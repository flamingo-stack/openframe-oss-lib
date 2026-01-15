import type {
  ConnectionOptions,
  MsgHdrs as NatsHeaders,
  Msg,
  NatsConnection,
  Subscription,
} from 'nats.ws'

export interface NatsClientOptions {
  /**
   * NATS server URL(s), for example:
   * - "wss://nats.example.com:443"
   * - ["wss://nats-1.example.com:443", "wss://nats-2.example.com:443"]
   */
  servers: string | string[]

  /**
   * Connection name (shows up in NATS monitoring).
   */
  name?: string

  /**
   * Auth options (pick one: token or user/pass).
   */
  token?: string
  user?: string
  pass?: string

  /**
   * Reconnect behavior.
   */
  reconnect?: boolean
  maxReconnectAttempts?: number
  reconnectTimeWaitMs?: number

  /**
   * Ping behavior (keep-alive).
   */
  pingIntervalMs?: number
  maxPingOut?: number

  /**
   * Optional inbox prefix (useful if you want to isolate request/reply inboxes).
   */
  inboxPrefix?: string

  /**
   * Connection timeout in milliseconds (maps to `nats.ws` connect option `timeout`).
   * If you see `NatsError: TIMEOUT` during connect, increase this.
   */
  connectTimeoutMs?: number
}

export interface NatsSubscribeOptions {
  /**
   * Queue group for load-balancing messages across subscribers.
   */
  queue?: string

  /**
   * Auto-unsubscribe after receiving this many messages.
   */
  max?: number

  /**
   * Abort signal to stop message iteration and unsubscribe.
   */
  signal?: AbortSignal
}

export type NatsHeadersInit = Record<string, string> | NatsHeaders | undefined

export interface NatsPublishOptions {
  headers?: NatsHeadersInit
}

export interface NatsRequestOptions {
  timeoutMs?: number
  headers?: NatsHeadersInit
}

export interface NatsSubscriptionHandle {
  readonly subscription: Subscription
  unsubscribe(): void
}

export type NatsStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'closed'
  | 'error'

export interface NatsStatusEvent {
  status: NatsStatus
  data?: unknown
}

export interface NatsClient {
  connect(): Promise<void>
  close(): Promise<void>

  isConnected(): boolean

  publishBytes(subject: string, payload: Uint8Array, options?: NatsPublishOptions): void
  publishString(subject: string, payload: string, options?: NatsPublishOptions): void
  publishJson<T>(subject: string, payload: T, options?: NatsPublishOptions): void

  requestBytes(subject: string, payload: Uint8Array, options?: NatsRequestOptions): Promise<Msg>
  requestString(subject: string, payload: string, options?: NatsRequestOptions): Promise<string>
  requestJson<TResponse, TRequest = unknown>(
    subject: string,
    payload: TRequest,
    options?: NatsRequestOptions,
  ): Promise<TResponse>

  subscribeBytes(
    subject: string,
    onMessage: (msg: Msg) => void | Promise<void>,
    options?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle
  subscribeString(
    subject: string,
    onMessage: (payload: string, msg: Msg) => void | Promise<void>,
    options?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle
  subscribeJson<T>(
    subject: string,
    onMessage: (payload: T, msg: Msg) => void | Promise<void>,
    options?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle

  onStatus(listener: (event: NatsStatusEvent) => void): () => void
}

function assertClientSide(): void {
  // This wrapper is meant for browser/Tauri usage via WebSockets.
  // Keep it safe to import from Next.js server bundles by throwing only when used.
  if (typeof window === 'undefined') {
    throw new Error('NATS client can only connect from the browser/runtime with WebSocket support (window is undefined).')
  }
}

async function importNats(): Promise<typeof import('nats.ws')> {
  // Browser/Tauri only: always use the websocket client (no Node-only deps).
  return await import('nats.ws')
}

function toNatsHeaders(nats: typeof import('nats.ws'), init: NatsHeadersInit): NatsHeaders | undefined {
  if (!init) return undefined
  if (typeof (init as NatsHeaders).get === 'function') return init as NatsHeaders

  const h = nats.headers()
  for (const [k, v] of Object.entries(init as Record<string, string>)) {
    if (v !== undefined && v !== null) h.set(k, String(v))
  }
  return h
}

function mapOptionsToConnectionOptions(opts: NatsClientOptions): ConnectionOptions {
  return {
    servers: opts.servers,
    name: opts.name,
    token: opts.token,
    user: opts.user,
    pass: opts.pass,
    timeout: opts.connectTimeoutMs ?? 15000,
    reconnect: opts.reconnect ?? true,
    maxReconnectAttempts: opts.maxReconnectAttempts,
    reconnectTimeWait: opts.reconnectTimeWaitMs,
    pingInterval: opts.pingIntervalMs,
    maxPingOut: opts.maxPingOut,
    inboxPrefix: opts.inboxPrefix,
  }
}

function mapNatsTypeToStatus(type: unknown): NatsStatus | null {
  const t = String(type).toLowerCase()
  if (t.includes('connect')) return 'connected'
  if (t.includes('disconnect')) return 'disconnected'
  if (t.includes('reconnect')) return 'reconnecting'
  if (t.includes('error')) return 'error'
  if (t.includes('close')) return 'closed'
  return null
}

export function createNatsClient(options: NatsClientOptions): NatsClient {
  let nc: NatsConnection | null = null
  let statusLoopAbort: AbortController | null = null

  const statusListeners = new Set<(event: NatsStatusEvent) => void>()

  function emitStatus(event: NatsStatusEvent) {
    for (const listener of statusListeners) {
      try {
        listener(event)
      } catch {
        // ignore listener failures
      }
    }
  }

  async function connect(): Promise<void> {
    if (nc && !nc.isClosed()) return
    assertClientSide()

    emitStatus({ status: 'connecting' })

    const nats = await importNats()
    const conn = await nats.connect(mapOptionsToConnectionOptions(options))
    nc = conn

    emitStatus({ status: 'connected' })

    statusLoopAbort = new AbortController()
    const signal = statusLoopAbort.signal

    ;(async () => {
      try {
        for await (const s of conn.status()) {
          if (signal.aborted) return
          const mapped = mapNatsTypeToStatus((s as any)?.type)
          if (mapped) {
            emitStatus({ status: mapped, data: (s as any)?.data })
            if (mapped === 'closed') {
              nc = null
            }
          }
        }
      } catch (e) {
        if (!signal.aborted) {
          emitStatus({ status: 'error', data: e })
          nc = null
        }
      }
    })().catch(() => {
      // ignore
    })
  }

  async function close(): Promise<void> {
    const conn = nc
    nc = null

    if (statusLoopAbort) {
      try {
        statusLoopAbort.abort()
      } catch {
        // ignore
      }
      statusLoopAbort = null
    }

    if (!conn) return
    try {
      await conn.drain()
    } finally {
      try {
        await conn.close()
      } finally {
        emitStatus({ status: 'closed' })
      }
    }
  }

  function requireConnection(): NatsConnection {
    if (!nc) throw new Error('NATS is not connected. Call client.connect() first.')
    return nc
  }

  function isConnected(): boolean {
    return Boolean(nc) && !nc!.isClosed()
  }

  function publishBytes(subject: string, payload: Uint8Array, opts?: NatsPublishOptions): void {
    const conn = requireConnection()
    ;(async () => {
      const nats = await importNats()
      conn.publish(subject, payload, { headers: toNatsHeaders(nats, opts?.headers) })
    })().catch((e) => emitStatus({ status: 'error', data: e }))
  }

  function publishString(subject: string, payload: string, opts?: NatsPublishOptions): void {
    ;(async () => {
      const nats = await importNats()
      const sc = nats.StringCodec()
      publishBytes(subject, sc.encode(payload), opts)
    })().catch((e) => emitStatus({ status: 'error', data: e }))
  }

  function publishJson<T>(subject: string, payload: T, opts?: NatsPublishOptions): void {
    ;(async () => {
      const nats = await importNats()
      const jc = nats.JSONCodec<T>()
      publishBytes(subject, jc.encode(payload), opts)
    })().catch((e) => emitStatus({ status: 'error', data: e }))
  }

  async function requestBytes(subject: string, payload: Uint8Array, opts?: NatsRequestOptions): Promise<Msg> {
    const conn = requireConnection()
    const nats = await importNats()
    const msg = await conn.request(subject, payload, {
      timeout: opts?.timeoutMs ?? 2000,
      headers: toNatsHeaders(nats, opts?.headers),
    })
    return msg
  }

  async function requestString(subject: string, payload: string, opts?: NatsRequestOptions): Promise<string> {
    const nats = await importNats()
    const sc = nats.StringCodec()
    const msg = await requestBytes(subject, sc.encode(payload), opts)
    return sc.decode(msg.data)
  }

  async function requestJson<TResponse, TRequest = unknown>(
    subject: string,
    payload: TRequest,
    opts?: NatsRequestOptions,
  ): Promise<TResponse> {
    const nats = await importNats()
    const reqCodec = nats.JSONCodec<TRequest>()
    const resCodec = nats.JSONCodec<TResponse>()
    const msg = await requestBytes(subject, reqCodec.encode(payload), opts)
    return resCodec.decode(msg.data)
  }

  function subscribeBytes(
    subject: string,
    onMessage: (msg: Msg) => void | Promise<void>,
    opts?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle {
    const conn = requireConnection()
    const sub = conn.subscribe(subject, { queue: opts?.queue })
    if (typeof opts?.max === 'number') sub.unsubscribe(opts.max)

    const abortController = new AbortController()
    const signal = opts?.signal ?? abortController.signal

    ;(async () => {
      try {
        for await (const msg of sub) {
          if (signal.aborted) break
          await onMessage(msg)
        }
      } catch (e) {
        emitStatus({ status: 'error', data: e })
      } finally {
        try {
          sub.unsubscribe()
        } catch {
          // ignore
        }
      }
    })().catch((e) => emitStatus({ status: 'error', data: e }))

    return {
      subscription: sub,
      unsubscribe() {
        try {
          abortController.abort()
        } catch {
          // ignore
        }
        try {
          sub.unsubscribe()
        } catch {
          // ignore
        }
      },
    }
  }

  function subscribeString(
    subject: string,
    onMessage: (payload: string, msg: Msg) => void | Promise<void>,
    opts?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle {
    return subscribeBytes(
      subject,
      async (msg) => {
        const nats = await importNats()
        const sc = nats.StringCodec()
        await onMessage(sc.decode(msg.data), msg)
      },
      opts,
    )
  }

  function subscribeJson<T>(
    subject: string,
    onMessage: (payload: T, msg: Msg) => void | Promise<void>,
    opts?: NatsSubscribeOptions,
  ): NatsSubscriptionHandle {
    return subscribeBytes(
      subject,
      async (msg) => {
        const nats = await importNats()
        const jc = nats.JSONCodec<T>()
        await onMessage(jc.decode(msg.data), msg)
      },
      opts,
    )
  }

  function onStatus(listener: (event: NatsStatusEvent) => void): () => void {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  }

  return {
    connect,
    close,
    isConnected,
    publishBytes,
    publishString,
    publishJson,
    requestBytes,
    requestString,
    requestJson,
    subscribeBytes,
    subscribeString,
    subscribeJson,
    onStatus,
  }
}
