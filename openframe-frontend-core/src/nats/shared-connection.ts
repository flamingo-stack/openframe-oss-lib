import { createNatsClient, type NatsClient } from './nats'

const DEFAULTS = {
  SHARED_CLOSE_DELAY_MS: 3000,
  CONNECT_TIMEOUT_MS: 10_000,
  PING_INTERVAL_MS: 30_000,
  MAX_PING_OUT: 3,
} as const

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

let shared: SharedConnection | null = null

export function getSharedConnection(): SharedConnection | null {
  return shared
}

export function acquireClient(url: string, opts?: AcquireClientOptions): SharedConnection {
  if (shared?.wsUrl !== url) {
    if (shared) {
      if (shared.closeTimer) clearTimeout(shared.closeTimer)
      const old = shared
      shared = null
      void old.client.close().catch(() => {})
    }

    const {
      name = 'openframe-frontend',
      user = 'machine',
      pass = '',
      connectTimeoutMs = DEFAULTS.CONNECT_TIMEOUT_MS,
      pingIntervalMs = DEFAULTS.PING_INTERVAL_MS,
      maxPingOut = DEFAULTS.MAX_PING_OUT,
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

    shared = {
      wsUrl: url,
      client,
      connectPromise: null,
      refCount: 0,
      closeTimer: null,
      retryTimer: null,
      retryOwner: null,
    }
  }

  shared.refCount += 1
  if (shared.closeTimer) {
    clearTimeout(shared.closeTimer)
    shared.closeTimer = null
  }
  return shared
}

export function releaseClient(url: string, opts?: ReleaseClientOptions): void {
  if (!shared || shared.wsUrl !== url) return

  shared.refCount = Math.max(0, shared.refCount - 1)
  if (shared.refCount > 0) return

  const delay = opts?.delayMs ?? DEFAULTS.SHARED_CLOSE_DELAY_MS
  shared.closeTimer = setTimeout(() => {
    const s = shared
    shared = null
    if (s) {
      if (s.retryTimer) {
        clearTimeout(s.retryTimer)
        s.retryTimer = null
      }
      void s.client.close().catch(() => {})
    }
  }, delay)
}

export function getSharedConnectionFor(url: string | null | undefined): SharedConnection | null {
  if (!url) return null
  return shared && shared.wsUrl === url ? shared : null
}
