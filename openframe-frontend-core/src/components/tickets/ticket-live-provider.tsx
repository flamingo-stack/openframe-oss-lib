'use client'

/**
 * TicketLiveProvider — the ONE client home for support-ticket realtime.
 *
 * Owns:
 *   - the SSE subscription lifecycle (`createSseSubscription` over
 *     `ticketStreamUrl`), with `connected` derived from the SERVER's
 *     `status` frames (`subscribed` → true; `retrying`/`reconnect_failed`
 *     → false) — never from "the HTTP stream is open";
 *   - the unread summary (single source: `ticket-unread-summary`) —
 *     header badge total AND per-row dots both read this map;
 *   - resync on every (re)connect (summary refetch + engagements
 *     invalidation) — the single rule that closes every event-gap class
 *     (forced maxDuration reconnects, network blips, tab sleep);
 *   - visibility gating: hidden → 45s grace → disconnect; visible →
 *     reconnect + resync;
 *   - `markRead` with local write-through zeroing (no interval polling
 *     exists — a stale post-close map would re-light the dot forever).
 *
 * There is NO polling anywhere: the summary query has no
 * `refetchInterval`; it refetches on mount, (re)connect, window focus,
 * and (debounced) stream events. Hosts whose stream endpoint 404s
 * (terminal) or is absent keep exactly focus/mount freshness.
 *
 * Invalidation semantics on events — deliberately `invalidateQueries`,
 * NOT `setQueryData` patches: the ticket hooks run `gcTime: 0`, so
 * there is usually no cache entry to patch, and `TicketsCacheSlot`
 * shape rules apply when there is.
 */

import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
const TICKET_UNREAD_SUMMARY_ENDPOINT = '/api/chat/agent/ticket-unread-summary'

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
   *  (`buildTicketOpenHref` → `?ticket=<id>`, which opens the drawer
   *  and scrolls the row). Null when nothing is unread. */
  nextUnreadTicketId: string | null
  /** Mark a ticket read: POSTs the receipt, then locally zeroes the
   *  ticket in the summary map (write-through; reconciled by the next
   *  real refetch). */
  markRead: (ticketExternalId: string) => Promise<void>
  /** Drawer open/close registration — suppresses unread bumps for the
   *  open ticket and masks it in the derived map. */
  setOpenTicketId: (ticketExternalId: string | null) => void
  /** Hint that the viewer just created a ticket — retries a `no-stream`
   *  (204) subscription. */
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

export function TicketLiveProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime()
  const identity = useChatIdentity()
  const queryClient = useQueryClient()

  const streamUrl = runtime?.endpoints.ticketStreamUrl ?? TICKET_STREAM_ENDPOINT
  const readUrl = runtime?.endpoints.ticketReadUrl ?? TICKET_READ_ENDPOINT
  const summaryUrl =
    runtime?.endpoints.ticketUnreadSummaryUrl ?? TICKET_UNREAD_SUMMARY_ENDPOINT

  const identityKey = identity.user?.email ?? 'anon'
  const authed = identity.authTier !== 'anon' && !!identity.user?.email

  const [connected, setConnected] = React.useState(false)
  // State + ref for the open drawer: state drives the derived map,
  // the ref lets stream callbacks read it without re-subscribing.
  const [openTicketIdState, setOpenTicketIdState] = React.useState<string | null>(null)
  const openTicketIdRef = React.useRef<string | null>(null)

  const summaryQueryKey = React.useMemo(
    () => ['ticket-unread-summary', identityKey] as const,
    [identityKey],
  )

  // ONE unread source. No refetchInterval — freshness is event-driven
  // (mount / focus / (re)connect / debounced stream events).
  const summaryQuery = useQuery({
    queryKey: summaryQueryKey,
    enabled: authed,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TicketUnreadSummary> => {
      const response = await embedAuthedFetch(summaryUrl, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        throw new Error(`ticket-unread-summary failed: ${response.status}`)
      }
      const body = (await response.json()) as Partial<TicketUnreadSummary>
      return {
        totalUnread: typeof body.totalUnread === 'number' ? body.totalUnread : 0,
        tickets: body.tickets ?? {},
        latestUnreadAt: body.latestUnreadAt ?? {},
      }
    },
  })

  const refetchSummary = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: summaryQueryKey })
  }, [queryClient, summaryQueryKey])

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
    refetchSummary()
  }, [queryClient, refetchSummary])
  const scheduleInvalidation = React.useCallback(
    (ticketId?: string) => {
      if (ticketId) pendingTicketIdsRef.current.add(ticketId)
      if (invalidateTimerRef.current) return
      invalidateTimerRef.current = setTimeout(flushInvalidations, INVALIDATE_DEBOUNCE_MS)
    },
    [flushInvalidations],
  )

  // ---- Optimistic unread bump (reconciled by summary refetches) ----
  const bumpUnread = React.useCallback(
    (ticketId: string, createdAt?: string | null) => {
      queryClient.setQueryData<TicketUnreadSummary>(summaryQueryKey, (prev) => {
        const base = prev ?? { totalUnread: 0, tickets: {}, latestUnreadAt: {} }
        const stamp = createdAt ?? new Date().toISOString()
        const existing = base.latestUnreadAt[ticketId]
        return {
          totalUnread: base.totalUnread + 1,
          tickets: { ...base.tickets, [ticketId]: (base.tickets[ticketId] ?? 0) + 1 },
          latestUnreadAt: {
            ...base.latestUnreadAt,
            [ticketId]: existing && existing > stamp ? existing : stamp,
          },
        }
      })
    },
    [queryClient, summaryQueryKey],
  )

  const zeroUnread = React.useCallback(
    (ticketId: string) => {
      queryClient.setQueryData<TicketUnreadSummary>(summaryQueryKey, (prev) => {
        if (!prev) return prev
        const current = prev.tickets[ticketId] ?? 0
        if (current === 0) return prev
        const tickets = { ...prev.tickets }
        delete tickets[ticketId]
        const latestUnreadAt = { ...prev.latestUnreadAt }
        delete latestUnreadAt[ticketId]
        return { totalUnread: Math.max(0, prev.totalUnread - current), tickets, latestUnreadAt }
      })
    },
    [queryClient, summaryQueryKey],
  )

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
        // Resync on EVERY (re)connect — closes all event-gap classes.
        refetchSummary()
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

    if (eventName === 'ticket-resync') {
      refetchSummary()
      scheduleInvalidation()
      return
    }

    if (eventName === 'ticket-status') {
      // Meaningful ticket-row change (close/reopen/pipeline move). No
      // optimistic bump — closures count as unread SERVER-side
      // (closed_at vs receipt in computeUnreadCounts), so the debounced
      // flush's summary refetch is the one accounting path. The same
      // flush invalidates ['tickets'] (status badge flips live) and the
      // open drawer's engagements.
      const frame = data as TicketStreamEvent | null
      const ticketId = (frame?.data as { ticket_external_id?: string } | undefined)?.ticket_external_id
      scheduleInvalidation(ticketId)
      return
    }

    if (eventName === 'ticket-message') {
      const frame = data as TicketStreamEvent | null
      const payload = frame?.data
      if (!isTicketMessageData(payload)) {
        // Malformed/degraded — treat like a resync hint.
        refetchSummary()
        scheduleInvalidation()
        return
      }
      // Always invalidate (own replies from another tab render live);
      // bump unread ONLY on the server-stamped predicate, and never for
      // the ticket whose drawer is open.
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

    // `subscriptionRef.current` is the SINGLE source of truth in every
    // handler below — never the `subscription` constant above. The visible
    // branch recreates the subscription into the ref, so a captured
    // constant would go stale after the first hide/show cycle: the next
    // hide would close the already-dead original and leak the live
    // replacement (which never terminates by design).
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
      // Visible again — cancel the grace, or recreate if already torn down.
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
      // Resync regardless — the tab may have slept through events.
      refetchSummary()
    }

    const onOnline = () => {
      subscriptionRef.current?.reconnectNow()
      refetchSummary()
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
    }
    // handlersRef is stable; streamUrl/auth changes remount the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamEnabled, streamUrl, refetchSummary])

  // ---- Public API ----
  const markRead = React.useCallback(
    async (ticketExternalId: string) => {
      try {
        const response = await embedAuthedFetch(readUrl, {
          method: 'POST',
          body: JSON.stringify({ ticket_id: ticketExternalId }),
        })
        if (response.ok) {
          // Write-through zero — without polling, a stale post-close map
          // would re-light the dot until the next focus/event/reconnect.
          zeroUnread(ticketExternalId)
        }
      } catch {
        // Non-fatal — the receipt lands on the next markRead; unread
        // state reconciles via the summary.
      }
    },
    [readUrl, zeroUnread],
  )

  const setOpenTicketId = React.useCallback((ticketExternalId: string | null) => {
    openTicketIdRef.current = ticketExternalId
    setOpenTicketIdState(ticketExternalId)
  }, [])

  const notifyTicketCreated = React.useCallback(() => {
    refetchSummary()
    if (noStreamRef.current) {
      noStreamRef.current = false
      subscriptionRef.current?.reconnectNow()
    }
  }, [refetchSummary])

  // Derived unread map — open ticket masked to 0 so a summary refetch
  // inside the markRead debounce window can't transiently re-badge it.
  const value = React.useMemo<TicketLiveContextValue>(() => {
    const summary = summaryQuery.data ?? { totalUnread: 0, tickets: {}, latestUnreadAt: {} }
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
    summaryQuery.data,
    authed,
    connected,
    openTicketIdState,
    markRead,
    setOpenTicketId,
    notifyTicketCreated,
  ])

  return <TicketLiveContext.Provider value={value}>{children}</TicketLiveContext.Provider>
}
