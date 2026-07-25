/**
 * TTL-based dismissal store — a thin policy layer over the lib's
 * `createLocalStorageAdapter` SSOT (SSR guard + try/catch + quota-safe).
 *
 * Semantically distinct from `announcement-storage.ts` (id-match cookie): a
 * surface dismissed here stays hidden for `ttlDays` (localStorage timestamp)
 * AND for the rest of the browser session regardless of TTL (sessionStorage
 * boolean — covers a TTL that expires mid-session).
 *
 * Design note: the public API takes a full string key (it crosses the widget's
 * `storageKey` props boundary) rather than the adapter's `namespace` option, so
 * hosts build their own per-platform key from `WALKTHROUGH_VIDEO_DISMISS_KEY`.
 */

import { createLocalStorageAdapter } from './local-storage-adapter';

/** Default dismissal key. Hosts append their own suffix (e.g. `:${platform}`). */
export const WALKTHROUGH_VIDEO_DISMISS_KEY = 'walkthrough-video-dismissed';

const isNumber = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const isTrue = (v: unknown): v is true => v === true;

const MS_PER_DAY = 86_400_000;

function tsAdapter(key: string) {
  // `validate` guards against a garbage/legacy value NaN-ing the TTL check
  // into "permanently dismissed"; a bad value fails open (shows the surface).
  return createLocalStorageAdapter<number>({ key, validate: isNumber, logTag: '[walkthrough-dismiss]' });
}

function sessionAdapter(key: string) {
  return createLocalStorageAdapter<true>({ key: `${key}:session`, backend: 'session', validate: isTrue, logTag: '[walkthrough-dismiss]' });
}

/** True when the surface should stay hidden: dismissed this session (any TTL),
 *  or dismissed within the last `ttlDays`. */
export function isDismissed(key: string, ttlDays: number): boolean {
  if (sessionAdapter(key).load() === true) return true;
  const ts = tsAdapter(key).load();
  if (ts === null) return false;
  return Date.now() - ts < ttlDays * MS_PER_DAY;
}

/** Record a dismissal: TTL timestamp + same-session guard. */
export function writeDismissed(key: string): void {
  tsAdapter(key).save(Date.now());
  sessionAdapter(key).save(true);
}
