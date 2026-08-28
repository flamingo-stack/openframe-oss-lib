'use client';

/**
 * TicketLiveProvider — the ONE client home for support-ticket realtime.
 *
 * DOMAIN logic only — connection lifecycle (subscribed-confirm, server
 * retry grace, failed-reconnect pacing, hidden-tab suspend/resume) is
 * owned entirely by the common SSE client (`createSseSubscription`);
 * this provider consumes its consolidated `onConnectedChange` signal.
 *
 * Owns:
 *   - the unread summary — delivered EXCLUSIVELY by the stream
 *     (`ticket-summary` frames on connect + debounced after events) and
 *     by `ticket-read` responses. The client holds NO summary fetch
 *     path: resync-on-(re)connect is served by the SERVER (every
 *     connect pushes a fresh summary);
 *   - query invalidation on events (list + open drawer refresh live);
 *   - `markRead` with local write-through zeroing for 0-latency,
 *     reconciled by the response's server-computed summary;
 *   - the ticket-contract `no-stream` (204) retry policy.
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

import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { embedAuthedFetch } from '../../utils/embed-authed-fetch';
import { createSseSubscription, type SseSubscription, type SseTransportStatus } from '../../utils/sse-subscription';
import { useChatIdentity } from '../chat/hooks/use-chat-identity';
import type { TicketMessageStreamData, TicketStreamEvent, TicketUnreadSummary } from './types';

// Ticket realtime is its OWN api surface — deliberately NOT under
// `/api/chat/agent/*` (that prefix is the chat agent's tool surface;
// ticket streaming/read-receipts are unrelated to chat).
const TICKET_STREAM_ENDPOINT = '/api/tickets/stream';
const TICKET_READ_ENDPOINT = '/api/tickets/read';

const EMPTY_SUMMARY: TicketUnreadSummary = { totalUnread: 0, tickets: {}, latestUnreadAt: {} };

/** ISO stamps can carry mixed timezone offsets (server `+00:00` vs an
 *  optimistic local `Z`) — lexicographic string comparison mis-orders
 *  those, so every stamp comparison goes through parsed epoch ms.
 *  Missing/unparseable stamps sort oldest. */
const stampMs = (stamp: string | null | undefined): number => {
  if (!stamp) return 0;
  const ms = Date.parse(stamp);
  return Number.isNaN(ms) ? 0 : ms;
};

/** Trailing debounce for event-burst invalidations (an agent pasting 5
 *  messages must not fire 5 list refetches). */
const INVALIDATE_DEBOUNCE_MS = 1_500;

export interface TicketLiveContextValue {
  /** Viewer has a resolved, non-anon chat identity. Surfaces (e.g. the
   *  header cell) hide themselves when false — computed here so they
   *  don't each spin up their own identity resolution. */
  authed: boolean;
  /** Realtime-subscribed (server-confirmed), not merely HTTP-open. */
  connected: boolean;
  /** Unread total across tickets — drives the header count badge. */
  unreadTotal: number;
  /** Per-ticket unread counts (missing key = 0) — drives row dots.
   *  The currently-open ticket is masked to 0. */
  unreadByTicket: Record<string, number>;
  /** The ticket with the NEWEST unread reply (open ticket excluded) —
   *  the header cell routes to it via the SSOT deep link
   *  (`buildTicketOpenHref`). Null when nothing is unread. */
  nextUnreadTicketId: string | null;
  /** Mark a ticket read: POSTs the receipt, zeroes the ticket locally
   *  (0-latency), then applies the response's server-computed summary. */
  markRead: (ticketExternalId: string) => Promise<void>;
  /** Drawer open/close registration — suppresses unread bumps for the
   *  open ticket and masks it in the derived map. */
  setOpenTicketId: (ticketExternalId: string | null) => void;
  /** Hint that the viewer just created a ticket — reconnects the stream
   *  (fresh ownership set + fresh server-pushed summary). */
  notifyTicketCreated: () => void;
}

const TicketLiveContext = React.createContext<TicketLiveContextValue | null>(null);

export function useOptionalTicketLive(): TicketLiveContextValue | null {
  return React.useContext(TicketLiveContext);
}

export function useTicketLive(): TicketLiveContextValue {
  const ctx = React.useContext(TicketLiveContext);
  if (!ctx) {
    throw new Error('useTicketLive must be used within <TicketLiveProvider>');
  }
  return ctx;
}

function isTicketMessageData(value: unknown): value is TicketMessageStreamData {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TicketMessageStreamData).ticket_external_id === 'string'
  );
}

function isSummaryData(value: unknown): value is TicketUnreadSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TicketUnreadSummary).totalUnread === 'number' &&
    typeof (value as TicketUnreadSummary).tickets === 'object'
  );
}

export function TicketLiveProvider({ children }: { children: React.ReactNode }) {
  const runtime = useChatRuntime();
  const identity = useChatIdentity();
  const queryClient = useQueryClient();

  const streamUrl = runtime?.endpoints.ticketStreamUrl ?? TICKET_STREAM_ENDPOINT;
  const readUrl = runtime?.endpoints.ticketReadUrl ?? TICKET_READ_ENDPOINT;

  const authed = identity.authTier !== 'anon' && !!identity.user?.email;

  const [connected, setConnected] = React.useState(false);
  // The SINGLE unread source — written ONLY from server-computed
  // summaries (stream frames + markRead responses) plus the two
  // 0-latency optimistic writes (event bump, markRead zero), both
  // reconciled by the next server summary.
  const [summary, setSummary] = React.useState<TicketUnreadSummary>(EMPTY_SUMMARY);
  // State + ref for the open drawer: state drives the derived map,
  // the ref lets stream callbacks read it without re-subscribing.
  const [openTicketIdState, setOpenTicketIdState] = React.useState<string | null>(null);
  const openTicketIdRef = React.useRef<string | null>(null);

  // ---- Debounced (trailing) invalidation of ticket queries on events ----
  const pendingTicketIdsRef = React.useRef<Set<string>>(new Set());
  const invalidateTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushInvalidations = React.useCallback(() => {
    invalidateTimerRef.current = null;
    const ids = Array.from(pendingTicketIdsRef.current);
    pendingTicketIdsRef.current.clear();
    void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    for (const id of ids) {
      void queryClient.invalidateQueries({ queryKey: ['ticket-engagements', id] });
    }
  }, [queryClient]);
  const scheduleInvalidation = React.useCallback(
    (ticketId?: string) => {
      if (ticketId) pendingTicketIdsRef.current.add(ticketId);
      if (invalidateTimerRef.current) return;
      invalidateTimerRef.current = setTimeout(flushInvalidations, INVALIDATE_DEBOUNCE_MS);
    },
    [flushInvalidations],
  );

  // ---- Optimistic unread writes (reconciled by server summaries) ----
  const bumpUnread = React.useCallback((ticketId: string, createdAt?: string | null) => {
    setSummary(prev => {
      const stamp = createdAt ?? new Date().toISOString();
      const existing = prev.latestUnreadAt[ticketId];
      return {
        totalUnread: prev.totalUnread + 1,
        tickets: { ...prev.tickets, [ticketId]: (prev.tickets[ticketId] ?? 0) + 1 },
        latestUnreadAt: {
          ...prev.latestUnreadAt,
          [ticketId]: existing && stampMs(existing) > stampMs(stamp) ? existing : stamp,
        },
      };
    });
  }, []);

  const zeroUnread = React.useCallback((ticketId: string) => {
    setSummary(prev => {
      const current = prev.tickets[ticketId] ?? 0;
      if (current === 0) return prev;
      const tickets = { ...prev.tickets };
      delete tickets[ticketId];
      const latestUnreadAt = { ...prev.latestUnreadAt };
      delete latestUnreadAt[ticketId];
      return { totalUnread: Math.max(0, prev.totalUnread - current), tickets, latestUnreadAt };
    });
  }, []);

  // ---- Stream lifecycle (owned by the SSE CLIENT — the provider only
  // consumes its consolidated signals) ----
  const subscriptionRef = React.useRef<SseSubscription | null>(null);
  const noStreamRef = React.useRef(false);

  // Stable handler refs so the subscription effect doesn't churn.
  const handlersRef = React.useRef<{
    onEvent: (eventName: string, data: unknown) => void;
    onStatus: (status: SseTransportStatus) => void;
    onConnected: (connected: boolean) => void;
  }>({ onEvent: () => {}, onStatus: () => {}, onConnected: () => {} });

  const handleConnected = (isConnected: boolean) => {
    setConnected(isConnected);
    if (isConnected) {
      // Event-gap healing on every (re)connect: the SERVER pushes a
      // fresh summary; the open drawer refetches through the ACL'd path.
      const openId = openTicketIdRef.current;
      if (openId) {
        void queryClient.invalidateQueries({ queryKey: ['ticket-engagements', openId] });
      }
    }
  };

  const handleEvent = (eventName: string, data: unknown) => {
    if (eventName === 'ticket-summary') {
      const frame = data as TicketStreamEvent | null;
      if (isSummaryData(frame?.data)) {
        setSummary({
          totalUnread: frame.data.totalUnread,
          tickets: frame.data.tickets ?? {},
          latestUnreadAt: frame.data.latestUnreadAt ?? {},
        });
      }
      return;
    }

    if (eventName === 'ticket-resync') {
      // Ownership gained / degraded payload — a fresh ticket-summary
      // frame follows from the server; refresh the query surfaces.
      scheduleInvalidation();
      return;
    }

    if (eventName === 'ticket-status') {
      // Meaningful ticket-row change (close/reopen/pipeline move). The
      // server pushes an updated summary right after (closures count as
      // unread server-side); here we just refresh the query surfaces so
      // the status badge flips live.
      const frame = data as TicketStreamEvent | null;
      const ticketId = (frame?.data as { ticket_external_id?: string } | undefined)?.ticket_external_id;
      scheduleInvalidation(ticketId);
      return;
    }

    if (eventName === 'ticket-message') {
      const frame = data as TicketStreamEvent | null;
      const payload = frame?.data;
      if (!isTicketMessageData(payload)) {
        scheduleInvalidation();
        return;
      }
      // Always invalidate (own replies from another tab render live);
      // bump unread ONLY on the server-stamped predicate, and never for
      // the ticket whose drawer is open. The server's debounced summary
      // push reconciles moments later.
      scheduleInvalidation(payload.ticket_external_id);
      if (payload.countsAsUnread && payload.ticket_external_id !== openTicketIdRef.current) {
        bumpUnread(payload.ticket_external_id, payload.hubspot_created_at);
      }
    }
  };

  const handleStatus = (status: SseTransportStatus) => {
    // The client owns connection lifecycle (confirm timeout, server
    // retry grace, failed-reconnect pacing, hidden-suspend). The only
    // transport status with DOMAIN meaning is the ticket contract's
    // `no-stream` (204 = zero owned tickets): remember it so a domain
    // signal (own create_ticket, window focus) can retry.
    if (status === 'open') noStreamRef.current = false;
    if (status === 'no-stream') noStreamRef.current = true;
  };

  // Publish the three handlers into the stable ref. In an unconditional effect
  // rather than in the render body: every caller is an SSE transport callback,
  // which can only fire after a commit, and a render attempt React discards
  // must not be able to leave a handler behind that closes over state the user
  // never saw. Declared BEFORE the subscription effect so it is filled first
  // in the same flush.
  React.useEffect(() => {
    handlersRef.current.onConnected = handleConnected;
    handlersRef.current.onEvent = handleEvent;
    handlersRef.current.onStatus = handleStatus;
  });

  // Mount/unmount of the subscription — gated on auth + a usable URL.
  const streamEnabled = authed && !!streamUrl;
  React.useEffect(() => {
    if (!streamEnabled) return undefined;
    if (typeof window === 'undefined') return undefined;

    subscriptionRef.current = createSseSubscription({
      url: streamUrl,
      onEvent: (name, data) => handlersRef.current.onEvent(name, data),
      onStatusChange: status => handlersRef.current.onStatus(status),
      onConnectedChange: isConnected => handlersRef.current.onConnected(isConnected),
      // Long-lived per-user stream: suspend while hidden (scale relief),
      // resume + reconnect on visible/online — all inside the client.
      pauseWhenHidden: true,
    });

    const retryIfIdle = () => {
      // After a 204 (no-stream), a focus signal is the retry trigger.
      if (noStreamRef.current) {
        noStreamRef.current = false;
        subscriptionRef.current?.reconnectNow();
      }
    };
    window.addEventListener('focus', retryIfIdle);

    return () => {
      window.removeEventListener('focus', retryIfIdle);
      if (invalidateTimerRef.current) {
        clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
      subscriptionRef.current?.close();
      subscriptionRef.current = null;
      setConnected(false);
      setSummary(EMPTY_SUMMARY);
    };
    // handlersRef is stable; streamUrl/auth changes remount the stream.
  }, [streamEnabled, streamUrl]);

  // ---- Public API ----
  const markRead = React.useCallback(
    async (ticketExternalId: string) => {
      try {
        const response = await embedAuthedFetch(readUrl, {
          method: 'POST',
          body: JSON.stringify({ ticket_id: ticketExternalId }),
        });
        if (!response.ok) return;
        // 0-latency local zero, then reconcile with the response's
        // server-computed summary (THE truth — includes closure
        // accounting and other tickets).
        zeroUnread(ticketExternalId);
        const body = (await response.json().catch(() => null)) as { summary?: TicketUnreadSummary } | null;
        if (isSummaryData(body?.summary)) {
          setSummary({
            totalUnread: body.summary.totalUnread,
            tickets: body.summary.tickets ?? {},
            latestUnreadAt: body.summary.latestUnreadAt ?? {},
          });
        }
      } catch {
        // Non-fatal — the receipt lands on the next markRead; unread
        // state reconciles via the next server summary push.
      }
    },
    [readUrl, zeroUnread],
  );

  const setOpenTicketId = React.useCallback((ticketExternalId: string | null) => {
    openTicketIdRef.current = ticketExternalId;
    setOpenTicketIdState(ticketExternalId);
  }, []);

  const notifyTicketCreated = React.useCallback(() => {
    // Fresh connect → fresh ownership set + fresh server summary
    // (covers both the no-stream 204 wait state and an already-live
    // stream whose set predates the new ticket).
    noStreamRef.current = false;
    subscriptionRef.current?.reconnectNow();
  }, []);

  // Derived unread map — open ticket masked to 0 so a server summary
  // landing inside the markRead debounce window can't transiently
  // re-badge it.
  const value = React.useMemo<TicketLiveContextValue>(() => {
    let unreadByTicket = summary.tickets;
    let unreadTotal = summary.totalUnread;
    if (openTicketIdState && unreadByTicket[openTicketIdState]) {
      const masked = unreadByTicket[openTicketIdState];
      unreadByTicket = { ...unreadByTicket };
      delete unreadByTicket[openTicketIdState];
      unreadTotal = Math.max(0, unreadTotal - masked);
    }
    // Ticket with the NEWEST unread reply (compared as parsed epoch ms
    // via `stampMs` — mixed timezone offsets break string ordering) —
    // header cell routes there. Falls back to any unread key if a
    // timestamp is missing.
    let nextUnreadTicketId: string | null = null;
    let nextStampMs = 0;
    for (const id of Object.keys(unreadByTicket)) {
      const ms = stampMs(summary.latestUnreadAt[id]);
      if (nextUnreadTicketId === null || ms > nextStampMs) {
        nextUnreadTicketId = id;
        nextStampMs = ms;
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
    };
  }, [summary, authed, connected, openTicketIdState, markRead, setOpenTicketId, notifyTicketCreated]);

  return <TicketLiveContext.Provider value={value}>{children}</TicketLiveContext.Provider>;
}
