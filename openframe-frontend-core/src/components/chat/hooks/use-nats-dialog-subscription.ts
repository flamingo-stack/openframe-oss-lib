'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acquireClient as acquireSharedClient,
  releaseClient as releaseSharedClient,
  startConnectionLifecycle,
  type NatsClient,
  type NatsStatus,
  type NatsSubscriptionHandle,
  type SharedConnection,
} from '../../../nats'
import {
  type NatsConnectionSource,
  type NatsMessageType,
  type UseNatsDialogSubscriptionOptions,
  type UseNatsDialogSubscriptionReturn,
} from '../types'

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
  reconnectionBackoff,
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

  const hadConnectionBeforeRef = useRef(false)

  const getNatsWsUrlRef = useRef(getNatsWsUrl)
  useEffect(() => {
    getNatsWsUrlRef.current = getNatsWsUrl
  }, [getNatsWsUrl])

  const reconnectionBackoffRef = useRef(reconnectionBackoff)
  useEffect(() => {
    reconnectionBackoffRef.current = reconnectionBackoff
  }, [reconnectionBackoff])

  const acquireClient = useCallback(
    (url: string): SharedConnection =>
      acquireSharedClient(url, {
        name: clientConfig.name ?? 'openframe-frontend',
        user: clientConfig.user ?? 'machine',
        pass: clientConfig.pass ?? '',
      }),
    [clientConfig],
  )

  const releaseClient = useCallback((url: string) => {
    releaseSharedClient(url)
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
    setIsConnected(client.isConnected())

    const tearDownSubscriptions = () => {
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

    // This hook treats 'error' as a disconnect (pre-existing behaviour); JetStream's
    // hook does not — it skips retry on protocol errors.
    const isDisconnectStatus = (status: NatsStatus) =>
      status === 'closed' || status === 'disconnected' || status === 'error'

    const lifecycle = startConnectionLifecycle({
      conn: sharedConn,
      wsUrl,
      onBeforeReconnect: () => onBeforeReconnectRef.current?.(),
      backoff: reconnectionBackoffRef.current,
      getFreshUrl: () => getNatsWsUrlRef.current(),
      shouldRetryOn: isDisconnectStatus,
      onStatusChange: (status) => {
        if (status === 'connected') {
          setIsConnected(true)
          if (hadConnectionBeforeRef.current) {
            setReconnectionCount((c) => c + 1)
          }
          hadConnectionBeforeRef.current = true
          onConnectRef.current?.()
        }
        if (isDisconnectStatus(status)) {
          setIsConnected(false)
          setIsSubscribed(false)
          tearDownSubscriptions()
          onDisconnectRef.current?.()
        }
      },
    })

    return () => {
      lifecycle.stop()
      setIsConnected(false)
      setIsSubscribed(false)
      tearDownSubscriptions()

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
    source?: NatsConnectionSource
  }
): string {
  const path = options?.source === 'dashboard' ? '/ws/nats-api' : '/ws/nats'
  const u = new URL(path, apiBaseUrl)
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'

  if (options?.includeAuthParam && options?.token) {
    u.searchParams.set('authorization', options.token)
  }
  
  return u.toString()
}
