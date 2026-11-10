'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { subscribeRegisteredAdapter } from '../utils/embed-auth-adapter-registry';
import {
  answeredAfterRefresh,
  assetLoadMode,
  embedAuthedFetch,
  resolveAssetUrl,
  subscribeEmbedCredentialChange,
} from '../utils/embed-authed-fetch';
import { useIsomorphicLayoutEffect } from './ui/use-isomorphic-layout-effect';

/**
 * Resolve ANY asset URL the browser would load natively — `<img src>`,
 * `<track src>`, a font, a poster — on every host:
 *
 *   1. The host's `resolveAssetUrl` says where the URL lives, so a backend path
 *      the page's origin does not serve is drawn from the gateway.
 *   2. Where auth rides in request HEADERS instead of cookies (native shells,
 *      `capacitor://` / `tauri://`, and dev-ticket web, both in bearer mode), a
 *      native subresource load can't carry the `Authorization` header and gets
 *      a 401. Such a URL is fetched through `embedAuthedFetch` (bearer + deduped
 *      401-refresh-retry + the adapter's cross-origin guard) and drawn from a
 *      blob object-URL. Every other URL is drawn as it stands, so on the
 *      cookie-auth web this is a pass-through.
 *
 * The state lives in ONE module store read through `useSyncExternalStore`, so
 * every mounted consumer follows it, memoized or not:
 *
 *   - A shell renders before its tokens arrive. A gateway URL is then `pending`
 *     (nothing is drawn, nothing is requested) and is fetched as soon as the
 *     adapter reports a credential (`subscribeEmbedCredentialChange`), a new
 *     adapter registers, or a consumer renders and finds one. It used to be
 *     handed to a native `<img>` at that first render, which got a 401 and was
 *     never asked again.
 *   - `failed` is its own state, so a caller can show its fallback at once, and
 *     it stays `failed` while a retry runs. What is retried, and when:
 *       - no answer at all (offline, a refused redirect): on the next credential
 *         and when the browser comes back online;
 *       - a 401 that `embedAuthedFetch` could not refresh its way past (no new
 *         credential came of it): on the next credential;
 *       - anything else, including a 401 to the retry `embedAuthedFetch` sent
 *         with a credential it had just refreshed (`answeredAfterRefresh`): only
 *         when a consumer mounts again after every one let go. A new credential
 *         cannot lift that refusal, and retrying it on each rotation would rotate
 *         again: two such pictures would keep rotating the session between them.
 *   - `clearAuthedAssetCache` (session end) drops every blob; consumers still
 *     mounted go back to `pending` and fetch again with whatever credential the
 *     host holds when one next asks (see there).
 *   - A 2xx `text/html` answer is a failure, not a picture: a native shell's
 *     asset server answers an unknown path with its SPA page.
 *
 * Reading the state through the store also keeps it correct under the React
 * Compiler: a module map read during render is memoized on its key, so a hook
 * that read `cache.get(src)` there would keep the `undefined` it saw before the
 * fetch finished.
 *
 * Cache: keyed by the resolved URL, so the same avatar in twenty rows costs one
 * request. Gateway URLs carry a `?v=<content-hash>` cache-buster, so changed
 * content is a new key. Entries are reference-counted by the mounted consumers
 * and revoked RELEASE_DELAY_MS after the last one unmounts (a remount inside
 * that window keeps the blob): in a desktop shell open for days, every distinct
 * picture ever shown would otherwise stay in memory.
 */

/** What a consumer draws, and why. */
export type AuthedAssetStatus =
  /** Draw `src` as it stands: the browser loads it itself. */
  | 'native'
  /** Nothing to draw yet: waiting for a credential, or the first authed fetch is in flight. */
  | 'pending'
  /** `src` is the fetched blob. */
  | 'ready'
  /** The authed fetch failed (a retry may be running); `url` is what was asked for. */
  | 'failed';

export interface AuthedAsset {
  /** What to draw: the URL (`native`), its blob (`ready`), or nothing (`pending`, `failed`, or no URL given). */
  readonly src: string | undefined;
  /** The URL after the host's `resolveAssetUrl`; `undefined` when none was given. */
  readonly url: string | undefined;
  readonly status: AuthedAssetStatus;
}

/** What makes a failed entry worth asking again (see the header). */
type RetryOn = 'credential-or-online' | 'credential' | 'remount';

type EntryState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly afterFailure: boolean }
  | { readonly status: 'ready'; readonly blobUrl: string }
  | { readonly status: 'failed'; readonly retryOn: RetryOn };

interface Entry {
  state: EntryState;
  accept: string;
  refs: number;
  releaseTimer: ReturnType<typeof setTimeout> | undefined;
}

/**
 * Why an entry is being looked at:
 * - `join`: another consumer joining, or a consumer rendering while it waits. Starts only an idle entry.
 * - `mount`: the first consumer back after every one let go. Also retries any failure.
 * - `credential`: the adapter's credential changed, or a new adapter registered.
 * - `online`: the browser came back online.
 */
type Trigger = 'join' | 'mount' | 'credential' | 'online';

/** How long an unused blob is kept before it is revoked, in ms. */
const RELEASE_DELAY_MS = 60_000;

const IDLE: EntryState = { status: 'idle' };

/** A non-2xx answer, or a page where an asset was asked for. */
class AssetResponseError extends Error {
  readonly status: number;
  readonly afterRefresh: boolean;

  constructor(response: Response) {
    super(`asset fetch failed: ${response.status}`);
    this.status = response.status;
    this.afterRefresh = answeredAfterRefresh(response);
  }
}

const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
/** Moves on `clearAuthedAssetCache`: fences fetches started under the previous session. */
let cacheGeneration = 0;
let notifyScheduled = false;
let detachSources: (() => void) | null = null;

function notify(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  // One pass per burst: a credential change can settle dozens of entries at once.
  queueMicrotask(() => {
    notifyScheduled = false;
    for (const listener of [...listeners]) listener();
  });
}

/** Settle `url`'s entry, unless it was dropped or the cache cleared since `entry` was read. */
function settle(url: string, entry: Entry, generation: number, state: EntryState): boolean {
  const current = entries.get(url);
  if (generation !== cacheGeneration || current !== entry) return false;
  current.state = state;
  notify();
  return true;
}

function due(state: EntryState, trigger: Trigger): boolean {
  if (state.status === 'idle') return true;
  if (state.status !== 'failed') return false;
  switch (trigger) {
    case 'mount':
      return true;
    case 'credential':
      return state.retryOn !== 'remount';
    case 'online':
      return state.retryOn === 'credential-or-online';
    default:
      return false;
  }
}

function retryOnFor(error: unknown): RetryOn {
  // `fetch` rejects with a TypeError when the request got no answer at all: offline, DNS, a refused redirect.
  if (error instanceof TypeError) return 'credential-or-online';
  if (error instanceof AssetResponseError && error.status === 401 && !error.afterRefresh) return 'credential';
  return 'remount';
}

/** Start the authed fetch when `trigger` makes the entry due and a credential is there to send. */
function kick(url: string, trigger: Trigger): void {
  const entry = entries.get(url);
  if (!entry || !due(entry.state, trigger) || assetLoadMode(url) !== 'bearer') return;
  const generation = cacheGeneration;
  settle(url, entry, generation, { status: 'loading', afterFailure: entry.state.status === 'failed' });
  // `embedAuthedFetch` throws synchronously on a URL its origin guard refuses: one failure path for both.
  Promise.resolve()
    .then(() => embedAuthedFetch(url, { headers: { Accept: entry.accept } }))
    .then(async response => {
      if (!response.ok || /^\s*text\/html\b/i.test(response.headers.get('Content-Type') ?? '')) {
        throw new AssetResponseError(response);
      }
      return URL.createObjectURL(await response.blob());
    })
    .then(
      blobUrl => {
        if (!settle(url, entry, generation, { status: 'ready', blobUrl })) URL.revokeObjectURL(blobUrl);
      },
      (error: unknown) => {
        settle(url, entry, generation, { status: 'failed', retryOn: retryOnFor(error) });
      },
    );
}

function sweep(trigger: Trigger): void {
  for (const [url, entry] of entries) if (entry.refs > 0) kick(url, trigger);
  // Even with nothing to fetch, a URL that was awaiting a credential may be classified differently now.
  notify();
}

function onCredentialChange(): void {
  sweep('credential');
}

function onOnline(): void {
  sweep('online');
}

/** Listen for what can make a waiting or failed entry loadable: a new adapter, a new credential, the network. */
function attachSources(): () => void {
  let detachCredential = subscribeEmbedCredentialChange(onCredentialChange);
  const detachAdapter = subscribeRegisteredAdapter(() => {
    // `subscribeEmbedCredentialChange` binds to the adapter registered when it is called.
    detachCredential();
    detachCredential = subscribeEmbedCredentialChange(onCredentialChange);
    onCredentialChange();
  });
  window.addEventListener('online', onOnline);
  return () => {
    detachCredential();
    detachAdapter();
    window.removeEventListener('online', onOnline);
  };
}

/** No URL, nothing that can change: the many pictures drawn without one stay off the store. */
function subscribeNothing(): () => void {
  return () => {};
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  detachSources ??= attachSources();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detachSources) {
      detachSources();
      detachSources = null;
    }
  };
}

function acquire(url: string, accept: string): void {
  let entry = entries.get(url);
  if (!entry) {
    entry = { state: IDLE, accept, refs: 0, releaseTimer: undefined };
    entries.set(url, entry);
  }
  clearTimeout(entry.releaseTimer);
  entry.releaseTimer = undefined;
  entry.refs++;
  kick(url, entry.refs === 1 ? 'mount' : 'join');
}

function release(url: string): void {
  const entry = entries.get(url);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;
  clearTimeout(entry.releaseTimer);
  entry.releaseTimer = setTimeout(() => {
    if (entries.get(url) !== entry || entry.refs > 0) return;
    if (entry.state.status === 'ready') URL.revokeObjectURL(entry.state.blobUrl);
    entries.delete(url);
  }, RELEASE_DELAY_MS);
}

/**
 * Drop every cached blob and revoke its object URL. Hosts call this at
 * session end (logout / forced re-login) so a follow-on login as a
 * different identity cannot be served blobs fetched under the previous
 * one's bearer. Fetches still in flight are fenced by a generation counter
 * (their results are revoked instead of cached). Consumers still mounted go
 * back to `pending`; the clear itself starts no fetch, so a host may clear
 * just before it drops its credential, in the same task. A consumer that
 * looks again later (a credential change, a mount, a render) fetches with
 * whatever credential the host holds then.
 */
export function clearAuthedAssetCache(): void {
  cacheGeneration++;
  for (const [url, entry] of entries) {
    if (entry.state.status === 'ready') URL.revokeObjectURL(entry.state.blobUrl);
    clearTimeout(entry.releaseTimer);
    entry.releaseTimer = undefined;
    if (entry.refs > 0) entry.state = IDLE;
    else entries.delete(url);
  }
  notify();
}

const NO_ASSET: AuthedAsset = Object.freeze({ src: undefined, url: undefined, status: 'native' });

function readAsset(src: string | null | undefined): AuthedAsset {
  if (!src) return NO_ASSET;
  const url = resolveAssetUrl(src);
  const mode = assetLoadMode(url);
  if (mode === 'native') return { src: url, url, status: 'native' };
  const state = mode === 'bearer' ? entries.get(url)?.state : undefined;
  if (state?.status === 'ready') return { src: state.blobUrl, url, status: 'ready' };
  if (state?.status === 'failed' || (state?.status === 'loading' && state.afterFailure)) {
    return { src: undefined, url, status: 'failed' };
  }
  return { src: undefined, url, status: 'pending' };
}

/**
 * The store's answer as one string: `useSyncExternalStore` compares snapshots
 * by identity, and a string is equal by value, with no cache of answer objects
 * to grow and evict.
 */
function encode(asset: AuthedAsset): string {
  return JSON.stringify([asset.status, asset.url ?? null, asset.src ?? null]);
}

function decode(snapshot: string): AuthedAsset {
  const [status, url, src] = JSON.parse(snapshot) as [AuthedAssetStatus, string | null, string | null];
  return { status, url: url ?? undefined, src: src ?? undefined };
}

/**
 * @param src    the asset URL (relative or absolute), or null/undefined
 * @param accept `Accept` header for the authed fetch — narrow it to what the
 *               consumer renders (`image/*`, `text/vtt`); it also replaces
 *               `embedAuthedFetch`'s default JSON `Content-Type` on the GET.
 */
export function useAuthedAsset(src?: string | null, accept = '*/*'): AuthedAsset {
  const snapshot = useSyncExternalStore(
    src ? subscribe : subscribeNothing,
    () => encode(readAsset(src)),
    // The server has no adapter: it draws the URL as given, and the client takes over after hydration.
    () => encode(src ? { src, url: src, status: 'native' } : NO_ASSET),
  );
  const asset = decode(snapshot);
  const tracked = asset.status === 'native' ? undefined : asset.url;

  // Layout, not passive: this render may hand out a cached blob URL, and a
  // release timer firing before a passive effect ran would revoke it under
  // the committed element.
  useIsomorphicLayoutEffect(() => {
    if (!tracked) return undefined;
    acquire(tracked, accept);
    return () => release(tracked);
  }, [tracked, accept]);

  // A consumer that renders while it waits looks again, because a credential can be there with nobody having told
  // the store: it arrived between this consumer's acquire (layout effect) and its subscribe (passive effect), or the
  // adapter never announced it (another tab's sign-in reaches this one only through `storage`). Starts only an idle
  // entry.
  const waiting = tracked !== undefined && asset.status === 'pending';
  useEffect(() => {
    if (waiting) kick(tracked, 'join');
  });

  return asset;
}

/** `useAuthedAsset`'s `src`: what to draw, `undefined` while there is nothing to draw. */
export function useAuthedAssetSrc(src?: string | null, accept = '*/*'): string | undefined {
  return useAuthedAsset(src, accept).src;
}
