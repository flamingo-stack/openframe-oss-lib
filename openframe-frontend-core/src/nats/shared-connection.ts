import { createNatsClient, type NatsClient, type NatsStatus, type NatsStatusEvent } from './nats'

export const NATS_DEFAULTS = {
  SHARED_CLOSE_DELAY_MS: 3000,
  CONNECT_TIMEOUT_MS: 10_000,
  PING_INTERVAL_MS: 30_000,
  MAX_PING_OUT: 3,
  RETRY_INITIAL_DELAY_MS: 1000,
  RETRY_MAX_DELAY_MS: 30_000,
  RETRY_MULTIPLIER: 2,
} as const

export interface NatsReconnectionBackoff {
  /** Number of fast retries before exponential phase kicks in. Default: 0. */
  fastRetries?: number
  /** Delay used during the fast-retry phase. Default: RETRY_INITIAL_DELAY_MS. */
  fastRetryDelayMs?: number
  /** Base delay for the exponential phase. Default: RETRY_INITIAL_DELAY_MS. */
  initialDelayMs?: number
  /** Upper cap on any single retry delay. Default: RETRY_MAX_DELAY_MS. */
  maxDelayMs?: number
  /** Per-attempt multiplier during exponential phase. Default: RETRY_MULTIPLIER. */
  multiplier?: number
}

export interface SharedConnection {
  wsUrl: string
  client: NatsClient
  connectPromise: Promise<void> | null
  refCount: number
  closeTimer: ReturnType<typeof setTimeout> | null
  retryTimer: ReturnType<typeof setTimeout> | null
  /**
   * Identity of the consumer driving reconnect. When set, other consumers
   * should observe status only and skip their own scheduleRetry — otherwise
   * each disconnect triggers multiple concurrent connect() calls racing over
   * connectPromise.
   */
  retryOwner: object | null
}

export interface AcquireClientOptions {
  name?: string
  user?: string
  pass?: string
  connectTimeoutMs?: number
  pingIntervalMs?: number
  maxPingOut?: number
}

export interface ReleaseClientOptions {
  delayMs?: number
}

// One shared connection PER URL. The previous single-slot implementation
// force-closed whatever was connected the moment any consumer acquired a
// DIFFERENT URL — even with live refs on it. With two chat surfaces on
// distinct endpoints (`/ws/nats` client chat vs `/ws/nats-api` dashboard)
// mounted at once, each acquire killed the other's socket, and the loser's
// retry loop self-cancelled (connection identity mismatch) leaving a dead
// subscription that silently received nothing.
const connections = new Map<string, SharedConnection>()

/** Legacy accessor from the single-slot era: returns the first live shared
 *  connection, or null. With MULTIPLE URLs connected (e.g. `/ws/nats` client
 *  chat + `/ws/nats-api` dashboard mounted together) "first" is whichever
 *  surface acquired first — an arbitrary, mount-order-dependent answer.
 *  Prefer `getSharedConnectionFor(url)`; this stays only for external
 *  registry-pinned consumers of the old single-connection API. */
export function getSharedConnection(): SharedConnection | null {
  const first = connections.values().next()
  return first.done ? null : first.value
}

export function acquireClient(url: string, opts?: AcquireClientOptions): SharedConnection {
  let conn = connections.get(url)

  if (!conn) {
    const {
      name = 'openframe-frontend',
      user = 'machine',
      pass = '',
      connectTimeoutMs = NATS_DEFAULTS.CONNECT_TIMEOUT_MS,
      pingIntervalMs = NATS_DEFAULTS.PING_INTERVAL_MS,
      maxPingOut = NATS_DEFAULTS.MAX_PING_OUT,
    } = opts ?? {}

    const client = createNatsClient({
      servers: url,
      name,
      user,
      pass,
      connectTimeoutMs,
      reconnect: false,
      pingIntervalMs,
      maxPingOut,
    })

    conn = {
      wsUrl: url,
      client,
      connectPromise: null,
      refCount: 0,
      closeTimer: null,
      retryTimer: null,
      retryOwner: null,
    }
    connections.set(url, conn)
  }

  conn.refCount += 1
  if (conn.closeTimer) {
    clearTimeout(conn.closeTimer)
    conn.closeTimer = null
  }
  return conn
}

export function releaseClient(url: string, opts?: ReleaseClientOptions): void {
  const conn = connections.get(url)
  if (!conn) return

  conn.refCount = Math.max(0, conn.refCount - 1)
  if (conn.refCount > 0) return

  const delay = opts?.delayMs ?? NATS_DEFAULTS.SHARED_CLOSE_DELAY_MS
  conn.closeTimer = setTimeout(() => {
    conn.closeTimer = null
    // A new acquire may have raced in during the grace period.
    if (conn.refCount > 0) return
    if (connections.get(url) === conn) {
      connections.delete(url)
    }
    if (conn.retryTimer) {
      clearTimeout(conn.retryTimer)
      conn.retryTimer = null
    }
    void conn.client.close().catch(() => {})
  }, delay)
}

export function getSharedConnectionFor(url: string | null | undefined): SharedConnection | null {
  if (!url) return null
  return connections.get(url) ?? null
}

// ---------------------------------------------------------------------------
// Connection lifecycle: retry + status loop, shared by NatsProvider and the
// chat hooks. Each consumer that wants to drive reconnect creates an
// ownerToken and calls startConnectionLifecycle(). The first caller to claim
// retryOwner runs the actual retry loop; subsequent claimants observe status
// only. When the owner unmounts and releases retryOwner, the next status
// event lets a surviving consumer pick up ownership opportunistically.
// ---------------------------------------------------------------------------

export interface ConnectionLifecycleOptions {
  conn: SharedConnection
  wsUrl: string
  onBeforeReconnect?: () => Promise<void> | void
  backoff?: NatsReconnectionBackoff
  getFreshUrl: () => string | null
  /** Called on every status change (after closed-guard). */
  onStatusChange?: (status: NatsStatus, evt: NatsStatusEvent) => void
  /**
   * Decide which statuses should trigger a retry attempt. Defaults to closed +
   * disconnected. Override to skip 'error' (JetStream protocol errors that
   * don't close the WS) or include it.
   */
  shouldRetryOn?: (status: NatsStatus) => boolean
}

export interface ConnectionLifecycleHandle {
  /** Stop observing status, clear any pending retry, release ownership if held. */
  stop(): void
}

const defaultShouldRetryOn = (status: NatsStatus) => status === 'closed' || status === 'disconnected'

export function startConnectionLifecycle(options: ConnectionLifecycleOptions): ConnectionLifecycleHandle {
  const { conn, wsUrl } = options
  // Each lifecycle gets its own identity for retry ownership. The first lifecycle to claim
  // an unowned connection drives reconnect; later attachers observe status only until the
  // owner releases (see opportunistic claim in scheduleRetry).
  const ownerToken = {}
  if (!conn.retryOwner) conn.retryOwner = ownerToken

  let closed = false
  let retryAttempt = 0

  function emitSynthetic(status: NatsStatus) {
    if (closed) return
    options.onStatusChange?.(status, { status })
    if (status === 'connected') {
      retryAttempt = 0
    }
  }

  function scheduleRetry() {
    if (closed) return
    if (getSharedConnectionFor(wsUrl) !== conn) return
    if (!conn.retryOwner) conn.retryOwner = ownerToken
    if (conn.retryOwner !== ownerToken) return

    if (conn.retryTimer) {
      clearTimeout(conn.retryTimer)
      conn.retryTimer = null
    }

    const cfg = options.backoff ?? {}
    const fastRetries = cfg.fastRetries ?? 0
    const fastDelay = cfg.fastRetryDelayMs ?? NATS_DEFAULTS.RETRY_INITIAL_DELAY_MS
    const baseDelay = cfg.initialDelayMs ?? NATS_DEFAULTS.RETRY_INITIAL_DELAY_MS
    const maxDelay = cfg.maxDelayMs ?? NATS_DEFAULTS.RETRY_MAX_DELAY_MS
    const multiplier = cfg.multiplier ?? NATS_DEFAULTS.RETRY_MULTIPLIER

    const delay =
      retryAttempt < fastRetries
        ? fastDelay
        : Math.min(baseDelay * multiplier ** (retryAttempt - fastRetries), maxDelay)
    const jitteredDelay = delay * (0.5 + Math.random() * 0.5)
    retryAttempt++

    conn.retryTimer = setTimeout(async () => {
      conn.retryTimer = null
      if (closed) return
      if (getSharedConnectionFor(wsUrl) !== conn) return

      try {
        await options.onBeforeReconnect?.()
      } catch {
        // continue regardless of token-refresh outcome
      }
      if (closed) return
      if (getSharedConnectionFor(wsUrl) !== conn) return

      const freshUrl = options.getFreshUrl()
      if (freshUrl !== wsUrl) return

      try {
        conn.connectPromise = null
        conn.connectPromise = conn.client.connect()
        await conn.connectPromise
        if (!closed && getSharedConnectionFor(wsUrl) === conn) {
          retryAttempt = 0
        }
      } catch {
        conn.connectPromise = null
        if (!closed && getSharedConnectionFor(wsUrl) === conn) {
          scheduleRetry()
        }
      }
    }, jitteredDelay)
  }

  const shouldRetryOn = options.shouldRetryOn ?? defaultShouldRetryOn

  const unsubStatus = conn.client.onStatus((evt) => {
    if (closed) return
    options.onStatusChange?.(evt.status, evt)
    if (evt.status === 'connected') {
      retryAttempt = 0
    }
    if (shouldRetryOn(evt.status)) {
      scheduleRetry()
    }
  })

  if (conn.client.isConnected()) {
    emitSynthetic('connected')
  }

  void (async () => {
    try {
      conn.connectPromise ||= conn.client.connect()
      await conn.connectPromise
    } catch {
      conn.connectPromise = null
      if (closed) return

      emitSynthetic('disconnected')
      scheduleRetry()
    }
  })()

  return {
    stop() {
      closed = true
      unsubStatus()
      if (conn.retryTimer) {
        clearTimeout(conn.retryTimer)
        conn.retryTimer = null
      }
      if (conn.retryOwner === ownerToken) {
        conn.retryOwner = null
      }
    },
  }
}
