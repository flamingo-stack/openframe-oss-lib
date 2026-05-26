'use client'

import * as React from 'react'
import type { NatsClient, NatsStatus } from './nats'
import {
  acquireClient,
  releaseClient,
  type AcquireClientOptions,
  type SharedConnection,
} from './shared-connection'

const DEFAULT_RETRY = {
  INITIAL_DELAY_MS: 1000,
  MAX_DELAY_MS: 30_000,
  MULTIPLIER: 2,
} as const

export interface NatsReconnectionBackoff {
  fastRetries?: number
  fastRetryDelayMs?: number
  initialDelayMs?: number
  maxDelayMs?: number
  multiplier?: number
}

export interface NatsProviderProps {
  children: React.ReactNode
  /** Return the current NATS WebSocket URL (or null when not yet available, e.g. unauthenticated). */
  getWsUrl: () => string | null
  /** Called before each reconnect attempt; use to refresh auth tokens. */
  onBeforeReconnect?: () => Promise<void> | void
  clientConfig?: AcquireClientOptions
  reconnectionBackoff?: NatsReconnectionBackoff
  /**
   * Bump this to force re-evaluating `getWsUrl()` (e.g. when auth state flips).
   * Provider does not subscribe to external auth state by itself.
   */
  urlRevision?: unknown
}

export interface NatsContextValue {
  client: NatsClient | null
  status: NatsStatus
  isReady: boolean
  reconnectionCount: number
}

const NatsContext = React.createContext<NatsContextValue | null>(null)

export function NatsProvider({
  children,
  getWsUrl,
  onBeforeReconnect,
  clientConfig,
  reconnectionBackoff,
  urlRevision,
}: NatsProviderProps) {
  const [client, setClient] = React.useState<NatsClient | null>(null)
  const [status, setStatus] = React.useState<NatsStatus>('closed')
  const [reconnectionCount, setReconnectionCount] = React.useState(0)

  const getWsUrlRef = React.useRef(getWsUrl)
  React.useEffect(() => {
    getWsUrlRef.current = getWsUrl
  }, [getWsUrl])

  const onBeforeReconnectRef = React.useRef(onBeforeReconnect)
  React.useEffect(() => {
    onBeforeReconnectRef.current = onBeforeReconnect
  }, [onBeforeReconnect])

  const reconnectionBackoffRef = React.useRef(reconnectionBackoff)
  React.useEffect(() => {
    reconnectionBackoffRef.current = reconnectionBackoff
  }, [reconnectionBackoff])

  const clientConfigRef = React.useRef(clientConfig)
  React.useEffect(() => {
    clientConfigRef.current = clientConfig
  }, [clientConfig])

  const heldUrlRef = React.useRef<string | null>(null)
  const hadConnectionBeforeRef = React.useRef(false)

  React.useEffect(() => {
    const wsUrl = getWsUrlRef.current()

    if (!wsUrl) {
      if (heldUrlRef.current) {
        releaseClient(heldUrlRef.current)
        heldUrlRef.current = null
        setClient(null)
        setStatus('closed')
      }
      return
    }

    if (heldUrlRef.current && heldUrlRef.current !== wsUrl) {
      releaseClient(heldUrlRef.current)
      heldUrlRef.current = null
    }

    const conn: SharedConnection = acquireClient(wsUrl, clientConfigRef.current)
    const ownerToken = {}
    if (!conn.retryOwner) conn.retryOwner = ownerToken
    heldUrlRef.current = wsUrl
    setClient(conn.client)
    setStatus(conn.client.isConnected() ? 'connected' : 'connecting')

    let closed = false
    let retryAttempt = 0

    function scheduleRetry() {
      if (closed) return
      // Opportunistically claim ownership if vacant — covers the case where the previous owner
      // unmounted while we're still alive. Without this, a released owner leaves retry stuck.
      if (!conn.retryOwner) conn.retryOwner = ownerToken
      if (conn.retryOwner !== ownerToken) return
      if (conn.retryTimer) {
        clearTimeout(conn.retryTimer)
        conn.retryTimer = null
      }

      const cfg = reconnectionBackoffRef.current ?? {}
      const fastRetries = cfg.fastRetries ?? 0
      const fastDelay = cfg.fastRetryDelayMs ?? DEFAULT_RETRY.INITIAL_DELAY_MS
      const baseDelay = cfg.initialDelayMs ?? DEFAULT_RETRY.INITIAL_DELAY_MS
      const maxDelay = cfg.maxDelayMs ?? DEFAULT_RETRY.MAX_DELAY_MS
      const multiplier = cfg.multiplier ?? DEFAULT_RETRY.MULTIPLIER

      const delay =
        retryAttempt < fastRetries
          ? fastDelay
          : Math.min(baseDelay * multiplier ** (retryAttempt - fastRetries), maxDelay)
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5)
      retryAttempt++

      conn.retryTimer = setTimeout(async () => {
        conn.retryTimer = null
        if (closed) return

        try {
          await onBeforeReconnectRef.current?.()
        } catch {
          // continue regardless of token-refresh outcome
        }
        if (closed) return

        const freshUrl = getWsUrlRef.current()
        if (freshUrl !== wsUrl) return

        try {
          conn.connectPromise = null
          conn.connectPromise = conn.client.connect()
          await conn.connectPromise
          if (!closed) retryAttempt = 0
        } catch {
          conn.connectPromise = null
          if (!closed) scheduleRetry()
        }
      }, jitteredDelay)
    }

    const unsubStatus = conn.client.onStatus((evt) => {
      if (closed) return
      setStatus(evt.status)
      if (evt.status === 'connected') {
        if (hadConnectionBeforeRef.current) {
          setReconnectionCount((c) => c + 1)
        }
        hadConnectionBeforeRef.current = true
        retryAttempt = 0
      }
      if (evt.status === 'closed' || evt.status === 'disconnected') {
        scheduleRetry()
      }
    })

    void (async () => {
      try {
        conn.connectPromise ||= conn.client.connect()
        await conn.connectPromise
        if (!closed) {
          hadConnectionBeforeRef.current = true
          setStatus('connected')
        }
      } catch {
        conn.connectPromise = null
        if (!closed) scheduleRetry()
      }
    })()

    return () => {
      closed = true
      unsubStatus()
      if (conn.retryTimer) {
        clearTimeout(conn.retryTimer)
        conn.retryTimer = null
      }
      if (conn.retryOwner === ownerToken) {
        conn.retryOwner = null
      }
      if (heldUrlRef.current) {
        releaseClient(heldUrlRef.current)
        heldUrlRef.current = null
      }
      setClient(null)
      setStatus('closed')
    }
  }, [urlRevision])

  const value = React.useMemo<NatsContextValue>(
    () => ({
      client,
      status,
      isReady: status === 'connected' && client !== null,
      reconnectionCount,
    }),
    [client, status, reconnectionCount],
  )

  return <NatsContext.Provider value={value}>{children}</NatsContext.Provider>
}

export function useNats(): NatsContextValue {
  const ctx = React.useContext(NatsContext)
  if (!ctx) throw new Error('useNats must be used inside <NatsProvider>')
  return ctx
}

export function useOptionalNats(): NatsContextValue | null {
  return React.useContext(NatsContext)
}
