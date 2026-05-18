'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createNatsClient,
  type JetStreamSubscriptionHandle,
  type NatsClient,
} from '../../../nats'
import {
  type UseJetStreamDialogSubscriptionOptions,
  type UseJetStreamDialogSubscriptionReturn,
  NETWORK_CONFIG,
} from '../types'

type SharedConnection = {
  wsUrl: string
  client: NatsClient
  connectPromise: Promise<void> | null
  refCount: number
  closeTimer: ReturnType<typeof setTimeout> | null
  retryTimer: ReturnType<typeof setTimeout> | null
}

let shared: SharedConnection | null = null

const DEFAULT_INACTIVE_THRESHOLD_MS = 5 * 60_000
const DEFAULT_STREAM_NAME = 'CHAT_CHUNKS'

/**
 * Subscribe to a chat dialog stream via a JetStream **ephemeral OrderedConsumer**.
 *
 * - Subject: `chat.{dialogId}.{topic}`
 * - When `optStartSeq` is a number, the consumer resumes at `optStartSeq + 1`
 *   (`DeliverPolicy.ByStartSequence`). When null/undefined, it live-tails
 *   (`DeliverPolicy.New`).
 * - On reconnect, the consumer is recreated starting from the highest stream
 *   sequence we've already observed + 1, so no chunk is replayed or skipped.
 * - Consumer is ephemeral with `AckPolicy.None` and a 5-minute inactivity
 *   threshold (overridable via `inactiveThresholdMs`).
 */
export function useJetStreamDialogSubscription({
  enabled,
  dialogId,
  streamName = DEFAULT_STREAM_NAME,
  topic,
  optStartSeq,
  onEvent,
  onConnect,
  onDisconnect,
  onSubscribed,
  onBeforeReconnect,
  getNatsWsUrl,
  clientConfig = {},
  reconnectionBackoff,
  inactiveThresholdMs,
}: UseJetStreamDialogSubscriptionOptions): UseJetStreamDialogSubscriptionReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [reconnectionCount, setReconnectionCount] = useState(0)
  const [currentStreamSeq, setCurrentStreamSeq] = useState<number | null>(null)

  const clientRef = useRef<NatsClient | null>(null)
  const subscriptionRef = useRef<JetStreamSubscriptionHandle | null>(null)
  const highestStreamSeqRef = useRef<number | null>(null)

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

  const getNatsWsUrlRef = useRef(getNatsWsUrl)
  useEffect(() => {
    getNatsWsUrlRef.current = getNatsWsUrl
  }, [getNatsWsUrl])

  const reconnectionBackoffRef = useRef(reconnectionBackoff)
  useEffect(() => {
    reconnectionBackoffRef.current = reconnectionBackoff
  }, [reconnectionBackoff])

  const optStartSeqRef = useRef<number | null | undefined>(optStartSeq)
  useEffect(() => {
    optStartSeqRef.current = optStartSeq
  }, [optStartSeq])

  const inactiveThresholdRef = useRef<number | undefined>(inactiveThresholdMs)
  useEffect(() => {
    inactiveThresholdRef.current = inactiveThresholdMs
  }, [inactiveThresholdMs])

  const hadConnectionBeforeRef = useRef(false)

  const acquireClient = useCallback(
    (url: string): SharedConnection => {
      if (shared?.wsUrl !== url) {
        if (shared) {
          if (shared.closeTimer) clearTimeout(shared.closeTimer)
          const old = shared
          shared = null
          void old.client.close().catch(() => {})
        }

        const { name = 'openframe-frontend-jetstream', user = 'machine', pass = '' } = clientConfig

        const client = createNatsClient({
          servers: url,
          name,
          user,
          pass,
          connectTimeoutMs: NETWORK_CONFIG.CONNECT_TIMEOUT_MS,
          reconnect: false,
          pingIntervalMs: NETWORK_CONFIG.PING_INTERVAL_MS,
          maxPingOut: NETWORK_CONFIG.MAX_PING_OUT,
        })
        shared = {
          wsUrl: url,
          client,
          connectPromise: null,
          refCount: 0,
          closeTimer: null,
          retryTimer: null,
        }
      }

      shared.refCount += 1
      if (shared.closeTimer) {
        clearTimeout(shared.closeTimer)
        shared.closeTimer = null
      }
      return shared
    },
    [clientConfig],
  )

  const releaseClient = useCallback((url: string) => {
    if (!shared || shared.wsUrl !== url) return

    shared.refCount = Math.max(0, shared.refCount - 1)
    if (shared.refCount > 0) return

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
    }, NETWORK_CONFIG.SHARED_CLOSE_DELAY_MS)
  }, [])

  const currentWsUrlRef = useRef<string>('')

  // Connection lifecycle: acquire/release the shared client based on enabled + URL.
  useEffect(() => {
    const wsUrl = getNatsWsUrl()
    if (!enabled || !wsUrl) {
      if (currentWsUrlRef.current && clientRef.current) {
        releaseClient(currentWsUrlRef.current)
        clientRef.current = null
        currentWsUrlRef.current = ''
        setIsConnected(false)
      }
      return
    }

    if (
      wsUrl === currentWsUrlRef.current &&
      clientRef.current &&
      clientRef.current.isConnected()
    ) {
      return
    }

    if (
      currentWsUrlRef.current &&
      currentWsUrlRef.current !== wsUrl &&
      clientRef.current
    ) {
      releaseClient(currentWsUrlRef.current)
      clientRef.current = null
      setIsConnected(false)
    }

    currentWsUrlRef.current = wsUrl
    const sharedConn = acquireClient(wsUrl)
    const client = sharedConn.client

    clientRef.current = client
    setIsConnected(false)

    let closed = false
    let retryAttempt = 0

    function scheduleRetry() {
      if (closed) return
      if (shared !== sharedConn) return

      if (sharedConn.retryTimer) {
        clearTimeout(sharedConn.retryTimer)
        sharedConn.retryTimer = null
      }

      const cfg = reconnectionBackoffRef.current ?? {}
      const fastRetries = cfg.fastRetries ?? 0
      const fastDelay = cfg.fastRetryDelayMs ?? NETWORK_CONFIG.RETRY_INITIAL_DELAY_MS
      const baseDelay = cfg.initialDelayMs ?? NETWORK_CONFIG.RETRY_INITIAL_DELAY_MS
      const maxDelay = cfg.maxDelayMs ?? NETWORK_CONFIG.RETRY_MAX_DELAY_MS
      const multiplier = cfg.multiplier ?? NETWORK_CONFIG.RETRY_BACKOFF_MULTIPLIER

      const delay =
        retryAttempt < fastRetries
          ? fastDelay
          : Math.min(baseDelay * multiplier ** (retryAttempt - fastRetries), maxDelay)
      const jitteredDelay = delay * (0.5 + Math.random() * 0.5)
      retryAttempt++

      sharedConn.retryTimer = setTimeout(async () => {
        sharedConn.retryTimer = null
        if (closed) return
        if (shared !== sharedConn) return

        try {
          await onBeforeReconnectRef.current?.()
        } catch {
          // Token refresh failed; still try to reconnect.
        }

        if (closed) return
        if (shared !== sharedConn) return

        const freshUrl = getNatsWsUrlRef.current()
        if (freshUrl !== wsUrl) return

        try {
          sharedConn.connectPromise = null
          sharedConn.connectPromise = client.connect()
          await sharedConn.connectPromise
          if (!closed && shared === sharedConn) {
            retryAttempt = 0
            setIsConnected(true)
          }
        } catch {
          sharedConn.connectPromise = null
          if (!closed && shared === sharedConn) {
            scheduleRetry()
          }
        }
      }, jitteredDelay)
    }

    const unsubscribeStatus = client.onStatus((event) => {
      const connected = event.status === 'connected'
      const disconnected = ['closed', 'disconnected', 'error'].includes(event.status)
      if (connected) {
        setIsConnected(true)
        if (hadConnectionBeforeRef.current) {
          setReconnectionCount((c) => c + 1)
        }
        hadConnectionBeforeRef.current = true
        retryAttempt = 0
        onConnectRef.current?.()
      }
      if (disconnected) {
        setIsConnected(false)
        setIsSubscribed(false)

        if (subscriptionRef.current) {
          try {
            subscriptionRef.current.unsubscribe()
          } catch {
            // ignore
          }
          subscriptionRef.current = null
        }

        onDisconnectRef.current?.()
        scheduleRetry()
      }
    })

    ;(async () => {
      try {
        sharedConn.connectPromise ||= client.connect()
        await sharedConn.connectPromise
        if (!closed) {
          setIsConnected(true)
          hadConnectionBeforeRef.current = true
        }
      } catch {
        sharedConn.connectPromise = null
        if (!closed) {
          setIsConnected(false)
          onDisconnectRef.current?.()
          scheduleRetry()
        }
      }
    })()

    return () => {
      closed = true
      setIsConnected(false)
      setIsSubscribed(false)
      unsubscribeStatus()

      if (sharedConn.retryTimer) {
        clearTimeout(sharedConn.retryTimer)
        sharedConn.retryTimer = null
      }

      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe()
        } catch {
          // ignore
        }
        subscriptionRef.current = null
      }

      if (clientRef.current && currentWsUrlRef.current) {
        releaseClient(currentWsUrlRef.current)
        clientRef.current = null
        currentWsUrlRef.current = ''
      }
    }
  }, [enabled, getNatsWsUrl, acquireClient, releaseClient])

  // Subscription lifecycle: (re)create the ephemeral JetStream consumer whenever
  // we transition into a connected state for a dialog, and whenever the dialog
  // changes. On reconnect we resume from highestStreamSeq + 1.
  useEffect(() => {
    if (!enabled || !dialogId || !isConnected) {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe()
        } catch {
          // ignore
        }
        subscriptionRef.current = null
      }
      setIsSubscribed(false)
      return
    }

    const client = clientRef.current
    if (!client) return

    const abortController = new AbortController()
    const decoder = new TextDecoder()
    const filterSubject = `chat.${dialogId}.${topic}`

    const resumeSeq = highestStreamSeqRef.current
    const initialOptStart = optStartSeqRef.current
    const startSeq =
      resumeSeq != null ? resumeSeq + 1 : initialOptStart != null ? initialOptStart + 1 : undefined

    let cancelled = false

    void (async () => {
      try {
        const handle = await client.subscribeJetStreamOrdered(
          (msg) => {
            if (cancelled) return
            const streamSeq = msg.info.streamSequence
            if (typeof streamSeq === 'number') {
              if (
                highestStreamSeqRef.current == null ||
                streamSeq > highestStreamSeqRef.current
              ) {
                highestStreamSeqRef.current = streamSeq
                setCurrentStreamSeq(streamSeq)
              }
            }
            const cb = onEventRef.current
            if (!cb) return
            try {
              const parsed = JSON.parse(decoder.decode(msg.data)) as Record<string, unknown>
              if (typeof streamSeq === 'number') {
                ;(parsed as { streamSeq?: number }).streamSeq = streamSeq
              }
              cb(parsed, topic)
            } catch {
              // Ignore malformed payloads.
            }
          },
          {
            streamName,
            filterSubject,
            deliverPolicy: startSeq != null ? 'byStartSequence' : 'new',
            optStartSeq: startSeq,
            inactiveThresholdMs: inactiveThresholdRef.current ?? DEFAULT_INACTIVE_THRESHOLD_MS,
            signal: abortController.signal,
          },
        )

        if (cancelled) {
          try {
            handle.unsubscribe()
          } catch {
            // ignore
          }
          return
        }

        subscriptionRef.current = handle
        setIsSubscribed(true)
        onSubscribedRef.current?.()
      } catch {
        if (!cancelled) {
          setIsSubscribed(false)
        }
      }
    })()

    return () => {
      cancelled = true
      abortController.abort()
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe()
        } catch {
          // ignore
        }
        subscriptionRef.current = null
      }
      setIsSubscribed(false)
    }
  }, [enabled, dialogId, isConnected, streamName, topic, reconnectionCount])

  // Reset the highest-seen sequence whenever the dialog changes so a new dialog
  // starts from optStartSeq (or DeliverPolicy.New) rather than the previous
  // dialog's offset.
  useEffect(() => {
    highestStreamSeqRef.current = null
    setCurrentStreamSeq(null)
  }, [dialogId])

  return { isConnected, isSubscribed, reconnectionCount, currentStreamSeq }
}
