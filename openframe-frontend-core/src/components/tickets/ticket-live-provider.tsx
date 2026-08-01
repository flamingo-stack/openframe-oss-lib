'use client'

/**
 * TicketLiveProvider — the ONE client home for support-ticket realtime.
 *
 * Owns:
 *   - the SSE subscription lifecycle (`createSseSubscription` over
 *     `ticketStreamUrl`), with `connected` derived from the SERVER's
 *     `status` frames (`subscribed` → true; `retrying`/`reconnect_failed`
 *     → false) — never from "the HTTP stream is open";
 *   - the unread summary — delivered EXCLUSIVELY by the stream
 *     (`ticket-summary` frames on connect + debounced after events) and
 *     by `ticket-read` responses. The client holds NO summary fetch
 *     path: resync-on-(re)connect is served by the SERVER (every
 *     connect pushes a fresh summary);
 *   - visibility gating: hidden → 45s grace → disconnect; visible →
 *     reconnect (which re-delivers the summary);
 *   - `markRead` with local write-through zeroing for 0-latency,
 *     reconciled by the response's server-computed summary.
 *
 * There is NO polling anywhere and NO summary endpoint. Hosts whose
 * stream endpoint 404s (terminal) or is absent get no unread indication
 * — the indication IS a realtime feature.
 *
 * Invalidation semantics on events — deliberately `invalidateQueries`,
 * NOT `setQueryData` patches: the ticket hooks run `gcTime: 0`, so
 * there is usually no cache entry to patch, and `TicketsCacheSlot`
 * shape rules apply when there is.
 */

import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import { embedAuthedFetch } from '../../utils/embed-authed-fetch'
import {
  createSseSubscription,
  type SseSubscription,
  type SseTransportStatus,
} from '../../utils/sse-subscription'
import { useChatIdentity } from '../chat/hooks/use-chat-identity'
import type {
  TicketMessageStreamData,
  TicketStreamEvent,
  TicketUnreadSummary,
} from './types'

const TICKET_STREAM_ENDPOINT = '/api/chat/agent/ticket-stream'
const TICKET_READ_ENDPOINT = '/api/chat/agent/ticket-read'

const EMPTY_SUMMARY: TicketUnreadSummary = { totalUnread: 0, tickets: {}, latestUnreadAt: {} }

/** Trailing debounce for event-burst invalidations (an agent pasting 5
 *  messages must not fire 5 list refetches). */
const INVALIDATE_DEBOUNCE_MS = 1_500
/** Grace before disconnecting a hidden tab (Cmd-Tab thrash protection). */
const HIDDEN_DISCONNECT_GRACE_MS = 45_000
/** No `status: subscribed` within this window after transport-open →
 *  treat as disconnected and force a client-side reconnect. */
const SUBSCRIBE_CONFIRM_TIMEOUT_MS = 15_000
/** After a server-reported `reconnect_failed`, the next client attempt
 *  starts at the CAPPED delay — each reconnect costs a full server
 *  invocation + the server's own Realtime retries; an outage must not
 *  become a stampede. */
const FAILED_RECONNECT_DELAY_MS = 30_000
/** A server `retrying` status means the server is recovering the channel
 *  itself (exponential backoff, ~5 attempts). Give it this long to reach
 *  `subscribed` before the client hard-reconnects. */
const SERVER_RETRY_GRACE_MS = 90_000

export interface TicketLiveContextValue {
  /** Viewer has a resolved, non-anon chat identity. Surfaces (e.g. the
   *  header cell) hide themselves when false — computed here so they
   *  don't each spin up their own identity resolution. */
  authed: boolean
  /** Realtime-subscribed (server-confirmed), not merely HTTP-open. */
  connected: boolean
  /** Unread total across tickets — drives the header count badge. */
  unreadTotal: number
  /** Per-ticket unread counts (missing key = 0) — drives row dots.
   *  The currently-open ticket is masked to 0. */
  unreadByTicket: Record<string, number>
  /** The ticket with the NEWEST unread reply (open ticket excluded) —
   *  the header cell routes to it via the SSOT deep link
   *  (`buildTicketOpenHref`). Null when nothing is unread. */
  nextUnreadTicketId: string | null
  /** Mark a ticket read: POSTs the receipt, zeroes the ticket locally
   *  (0-latency), then applies the response's server-computed summary. */
  markRead: (ticketExternalId: string) => Promise<void>
  /** Drawer open/close registration — suppresses unread bumps for the
   *  open ticket and masks it in the derived map. */
  setOpenTicketId: (ticketExternalId: string | null) => void
  /** Hint that the viewer just created a ticket — reconnects the stream
   *  (fresh ownership set + fresh server-pushed summary). */
  notifyTicketCreated: () => void
}

const TicketLiveContext = React.createContext<TicketLiveContextValue | null>(null)

export function useOptionalTicketLive(): TicketLiveContextValue | null {
  return React.useContext(TicketLiveContext)
}

export function useTicketLive(): TicketLiveContextValue {
  const ctx = React.useContext(TicketLiveContext)
  if (!ctx) {
    throw new Error('useTicketLive must be used within <TicketLiveProvider>')
  }
  return ctx
}

function isTicketMessageData(value: unknown): value is TicketMessageStreamData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TicketMessageStreamData).ticket_external_id === 'string'
  )
}

function isSummaryData(value: unknown): value is TicketUnreadSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TicketUnreadSummary).totalUnread === 'number' &&
    typeof (value as TicketUnreadSummary).tickets === 'object'
  )
}

export function TicketLiveProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime()
  const identity = useChatIdentity()
  const queryClient = useQueryClient()

  const streamUrl = runtime?.endpoints.ticketStreamUrl ?? TICKET_STREAM_ENDPOINT
  const readUrl = runtime?.endpoints.ticketReadUrl ?? TICKET_READ_ENDPOINT

  const authed = identity.authTier !== 'anon' && !!identity.user?.email

  const [connected, setConnected] = React.useState(false)
  // The SINGLE unread source — written ONLY from server-computed
  // summaries (stream frames + markRead responses) plus the two
  // 0-latency optimistic writes (event bump, markRead zero), both
  // reconciled by the next server summary.
  const [summary, setSummary] = React.useState<TicketUnreadSummary>(EMPTY_SUMMARY)
  // State + ref for the open drawer: state drives the derived map,
  // the ref lets stream callbacks read it without re-subscribing.
  const [openTicketIdState, setOpenTicketIdState] = React.useState<string | null>(null)
  const openTicketIdRef = React.useRef<string | null>(null)

  // ---- Debounced (trailing) invalidation of ticket queries on events ----
  const pendingTicketIdsRef = React.useRef<Set<string>>(new Set())
  const invalidateTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushInvalidations = React.useCallback(() => {
    invalidateTimerRef.current = null
    const ids = Array.from(pendingTicketIdsRef.current)
    pendingTicketIdsRef.current.clear()
    void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    for (const id of ids) {
      void queryClient.invalidateQueries({ queryKey: ['ticket-engagements', id] })
    }
  }, [queryClient])
  const scheduleInvalidation = React.useCallback(
    (ticketId?: string) => {
      if (ticketId) pendingTicketIdsRef.current.add(ticketId)
      if (invalidateTimerRef.current) return
      invalidateTimerRef.current = setTimeout(flushInvalidations, INVALIDATE_DEBOUNCE_MS)
    },
    [flushInvalidations],
  )

  // ---- Optimistic unread writes (reconciled by server summaries) ----
  const bumpUnread = React.useCallback((ticketId: string, createdAt?: string | null) => {
    setSummary((prev) => {
      const stamp = createdAt ?? new Date().toISOString()
      const existing = prev.latestUnreadAt[ticketId]
      return {
        totalUnread: prev.totalUnread + 1,
        tickets: { ...prev.tickets, [ticketId]: (prev.tickets[ticketId] ?? 0) + 1 },
        latestUnreadAt: {
          ...prev.latestUnreadAt,
          [ticketId]: existing && existing > stamp ? existing : stamp,
        },
      }
    })
  }, [])

  const zeroUnread = React.useCallback((ticketId: string) => {
    setSummary((prev) => {
      const current = prev.tickets[ticketId] ?? 0
      if (current === 0) return prev
      const tickets = { ...prev.tickets }
      delete tickets[ticketId]
      const latestUnreadAt = { ...prev.latestUnreadAt }
      delete latestUnreadAt[ticketId]
      return { totalUnread: Math.max(0, prev.totalUnread - current), tickets, latestUnreadAt }
    })
  }, [])

  // ---- Stream lifecycle ----
  const subscriptionRef = React.useRef<SseSubscription | null>(null)
  const noStreamRef = React.useRef(false)
  const subscribeConfirmTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverRecoveryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const failedReconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const hiddenGraceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) {
      clearTimeout(ref.current)
      ref.current = null
    }
  }

  // Stable handler refs so the subscription effect doesn't churn.
  const handlersRef = React.useRef<{
    onEvent: (eventName: string, data: unknown) => void
    onStatus: (status: SseTransportStatus) => void
  }>({ onEvent: () => {}, onStatus: () => {} })

  const hardReconnect = React.useCallback((delayMs: number) => {
    clearTimer(failedReconnectTimerRef)
    if (delayMs <= 0) {
      subscriptionRef.current?.reconnectNow()
      return
    }
    failedReconnectTimerRef.current = setTimeout(() => {
      failedReconnectTimerRef.current = null
      subscriptionRef.current?.reconnectNow()
    }, delayMs)
  }, [])

  handlersRef.current.onEvent = (eventName, data) => {
    if (eventName === 'status') {
      const status = (data as { status?: string } | null)?.status
      if (status === 'subscribed') {
        clearTimer(subscribeConfirmTimerRef)
        clearTimer(serverRecoveryTimerRef)
        setConnected(true)
        // Event-gap healing: the SERVER pushes a fresh summary on every
        // (re)connect; the open drawer refetches through the ACL'd path.
        const openId = openTicketIdRef.current
        if (openId) {
          void queryClient.invalidateQueries({ queryKey: ['ticket-engagements', openId] })
        }
      } else if (status === 'retrying') {
        // Server is recovering its Realtime channel itself — wait for it
        // (bounded), don't stampede with a client reconnect.
        setConnected(false)
        if (!serverRecoveryTimerRef.current) {
          serverRecoveryTimerRef.current = setTimeout(() => {
            serverRecoveryTimerRef.current = null
            hardReconnect(0)
          }, SERVER_RETRY_GRACE_MS)
        }
      } else if (status === 'reconnect_failed') {
        setConnected(false)
        clearTimer(serverRecoveryTimerRef)
        hardReconnect(FAILED_RECONNECT_DELAY_MS)
      }
      return
    }

    if (eventName === 'ticket-summary') {
      const frame = data as TicketStreamEvent | null
      if (isSummaryData(frame?.data)) {
        setSummary({
          totalUnread: frame.data.totalUnread,
          tickets: frame.data.tickets ?? {},
          latestUnreadAt: frame.data.latestUnreadAt ?? {},
        })
      }
      return
    }

    if (eventName === 'ticket-resync') {
      // Ownership gained / degraded payload — a fresh ticket-summary
      // frame follows from the server; refresh the query surfaces.
      scheduleInvalidation()
      return
    }

    if (eventName === 'ticket-status') {
      // Meaningful ticket-row change (close/reopen/pipeline move). The
      // server pushes an updated summary right after (closures count as
      // unread server-side); here we just refresh the query surfaces so
      // the status badge flips live.
      const frame = data as TicketStreamEvent | null
      const ticketId = (frame?.data as { ticket_external_id?: string } | undefined)
        ?.ticket_external_id
      scheduleInvalidation(ticketId)
      return
    }

    if (eventName === 'ticket-message') {
      const frame = data as TicketStreamEvent | null
      const payload = frame?.data
      if (!isTicketMessageData(payload)) {
        scheduleInvalidation()
        return
      }
      // Always invalidate (own replies from another tab render live);
      // bump unread ONLY on the server-stamped predicate, and never for
      // the ticket whose drawer is open. The server's debounced summary
      // push reconciles moments later.
      scheduleInvalidation(payload.ticket_external_id)
      if (payload.countsAsUnread && payload.ticket_external_id !== openTicketIdRef.current) {
        bumpUnread(payload.ticket_external_id, payload.hubspot_created_at)
      }
    }
  }

  handlersRef.current.onStatus = (status) => {
    if (status === 'open') {
      // Transport open ≠ connected. Require `status: subscribed` within
      // the confirm window or force a reconnect.
      noStreamRef.current = false
      clearTimer(subscribeConfirmTimerRef)
      subscribeConfirmTimerRef.current = setTimeout(() => {
        subscribeConfirmTimerRef.current = null
        setConnected(false)
        hardReconnect(0)
      }, SUBSCRIBE_CONFIRM_TIMEOUT_MS)
      return
    }
    if (status === 'no-stream') {
      // Zero owned tickets (204). Retried on create_ticket / visibility.
      noStreamRef.current = true
    }
    // Every non-'open' transport status means we are not subscribed.
    clearTimer(subscribeConfirmTimerRef)
    setConnected(false)
  }

  // Mount/unmount of the subscription — gated on auth + a usable URL.
  const streamEnabled = authed && !!streamUrl
  React.useEffect(() => {
    if (!streamEnabled) return
    if (typeof window === 'undefined') return

    const subscription = createSseSubscription({
      url: streamUrl,
      onEvent: (name, data) => handlersRef.current.onEvent(name, data),
      onStatusChange: (status) => handlersRef.current.onStatus(status),
    })
    subscriptionRef.current = subscription

    const retryIfIdle = () => {
      // After a 204 (no-stream) or while disconnected-hidden, a
      // visibility/focus/online signal is the retry trigger.
      if (noStreamRef.current) {
        noStreamRef.current = false
        subscriptionRef.current?.reconnectNow()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!hiddenGraceTimerRef.current) {
          hiddenGraceTimerRef.current = setTimeout(() => {
            hiddenGraceTimerRef.current = null
            // Scale relief: a hidden tab holds no server invocation.
            setConnected(false)
            subscriptionRef.current?.close()
            subscriptionRef.current = null
          }, HIDDEN_DISCONNECT_GRACE_MS)
        }
        return
      }
      // Visible again — cancel the grace, or recreate if already torn
      // down (the fresh connect delivers a fresh server summary).
      clearTimer(hiddenGraceTimerRef)
      if (!subscriptionRef.current) {
        subscriptionRef.current = createSseSubscription({
          url: streamUrl,
          onEvent: (name, data) => handlersRef.current.onEvent(name, data),
          onStatusChange: (status) => handlersRef.current.onStatus(status),
        })
      } else {
        retryIfIdle()
      }
    }

    const onOnline = () => {
      // Fresh connect → fresh server-pushed summary.
      subscriptionRef.current?.reconnectNow()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', retryIfIdle)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('focus', retryIfIdle)
      clearTimer(hiddenGraceTimerRef)
      clearTimer(subscribeConfirmTimerRef)
      clearTimer(serverRecoveryTimerRef)
      clearTimer(failedReconnectTimerRef)
      if (invalidateTimerRef.current) {
        clearTimeout(invalidateTimerRef.current)
        invalidateTimerRef.current = null
      }
      subscriptionRef.current?.close()
      subscriptionRef.current = null
      setConnected(false)
      setSummary(EMPTY_SUMMARY)
    }
    // handlersRef is stable; streamUrl/auth changes remount the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEnabled, streamUrl])

  // ---- Public API ----
  const markRead = React.useCallback(
    async (ticketExternalId: string) => {
      try {
        const response = await embedAuthedFetch(readUrl, {
          method: 'POST',
          body: JSON.stringify({ ticket_id: ticketExternalId }),
        })
        if (!response.ok) return
        // 0-latency local zero, then reconcile with the response's
        // server-computed summary (THE truth — includes closure
        // accounting and other tickets).
        zeroUnread(ticketExternalId)
        const body = (await response.json().catch(() => null)) as
          | { summary?: TicketUnreadSummary }
          | null
        if (isSummaryData(body?.summary)) {
          setSummary({
            totalUnread: body.summary.totalUnread,
            tickets: body.summary.tickets ?? {},
            latestUnreadAt: body.summary.latestUnreadAt ?? {},
          })
        }
      } catch {
        // Non-fatal — the receipt lands on the next markRead; unread
        // state reconciles via the next server summary push.
      }
    },
    [readUrl, zeroUnread],
  )

  const setOpenTicketId = React.useCallback((ticketExternalId: string | null) => {
    openTicketIdRef.current = ticketExternalId
    setOpenTicketIdState(ticketExternalId)
  }, [])

  const notifyTicketCreated = React.useCallback(() => {
    // Fresh connect → fresh ownership set + fresh server summary
    // (covers both the no-stream 204 wait state and an already-live
    // stream whose set predates the new ticket).
    noStreamRef.current = false
    subscriptionRef.current?.reconnectNow()
  }, [])

  // Derived unread map — open ticket masked to 0 so a server summary
  // landing inside the markRead debounce window can't transiently
  // re-badge it.
  const value = React.useMemo<TicketLiveContextValue>(() => {
    let unreadByTicket = summary.tickets
    let unreadTotal = summary.totalUnread
    if (openTicketIdState && unreadByTicket[openTicketIdState]) {
      const masked = unreadByTicket[openTicketIdState]
      unreadByTicket = { ...unreadByTicket }
      delete unreadByTicket[openTicketIdState]
      unreadTotal = Math.max(0, unreadTotal - masked)
    }
    // Ticket with the NEWEST unread reply (ISO strings compare
    // lexicographically) — header cell routes there. Falls back to any
    // unread key if a timestamp is missing.
    let nextUnreadTicketId: string | null = null
    let nextStamp = ''
    for (const id of Object.keys(unreadByTicket)) {
      const stamp = summary.latestUnreadAt[id] ?? ''
      if (nextUnreadTicketId === null || stamp > nextStamp) {
        nextUnreadTicketId = id
        nextStamp = stamp
      }
    }
    return {
      authed,
      connected,
      unreadTotal,
      unreadByTicket,
      nextUnreadTicketId,
      markRead,
      setOpenTicketId,
      notifyTicketCreated,
    }
  }, [
    summary,
    authed,
    connected,
    openTicketIdState,
    markRead,
    setOpenTicketId,
    notifyTicketCreated,
  ])

  return <TicketLiveContext.Provider value={value}>{children}</TicketLiveContext.Provider>
}
