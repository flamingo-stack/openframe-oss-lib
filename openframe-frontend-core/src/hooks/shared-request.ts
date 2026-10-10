'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { contentFetch } from '../utils/embed-content-fetch';

export interface SharedRequestState<T> {
  /** The server's answer; null until it lands. */
  data: T | null;
  isLoading: boolean;
  error: boolean;
}

export interface SharedRequestOptions<T> {
  /** GET endpoint. Embedders pass their proxy path. */
  endpoint: string;
  /** The server's copy (a host that read it during SSR): no request is made. */
  initialData?: T;
  /** False: nothing is requested. Default true. */
  enabled?: boolean;
}

interface Entry<T> {
  state: SharedRequestState<T>;
  request: Promise<void> | null;
  listeners: Set<() => void>;
}

/**
 * A public GET every caller on a page shares: ONE request and one answer per
 * endpoint for the life of the page, through `contentFetch` (so an embedder's
 * auth adapter and proxy apply). For a record the server changes only when it
 * is edited or redeployed, never while a page is open: what the apps are
 * installed from (`useDownloads`), the AI agents' identities
 * (`useAgentIdentities`).
 *
 * `read` turns the response body into the answer the callers hold.
 */
export function createSharedRequest<T>(read: (body: unknown) => T = body => body as T) {
  const entries = new Map<string, Entry<T>>();
  const idle: SharedRequestState<T> = { data: null, isLoading: false, error: false };

  function entryFor(endpoint: string): Entry<T> {
    let entry = entries.get(endpoint);
    if (!entry) {
      entry = { state: idle, request: null, listeners: new Set() };
      entries.set(endpoint, entry);
    }
    return entry;
  }

  function publish(endpoint: string, state: SharedRequestState<T>) {
    const entry = entryFor(endpoint);
    entry.state = state;
    for (const listener of entry.listeners) listener();
  }

  function load(endpoint: string, force = false): void {
    const entry = entryFor(endpoint);
    if (entry.request || (entry.state.data && !force)) return;
    publish(endpoint, { data: entry.state.data, isLoading: true, error: false });
    entry.request = contentFetch(endpoint)
      .then(async response => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        publish(endpoint, { data: read(await response.json()), isLoading: false, error: false });
      })
      .catch(() => publish(endpoint, { data: entry.state.data, isLoading: false, error: true }))
      .finally(() => {
        entry.request = null;
      });
  }

  function useSharedRequest({ endpoint, initialData, enabled = true }: SharedRequestOptions<T>) {
    const entry = entryFor(endpoint);
    // A server copy is the answer: held from the first render (server and client alike), and never re-requested.
    // Written during render so THIS caller's first paint has it; a render cannot notify other callers.
    if (initialData && entry.state.data !== initialData && !entry.request) {
      entry.state = { data: initialData, isLoading: false, error: false };
    }
    // So the callers that rendered before this one (a header button above the page) are told after
    // the commit: they re-read the shared answer instead of staying on the empty one they first saw.
    useEffect(() => {
      if (!initialData) return;
      for (const listener of entry.listeners) listener();
    }, [entry, initialData]);
    const subscribe = useCallback(
      (listener: () => void) => {
        entry.listeners.add(listener);
        return () => {
          entry.listeners.delete(listener);
        };
      },
      [entry],
    );
    const state = useSyncExternalStore(
      subscribe,
      () => entry.state,
      () => entry.state,
    );

    useEffect(() => {
      if (enabled) load(endpoint);
    }, [enabled, endpoint]);

    const reload = useCallback(() => load(endpoint, true), [endpoint]);
    // Until the effect has asked, an enabled caller with no answer is loading, not empty.
    const isLoading = state.isLoading || (enabled && !state.data && !state.error);
    return { data: state.data, isLoading, error: state.error, reload };
  }

  return {
    useSharedRequest,
    /** Test seam: forget every answer. */
    reset: () => entries.clear(),
  };
}
