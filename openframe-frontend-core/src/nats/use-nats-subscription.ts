'use client'

import * as React from 'react'
import type { JsMsg, Msg, NatsSubscribeOptions } from './nats'
import { useOptionalNats } from './nats-provider'

export interface UseNatsSubscriptionOptions extends NatsSubscribeOptions {
  enabled?: boolean
}

export interface UseNatsSubscriptionReturn {
  isSubscribed: boolean
  isReady: boolean
}

/**
 * Subscribe to a NATS subject using the shared connection from <NatsProvider>.
 * Automatically (re)subscribes when the connection becomes ready, when the
 * subject changes, and after reconnections.
 */
export function useNatsSubscription(
  subject: string | null,
  onMessage: (msg: Msg) => void | Promise<void>,
  options?: UseNatsSubscriptionOptions,
): UseNatsSubscriptionReturn {
  const nats = useOptionalNats()
  const handlerRef = React.useRef(onMessage)
  React.useEffect(() => {
    handlerRef.current = onMessage
  }, [onMessage])

  const [isSubscribed, setIsSubscribed] = React.useState(false)

  const enabled = options?.enabled !== false
  const queue = options?.queue
  const max = options?.max
  const reconnectionCount = nats?.reconnectionCount ?? 0
  const isReady = !!nats?.isReady
  const client = nats?.client ?? null

  React.useEffect(() => {
    if (!client || !isReady || !subject || !enabled) {
      setIsSubscribed(false)
      return
    }

    const sub = client.subscribeBytes(
      subject,
      (msg) => handlerRef.current(msg),
      { queue, max },
    )
    setIsSubscribed(true)

    return () => {
      setIsSubscribed(false)
      try {
        sub.unsubscribe()
      } catch {
        // ignore
      }
    }
    // reconnectionCount intentionally in deps: re-subscribe after reconnect
  }, [client, isReady, subject, enabled, queue, max, reconnectionCount])

  return { isSubscribed, isReady }
}

export type UseNatsJsonSubscriptionOptions = UseNatsSubscriptionOptions

export function useNatsJsonSubscription<T = unknown>(
  subject: string | null,
  onPayload: (payload: T, msg: Msg) => void | Promise<void>,
  options?: UseNatsJsonSubscriptionOptions,
): UseNatsSubscriptionReturn {
  const handlerRef = React.useRef(onPayload)
  React.useEffect(() => {
    handlerRef.current = onPayload
  }, [onPayload])

  const decoderRef = React.useRef<TextDecoder | null>(null)
  if (!decoderRef.current && typeof TextDecoder !== 'undefined') {
    decoderRef.current = new TextDecoder()
  }

  const wrapped = React.useCallback(async (msg: Msg) => {
    const decoder = decoderRef.current
    if (!decoder) return
    try {
      const parsed = JSON.parse(decoder.decode(msg.data)) as T
      await handlerRef.current(parsed, msg)
    } catch {
      // ignore malformed payloads
    }
  }, [])

  return useNatsSubscription(subject, wrapped, options)
}

export type NatsJsMsg = JsMsg
