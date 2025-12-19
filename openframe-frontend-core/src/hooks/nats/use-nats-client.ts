import { useEffect, useMemo, useState } from 'react'

import type { NatsClient, NatsClientOptions, NatsStatus } from '../../nats'
import { createNatsClient } from '../../nats'

export interface UseNatsClientOptions {
  /**
   * When true, connect on mount and close on unmount.
   */
  autoConnect?: boolean
}

export interface UseNatsClientResult {
  client: NatsClient | null
  status: NatsStatus
  isConnected: boolean
  lastError: unknown
}

/**
 * React hook for managing a shared NATS WebSocket connection lifecycle.
 *
 * Important: pass a memoized `clientOptions` (e.g. via `useMemo`) to avoid
 * reconnecting on every render.
 */
export function useNatsClient(
  clientOptions: NatsClientOptions | null,
  options: UseNatsClientOptions = {},
): UseNatsClientResult {
  const { autoConnect = true } = options

  const client = useMemo(() => {
    if (!clientOptions) return null
    return createNatsClient(clientOptions)
  }, [clientOptions])

  const [status, setStatus] = useState<NatsStatus>('disconnected')
  const [lastError, setLastError] = useState<unknown>(null)

  useEffect(() => {
    if (!client) {
      setStatus('disconnected')
      setLastError(null)
      return
    }

    const off = client.onStatus((event) => {
      setStatus(event.status)
      if (event.status === 'error') setLastError(event.data)
    })

    if (autoConnect) {
      client.connect().catch((e) => {
        setLastError(e)
        setStatus('error')
      })
    }

    return () => {
      off()
      client.close().catch(() => {
        // ignore
      })
    }
  }, [client, autoConnect])

  return {
    client,
    status,
    isConnected: status === 'connected',
    lastError,
  }
}
