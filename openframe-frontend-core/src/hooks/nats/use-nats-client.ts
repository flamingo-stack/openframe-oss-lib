import { useEffect, useMemo, useState } from 'react';

import type { NatsClient, NatsClientOptions, NatsStatus } from '../../nats';
import { createNatsClient } from '../../nats';

export interface UseNatsClientOptions {
  /**
   * When true, connect on mount and close on unmount.
   */
  autoConnect?: boolean;
}

export interface UseNatsClientResult {
  client: NatsClient | null;
  status: NatsStatus;
  isConnected: boolean;
  lastError: unknown;
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
  const { autoConnect = true } = options;

  const client = useMemo(() => {
    if (!clientOptions) return null;
    return createNatsClient(clientOptions);
  }, [clientOptions]);

  const [status, setStatus] = useState<NatsStatus>('disconnected');
  const [lastError, setLastError] = useState<unknown>(null);
  const [statusClient, setStatusClient] = useState(client);

  // Reset while rendering (React's documented prop-sync pattern) rather than
  // from the effect below. `client.onStatus` does NOT replay the current status
  // to a new listener, so a swapped-in client emits nothing until it actually
  // changes state — leaving `status`/`lastError` describing the PREVIOUS
  // client. A fresh client from `createNatsClient` is genuinely disconnected
  // and error-free at this point, so that is what we report until it says
  // otherwise.
  if (statusClient !== client) {
    setStatusClient(client);
    setStatus('disconnected');
    setLastError(null);
  }

  useEffect(() => {
    if (!client) return undefined;

    const off = client.onStatus(event => {
      setStatus(event.status);
      if (event.status === 'error') setLastError(event.data);
    });

    if (autoConnect) {
      client.connect().catch((e: unknown) => {
        setLastError(e);
        setStatus('error');
      });
    }

    return () => {
      off();
      client.close().catch(() => {
        // ignore
      });
    };
  }, [client, autoConnect]);

  return {
    client,
    status,
    isConnected: status === 'connected',
    lastError,
  };
}
