import { useCallback, useEffect, useRef, useState } from 'react'
import { createNatsClient, type NatsClient, type NatsSubscriptionHandle } from '../../../nats'
import {
  type NatsMessageType,
  type UseNatsDialogSubscriptionOptions,
  type UseNatsDialogSubscriptionReturn,
  NETWORK_CONFIG,
} from '../types'

type SharedConnection = {
  wsUrl: string
  client: NatsClient
  connectPromise: Promise<void> | null
  refCount: number
  closeTimer: ReturnType<typeof setTimeout> | null
}

let shared: SharedConnection | null = null

/**
 * Hook for managing NATS dialog subscriptions.
 * 
 * This hook handles:
 * - Connecting to NATS WebSocket
 * - Subscribing to dialog topics (message and/or admin-message)
 * - Reconnection and error handling
 * - Shared connection management
 * 
 * @example
 * ```tsx
 * // Client usage (single topic)
 * const { isConnected, isSubscribed } = useNatsDialogSubscription({
 *   enabled: true,
 *   dialogId,
 *   topics: ['message'],
 *   onEvent: (payload, messageType) => handleChunk(payload),
 *   onSubscribed: () => catchUpChunks(),
 *   getNatsWsUrl: () => buildNatsWsUrl(apiBaseUrl, token),
 * })
 * 
 * // Admin usage (multiple topics)
 * const { isConnected, isSubscribed } = useNatsDialogSubscription({
 *   enabled: true,
 *   dialogId,
 *   topics: ['message', 'admin-message'],
 *   onEvent: (payload, messageType) => ingestRealtimeEvent(payload, messageType),
 *   onSubscribed: () => catchUpChunks(),
 *   getNatsWsUrl: () => buildNatsWsUrl(apiBaseUrl),
 * })
 * ```
 */
export function useNatsDialogSubscription({
  enabled,
  dialogId,
  topics = ['message'],
  onEvent,
  onConnect,
  onDisconnect,
  onSubscribed,
  getNatsWsUrl,
  clientConfig = {},
}: UseNatsDialogSubscriptionOptions): UseNatsDialogSubscriptionReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  
  const clientRef = useRef<NatsClient | null>(null)
  const subscriptionRefs = useRef<Map<NatsMessageType, NatsSubscriptionHandle | null>>(new Map())
  
  // Stable refs for callbacks
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])
  
  const onConnectRef = useRef(onConnect)
  useEffect(() => {
    onConnectRef.current = onConnect
  }, [onConnect])
  
  const onDisconnectRef = useRef(onDisconnect)
  useEffect(() => {
    onDisconnectRef.current = onDisconnect
  }, [onDisconnect])
  
  const onSubscribedRef = useRef(onSubscribed)
  useEffect(() => {
    onSubscribedRef.current = onSubscribed
  }, [onSubscribed])

  const acquireClient = useCallback((url: string): SharedConnection => {
    if (shared?.wsUrl !== url) {
      // Close existing connection if URL changed
      if (shared) {
        shared.closeTimer && clearTimeout(shared.closeTimer)
        const old = shared
        shared = null
        void old.client.close().catch(() => {})
      }
      
      const { name = 'openframe-frontend', user = 'machine', pass = '' } = clientConfig
      
      const client = createNatsClient({
        servers: url,
        name,
        user,
        pass,
        connectTimeoutMs: NETWORK_CONFIG.CONNECT_TIMEOUT_MS,
        reconnect: true,
        maxReconnectAttempts: -1, // Unlimited reconnection attempts
        reconnectTimeWaitMs: NETWORK_CONFIG.RECONNECT_TIME_WAIT_MS,
        pingIntervalMs: NETWORK_CONFIG.PING_INTERVAL_MS,
        maxPingOut: NETWORK_CONFIG.MAX_PING_OUT,
      })
      shared = { wsUrl: url, client, connectPromise: null, refCount: 0, closeTimer: null }
    }

    shared.refCount += 1
    shared.closeTimer && clearTimeout(shared.closeTimer)
    shared.closeTimer = null
    return shared
  }, [clientConfig])

  const releaseClient = useCallback((url: string) => {
    if (!shared || shared.wsUrl !== url) return
    
    shared.refCount = Math.max(0, shared.refCount - 1)
    if (shared.refCount > 0) return

    shared.closeTimer = setTimeout(() => {
      const s = shared
      shared = null
      s && void s.client.close().catch(() => {})
    }, NETWORK_CONFIG.SHARED_CLOSE_DELAY_MS)
  }, [])

  // Connection effect
  useEffect(() => {
    const wsUrl = getNatsWsUrl()
    if (!enabled || !wsUrl) return

    const sharedConn = acquireClient(wsUrl)
    const client = sharedConn.client

    clientRef.current = client
    setIsConnected(false)
    
    let hasConnected = false

    const unsubscribeStatus = client.onStatus((event) => {
      const connected = event.status === 'connected'
      const disconnected = ['closed', 'disconnected', 'error'].includes(event.status)
      if (connected) {
        setIsConnected(true)
        if (!hasConnected) {
          hasConnected = true
          onConnectRef.current?.()
        }
      }
      if (disconnected) {
        setIsConnected(false)
        hasConnected = false
        onDisconnectRef.current?.()
      }
    })

    let closed = false
    ;(async () => {
      try {
        sharedConn.connectPromise ||= client.connect()
        await sharedConn.connectPromise
        if (!closed) {
          setIsConnected(true)
        }
      } catch (e) {
        sharedConn.connectPromise = null
        setIsConnected(false)
        onDisconnectRef.current?.()
        await client.close().catch(() => {})
      }
    })()

    return () => {
      closed = true
      setIsConnected(false)
      unsubscribeStatus()
      
      // Unsubscribe all subscriptions
      subscriptionRefs.current.forEach((sub) => {
        try {
          sub?.unsubscribe()
        } catch {
          // ignore
        }
      })
      subscriptionRefs.current.clear()
      
      clientRef.current && releaseClient(wsUrl)
      clientRef.current = null
    }
  }, [enabled, getNatsWsUrl, acquireClient, releaseClient])

  // Create stable topics string for effect dependency
  const topicsKey = topics.join(',')

  // Subscription effect
  useEffect(() => {
    if (!enabled || !isConnected || !dialogId) return
    const client = clientRef.current
    if (!client) return

    setIsSubscribed(false)

    // Unsubscribe existing subscriptions
    subscriptionRefs.current.forEach((sub) => {
      try {
        sub?.unsubscribe()
      } catch {
        // ignore
      }
    })
    subscriptionRefs.current.clear()

    const abort = new AbortController()
    const decoder = new TextDecoder()
    
    const handleMessage = (messageType: NatsMessageType) => async (msg: any) => {
      if (!onEventRef.current) return
      try {
        const dataStr = decoder.decode(msg.data)
        const parsed = JSON.parse(dataStr)
        onEventRef.current(parsed, messageType)
      } catch {
        // Ignore parse errors
      }
    }
    
    // Subscribe to all configured topics
    topics.forEach((topic) => {
      const subscription = client.subscribeBytes(
        `chat.${dialogId}.${topic}`,
        handleMessage(topic),
        { signal: abort.signal }
      )
      subscriptionRefs.current.set(topic, subscription)
    })
    
    setIsSubscribed(true)
    onSubscribedRef.current?.()

    return () => {
      setIsSubscribed(false)
      abort.abort()
      subscriptionRefs.current.forEach((sub) => {
        try {
          sub?.unsubscribe()
        } catch {
          // ignore
        }
      })
      subscriptionRefs.current.clear()
    }
  }, [enabled, isConnected, dialogId, topicsKey, topics]) // topics is needed for forEach

  return { isConnected, isSubscribed }
}

/**
 * Utility function to build NATS WebSocket URL
 * Can be used by consumers to create the getNatsWsUrl callback
 */
export function buildNatsWsUrl(
  apiBaseUrl: string,
  options?: {
    token?: string
    includeAuthParam?: boolean
  }
): string {
  const u = new URL('/ws/nats', apiBaseUrl)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'

  if (options?.includeAuthParam && options?.token) {
    u.searchParams.set('authorization', options.token)
  }
  
  return u.toString()
}
