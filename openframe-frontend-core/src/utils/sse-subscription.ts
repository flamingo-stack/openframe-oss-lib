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
 *   - Terminal responses (NO retry): any 4xx except 408/429 — the
 *     `x-block-layer` header, when readable, is logged for attribution
 *     only, never used as a retry gate (proxies may strip it); and
 *     204 → a distinct `no-stream` status (the caller decides when to
 *     try again). Backoff-retry is for transport errors, 408/429, and 5xx.
 *
 * THE common SSE client for lib + hosts — exported from the `utils`
 * barrel. Consumers: `TicketLiveProvider` (lib) and the hub's
 * workflow/invocation stream hooks (which replaced the hub's old
 * EventSource-based `sse-client.ts`). Finite streams (workflows,
 * invocations) end with a terminal event and a server-side close —
 * their handlers MUST call `close()` on the terminal event, or the
 * never-terminating reconnect loop re-opens the finished stream.
 */

import { embedAuthedFetch } from './embed-authed-fetch'

/** Transport-level status. Server-sent `status` FRAMES (`subscribed` /
 *  `retrying` / `reconnect_failed`) arrive via `onEvent('status', …)` —
 *  callers derive their "connected" notion from those, not from these. */
export type SseTransportStatus =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'no-stream'
  | 'terminal'
  | 'closed'

export interface SseSubscriptionOptions {
  url: string
  /** Defaults to `embedAuthedFetch` (adapter headers + credentials). */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
  /** Called per parsed frame: `eventName` from `event:` (default
   *  'message'), `data` JSON-parsed when possible (raw string otherwise). */
  onEvent: (eventName: string, data: unknown) => void
  onStatusChange?: (status: SseTransportStatus) => void
  /** Silence threshold before the connection is presumed dead. MUST be
   *  ≥2.5× the server keepalive cadence or jitter causes false-disconnect
   *  churn (each one costs a full server invocation). */
  silenceTimeoutMs?: number
  maxBackoffMs?: number
  initialBackoffMs?: number
}

export interface SseSubscription {
  /** Permanently stop — no further reconnects, no callbacks. */
  close: () => void
  /** Drop the current connection (if any) and reconnect immediately,
   *  resetting backoff. No-op after `close()`. */
  reconnectNow: () => void
}

const DEFAULT_SILENCE_TIMEOUT_MS = 45_000
const DEFAULT_MAX_BACKOFF_MS = 30_000
const DEFAULT_INITIAL_BACKOFF_MS = 1_000

export function createSseSubscription(options: SseSubscriptionOptions): SseSubscription {
  const {
    url,
    fetchImpl = embedAuthedFetch,
    onEvent,
    onStatusChange,
    silenceTimeoutMs = DEFAULT_SILENCE_TIMEOUT_MS,
    maxBackoffMs = DEFAULT_MAX_BACKOFF_MS,
    initialBackoffMs = DEFAULT_INITIAL_BACKOFF_MS,
  } = options

  let closed = false
  let attempt = 0
  /** Connection generation — bumped by each connect() and by
   *  reconnectNow(). A stale loop (aborted, still unwinding) compares
   *  its captured generation before scheduling a reconnect, so an
   *  explicit reconnect can never race a zombie loop into two
   *  concurrent connections. */
  let generation = 0
  let abortController: AbortController | null = null
  let retryTimerId: ReturnType<typeof setTimeout> | null = null
  let silenceTimerId: ReturnType<typeof setTimeout> | null = null

  const setStatus = (status: SseTransportStatus) => {
    if (closed && status !== 'closed') return
    onStatusChange?.(status)
  }

  const clearTimers = () => {
    if (retryTimerId) {
      clearTimeout(retryTimerId)
      retryTimerId = null
    }
    if (silenceTimerId) {
      clearTimeout(silenceTimerId)
      silenceTimerId = null
    }
  }

  const armSilenceTimer = () => {
    if (silenceTimerId) clearTimeout(silenceTimerId)
    silenceTimerId = setTimeout(() => {
      // Dead-air: the read loop is stuck on a connection that will never
      // produce again. Abort → the loop's catch schedules a reconnect.
      abortController?.abort()
    }, silenceTimeoutMs)
  }

  const scheduleReconnect = () => {
    if (closed || retryTimerId) return
    setStatus('reconnecting')
    const backoff = Math.min(maxBackoffMs, initialBackoffMs * 2 ** attempt)
    const jitter = backoff * 0.25 * Math.random()
    attempt += 1
    retryTimerId = setTimeout(() => {
      retryTimerId = null
      void connect()
    }, backoff + jitter)
  }

  const parseFrame = (rawFrame: string) => {
    let eventName = 'message'
    const dataLines: string[] = []
    for (const line of rawFrame.split('\n')) {
      if (line.startsWith(':')) continue // comment (keepalive) — liveness only
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim() || 'message'
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }
    if (dataLines.length === 0) return
    const rawData = dataLines.join('\n')
    let data: unknown = rawData
    try {
      data = JSON.parse(rawData)
    } catch {
      // Non-JSON data frame — deliver the raw string.
    }
    try {
      onEvent(eventName, data)
    } catch (err) {
      console.error('[sse-subscription] onEvent handler threw:', err)
    }
  }

  const connect = async (): Promise<void> => {
    if (closed) return
    const gen = ++generation
    setStatus('connecting')
    abortController = new AbortController()

    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        // Explicit Accept — embedAuthedFetch otherwise injects
        // `Content-Type: application/json` defaults meant for POSTs.
        headers: { Accept: 'text/event-stream' },
        signal: abortController.signal,
      })
    } catch {
      // Network error / abort — transport-level, retryable.
      if (!closed && gen === generation) scheduleReconnect()
      return
    }
    if (closed || gen !== generation) return

    if (response.status === 204) {
      // Contract: nothing to stream for this identity. Caller decides
      // when to try again — no retry loop here.
      setStatus('no-stream')
      return
    }
    if (!response.ok) {
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500
      if (retryable) {
        scheduleReconnect()
        return
      }
      // Terminal 4xx. x-block-layer (proxy surface block) is logged for
      // attribution when readable — never gates the decision.
      const blockLayer = response.headers.get('x-block-layer')
      console.warn(
        `[sse-subscription] terminal ${response.status} for ${url}${blockLayer ? ` (x-block-layer: ${blockLayer})` : ''} — not retrying`,
      )
      setStatus('terminal')
      return
    }
    if (!response.body) {
      scheduleReconnect()
      return
    }

    // Successful open — reset backoff, start liveness accounting.
    attempt = 0
    setStatus('open')
    armSilenceTimer()

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (closed || gen !== generation) return
        if (done) break
        // ANY bytes are liveness — including comment keepalives, which
        // the frame parser below will drop.
        armSilenceTimer()
        buffer += decoder.decode(value, { stream: true })
        // SSE line terminators may be CRLF, LF, or bare CR per spec.
        // Normalize to LF before boundary scanning — a CRLF stream would
        // otherwise never match '\n\n' and frames would pile up unparsed.
        // A trailing CR is held back one iteration: it may be the first
        // half of a CRLF split across reads (normalization is idempotent
        // on the already-normalized remainder).
        let pendingCr = ''
        if (buffer.endsWith('\r')) {
          pendingCr = '\r'
          buffer = buffer.slice(0, -1)
        }
        buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        // Frames are separated by a blank line (\n\n).
        for (;;) {
          const boundary = buffer.indexOf('\n\n')
          if (boundary === -1) break
          const rawFrame = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          parseFrame(rawFrame)
        }
        buffer += pendingCr
      }
    } catch {
      // Aborted (silence timer / reconnectNow) or stream error — fall
      // through to reconnect.
    } finally {
      if (silenceTimerId) {
        clearTimeout(silenceTimerId)
        silenceTimerId = null
      }
      try {
        reader.releaseLock()
      } catch {
        // Already released.
      }
    }

    // Server closed the stream (e.g. Vercel maxDuration) — reconnect.
    if (!closed && gen === generation) scheduleReconnect()
  }

  void connect()

  return {
    close: () => {
      if (closed) return
      closed = true
      generation += 1
      clearTimers()
      abortController?.abort()
      onStatusChange?.('closed')
    },
    reconnectNow: () => {
      if (closed) return
      // Invalidate the current loop BEFORE aborting so its unwinding
      // never schedules a competing (backoff) reconnect.
      generation += 1
      clearTimers()
      attempt = 0
      abortController?.abort()
      void connect()
    },
  }
}
