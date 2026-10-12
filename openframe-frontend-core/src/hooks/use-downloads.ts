'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { DOWNLOADS_API_PATH, type AppDownload, type DownloadsPublic } from '../types/downloads';
import { contentFetch } from '../utils/embed-content-fetch';
import { desktopOsOf } from '../utils/visitor-os';
import { useVisitorOs } from './ui/use-visitor-os';

export interface DownloadsState {
  /** The server's answer; null until it lands. */
  data: DownloadsPublic | null;
  isLoading: boolean;
  error: boolean;
}

interface Entry {
  state: DownloadsState;
  request: Promise<void> | null;
  listeners: Set<() => void>;
}

const IDLE: DownloadsState = { data: null, isLoading: false, error: false };

/**
 * One entry per endpoint for the life of the page. Every download button on a
 * page asks the same question, so they share ONE request and one answer: the
 * list changes only when the server is redeployed, never while a page is open.
 */
const entries = new Map<string, Entry>();

function entryFor(endpoint: string): Entry {
  let entry = entries.get(endpoint);
  if (!entry) {
    entry = { state: IDLE, request: null, listeners: new Set() };
    entries.set(endpoint, entry);
  }
  return entry;
}

function publish(endpoint: string, state: DownloadsState) {
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
      publish(endpoint, { data: (await response.json()) as DownloadsPublic, isLoading: false, error: false });
    })
    .catch(() => publish(endpoint, { data: entry.state.data, isLoading: false, error: true }))
    .finally(() => {
      entry.request = null;
    });
}

/** Test seam: forget every answer. */
export function resetDownloadsStore(): void {
  entries.clear();
}

export interface UseDownloadsOptions {
  /** GET endpoint for the public projection. Default `DOWNLOADS_API_PATH`; embedders pass their proxy path. */
  endpoint?: string;
  /** The server's copy (a host that read it during SSR): no request is made. */
  initialData?: DownloadsPublic;
  /** False: nothing is requested (a host that does not offer the desktop app). Default true. */
  enabled?: boolean;
}

/**
 * What the OpenFrame desktop app is installed from, read FROM THE SERVER
 * (`GET /api/downloads`). The links and package names live in the server's
 * environment; no client holds a copy of its own. Every caller on a page shares
 * one request.
 */
export function useDownloads({ endpoint = DOWNLOADS_API_PATH, initialData, enabled = true }: UseDownloadsOptions = {}) {
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

export interface VisitorDesktopDownload {
  /** False until the visitor's system AND the server's list are both known. */
  known: boolean;
  /** This visitor's installer (the first one for their system); null when nothing installs on it. */
  download: AppDownload | null;
}

/**
 * The installer a download button offers THIS visitor: the server's first
 * installer for the system they are on. `enabled: false` asks for nothing.
 */
export function useVisitorDesktopDownload(options: UseDownloadsOptions = {}): VisitorDesktopDownload {
  const enabled = options.enabled ?? true;
  const visitor = useVisitorOs();
  const { data, error } = useDownloads(options);
  if (!enabled || !visitor.known || (!data && !error)) return { known: false, download: null };
  const os = desktopOsOf(visitor.os);
  const download = data?.desktop.find(row => row.kind === 'binary' && row.url && row.os === os) ?? null;
  return { known: true, download };
}
