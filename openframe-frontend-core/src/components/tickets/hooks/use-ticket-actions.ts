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

import { useCallback, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import { readLeadingDecisionFrame, type DecisionResolvedFrame } from '../../../utils/sse-decision-frame'
import type { ChatAttachment } from '../../chat/utils/chat-attachment-markdown'
import {
  type AnyTicket,
  type MappedTicketActionError,
  type OptimisticTicket,
  type TicketActionErrorCode,
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

  const [isSubmittingForm, setIsSubmittingForm] = useState(false)
  // Per-row mutex. Held as a ref to keep the public `isRowBusy` callback
  // stable while still re-rendering when the Set changes.
  const [busyRows, setBusyRows] = useState<Set<string>>(() => new Set())
  const setRowBusy = useCallback((id: string, busy: boolean) => {
    setBusyRows((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])
  const isRowBusy = useCallback((id: string) => busyRows.has(id), [busyRows])

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

  // ─── Core helper ────────────────────────────────────────────────
  const proposeAndConfirm = useCallback(
    async (toolName: ToolName, args: Record<string, unknown>): Promise<DecisionResolvedFrame> => {
      const proposeRes = await embedAuthedFetch(PROPOSE_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ tool_name: toolName, args }),
      })
      if (!proposeRes.ok) {
        const body = (await proposeRes.json().catch(() => ({}))) as ProposeResponse
        const code = (body.code || 'UNKNOWN') as TicketActionErrorCode
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
        const code = (body.code || 'UNKNOWN') as TicketActionErrorCode
        const message = body.error || `confirm-tool failed (${confirmRes.status})`
        throw new TicketActionFailure(code, message, confirmRes)
      }
      return await readLeadingDecisionFrame(confirmRes)
    },
    [],
  )

  // ─── Mirror-sync watcher ────────────────────────────────────────
  // Schedules backoff refetches when the server reports the post-create
  // mirror upsert failed. If the optimistic row is still present after
  // the last attempt, removes it and surfaces a recovery toast.
  const watchMirrorSync = useCallback(
    (placeholderId: string) => {
      const controller = new AbortController()
      const schedule = async () => {
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
        }
        // Last-resort cleanup — placeholder didn't get replaced.
        if (!controller.signal.aborted) {
          removeOptimistic(placeholderId)
          toast({
            title: "Couldn't confirm ticket",
            description: 'Try reloading to see the latest state.',
            variant: 'destructive',
          })
        }
      }
      void schedule()
      return controller
    },
    [queryClient, removeOptimistic, toast],
  )

  // ─── Error handling ─────────────────────────────────────────────
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

  // ─── Actions ────────────────────────────────────────────────────

  const submitTicket = useCallback(
    async (input: SubmitTicketInput): Promise<boolean> => {
      if (isSubmittingForm) return false
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
            watchMirrorSync(placeholderId)
          } else {
            toast(TOAST_COPY.open_success)
            removeOptimistic(placeholderId)
            await queryClient.invalidateQueries({ queryKey: ['tickets'] })
          }
          return true
        })
      } catch (err) {
        removeOptimistic(placeholderId)
        surfaceError(err, 'open ticket')
        return false
      } finally {
        setIsSubmittingForm(false)
      }
    },
    [
      isSubmittingForm,
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
      if (busyRows.has(args.ticket_id)) return false
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
    [busyRows, setRowBusy, enqueue, proposeAndConfirm, queryClient, toast, surfaceError, removeTicketFromCache],
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

// ─── Error types + mapper ─────────────────────────────────────────

class TicketActionFailure extends Error {
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

// Re-export so callers can narrow the type when needed.
export type { AnyTicket, OptimisticTicket }
