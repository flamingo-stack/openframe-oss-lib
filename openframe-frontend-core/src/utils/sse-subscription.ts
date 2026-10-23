/**
 * Fetch-based SSE subscription primitive.
 *
 * Why not `EventSource`: cross-origin embedders authenticate via the
 * `embedAuthedFetch` adapter's HEADERS (OpenFrame bearer), which
 * `EventSource` cannot carry. This reads `response.body` from a normal
 * authed fetch and parses standard `event:`/`data:` frames.
 *
 * Lifecycle (never-terminating by design):
 *   - Infinite reconnects with capped exponential backoff (~30s max +
 *     jitter), reset on a successful open. Do NOT copy the terminating
 *     `maxRetries → exhausted` model of the hub's server-side
 *     `RealtimeRetryManager` — a long outage must self-heal when the
 *     backend returns, because there is NO polling fallback behind this.
 *   - Liveness by silence: the server keepalives every ~15s; any bytes
 *     (INCLUDING `: keepalive` comment lines — they reset the timer
 *     before frame parsing drops them) count as life. Silence beyond
 *     `silenceTimeoutMs` (default 45s = 3× keepalive) aborts + reconnects.
 *   - Terminal responses: any 4xx except 408/429 — the `x-block-layer`
 *     header, when readable, is logged for attribution only, never used
 *     as a retry gate (proxies may strip it); and 204 → a distinct
 *     `no-stream` status (the caller decides when to try again).
 *     Backoff-retry is for transport errors, 408/429, and 5xx.
 *   - Long-lived streams (`pauseWhenHidden`) never stay terminal, because
 *     a page a desktop shell keeps open for days would otherwise stay
 *     dead until reloaded:
 *       · 401 is retried on a slow timer (30s doubling to 5min, plus
 *         jitter). The default fetch already refreshed + retried once, so
 *         this is a session the host could not renew yet — and every
 *         attempt makes it try again, which rotates a refresh token. So
 *         visible / focus do NOT shortcut this timer. What does: a new
 *         credential reported by the host (`EmbedAuthAdapter.subscribe`,
 *         default fetch only), plus the unconditional reconnect paths
 *         (`online`, resuming after a suspend, `reconnectNow()`).
 *       · Any other terminal 4xx is retried on visible / window focus, no
 *         sooner than 30s after the last connect attempt.
 *     Finite streams keep the terminal behavior: their monitors have no
 *     auth adapter to recover with and must reach a final state.
 *
 * THE common SSE client for lib + hosts — exported from the `utils`
 * barrel. Consumers: `TicketLiveProvider` (lib) and the hub's
 * workflow/invocation stream hooks (which replaced the hub's old
 * EventSource-based `sse-client.ts`). Finite streams (workflows,
 * invocations) end with a terminal event and a server-side close —
 * their handlers MUST call `close()` on the terminal event, or the
 * never-terminating reconnect loop re-opens the finished stream.
 */

import { embedAuthedFetch, subscribeEmbedCredentialChange } from './embed-authed-fetch';

/** Transport-level status. `suspended` = paused by `pauseWhenHidden`
 *  after the hidden grace elapsed (resumes automatically on visible).
 *  `terminal` is final only without `pauseWhenHidden`. */
export type SseTransportStatus =
  'connecting' | 'open' | 'reconnecting' | 'no-stream' | 'terminal' | 'suspended' | 'closed';

export interface SseSubscriptionOptions {
  url: string;
  /** Defaults to `embedAuthedFetch` (adapter headers + credentials). */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Called per parsed frame: `eventName` from `event:` (default
   *  'message'), `data` JSON-parsed when possible (raw string otherwise).
   *  Server `status` frames are ALSO forwarded here (after the client's
   *  own lifecycle handling) for consumers that render health detail. */
  onEvent: (eventName: string, data: unknown) => void;
  onStatusChange?: (status: SseTransportStatus) => void;
  /**
   * Consolidated liveness signal — true only when the SERVER confirmed
   * its Realtime subscription (`status: subscribed` frame), never merely
   * "HTTP open". THE CLIENT owns the whole lifecycle policy:
   *   - transport open without `subscribed` within 15s → hard reconnect;
   *   - server `retrying` → connected=false, give the server 90s to
   *     recover before a client hard reconnect;
   *   - server `reconnect_failed` → connected=false, hard reconnect at
   *     the capped 30s delay (no stampedes);
   *   - any transport drop → connected=false (reconnect via backoff).
   * Fired only on transitions.
   */
  onConnectedChange?: (connected: boolean) => void;
  /**
   * Pause the subscription while the tab is hidden (45s grace so
   * Cmd-Tab thrash doesn't churn connections), resume + reconnect on
   * visible, and reconnect on `online`. Also makes the stream
   * self-healing after a 401 or terminal 4xx (see the module header).
   * OPT-IN — short-lived streams (workflow/invocation monitors) must
   * keep running in background tabs. Long-lived per-user streams should
   * enable it (scale relief: a hidden tab holds no server invocation).
   */
  pauseWhenHidden?: boolean;
  /** Silence threshold before the connection is presumed dead. MUST be
   *  ≥2.5× the server keepalive cadence or jitter causes false-disconnect
   *  churn (each one costs a full server invocation). */
  silenceTimeoutMs?: number;
  maxBackoffMs?: number;
  initialBackoffMs?: number;
}

export interface SseSubscription {
  /** Permanently stop — no further reconnects, no callbacks. */
  close: () => void;
  /** Drop the current connection (if any) and reconnect immediately,
   *  resetting the transport backoff (a 401 backoff carries over until a
   *  successful open). No-op after `close()`. */
  reconnectNow: () => void;
}

const DEFAULT_SILENCE_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_BACKOFF_MS = 30_000;
const DEFAULT_INITIAL_BACKOFF_MS = 1_000;
/** No server `subscribed` frame within this window after transport-open
 *  → the subscription is presumed dead behind a live HTTP stream. */
const SUBSCRIBE_CONFIRM_TIMEOUT_MS = 15_000;
/** Server `retrying` = it is recovering its own Realtime channel
 *  (exponential backoff, ~5 attempts). Grace before the client gives up
 *  waiting and hard-reconnects. */
const SERVER_RETRY_GRACE_MS = 90_000;
/** After a server `reconnect_failed`, the next client attempt starts at
 *  this capped delay — each reconnect costs a full server invocation +
 *  the server's own Realtime retries; an outage must not stampede. */
const FAILED_RECONNECT_DELAY_MS = 30_000;
/** Grace before a hidden tab's subscription is suspended. */
const HIDDEN_GRACE_MS = 45_000;
/** 401 retry backoff for long-lived streams — slow on purpose, see the
 *  module header. */
const AUTH_RETRY_INITIAL_MS = 30_000;
const AUTH_RETRY_MAX_MS = 300_000;
/** Minimum time since the last connect attempt before a presence signal
 *  retries a terminal stream — focus can fire many times a minute. */
const PRESENCE_RETRY_MIN_INTERVAL_MS = 30_000;

export function createSseSubscription(options: SseSubscriptionOptions): SseSubscription {
  const {
    url,
    fetchImpl = embedAuthedFetch,
    onEvent,
    onStatusChange,
    onConnectedChange,
    pauseWhenHidden = false,
    silenceTimeoutMs = DEFAULT_SILENCE_TIMEOUT_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
  } = options;

  let closed = false;
  let suspended = false;
  let attempt = 0;
  let authAttempt = 0;
  /** Stopped on a terminal response — what a presence signal retries.
   *  Cleared by every connect(). */
  let stalled = false;
  /** A 401 retry timer is pending — the only state a host credential change
   *  acts on, so routine rotations never tear down a live stream. Cleared by
   *  every connect(): a change reported while a request is in flight is
   *  indistinguishable from the default fetch's own refresh, so it is not
   *  acted on (a 401 that follows waits for the next backoff step) — acting
   *  on it would let a 401 → refresh → notify cycle loop. */
  let awaitingAuth = false;
  let lastConnectAt = 0;
  /** Connection generation — bumped by each connect() and by
   *  reconnectNow(). A stale loop (aborted, still unwinding) compares
   *  its captured generation before scheduling a reconnect, so an
   *  explicit reconnect can never race a zombie loop into two
   *  concurrent connections. */
  let generation = 0;
  let abortController: AbortController | null = null;
  let retryTimerId: ReturnType<typeof setTimeout> | null = null;
  let silenceTimerId: ReturnType<typeof setTimeout> | null = null;
  // Lifecycle timers — the client owns the WHOLE connected-state policy.
  let confirmTimerId: ReturnType<typeof setTimeout> | null = null;
  let serverGraceTimerId: ReturnType<typeof setTimeout> | null = null;
  let failedDelayTimerId: ReturnType<typeof setTimeout> | null = null;
  let hiddenGraceTimerId: ReturnType<typeof setTimeout> | null = null;

  let connected = false;
  const setConnected = (next: boolean) => {
    if (connected === next) return;
    connected = next;
    try {
      onConnectedChange?.(next);
    } catch (err) {
      console.error('[sse-subscription] onConnectedChange threw:', err);
    }
  };

  const clearLifecycleTimer = (id: ReturnType<typeof setTimeout> | null) => {
    if (id) clearTimeout(id);
    return null;
  };

  const setStatus = (status: SseTransportStatus) => {
    if (closed && status !== 'closed') return;
    // ANY transport transition means the server subscription is not
    // (or not yet) confirmed — `subscribed` frames re-assert true.
    setConnected(false);
    serverGraceTimerId = clearLifecycleTimer(serverGraceTimerId);
    if (status !== 'open') {
      confirmTimerId = clearLifecycleTimer(confirmTimerId);
    }
    onStatusChange?.(status);
  };

  /** Hard reconnect, optionally delayed — used by the lifecycle policy
   *  (confirm timeout / server give-up / failed-reconnect pacing). */
  const internalReconnect = (delayMs: number) => {
    failedDelayTimerId = clearLifecycleTimer(failedDelayTimerId);
    if (delayMs <= 0) {
      doReconnect();
      return;
    }
    failedDelayTimerId = setTimeout(() => {
      failedDelayTimerId = null;
      doReconnect();
    }, delayMs);
  };

  /** Interpret server `status` frames — the server-side Realtime
   *  subscription health channel emitted by the hub's SSE engine. */
  const handleServerStatus = (data: unknown) => {
    const status = (data as { status?: string } | null)?.status;
    if (status === 'subscribed') {
      confirmTimerId = clearLifecycleTimer(confirmTimerId);
      serverGraceTimerId = clearLifecycleTimer(serverGraceTimerId);
      setConnected(true);
      return;
    }
    if (status === 'retrying') {
      // Server is recovering its own channel — wait (bounded) before a
      // client hard reconnect stampedes it. Disarm the subscribe-confirm
      // timer: a pre-`subscribed` retry would otherwise fire the 15s hard
      // reconnect and the grace window would never apply.
      confirmTimerId = clearLifecycleTimer(confirmTimerId);
      setConnected(false);
      if (!serverGraceTimerId) {
        serverGraceTimerId = setTimeout(() => {
          serverGraceTimerId = null;
          doReconnect();
        }, SERVER_RETRY_GRACE_MS);
      }
      return;
    }
    if (status === 'reconnect_failed') {
      // Same disarm as `retrying` — a still-armed confirm timer would
      // preempt the deliberate 30s failed-reconnect delay.
      confirmTimerId = clearLifecycleTimer(confirmTimerId);
      setConnected(false);
      serverGraceTimerId = clearLifecycleTimer(serverGraceTimerId);
      internalReconnect(FAILED_RECONNECT_DELAY_MS);
    }
  };

  const clearTimers = () => {
    if (retryTimerId) {
      clearTimeout(retryTimerId);
      retryTimerId = null;
    }
    if (silenceTimerId) {
      clearTimeout(silenceTimerId);
      silenceTimerId = null;
    }
    confirmTimerId = clearLifecycleTimer(confirmTimerId);
    serverGraceTimerId = clearLifecycleTimer(serverGraceTimerId);
    failedDelayTimerId = clearLifecycleTimer(failedDelayTimerId);
    // NOT the hidden-grace timer: it tracks the page's visibility, not this
    // connection, and a reconnect while hidden must still suspend on time.
  };

  const armSilenceTimer = () => {
    if (silenceTimerId) clearTimeout(silenceTimerId);
    silenceTimerId = setTimeout(() => {
      // Dead-air: the read loop is stuck on a connection that will never
      // produce again. Abort → the loop's catch schedules a reconnect.
      abortController?.abort();
    }, silenceTimeoutMs);
  };

  /** `delayMs` overrides the transport backoff (auth-failure pacing). */
  const scheduleReconnect = (delayMs?: number) => {
    if (closed || suspended || retryTimerId) return;
    if (failedDelayTimerId) {
      // A server `reconnect_failed` already scheduled the next attempt at the
      // no-stampede delay. A transport retry here would jump that queue, and
      // the pending timer would then abort the connection it opened.
      setStatus('reconnecting');
      return;
    }
    let backoff = delayMs;
    if (backoff === undefined) {
      backoff = Math.min(maxBackoffMs, initialBackoffMs * 2 ** attempt);
      attempt += 1;
    }
    const jitter = backoff * 0.25 * Math.random();
    retryTimerId = setTimeout(() => {
      retryTimerId = null;
      void connect();
    }, backoff + jitter);
    // After arming: a status callback that calls reconnectNow() must find
    // the timer to clear, or it would later fire behind a live stream.
    setStatus('reconnecting');
  };

  const parseFrame = (rawFrame: string) => {
    let eventName = 'message';
    const dataLines: string[] = [];
    for (const line of rawFrame.split('\n')) {
      if (line.startsWith(':')) continue; // comment (keepalive) — liveness only
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message';
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) return;
    const rawData = dataLines.join('\n');
    let data: unknown = rawData;
    try {
      data = JSON.parse(rawData);
    } catch {
      // Non-JSON data frame — deliver the raw string.
    }
    // Lifecycle FIRST (server `status` frames drive `connected`), then
    // forward every frame — status included — to the domain handler.
    if (eventName === 'status') {
      handleServerStatus(data);
    }
    try {
      onEvent(eventName, data);
    } catch (err) {
      console.error('[sse-subscription] onEvent handler threw:', err);
    }
  };

  // A function DECLARATION, not a `const` arrow: `connect` and
  // `scheduleReconnect` call each other, so whichever one is written second
  // is a forward reference no reordering can remove. Declarations hoist, so
  // the cycle is expressible without one.
  async function connect(): Promise<void> {
    if (closed || suspended) return;
    const gen = ++generation;
    stalled = false;
    awaitingAuth = false;
    lastConnectAt = Date.now();
    setStatus('connecting');
    abortController = new AbortController();

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        // Explicit Accept — embedAuthedFetch otherwise injects
        // `Content-Type: application/json` defaults meant for POSTs.
        headers: { Accept: 'text/event-stream' },
        signal: abortController.signal,
      });
    } catch {
      // Network error / abort — transport-level, retryable.
      if (!closed && gen === generation) scheduleReconnect();
      return;
    }
    if (closed || gen !== generation) return;

    if (response.status === 204) {
      // Contract: nothing to stream for this identity. Caller decides
      // when to try again — no retry loop here.
      setStatus('no-stream');
      return;
    }
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      if (retryable) {
        scheduleReconnect();
        return;
      }
      // x-block-layer (proxy surface block) is logged for attribution
      // when readable — never gates the decision.
      const blockLayer = response.headers.get('x-block-layer');
      const blockNote = blockLayer ? ` (x-block-layer: ${blockLayer})` : '';
      if (response.status === 401 && pauseWhenHidden) {
        const delayMs = Math.min(AUTH_RETRY_MAX_MS, AUTH_RETRY_INITIAL_MS * 2 ** authAttempt);
        authAttempt += 1;
        console.warn(`[sse-subscription] 401 for ${url}${blockNote} — retrying in ~${Math.round(delayMs / 1000)}s`);
        awaitingAuth = true;
        scheduleReconnect(delayMs);
        return;
      }
      console.warn(
        `[sse-subscription] terminal ${response.status} for ${url}${blockNote} — ${pauseWhenHidden ? 'retrying on presence' : 'not retrying'}`,
      );
      // Before the status callback, which may re-enter via reconnectNow().
      stalled = pauseWhenHidden;
      setStatus('terminal');
      return;
    }
    if (!response.body) {
      scheduleReconnect();
      return;
    }

    // Successful open — reset backoff, start liveness accounting.
    attempt = 0;
    authAttempt = 0;
    setStatus('open');
    armSilenceTimer();
    // Transport open ≠ connected: require the server's `subscribed`
    // status frame within the confirm window, else the subscription is
    // presumed dead behind a live HTTP stream → hard reconnect.
    confirmTimerId = clearLifecycleTimer(confirmTimerId);
    confirmTimerId = setTimeout(() => {
      confirmTimerId = null;
      if (!connected) doReconnect();
    }, SUBSCRIBE_CONFIRM_TIMEOUT_MS);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (closed || gen !== generation) return;
        if (done) break;
        // ANY bytes are liveness — including comment keepalives, which
        // the frame parser below will drop.
        armSilenceTimer();
        buffer += decoder.decode(value, { stream: true });
        // SSE line terminators may be CRLF, LF, or bare CR per spec.
        // Normalize to LF before boundary scanning — a CRLF stream would
        // otherwise never match '\n\n' and frames would pile up unparsed.
        // A trailing CR is held back one iteration: it may be the first
        // half of a CRLF split across reads (normalization is idempotent
        // on the already-normalized remainder).
        let pendingCr = '';
        if (buffer.endsWith('\r')) {
          pendingCr = '\r';
          buffer = buffer.slice(0, -1);
        }
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Frames are separated by a blank line (\n\n).
        for (;;) {
          const boundary = buffer.indexOf('\n\n');
          if (boundary === -1) break;
          const rawFrame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          parseFrame(rawFrame);
        }
        buffer += pendingCr;
      }
    } catch {
      // Aborted (silence timer / reconnectNow) or stream error — fall
      // through to reconnect.
    } finally {
      if (silenceTimerId) {
        clearTimeout(silenceTimerId);
        silenceTimerId = null;
      }
      try {
        reader.releaseLock();
      } catch {
        // Already released.
      }
    }

    // Server closed the stream (e.g. Vercel maxDuration) — reconnect.
    if (!closed && gen === generation) scheduleReconnect();
  }

  /** Hard reconnect core — invalidate the current loop BEFORE aborting
   *  so its unwinding never schedules a competing (backoff) reconnect. */
  function doReconnect() {
    if (closed || suspended) return;
    generation += 1;
    clearTimers();
    attempt = 0;
    abortController?.abort();
    void connect();
  }

  // ---- pauseWhenHidden: suspend/resume with the tab, reconnect on
  // network return. Registered here (not in callers) — this is client
  // lifecycle policy, not domain logic.
  const suspend = () => {
    if (closed || suspended) return;
    suspended = true;
    generation += 1;
    clearTimers();
    abortController?.abort();
    setStatus('suspended');
  };
  /** A person is back at the page: the moment a fixed backend or a
   *  restored permission can be noticed without a reload. */
  const retryIfStalled = () => {
    if (!stalled || Date.now() - lastConnectAt < PRESENCE_RETRY_MIN_INTERVAL_MS) return;
    doReconnect();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      if (!hiddenGraceTimerId) {
        hiddenGraceTimerId = setTimeout(() => {
          hiddenGraceTimerId = null;
          // Scale relief: a hidden tab holds no server invocation.
          suspend();
        }, HIDDEN_GRACE_MS);
      }
      return;
    }
    // Visible again — cancel the grace, or resume if already suspended
    // (the fresh connect re-delivers server-pushed state).
    hiddenGraceTimerId = clearLifecycleTimer(hiddenGraceTimerId);
    if (suspended) {
      suspended = false;
      void connect();
      return;
    }
    retryIfStalled();
  };
  const onOnline = () => {
    if (!suspended) doReconnect();
  };
  // Only requests that carry the adapter's credentials can be rescued by a
  // new one, and only long-lived streams ever wait out a 401. Subscribed
  // before the DOM listeners, so a throwing host adapter leaks none of them.
  const unsubscribeCredentials =
    pauseWhenHidden && fetchImpl === embedAuthedFetch
      ? subscribeEmbedCredentialChange(() => {
          if (awaitingAuth) doReconnect();
        })
      : null;
  const listenersActive = pauseWhenHidden && typeof document !== 'undefined' && typeof window !== 'undefined';
  if (listenersActive) {
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', retryIfStalled);
  }

  void connect();

  return {
    close: () => {
      if (closed) return;
      closed = true;
      generation += 1;
      clearTimers();
      hiddenGraceTimerId = clearLifecycleTimer(hiddenGraceTimerId);
      abortController?.abort();
      if (listenersActive) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('focus', retryIfStalled);
      }
      unsubscribeCredentials?.();
      setConnected(false);
      onStatusChange?.('closed');
    },
    reconnectNow: () => {
      if (closed) return;
      suspended = false;
      doReconnect();
    },
  };
}
