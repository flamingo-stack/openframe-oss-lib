'use client';

import { useEffect, useRef, useState } from 'react';
import {
  acquireClient as acquireSharedClient,
  releaseClient as releaseSharedClient,
  startConnectionLifecycle,
  type Msg,
  type NatsClient,
  type NatsStatus,
  type NatsSubscriptionHandle,
} from '../../../nats';
import type {
  NatsConnectionSource,
  NatsMessageType,
  UseNatsDialogSubscriptionOptions,
  UseNatsDialogSubscriptionReturn,
} from '../types';

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
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [reconnectionCount, setReconnectionCount] = useState(0);

  const clientRef = useRef<NatsClient | null>(null);
  const subscriptionRefs = useRef<Map<NatsMessageType, NatsSubscriptionHandle | null>>(new Map());

  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const onConnectRef = useRef(onConnect);
  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  const onDisconnectRef = useRef(onDisconnect);
  useEffect(() => {
    onDisconnectRef.current = onDisconnect;
  }, [onDisconnect]);

  const onSubscribedRef = useRef(onSubscribed);
  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
  }, [onSubscribed]);

  const onBeforeReconnectRef = useRef(onBeforeReconnect);
  useEffect(() => {
    onBeforeReconnectRef.current = onBeforeReconnect;
  }, [onBeforeReconnect]);

  const hadConnectionBeforeRef = useRef(false);

  const getNatsWsUrlRef = useRef(getNatsWsUrl);
  useEffect(() => {
    getNatsWsUrlRef.current = getNatsWsUrl;
  }, [getNatsWsUrl]);

  const reconnectionBackoffRef = useRef(reconnectionBackoff);
  useEffect(() => {
    reconnectionBackoffRef.current = reconnectionBackoff;
  }, [reconnectionBackoff]);

  const clientConfigRef = useRef(clientConfig);
  useEffect(() => {
    clientConfigRef.current = clientConfig;
  }, [clientConfig]);

  const currentWsUrlRef = useRef<string>('');

  // Resolve the URL synchronously each render so the effect's dep is the URL string
  // itself, not the (often inline-allocated) getNatsWsUrl callback identity. Without
  // this the effect re-runs on every render that produces a new callback identity —
  // e.g. every silent token rotation when `useNatsAppConfig` rebuilds getWsUrl —
  // tearing the WS down and reacquiring even though the resolved URL hasn't changed.
  const wsUrl = getNatsWsUrl();

  const lastSubscribedDialogIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || !wsUrl) {
      if (currentWsUrlRef.current && clientRef.current) {
        releaseSharedClient(currentWsUrlRef.current);
        clientRef.current = null;
        currentWsUrlRef.current = '';
        setIsConnected(false);
      }
      return undefined;
    }

    // Skip if we're already connected to the same URL
    if (wsUrl === currentWsUrlRef.current && clientRef.current && clientRef.current.isConnected()) {
      return undefined;
    }

    if (currentWsUrlRef.current && currentWsUrlRef.current !== wsUrl && clientRef.current) {
      releaseSharedClient(currentWsUrlRef.current);
      clientRef.current = null;
      setIsConnected(false);
    }

    currentWsUrlRef.current = wsUrl;
    const cfg = clientConfigRef.current;
    const sharedConn = acquireSharedClient(wsUrl, {
      name: cfg.name ?? 'openframe-frontend',
      user: cfg.user ?? 'machine',
      pass: cfg.pass ?? '',
    });
    const client = sharedConn.client;

    clientRef.current = client;
    setIsConnected(client.isConnected());

    const tearDownSubscriptions = () => {
      subscriptionRefs.current.forEach(sub => {
        try {
          sub?.unsubscribe();
        } catch {
          // ignore
        }
      });
      subscriptionRefs.current.clear();
      lastSubscribedDialogIdRef.current = null;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };

    const isDisconnectStatus = (status: NatsStatus) => status === 'closed' || status === 'disconnected';

    const lifecycle = startConnectionLifecycle({
      conn: sharedConn,
      wsUrl,
      onBeforeReconnect: () => onBeforeReconnectRef.current?.(),
      backoff: reconnectionBackoffRef.current,
      getFreshUrl: () => getNatsWsUrlRef.current(),
      shouldRetryOn: isDisconnectStatus,
      onStatusChange: (status, evt) => {
        if (status === 'connected') {
          setIsConnected(true);
          if (hadConnectionBeforeRef.current) {
            setReconnectionCount(c => c + 1);
          }
          hadConnectionBeforeRef.current = true;
          onConnectRef.current?.();
        }
        if (status === 'error') {
          console.warn('[NATS] protocol error:', evt.data);
          return;
        }
        if (isDisconnectStatus(status)) {
          setIsConnected(false);
          setIsSubscribed(false);
          tearDownSubscriptions();
          onDisconnectRef.current?.();
        }
      },
    });

    return () => {
      lifecycle.stop();
      setIsConnected(false);
      setIsSubscribed(false);
      tearDownSubscriptions();

      if (clientRef.current && currentWsUrlRef.current) {
        releaseSharedClient(currentWsUrlRef.current);
        clientRef.current = null;
        currentWsUrlRef.current = '';
      }
    };
  }, [enabled, wsUrl]);

  // Key the subscription effects on the topics CONTENT, not the array
  // identity — hosts often pass an inline array, and an identity dep made
  // every render tear down + recreate the subscriptions (plain NATS delivers
  // nothing during that gap, so chunks were silently lost).
  const topicsKey = topics.join(',');
  const topicsRef = useRef(topics);
  const isConnectedRef = useRef(isConnected);

  // Both mirrors refreshed after every commit — `topicsRef` used to be written
  // in the render body, which publishes an array a discarded render attempt
  // produced. Every reader is inside a subscription effect or a NATS callback,
  // so none of them can run before this has caught up.
  useEffect(() => {
    topicsRef.current = topics;
    isConnectedRef.current = isConnected;
  });

  const currentDialogIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentDialogIdRef.current = dialogId;

    if (!enabled || !dialogId) {
      if (subscriptionRefs.current.size > 0) {
        setIsSubscribed(false);
        subscriptionRefs.current.forEach(sub => {
          try {
            sub?.unsubscribe();
          } catch {
            // ignore
          }
        });
        subscriptionRefs.current.clear();
        lastSubscribedDialogIdRef.current = null;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
      }
      return undefined;
    }

    const needsNewSubscription = lastSubscribedDialogIdRef.current !== dialogId || subscriptionRefs.current.size === 0;

    if (!needsNewSubscription) {
      return undefined;
    }

    if (subscriptionRefs.current.size > 0) {
      subscriptionRefs.current.forEach(sub => {
        try {
          sub?.unsubscribe();
        } catch {
          // ignore
        }
      });
      subscriptionRefs.current.clear();
      abortControllerRef.current?.abort();
    }

    abortControllerRef.current = new AbortController();
    const abort = abortControllerRef.current;

    const createSubscriptions = () => {
      if (!isConnectedRef.current) {
        return;
      }

      const client = clientRef.current;
      if (!client || currentDialogIdRef.current !== dialogId) {
        return;
      }

      const decoder = new TextDecoder();

      const handleMessage = (messageType: NatsMessageType) => (msg: Msg) => {
        if (!onEventRef.current) return;
        try {
          const dataStr = decoder.decode(msg.data);
          const parsed: unknown = JSON.parse(dataStr);
          onEventRef.current(parsed, messageType);
        } catch {
          // Ignore parse errors
        }
      };

      topicsRef.current.forEach(topic => {
        const subscription = client.subscribeBytes(`chat.${dialogId}.${topic}`, handleMessage(topic), {
          signal: abort.signal,
        });
        subscriptionRefs.current.set(topic, subscription);
      });

      lastSubscribedDialogIdRef.current = dialogId;
      setIsSubscribed(true);
      onSubscribedRef.current?.();
    };

    if (isConnectedRef.current) {
      createSubscriptions();
    }

    // Captured, not read through the ref in cleanup: the Map identity is
    // fixed for the component's life, and the local makes that explicit.
    const subscriptions = subscriptionRefs.current;
    return () => {
      setIsSubscribed(false);
      abort.abort();
      subscriptions.forEach(sub => {
        try {
          sub?.unsubscribe();
        } catch {
          // ignore
        }
      });
      subscriptions.clear();
      lastSubscribedDialogIdRef.current = null;
      abortControllerRef.current = null;
    };
  }, [enabled, dialogId, topicsKey]);

  useEffect(() => {
    if (!enabled || !currentDialogIdRef.current || !isConnected) {
      return;
    }

    if (subscriptionRefs.current.size === 0 && lastSubscribedDialogIdRef.current !== currentDialogIdRef.current) {
      const client = clientRef.current;
      if (!client) return;

      // Ref, not the `dialogId` prop in this effect's closure — the same
      // `current*` naming as use-chunk-catchup, and the only thing telling a
      // reader which of the two values this branch reads.
      const currentDialogId = currentDialogIdRef.current;
      const decoder = new TextDecoder();

      const abort = abortControllerRef.current || new AbortController();
      if (!abortControllerRef.current) {
        abortControllerRef.current = abort;
      }

      const handleMessage = (messageType: NatsMessageType) => (msg: Msg) => {
        if (!onEventRef.current) return;
        try {
          const dataStr = decoder.decode(msg.data);
          const parsed: unknown = JSON.parse(dataStr);
          onEventRef.current(parsed, messageType);
        } catch {
          // Ignore parse errors
        }
      };

      topicsRef.current.forEach(topic => {
        const subscription = client.subscribeBytes(`chat.${currentDialogId}.${topic}`, handleMessage(topic), {
          signal: abort.signal,
        });
        subscriptionRefs.current.set(topic, subscription);
      });

      lastSubscribedDialogIdRef.current = currentDialogId;
      setIsSubscribed(true);
      onSubscribedRef.current?.();
    } else if (subscriptionRefs.current.size > 0) {
      setIsSubscribed(true);
    }
  }, [isConnected, enabled, topicsKey]);

  return { isConnected, isSubscribed, reconnectionCount };
}

/**
 * Utility function to build NATS WebSocket URL
 * Can be used to create the getNatsWsUrl callback
 */
export function buildNatsWsUrl(
  apiBaseUrl: string,
  options?: {
    token?: string;
    includeAuthParam?: boolean;
    source?: NatsConnectionSource;
  },
): string {
  const path = options?.source === 'dashboard' ? '/ws/nats-api' : '/ws/nats';
  const u = new URL(path, apiBaseUrl);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';

  if (options?.includeAuthParam && options?.token) {
    u.searchParams.set('authorization', options.token);
  }

  return u.toString();
}
