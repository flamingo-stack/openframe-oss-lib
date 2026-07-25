/**
 * Walkthrough-video dismissal — a thin key-naming layer over the shared
 * dismissal-cookie primitives (`utils/dismiss-cookie.ts`). Same id-match
 * semantics as the announcement bar, from the same implementation.
 */

import {
  isDismissedCookieValue,
  readDismissCookie,
  writeDismissCookie,
  clearDismissCookie,
} from './dismiss-cookie';

/** Default cookie key. Hosts append their own suffix (e.g. `:${platform}`). */
export const WALKTHROUGH_VIDEO_DISMISS_KEY = 'walkthrough-video-dismissed';

/** Client-side dismissal check (id-match). Reads a cookie, so call it from an
 *  effect, never during render. */
export function isWalkthroughDismissed(key: string, id: string | undefined): boolean {
  return isDismissedCookieValue(readDismissCookie(key), id);
}

/** Persist a dismissal for this video id. */
export function dismissWalkthrough(key: string, id: string): void {
  writeDismissCookie(key, id);
}

/** Clear a platform key's dismissal (test/story helper). */
export function clearWalkthroughDismissal(key: string): void {
  clearDismissCookie(key);
}
