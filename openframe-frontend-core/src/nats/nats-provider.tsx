'use client';

import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { NatsClient, NatsStatus } from './nats';
import {
  acquireClient,
  releaseClient,
  startConnectionLifecycle,
  type AcquireClientOptions,
  type NatsBeforeReconnect,
  type NatsReconnectionBackoff,
} from './shared-connection';

export interface NatsProviderProps {
  children: ReactNode;
  /** Return the current NATS WebSocket URL (or null when not yet available, e.g. unauthenticated). */
  getWsUrl: () => string | null;
  /** Called before each reconnect attempt. May return a verdict; see `NatsReconnectVerdict`. */
  onBeforeReconnect?: NatsBeforeReconnect;
  clientConfig?: AcquireClientOptions;
  reconnectionBackoff?: NatsReconnectionBackoff;
  /**
   * Bump this to force re-evaluating `getWsUrl()` (e.g. when auth state flips).
   * Provider does not subscribe to external auth state by itself.
   */
  urlRevision?: unknown;
}

export interface NatsContextValue {
  client: NatsClient | null;
  status: NatsStatus;
  isReady: boolean;
  reconnectionCount: number;
  /**
   * A `terminal` verdict stopped reconnecting; `status` stays `disconnected`. Reset when this
   * provider re-acquires (`urlRevision` changes); the connection itself stays terminal while
   * another consumer still holds it.
   */
  terminal: boolean;
}

const NatsContext = createContext<NatsContextValue | null>(null);

export function NatsProvider({
  children,
  getWsUrl,
  onBeforeReconnect,
  clientConfig,
  reconnectionBackoff,
  urlRevision,
}: NatsProviderProps) {
  const [client, setClient] = useState<NatsClient | null>(null);
  const [status, setStatus] = useState<NatsStatus>('closed');
  const [reconnectionCount, setReconnectionCount] = useState(0);
  const [terminal, setTerminal] = useState(false);

  const getWsUrlRef = useRef(getWsUrl);
  useEffect(() => {
    getWsUrlRef.current = getWsUrl;
  }, [getWsUrl]);

  const onBeforeReconnectRef = useRef(onBeforeReconnect);
  useEffect(() => {
    onBeforeReconnectRef.current = onBeforeReconnect;
  }, [onBeforeReconnect]);

  const reconnectionBackoffRef = useRef(reconnectionBackoff);
  useEffect(() => {
    reconnectionBackoffRef.current = reconnectionBackoff;
  }, [reconnectionBackoff]);

  const clientConfigRef = useRef(clientConfig);
  useEffect(() => {
    clientConfigRef.current = clientConfig;
  }, [clientConfig]);

  const heldUrlRef = useRef<string | null>(null);
  const hadConnectionBeforeRef = useRef(false);

  useEffect(() => {
    const wsUrl = getWsUrlRef.current();

    if (!wsUrl) {
      if (heldUrlRef.current) {
        releaseClient(heldUrlRef.current);
        heldUrlRef.current = null;
        setClient(null);
        setStatus('closed');
      }
      return undefined;
    }

    if (heldUrlRef.current && heldUrlRef.current !== wsUrl) {
      releaseClient(heldUrlRef.current);
      heldUrlRef.current = null;
    }

    const conn = acquireClient(wsUrl, clientConfigRef.current);
    heldUrlRef.current = wsUrl;
    setClient(conn.client);
    setStatus(conn.client.isConnected() ? 'connected' : 'connecting');

    const lifecycle = startConnectionLifecycle({
      conn,
      wsUrl,
      onBeforeReconnect: ctx => onBeforeReconnectRef.current?.(ctx),
      backoff: reconnectionBackoffRef.current,
      getFreshUrl: () => getWsUrlRef.current(),
      onTerminal: () => setTerminal(true),
      onStatusChange: newStatus => {
        if (newStatus === 'error') return;
        setStatus(newStatus);
        if (newStatus === 'connected') {
          if (hadConnectionBeforeRef.current) {
            setReconnectionCount(c => c + 1);
          }
          hadConnectionBeforeRef.current = true;
        }
      },
    });

    return () => {
      lifecycle.stop();
      if (heldUrlRef.current) {
        releaseClient(heldUrlRef.current);
        heldUrlRef.current = null;
      }
      setClient(null);
      setStatus('closed');
      setTerminal(false);
    };
  }, [urlRevision]);

  const value = useMemo<NatsContextValue>(
    () => ({
      client,
      status,
      isReady: status === 'connected' && client !== null,
      reconnectionCount,
      terminal,
    }),
    [client, status, reconnectionCount, terminal],
  );

  return <NatsContext.Provider value={value}>{children}</NatsContext.Provider>;
}

export function useNats(): NatsContextValue {
  const ctx = useContext(NatsContext);
  if (!ctx) throw new Error('useNats must be used inside <NatsProvider>');
  return ctx;
}

export function useOptionalNats(): NatsContextValue | null {
  return useContext(NatsContext);
}
