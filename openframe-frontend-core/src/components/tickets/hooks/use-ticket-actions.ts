'use client'

/**
 * All 5 ticket write actions funnel through one helper:
 * `executeTicketAction()`, which POSTs to `/api/chat/agent/ticket-action`
 * — a single-roundtrip endpoint that runs the SAME `ChatToolHandler.execute`
 * the chat agent's `confirm-tool` route uses (same ACL re-bind, same audit
 * row, same HubSpot REST call). The only difference is REST shape: the
 * chat path needs `propose → confirm-tool` because the LLM emits a
 * `tool_use` the user must approve in a proposal card. The /tickets form
 * has no approval step (the user already clicked "Open ticket" / "Send"),
 * so the two-step is pure overhead — we collapse to one POST + JSON.
 *
 * Reuses every existing piece:
 *   - `embedAuthedFetch` for the bearer/act-as headers (same auth as chat).
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
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import type { ChatAttachment } from '../../chat/utils/chat-attachment-markdown'
import {
  type AnyTicket,
  type MappedTicketActionError,
  type OptimisticTicket,
  type TicketActionErrorCode,
  type TicketData,
  type TicketsCacheSlot,
  TOAST_COPY,
} from '../types'

const TICKET_ACTION_ENDPOINT = '/api/chat/agent/ticket-action'

/** Codes that populate the inline reply-failure banner above the drawer
 *  composer. Other codes (system-down, ticket-gone, rate-limit) are
 *  full-row / full-system signals covered by the toast + supportSystemDown
 *  handling — surfacing them in the inline banner too would be redundant. */
const REPLY_BANNER_CODES: ReadonlySet<TicketActionErrorCode> = new Set<TicketActionErrorCode>([
  'HUBSPOT_5XX',
  'HUBSPOT_400_VALIDATION',
  'HUBSPOT_404_THREAD',
  'HUBSPOT_REPLY_UNKNOWN',
])

/** 3 attempts × backoff (cumulative ~21s wall-clock). After this we
 *  drop the optimistic row and ask the user to reload. */
const MIRROR_SYNC_BACKOFF_MS = [3_000, 6_000, 12_000] as const

type ToolName = 'create_ticket' | 'update_ticket'

/** Wire shape returned by the new `/api/chat/agent/ticket-action` endpoint.
 *  Flat — no decision-frame wrapping — because there's no LLM approval
 *  loop on the form path. Mirrors `ExecuteResult` from
 *  `chat-source-strategy.ts` plus `{ ok, ticket_id }` at the top so
 *  callers don't need to know about the underlying `id` field. */
interface TicketActionResponse {
  ok?: boolean
  ticket_id?: string
  status?: string | null
  mirror_synced?: boolean
  raw?: unknown
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

/**
 * Identity bundle used by every row action: the LOCAL mirror UUID
 * (drives the React-side mutex + optimistic cache removal) AND the
 * HubSpot ticket id (`external_id` — drives the server call, the only
 * id HubSpot REST recognizes). Decoupling these is mandatory: passing
 * the UUID to HubSpot gets you a 404 "Object not found. objectId are
 * usually numeric"; passing the external id to the React-side mutex
 * breaks per-row disable when the cache differs.
 */
export interface TicketRef {
  id: string
  external_id: string
}

export interface UseTicketActionsReturn {
  submitTicket: (input: SubmitTicketInput) => Promise<boolean>
  /** Single combined "reply" action — text + optional attachments
   *  delivered as ONE HubSpot Note engagement (one bubble in the
   *  timeline). Server creates a merged note when both are present. */
  sendMessage: (ticket: TicketRef, text: string, attachments: ChatAttachment[]) => Promise<boolean>
  closeTicket: (ticket: TicketRef, resolution?: string) => Promise<boolean>
  reopenTicket: (ticket: TicketRef) => Promise<boolean>
  /** `true` while the form-level submit is in flight. */
  isSubmittingForm: boolean
  /** Per-row in-flight set (read-only). UI uses `isRowBusy(localId)`. */
  isRowBusy: (localId: string) => boolean
  /** Most recent reply failure for a given ticket id (`external_id`).
   *  Drives the inline "couldn't send" banner above the composer in
   *  `<TicketDetailDrawer>`. Cleared on the next successful send OR
   *  via `clearReplyError(ticketId)`. */
  replyErrorFor: (ticketExternalId: string) => MappedTicketActionError | null
  /** Clear the persisted reply-failure banner for a ticket (e.g. when
   *  the user dismisses it or starts a new draft). */
  clearReplyError: (ticketExternalId: string) => void
}

export function useTicketActions(options: UseTicketActionsOptions): UseTicketActionsReturn {
  const queryClient = useQueryClient()
  // Endpoint from the runtime config (like every other endpoint); falls back to
  // the bare hub path when unconfigured.
  const ticketActionEndpoint =
    useRequiredChatRuntime().endpoints.ticketActionUrl ?? TICKET_ACTION_ENDPOINT
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

  // Persisted reply-failure banner state — keyed by the ticket's
  // HubSpot `external_id`. The drawer reads `replyErrorFor(externalId)`
  // and renders an inline "couldn't send — retry" banner above the
  // composer. Cleared automatically on the next successful send and
  // explicitly by the dismiss-X / "Retry" actions in the banner UI.
  // Distinct from the transient toast — the banner persists so the
  // user can locate their failed draft after dismissing the toast.
  const [replyErrorByTicket, setReplyErrorByTicket] = useState<
    Map<string, MappedTicketActionError>
  >(() => new Map())
  const setReplyError = useCallback(
    (externalId: string, mapped: MappedTicketActionError | null) => {
      setReplyErrorByTicket((prev) => {
        const next = new Map(prev)
        if (mapped) next.set(externalId, mapped)
        else next.delete(externalId)
        return next
      })
    },
    [],
  )
  const replyErrorFor = useCallback(
    (externalId: string): MappedTicketActionError | null =>
      replyErrorByTicket.get(externalId) ?? null,
    [replyErrorByTicket],
  )
  const clearReplyError = useCallback(
    (externalId: string) => setReplyError(externalId, null),
    [setReplyError],
  )

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

  const executeTicketAction = useCallback(
    async (toolName: ToolName, args: Record<string, unknown>): Promise<TicketActionResponse> => {
      const res = await embedAuthedFetch(ticketActionEndpoint, {
        method: 'POST',
        body: JSON.stringify({ tool_name: toolName, args }),
      })
      // Server returns JSON for both success and failure — no SSE on this
      // route. Parse once, branch on `res.ok`.
      const body = (await res.json().catch(() => ({}))) as TicketActionResponse
      if (!res.ok) {
        const code = resolveErrorCode(body.code, res.status)
        const message = body.error || `${toolName} failed (${res.status})`
        throw new TicketActionFailure(code, message, res)
      }
      return body
    },
    [ticketActionEndpoint],
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

  // Last `surfaceError` mapping — sendMessage reads this immediately
  // after the catch returns so it can decide whether to populate the
  // inline reply banner. Cleared on every read by the consumer to
  // prevent a stale failure from leaking into the next attempt.
  const lastUpdateErrorRef = useRef<MappedTicketActionError | null>(null)
  const surfaceError = useCallback(
    (err: unknown, action: string): MappedTicketActionError => {
      const mapped = mapTicketActionError(err)
      lastUpdateErrorRef.current = mapped
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
        preview: input.content.trim().slice(0, 400),
        body: input.content.trim(),
        status: 'OPEN',
        pipeline_stage_label: 'New',
        clickup_task_id: null,
        clickup: null,
        priority: null,
        customer_emails: [],
        customer_company: null,
        // Optimistic placeholder has no resolved HubSpot contact yet
        // — the real ticket row replaces this within a couple of
        // seconds via the mirror refetch. Drawer uses live chat
        // identity for own-replies during this window anyway.
        customer_name: null,
        // No assignee until the real ticket lands. Drawer renders
        // "Unassigned" for this brief window.
        assigned_to: null,
        assignedOwner: null,
        hubspot_updated_at: new Date().toISOString(),
        _optimistic: true,
      }
      prependOptimistic(placeholder)
      try {
        return await enqueue(async () => {
          const result = await executeTicketAction('create_ticket', {
            subject: input.subject.trim(),
            content: input.content.trim(),
            ...(input.attachments?.length ? { attachments: input.attachments } : {}),
          })
          if (result.mirror_synced === false) {
            toast(TOAST_COPY.open_mirror_pending)
            watchMirrorSync(placeholderId, result.ticket_id)
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
      executeTicketAction,
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
      ticket: TicketRef,
      serverArgs: Omit<UpdateTicketArgs, 'ticket_id'>,
      successCopy: { title: string; description?: string },
      action: string,
    ): Promise<boolean> => {
      // Mutex keyed on the LOCAL mirror id (stable across the React tree
      // + matches the cache row's `id` for optimistic removal). Server
      // arg uses `external_id` — HubSpot's only-numeric ticket id.
      if (busyRowsRef.current.has(ticket.id)) return false
      setRowBusy(ticket.id, true)
      try {
        return await enqueue(async () => {
          await executeTicketAction('update_ticket', {
            ...serverArgs,
            ticket_id: ticket.external_id,
          } as unknown as Record<string, unknown>)
          toast(successCopy)

          // OPTIMISTIC in-place row update on the tickets cache.
          //
          // Previously this code called
          // `queryClient.invalidateQueries({ queryKey: ['tickets'] })`
          // which forced a full refetch. When the user is on a
          // filtered view (e.g. ?status=open) and CLOSES a ticket from
          // its drawer, the refetched list excludes the now-closed
          // row, the parent `<HelpCenterCard>` for that row unmounts,
          // and the inline drawer dies with it — user-facing bug
          // "close button refreshes the whole page and dismisses the
          // ticket I was working on" (reported 2026-05-29).
          //
          // The mutation already knows what changed (status, content
          // addendum, attachments) — apply those fields in place
          // across every `['tickets']` cache slot. The row stays in
          // the list with the new badge; React doesn't reconcile away
          // the card; the drawer stays mounted and the user can
          // continue working.
          //
          // Filter-mismatch trade-off: a row that no longer matches a
          // slot's filter (e.g. CLOSED row in ?status=open cache)
          // stays visually until next manual refetch (filter change,
          // page nav, manual reload). Acceptable — the user opted into
          // the action; carrying their drawer through it is more
          // important than instantly hiding the row.
          const statusUpdate =
            (serverArgs as { status?: 'OPEN' | 'CLOSED' }).status ?? null
          if (statusUpdate) {
            // The `useTicketsList` query (in `use-tickets-list.ts`)
            // returns `FindTicketResponse` — an OBJECT shape
            // `{ tickets: TicketData[], count, page, totalPages, ... }` —
            // NOT a bare `TicketData[]`. The previous version of this
            // callback assumed an array and crashed at runtime with
            // `t.map is not a function` on every close/reopen
            // (reported 2026-05-29 in prod). Project the nested
            // tickets array, map, and reassemble the wrapper.
            queryClient.setQueriesData<TicketsCacheSlot | undefined>(
              { queryKey: ['tickets'] },
              (prev) => {
                if (!prev || !Array.isArray(prev.tickets)) return prev
                let mutated = false
                const nextTickets = prev.tickets.map((t) => {
                  if (t.id !== ticket.id || t.status === statusUpdate) return t
                  mutated = true
                  return { ...t, status: statusUpdate }
                })
                return mutated ? { ...prev, tickets: nextTickets } : prev
              },
            )
          }

          // Engagements ALWAYS need to refetch — the addendum / new
          // attachment / status-change-note must land in the timeline.
          // Scoped to the engagements query only; doesn't touch the
          // list cache.
          await queryClient.invalidateQueries({ queryKey: ['ticket-engagements'] })
          return true
        })
      } catch (err) {
        const mapped = surfaceError(err, action)
        if (mapped.removeRowFromCache) {
          removeTicketFromCache(ticket.id)
        }
        return false
      } finally {
        setRowBusy(ticket.id, false)
      }
    },
    // `busyRowsRef` is read via .current — needs no dep entry. `busyRows`
    // state isn't read inside this callback (only by `isRowBusy` selector
    // outside), so listing it would churn the closure on every flag flip
    // and cascade-recreate addNote/closeTicket/etc.
    [setRowBusy, enqueue, executeTicketAction, queryClient, toast, surfaceError, removeTicketFromCache],
  )

  const sendMessage = useCallback(
    async (ticket: TicketRef, text: string, attachments: ChatAttachment[]) => {
      const trimmed = text.trim()
      const hasText = trimmed.length > 0
      const hasFiles = attachments.length > 0
      if (!hasText && !hasFiles) return false
      // Clear any stale mapped error from a prior non-sendMessage action
      // (closeTicket / reopenTicket) so the post-call read only picks up
      // an error THIS sendMessage produced. Without this clear, a prior
      // close-failure's mapped error could leak into the banner via the
      // post-call `lastUpdateErrorRef.current` read.
      lastUpdateErrorRef.current = null
      const ok = await updateTicket(
        ticket,
        {
          ...(hasText ? { content_addendum: trimmed } : {}),
          ...(hasFiles ? { attachments } : {}),
        },
        TOAST_COPY.comment_success,
        'send message',
      )
      // Banner-state coupling: SUCCESS clears any stale failure banner
      // for this ticket; FAILURE populates the banner ONLY for the
      // reply-specific code subset (HUBSPOT_5XX / 400 / 404 / UNKNOWN).
      // Other codes (TICKET_NOT_FOUND, HUBSPOT_DISCONNECTED, RATE_LIMITED)
      // are full-row / full-system signals already covered by the
      // existing toast + supportSystemDown handling — surfacing them in
      // the inline banner too would be redundant.
      if (ok) {
        clearReplyError(ticket.external_id)
      } else {
        // Line 466's `.current = null` narrows the property to literal
        // `null`. `tsc -p tsconfig.declarations.json` (declarations
        // build, distinct from the `tsc --noEmit` pre-step) doesn't
        // widen that narrowing across the `await updateTicket(...)`,
        // so the read here is typed `never`. The runtime type IS
        // `MappedTicketActionError | null` per the useRef declaration;
        // the assertion just tells TS to honor it instead of the stale
        // narrowing.
        const mapped = lastUpdateErrorRef.current as MappedTicketActionError | null
        if (mapped && REPLY_BANNER_CODES.has(mapped.code)) {
          setReplyError(ticket.external_id, mapped)
        }
        lastUpdateErrorRef.current = null
      }
      return ok
    },
    [updateTicket, clearReplyError, setReplyError],
  )

  const closeTicket = useCallback(
    (ticket: TicketRef, resolution?: string) =>
      updateTicket(
        ticket,
        {
          status: 'CLOSED',
          ...(resolution?.trim() ? { resolution: resolution.trim() } : {}),
        },
        TOAST_COPY.close_success,
        'close ticket',
      ),
    [updateTicket],
  )

  const reopenTicket = useCallback(
    (ticket: TicketRef) =>
      updateTicket(ticket, { status: 'OPEN' }, TOAST_COPY.reopen_success, 'reopen ticket'),
    [updateTicket],
  )

  return useMemo<UseTicketActionsReturn>(
    () => ({
      submitTicket,
      sendMessage,
      closeTicket,
      reopenTicket,
      isSubmittingForm,
      isRowBusy,
      replyErrorFor,
      clearReplyError,
    }),
    [
      submitTicket,
      sendMessage,
      closeTicket,
      reopenTicket,
      isSubmittingForm,
      isRowBusy,
      replyErrorFor,
      clearReplyError,
    ],
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
      case 'HUBSPOT_5XX':
        return {
          code: err.code,
          message:
            "We couldn't reach the support system. Your reply wasn't sent — please retry in a moment.",
          supportSystemDown: false,
          removeRowFromCache: false,
        }
      case 'HUBSPOT_400_VALIDATION':
        return {
          code: err.code,
          message:
            'Your reply was rejected. Please rephrase or remove unsupported content and try again.',
          supportSystemDown: false,
          removeRowFromCache: false,
        }
      case 'HUBSPOT_404_THREAD':
        return {
          code: err.code,
          message:
            'This conversation is no longer accepting replies. Open a new ticket to continue.',
          supportSystemDown: false,
          removeRowFromCache: false,
        }
      case 'HUBSPOT_REPLY_UNKNOWN':
        return {
          code: err.code,
          message:
            "Your reply didn't go through. Please retry.",
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

/** True iff any ['tickets', …] cache slot contains a ticket whose
 *  HubSpot id (external_id) matches the target. Used by the mirror-sync
 *  watcher to detect "the real row just arrived" and drop the placeholder
 *  early instead of waiting for the 30s timeout. */
function cacheContainsTicket(
  queryClient: ReturnType<typeof useQueryClient>,
  expectedTicketId: string,
): boolean {
  // Cache slot is `TicketsCacheSlot` (`{ tickets, count, … }`), NOT a
  // bare `TicketData[]`. The previous code's `Array.isArray(data)` guard
  // silently fell through to `return false` on real responses — the
  // post-create watcher therefore NEVER detected the real row arriving
  // early and always waited the full timeout. Project the nested array.
  const entries = queryClient.getQueriesData<TicketsCacheSlot | undefined>({
    queryKey: ['tickets'],
  })
  for (const [, data] of entries) {
    if (
      data &&
      Array.isArray(data.tickets) &&
      data.tickets.some((t) => t.external_id === expectedTicketId)
    ) {
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
