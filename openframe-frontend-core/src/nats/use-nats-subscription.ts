'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type { JsMsg, Msg, NatsSubscribeOptions } from './nats';
import { useOptionalNats } from './nats-provider';

export interface UseNatsSubscriptionOptions extends NatsSubscribeOptions {
  enabled?: boolean;
}

export interface UseNatsSubscriptionReturn {
  isSubscribed: boolean;
  isReady: boolean;
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
  const nats = useOptionalNats();
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  const enabled = options?.enabled !== false;
  const queue = options?.queue;
  const max = options?.max;
  const reconnectionCount = nats?.reconnectionCount ?? 0;
  const isReady = !!nats?.isReady;
  const client = nats?.client ?? null;

  // Not independent state. The effect below subscribes synchronously and
  // unconditionally whenever all four preconditions hold, and unsubscribes in
  // its cleanup — so "is there a live subscription" IS this predicate, and
  // storing it meant every subscribe and every teardown paid a second render
  // pass to report something the first render already knew.
  //
  // It also removes a spurious flap: a reconnect-driven re-subscribe used to
  // run `setIsSubscribed(false)` (cleanup) then `setIsSubscribed(true)` in the
  // same commit, so the value briefly described a gap that consumers could
  // never observe anyway.
  const isSubscribed = Boolean(client) && isReady && Boolean(subject) && enabled;

  useEffect(() => {
    if (!client || !isReady || !subject || !enabled) return undefined;

    const sub = client.subscribeBytes(subject, msg => handlerRef.current(msg), { queue, max });

    return () => {
      try {
        sub.unsubscribe();
      } catch {
        // ignore
      }
    };
    // reconnectionCount intentionally in deps: re-subscribe after reconnect
  }, [client, isReady, subject, enabled, queue, max, reconnectionCount]);

  return { isSubscribed, isReady };
}

export type UseNatsJsonSubscriptionOptions = UseNatsSubscriptionOptions;

export function useNatsJsonSubscription<T = unknown>(
  subject: string | null,
  onPayload: (payload: T, msg: Msg) => void | Promise<void>,
  options?: UseNatsJsonSubscriptionOptions,
): UseNatsSubscriptionReturn {
  const handlerRef = useRef(onPayload);
  useEffect(() => {
    handlerRef.current = onPayload;
  }, [onPayload]);

  // One decoder for the hook's lifetime. `useState`'s lazy initialiser instead
  // of a ref filled on first render: the guard is exactly the lazy-init shape
  // `useState` exists for, and it keeps the construction out of render. Null
  // on a server render, where `TextDecoder` may be absent — `wrapped` only
  // ever runs client-side, but the guard below keeps that explicit.
  const [decoder] = useState<TextDecoder | null>(() => (typeof TextDecoder !== 'undefined' ? new TextDecoder() : null));

  const wrapped = useCallback(
    async (msg: Msg) => {
      if (!decoder) return;
      try {
        const parsed = JSON.parse(decoder.decode(msg.data)) as T;
        await handlerRef.current(parsed, msg);
      } catch {
        // ignore malformed payloads
      }
    },
    [decoder],
  );

  return useNatsSubscription(subject, wrapped, options);
}

export type NatsJsMsg = JsMsg;
