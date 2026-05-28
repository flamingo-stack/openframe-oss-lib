'use client'

import * as React from 'react'
import type { NatsClient, NatsStatus } from './nats'
import {
  acquireClient,
  releaseClient,
  startConnectionLifecycle,
  type AcquireClientOptions,
  type NatsReconnectionBackoff,
} from './shared-connection'

export type { NatsReconnectionBackoff } from './shared-connection'

export interface NatsProviderProps {
  children: React.ReactNode
  /** Return the current NATS WebSocket URL (or null when not yet available, e.g. unauthenticated). */
  getWsUrl: () => string | null
  /** Called before each reconnect attempt. */
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

    const conn = acquireClient(wsUrl, clientConfigRef.current)
    heldUrlRef.current = wsUrl
    setClient(conn.client)
    setStatus(conn.client.isConnected() ? 'connected' : 'connecting')

    const lifecycle = startConnectionLifecycle({
      conn,
      wsUrl,
      onBeforeReconnect: () => onBeforeReconnectRef.current?.(),
      backoff: reconnectionBackoffRef.current,
      getFreshUrl: () => getWsUrlRef.current(),
      onStatusChange: (newStatus) => {
        setStatus(newStatus)
        if (newStatus === 'connected') {
          if (hadConnectionBeforeRef.current) {
            setReconnectionCount((c) => c + 1)
          }
          hadConnectionBeforeRef.current = true
        }
      },
    })

    return () => {
      lifecycle.stop()
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
