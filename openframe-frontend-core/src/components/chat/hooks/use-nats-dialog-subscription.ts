'use client'

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
 */
export function useNatsDialogSubscription({
  enabled,
  dialogId,
  topics = ['message'],
  onEvent,
  onConnect,
  onDisconnect,
  onSubscribed,
  onBeforeReconnect,
  getNatsWsUrl,
  clientConfig = {},
}: UseNatsDialogSubscriptionOptions): UseNatsDialogSubscriptionReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [reconnectionCount, setReconnectionCount] = useState(0)
  
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

  const onBeforeReconnectRef = useRef(onBeforeReconnect)
  useEffect(() => {
    onBeforeReconnectRef.current = onBeforeReconnect
  }, [onBeforeReconnect])

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

  // Store the current WebSocket URL to prevent unnecessary reconnections
  const currentWsUrlRef = useRef<string>('')
  
  // Connection effect
  useEffect(() => {
    const wsUrl = getNatsWsUrl()
    if (!enabled || !wsUrl) {
      // Clean up if disabled or no URL
      if (currentWsUrlRef.current && clientRef.current) {
        releaseClient(currentWsUrlRef.current)
        clientRef.current = null
        currentWsUrlRef.current = ''
        setIsConnected(false)
      }
      return
    }

    // Skip if we're already connected to the same URL
    if (wsUrl === currentWsUrlRef.current && clientRef.current && clientRef.current.isConnected()) {
      return
    }

    // Clean up existing connection if URL changed
    if (currentWsUrlRef.current && currentWsUrlRef.current !== wsUrl && clientRef.current) {
      releaseClient(currentWsUrlRef.current)
      clientRef.current = null
      setIsConnected(false)
    }

    currentWsUrlRef.current = wsUrl
    const sharedConn = acquireClient(wsUrl)
    const client = sharedConn.client

    clientRef.current = client
    setIsConnected(false)
    
    let hasConnected = false
    let wasDisconnected = false

    const unsubscribeStatus = client.onStatus((event) => {
      const connected = event.status === 'connected'
      const disconnected = ['closed', 'disconnected', 'error'].includes(event.status)
      if (connected) {
        setIsConnected(true)
        if (!hasConnected) {
          hasConnected = true
          onConnectRef.current?.()
        } else if (wasDisconnected) {
          setReconnectionCount(c => c + 1)
          onConnectRef.current?.()
        }
        wasDisconnected = false
      }
      if (disconnected) {
        setIsConnected(false)
        wasDisconnected = true
        hasConnected = false
        onDisconnectRef.current?.()
        onBeforeReconnectRef.current?.()
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
      
      if (clientRef.current && currentWsUrlRef.current) {
        releaseClient(currentWsUrlRef.current)
        clientRef.current = null
        currentWsUrlRef.current = ''
      }
    }
  }, [enabled, getNatsWsUrl, acquireClient, releaseClient])

  const topicsKey = topics.join(',')
  const lastSubscribedDialogIdRef = useRef<string | null>(null)
  const isConnectedRef = useRef(isConnected)
  
  useEffect(() => {
    isConnectedRef.current = isConnected
  }, [isConnected])

  // Track subscription state separately from dialog changes
  const currentDialogIdRef = useRef<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Handle dialog changes and subscription lifecycle
  useEffect(() => {
    currentDialogIdRef.current = dialogId
    
    if (!enabled || !dialogId) {
      // Clean up if disabled or no dialog
      if (subscriptionRefs.current.size > 0) {
        setIsSubscribed(false)
        subscriptionRefs.current.forEach((sub) => {
          try {
            sub?.unsubscribe()
          } catch {
            // ignore
          }
        })
        subscriptionRefs.current.clear()
        lastSubscribedDialogIdRef.current = null
        abortControllerRef.current?.abort()
        abortControllerRef.current = null
      }
      return
    }
    
    const needsNewSubscription = 
      lastSubscribedDialogIdRef.current !== dialogId || 
      subscriptionRefs.current.size === 0
    
    if (!needsNewSubscription) {
      return
    }
    
    // Clean up any existing subscriptions before creating new ones
    if (subscriptionRefs.current.size > 0) {
      subscriptionRefs.current.forEach((sub) => {
        try {
          sub?.unsubscribe()
        } catch {
          // ignore
        }
      })
      subscriptionRefs.current.clear()
      abortControllerRef.current?.abort()
    }
    
    // Create new abort controller for this subscription set
    abortControllerRef.current = new AbortController()
    const abort = abortControllerRef.current

    const createSubscriptions = () => {
      if (!isConnectedRef.current) {
        return
      }
      
      const client = clientRef.current
      if (!client || currentDialogIdRef.current !== dialogId) {
        return
      }

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
      
      lastSubscribedDialogIdRef.current = dialogId
      setIsSubscribed(true)
      onSubscribedRef.current?.()
    }

    if (isConnectedRef.current) {
      createSubscriptions()
    }

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
      lastSubscribedDialogIdRef.current = null
      abortControllerRef.current = null
    }
  }, [enabled, dialogId, topicsKey, topics])
  
  // Separate effect to handle connection state changes
  useEffect(() => {
    if (!enabled || !currentDialogIdRef.current || !isConnected) {
      return
    }
    
    if (subscriptionRefs.current.size === 0 && lastSubscribedDialogIdRef.current !== currentDialogIdRef.current) {
      const client = clientRef.current
      if (!client) return
      
      const dialogId = currentDialogIdRef.current
      const decoder = new TextDecoder()
      
      const abort = abortControllerRef.current || new AbortController()
      if (!abortControllerRef.current) {
        abortControllerRef.current = abort
      }
      
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
      
      lastSubscribedDialogIdRef.current = dialogId
      setIsSubscribed(true)
      onSubscribedRef.current?.()
    } else if (subscriptionRefs.current.size > 0) {
      // We have subscriptions, just update the state
      setIsSubscribed(true)
    }
  }, [isConnected, enabled, topics, topicsKey])

  return { isConnected, isSubscribed, reconnectionCount }
}

/**
 * Utility function to build NATS WebSocket URL
 * Can be used to create the getNatsWsUrl callback
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
