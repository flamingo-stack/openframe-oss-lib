'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  acquireClient as acquireSharedClient,
  releaseClient as releaseSharedClient,
  startConnectionLifecycle,
  type JetStreamSubscriptionHandle,
  type NatsClient,
  type SharedConnection,
} from '../../../nats'
import {
  type UseJetStreamDialogSubscriptionOptions,
  type UseJetStreamDialogSubscriptionReturn,
} from '../types'

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
    (url: string): SharedConnection =>
      acquireSharedClient(url, {
        name: clientConfig.name ?? 'openframe-frontend-jetstream',
        user: clientConfig.user ?? 'machine',
        pass: clientConfig.pass ?? '',
      }),
    [clientConfig],
  )

  const releaseClient = useCallback((url: string) => {
    releaseSharedClient(url)
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
    setIsConnected(client.isConnected())

    const tearDownSubscription = () => {
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe()
        } catch {
          // ignore
        }
        subscriptionRef.current = null
      }
    }

    const lifecycle = startConnectionLifecycle({
      conn: sharedConn,
      wsUrl,
      onBeforeReconnect: () => onBeforeReconnectRef.current?.(),
      backoff: reconnectionBackoffRef.current,
      getFreshUrl: () => getNatsWsUrlRef.current(),
      // JetStream emits 'error' for protocol-level failures (e.g. -ERR Permissions
      // Violation when CONSUMER.CREATE is denied) without closing the WebSocket.
      // Retrying on 'error' would loop onBeforeReconnect on every -ERR; let the
      // subscribe effect surface those via its own rejected promise instead.
      shouldRetryOn: (status) => status === 'closed' || status === 'disconnected',
      onStatusChange: (status, evt) => {
        if (status === 'connected') {
          setIsConnected(true)
          if (hadConnectionBeforeRef.current) {
            setReconnectionCount((c) => c + 1)
          }
          hadConnectionBeforeRef.current = true
          onConnectRef.current?.()
        }
        if (status === 'error') {
          console.warn('[JetStream] NATS protocol error:', evt.data)
          return
        }
        if (status === 'closed' || status === 'disconnected') {
          setIsConnected(false)
          setIsSubscribed(false)
          tearDownSubscription()
          onDisconnectRef.current?.()
        }
      },
    })

    return () => {
      lifecycle.stop()
      setIsConnected(false)
      setIsSubscribed(false)
      tearDownSubscription()

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
