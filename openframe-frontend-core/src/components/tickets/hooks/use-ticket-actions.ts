'use client'

/**
 * All 5 ticket write actions funnel through one helper:
 * `proposeAndConfirm()`. The server-side chat-agent flow handles auth,
 * ACL re-bind, audit row, and HubSpot REST — we just chain
 * propose → confirm-tool with `messages: []` so the server's existing
 * phase-2 gate (confirm-tool/route.ts:569) structurally skips the
 * auto-continue prose.
 *
 * Reuses every existing piece:
 *   - `embedAuthedFetch` for the bearer/act-as headers (same auth as chat).
 *   - `readLeadingDecisionFrame` to drain the SSE leading frame.
 *   - TanStack-Query `invalidateQueries` for refetch.
 *
 * Single-flight + serialization:
 *   - Form-level `formInFlight` ref drops second submits while one is
 *     in flight.
 *   - Per-row `Set<ticket_id>` mutex prevents fan-out on the same row.
 *   - `mutationQueue` serializes ALL mutations through a depth=1 queue
 *     so 10× "Close" doesn't stampede the server's auth-write 60/min
 *     rate-limit.
 *
 * Mirror-sync retry: on `result.mirror_synced === false`, the helper
 * schedules 3s/6s/12s refetches (30s wall-clock cap). If the placeholder
 * is still present after the last attempt, it's removed and the parent
 * surfaces an inline "Couldn't confirm — Reload" affordance.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import { readLeadingDecisionFrame, type DecisionResolvedFrame } from '../../../utils/sse-decision-frame'
import type { ChatAttachment } from '../../chat/utils/chat-attachment-markdown'
import {
  type AnyTicket,
  type MappedTicketActionError,
  type OptimisticTicket,
  type TicketActionErrorCode,
  type TicketData,
  TOAST_COPY,
} from '../types'

const PROPOSE_ENDPOINT = '/api/chat/agent/propose'
const CONFIRM_TOOL_ENDPOINT = '/api/chat/agent/confirm-tool'

/** 3 attempts × backoff (cumulative ~21s wall-clock). After this we
 *  drop the optimistic row and ask the user to reload. */
const MIRROR_SYNC_BACKOFF_MS = [3_000, 6_000, 12_000] as const

type ToolName = 'create_ticket' | 'update_ticket'

interface ProposeResponse {
  proposal_id?: string
  error?: string
  code?: string
}

interface SubmitTicketInput {
  subject: string
  content: string
  attachments?: ChatAttachment[]
}

interface UpdateTicketArgs {
  ticket_id: string
  status?: 'OPEN' | 'CLOSED'
  content_addendum?: string
  resolution?: string
  attachments?: ChatAttachment[]
}

export interface UseTicketActionsOptions {
  /** Called when the parent should prepend an optimistic placeholder
   *  to the local cache. Implementer mutates the QueryClient cache
   *  directly so the row appears before the server roundtrip. */
  prependOptimistic: (placeholder: OptimisticTicket) => void
  /** Called when the optimistic placeholder should be removed
   *  (mirror-sync failure, or replacement after real ticket arrives). */
  removeOptimistic: (placeholderId: string) => void
  /** Called when a ticket should be removed from the cache without
   *  a refetch (TICKET_NOT_FOUND). */
  removeTicketFromCache: (ticketId: string) => void
  /** Toast helper from `@flamingo-stack/openframe-frontend-core/hooks`.
   *  Passed in so the lib doesn't import the toast singleton itself
   *  (test-friendly). */
  toast: (input: { title: string; description?: string; variant?: 'success' | 'destructive' | 'default' }) => void
  /** Called when a 412 HUBSPOT_DISCONNECTED arrives so the parent can
   *  flip its `supportSystemDown` flag. */
  onSupportSystemDown: () => void
}

export interface UseTicketActionsReturn {
  submitTicket: (input: SubmitTicketInput) => Promise<boolean>
  addNote: (ticketId: string, content: string) => Promise<boolean>
  attachFiles: (ticketId: string, attachments: ChatAttachment[]) => Promise<boolean>
  closeTicket: (ticketId: string, resolution?: string) => Promise<boolean>
  reopenTicket: (ticketId: string) => Promise<boolean>
  /** `true` while the form-level submit is in flight. */
  isSubmittingForm: boolean
  /** Per-row in-flight set (read-only). UI uses `isRowBusy(id)`. */
  isRowBusy: (ticketId: string) => boolean
}

export function useTicketActions(options: UseTicketActionsOptions): UseTicketActionsReturn {
  const queryClient = useQueryClient()
  const { prependOptimistic, removeOptimistic, removeTicketFromCache, toast, onSupportSystemDown } = options

  // Form-level single-flight uses BOTH a ref (for synchronous guarding
  // inside `submitTicket`, since React state setters are async) and a
  // state mirror (for UI disable / loading prop). Two rapid clicks in
  // the same tick would otherwise both see state==false and fan out
  // duplicate propose calls.
  const formInFlightRef = useRef(false)
  const [isSubmittingForm, setIsSubmittingForm] = useState(false)

  // Per-row mutex — same split: ref for synchronous has/add/delete,
  // state for the `isRowBusy` selector that drives row disable.
  const busyRowsRef = useRef<Set<string>>(new Set())
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set())
  const setRowBusy = useCallback((id: string, busy: boolean) => {
    if (busy) busyRowsRef.current.add(id)
    else busyRowsRef.current.delete(id)
    // Mirror to state (new Set so React notices). Render-only side.
    setBusyRows(new Set(busyRowsRef.current))
  }, [])
  const isRowBusy = useCallback((id: string) => busyRows.has(id), [busyRows])

  // Mirror-sync watcher controllers tracked by placeholder id so we can
  // abort prior watchers when a new submit lands AND so unmount cleans
  // them up without leaking setState calls. Single source of truth for
  // active watchers — never duplicate-schedule.
  const watcherControllersRef = useRef<Map<string, AbortController>>(new Map())
  useEffect(() => {
    return () => {
      // Component unmount — abort every live watcher so setState calls
      // inside the scheduler don't fire on an unmounted component.
      for (const controller of watcherControllersRef.current.values()) {
        controller.abort()
      }
      watcherControllersRef.current.clear()
    }
  }, [])

  // Single-flight queue (depth=1). Subsequent calls await the prior
  // promise. Local backoff timers and SSE drains run inside the queued
  // closure so the second user click waits for the first to fully
  // resolve before issuing its own propose call. This is the
  // server-stampede defense.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const next = queueRef.current.then(work, work)
    // Swallow rejection from the prior step so a single failure doesn't
    // poison every subsequent enqueue.
    queueRef.current = next.catch(() => undefined)
    return next
  }, [])

  const proposeAndConfirm = useCallback(
    async (toolName: ToolName, args: Record<string, unknown>): Promise<DecisionResolvedFrame> => {
      const proposeRes = await embedAuthedFetch(PROPOSE_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ tool_name: toolName, args }),
      })
      if (!proposeRes.ok) {
        const body = (await proposeRes.json().catch(() => ({}))) as ProposeResponse
        const code = resolveErrorCode(body.code, proposeRes.status)
        const message = body.error || `propose ${toolName} failed (${proposeRes.status})`
        throw new TicketActionFailure(code, message, proposeRes)
      }
      const proposeBody = (await proposeRes.json()) as ProposeResponse
      const proposalId = proposeBody.proposal_id
      if (!proposalId) {
        throw new TicketActionFailure('UNKNOWN', 'propose returned no proposal_id')
      }

      const confirmRes = await embedAuthedFetch(CONFIRM_TOOL_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({
          proposal_id: proposalId,
          action: 'approve',
          // messages:[] makes phase-2 unreachable server-side. See
          // §A-1 of the plan; the gate is at confirm-tool/route.ts:569.
          messages: [],
        }),
      })
      if (!confirmRes.ok) {
        // confirm-tool returns JSON on error, SSE on success.
        const body = (await confirmRes.json().catch(() => ({}))) as ProposeResponse
        const code = resolveErrorCode(body.code, confirmRes.status)
        const message = body.error || `confirm-tool failed (${confirmRes.status})`
        throw new TicketActionFailure(code, message, confirmRes)
      }
      return await readLeadingDecisionFrame(confirmRes)
    },
    [],
  )

  // Mirror-sync watcher — backoff refetches when the post-create mirror
  // upsert fails. Tracked in `watcherControllersRef` so unmount aborts
  // every live scheduler and a duplicate submit for the same placeholder
  // replaces the prior controller cleanly (no orphaned schedulers).
  //
  // `expectedTicketId` is the external_id the server returned from
  // create_ticket. After each invalidation refetch lands, if any cache
  // slot now contains a ticket with that id, the placeholder is dropped
  // immediately — preventing the duplicate-row window where placeholder
  // + real row both render until the 30s cap fires.
  const watchMirrorSync = useCallback(
    (placeholderId: string, expectedTicketId: string | undefined) => {
      const prior = watcherControllersRef.current.get(placeholderId)
      if (prior) prior.abort()
      const controller = new AbortController()
      watcherControllersRef.current.set(placeholderId, controller)
      const schedule = async () => {
        try {
          for (let i = 0; i < MIRROR_SYNC_BACKOFF_MS.length; i++) {
            if (controller.signal.aborted) return
            await new Promise<void>((resolve) => {
              const t = setTimeout(resolve, MIRROR_SYNC_BACKOFF_MS[i])
              controller.signal.addEventListener(
                'abort',
                () => {
                  clearTimeout(t)
                  resolve()
                },
                { once: true },
              )
            })
            if (controller.signal.aborted) return
            await queryClient.invalidateQueries({ queryKey: ['tickets'] })
            // If the real ticket landed during this refetch, drop the
            // placeholder + stop scheduling — no duplicate-row window.
            if (expectedTicketId && cacheContainsTicket(queryClient, expectedTicketId)) {
              removeOptimistic(placeholderId)
              return
            }
          }
          // Last-resort cleanup — placeholder didn't get replaced.
          if (!controller.signal.aborted) {
            removeOptimistic(placeholderId)
            toast({
              title: "Couldn't confirm ticket",
              description: "If the ticket doesn't appear shortly, please contact support.",
              variant: 'destructive',
            })
          }
        } finally {
          // Self-deregister on natural completion or abort so the map
          // doesn't accrete dead controllers across many submits.
          if (watcherControllersRef.current.get(placeholderId) === controller) {
            watcherControllersRef.current.delete(placeholderId)
          }
        }
      }
      void schedule()
    },
    [queryClient, removeOptimistic, toast],
  )

  const surfaceError = useCallback(
    (err: unknown, action: string): MappedTicketActionError => {
      const mapped = mapTicketActionError(err)
      if (mapped.supportSystemDown) onSupportSystemDown()
      toast({
        title: `Could not ${action}`,
        description: mapped.message,
        variant: 'destructive',
      })
      return mapped
    },
    [toast, onSupportSystemDown],
  )

  const submitTicket = useCallback(
    async (input: SubmitTicketInput): Promise<boolean> => {
      // Synchronous ref guard — closes the same-tick double-click race
      // that the state-only guard couldn't (setIsSubmittingForm is async).
      if (formInFlightRef.current) return false
      formInFlightRef.current = true
      setIsSubmittingForm(true)
      const placeholderId = `temp-${cryptoRandomId()}`
      const placeholder: OptimisticTicket = {
        id: placeholderId,
        external_id: 'Pending sync…',
        subject: input.subject.trim(),
        content: input.content.trim(),
        status: 'OPEN',
        pipeline_stage_label: 'New',
        clickup_task_id: null,
        priority: null,
        customer_emails: [],
        customer_company: null,
        hubspot_updated_at: new Date().toISOString(),
        _optimistic: true,
      }
      prependOptimistic(placeholder)
      try {
        return await enqueue(async () => {
          const frame = await proposeAndConfirm('create_ticket', {
            subject: input.subject.trim(),
            content: input.content.trim(),
            ...(input.attachments?.length ? { attachments: input.attachments } : {}),
          })
          if (frame.result?.mirror_synced === false) {
            toast(TOAST_COPY.open_mirror_pending)
            watchMirrorSync(placeholderId, frame.result?.ticket_id)
          } else {
            toast(TOAST_COPY.open_success)
            // Invalidate FIRST so the refetch lands before the
            // placeholder is removed — prevents a one-tick flash of
            // EmptyState when the prior cache was empty.
            await queryClient.invalidateQueries({ queryKey: ['tickets'] })
            removeOptimistic(placeholderId)
          }
          return true
        })
      } catch (err) {
        removeOptimistic(placeholderId)
        surfaceError(err, 'open ticket')
        return false
      } finally {
        formInFlightRef.current = false
        setIsSubmittingForm(false)
      }
    },
    [
      enqueue,
      proposeAndConfirm,
      prependOptimistic,
      removeOptimistic,
      queryClient,
      toast,
      watchMirrorSync,
      surfaceError,
    ],
  )

  const updateTicket = useCallback(
    async (
      args: UpdateTicketArgs,
      successCopy: { title: string; description?: string },
      action: string,
    ): Promise<boolean> => {
      // Synchronous ref guard for per-row double-click defense.
      if (busyRowsRef.current.has(args.ticket_id)) return false
      setRowBusy(args.ticket_id, true)
      try {
        return await enqueue(async () => {
          await proposeAndConfirm('update_ticket', args as unknown as Record<string, unknown>)
          toast(successCopy)
          await queryClient.invalidateQueries({ queryKey: ['tickets'] })
          return true
        })
      } catch (err) {
        const mapped = surfaceError(err, action)
        if (mapped.removeRowFromCache) {
          removeTicketFromCache(args.ticket_id)
        }
        return false
      } finally {
        setRowBusy(args.ticket_id, false)
      }
    },
    // `busyRowsRef` is read via .current — needs no dep entry. `busyRows`
    // state isn't read inside this callback (only by `isRowBusy` selector
    // outside), so listing it would churn the closure on every flag flip
    // and cascade-recreate addNote/closeTicket/etc.
    [setRowBusy, enqueue, proposeAndConfirm, queryClient, toast, surfaceError, removeTicketFromCache],
  )

  const addNote = useCallback(
    (ticketId: string, content: string) =>
      updateTicket({ ticket_id: ticketId, content_addendum: content.trim() }, TOAST_COPY.comment_success, 'add comment'),
    [updateTicket],
  )

  const attachFiles = useCallback(
    (ticketId: string, attachments: ChatAttachment[]) =>
      updateTicket({ ticket_id: ticketId, attachments }, TOAST_COPY.attach_success, 'attach files'),
    [updateTicket],
  )

  const closeTicket = useCallback(
    (ticketId: string, resolution?: string) =>
      updateTicket(
        {
          ticket_id: ticketId,
          status: 'CLOSED',
          ...(resolution?.trim() ? { resolution: resolution.trim() } : {}),
        },
        TOAST_COPY.close_success,
        'close ticket',
      ),
    [updateTicket],
  )

  const reopenTicket = useCallback(
    (ticketId: string) =>
      updateTicket({ ticket_id: ticketId, status: 'OPEN' }, TOAST_COPY.reopen_success, 'reopen ticket'),
    [updateTicket],
  )

  return useMemo<UseTicketActionsReturn>(
    () => ({
      submitTicket,
      addNote,
      attachFiles,
      closeTicket,
      reopenTicket,
      isSubmittingForm,
      isRowBusy,
    }),
    [submitTicket, addNote, attachFiles, closeTicket, reopenTicket, isSubmittingForm, isRowBusy],
  )
}

/** Exported so unit tests can construct an instance to exercise the
 *  per-code branches of `mapTicketActionError`. Not part of the public
 *  surface — kept out of `tickets/index.ts`. */
export class TicketActionFailure extends Error {
  code: TicketActionErrorCode
  response?: Response
  constructor(code: TicketActionErrorCode, message: string, response?: Response) {
    super(message)
    this.code = code
    this.response = response
  }
}

/**
 * Translate a server error envelope into user-facing copy. Exported so
 * a future chat refactor can adopt the same translation table.
 */
export function mapTicketActionError(err: unknown): MappedTicketActionError {
  if (err instanceof TicketActionFailure) {
    switch (err.code) {
      case 'PROPOSAL_NOT_CLAIMABLE':
        return {
          code: err.code,
          message: 'This action was already processed.',
          supportSystemDown: false,
          removeRowFromCache: false,
        }
      case 'TICKET_NOT_FOUND':
        return {
          code: err.code,
          message: 'This ticket is no longer available.',
          supportSystemDown: false,
          removeRowFromCache: true,
        }
      case 'TICKET_OWNERSHIP_DENIED':
        return {
          code: err.code,
          message: 'You can only act on tickets you opened.',
          supportSystemDown: false,
          removeRowFromCache: false,
        }
      case 'HUBSPOT_DISCONNECTED':
        return {
          code: err.code,
          message: 'Support system temporarily unavailable.',
          supportSystemDown: true,
          removeRowFromCache: false,
        }
      case 'RATE_LIMITED': {
        const retryAfterRaw = err.response?.headers.get('Retry-After')
        const retryAfterSeconds = retryAfterRaw ? parseInt(retryAfterRaw, 10) : undefined
        return {
          code: err.code,
          message: retryAfterSeconds
            ? `Too many actions. Try again in ${retryAfterSeconds}s.`
            : 'Too many actions. Try again shortly.',
          supportSystemDown: false,
          removeRowFromCache: false,
          ...(retryAfterSeconds ? { retryAfterSeconds } : {}),
        }
      }
      case 'INVALID_TOOL_ARGS':
        return {
          code: err.code,
          message: 'Your input was rejected. Please review and try again.',
          supportSystemDown: false,
          removeRowFromCache: false,
        }
      default:
        return {
          code: 'UNKNOWN',
          message: err.message || 'Something went wrong. Please try again.',
          supportSystemDown: false,
          removeRowFromCache: false,
        }
    }
  }
  // SSE decoder errors leak internal protocol details ("expected
  // decision_resolved, got X") that aren't useful to users. Map them
  // to a generic readable-server-response message.
  if (err instanceof Error && err.message.startsWith('readLeadingDecisionFrame:')) {
    return {
      code: 'UNKNOWN',
      message: "Couldn't read the server response. Please try again.",
      supportSystemDown: false,
      removeRowFromCache: false,
    }
  }
  return {
    code: 'UNKNOWN',
    message: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
    supportSystemDown: false,
    removeRowFromCache: false,
  }
}

/** Small id generator that doesn't require pulling in nanoid as a new
 *  dep. Sufficient for client-only optimistic ids. */
function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** True iff any ['tickets', …] cache slot contains a ticket whose
 *  HubSpot id (external_id) matches the target. Used by the mirror-sync
 *  watcher to detect "the real row just arrived" and drop the placeholder
 *  early instead of waiting for the 30s timeout. */
function cacheContainsTicket(
  queryClient: ReturnType<typeof useQueryClient>,
  expectedTicketId: string,
): boolean {
  const entries = queryClient.getQueriesData<TicketData[] | undefined>({ queryKey: ['tickets'] })
  for (const [, data] of entries) {
    if (Array.isArray(data) && data.some((t) => t.external_id === expectedTicketId)) {
      return true
    }
  }
  return false
}

/** Resolve the canonical error code from the server's body + HTTP status.
 *  Body code wins when present; status-derived code is the fallback so a
 *  bare 429/412 (no body code) still maps cleanly through the user-facing
 *  branches. */
function resolveErrorCode(
  bodyCode: string | undefined,
  status: number,
): TicketActionErrorCode {
  if (bodyCode) return bodyCode as TicketActionErrorCode
  if (status === 429) return 'RATE_LIMITED'
  if (status === 412) return 'HUBSPOT_DISCONNECTED'
  return 'UNKNOWN'
}

// Re-export so callers can narrow the type when needed.
export type { AnyTicket, OptimisticTicket }
