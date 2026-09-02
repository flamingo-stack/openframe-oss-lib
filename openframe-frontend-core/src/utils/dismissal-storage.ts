/**
 * Walkthrough-video dismissal — a thin key-naming layer over the shared
 * dismissal-cookie primitives (`utils/dismiss-cookie.ts`). Same id-match
 * semantics as the announcement bar, from the same implementation.
 */

import { isDismissedCookieValue, readDismissCookie, writeDismissCookie, clearDismissCookie } from './dismiss-cookie';

/** Cookie-name stem. */
export const WALKTHROUGH_VIDEO_DISMISS_KEY = 'walkthrough-video-dismissed';

/** THE per-platform cookie name — the ONE home for the encoding. Shaped exactly
 *  like `announcementDismissCookieName` (`<platform>-<name>-dismissed`): `:` is
 *  not a `token` character under RFC 6265, so the old `…-dismissed:<platform>`
 *  form was only working on browser leniency. Hosts must not rebuild this
 *  inline, or an SSR reader added later will restate the separator.
 *
 *  Renaming orphans existing cookies, so anyone who had dismissed the card sees
 *  it once more. Deliberate and one-time: the alternative is reading both names
 *  forever to save a single re-dismissal. */
export function walkthroughDismissCookieName(platform: string): string {
  return `${platform}-${WALKTHROUGH_VIDEO_DISMISS_KEY}`;
}

/** Client-side dismissal check (id-match). Reads browser storage, so call it
 *  from an effect, never during render. */
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
