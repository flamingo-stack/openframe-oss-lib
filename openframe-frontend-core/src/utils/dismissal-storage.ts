/**
 * Walkthrough-video dismissal store — COOKIE-based, mirroring
 * `announcement-storage.ts` (the app moved off localStorage for dismissals).
 *
 * The dismissal COOKIE is the single source of truth. One cookie per platform
 * key holds the LAST dismissed video id — dismissal is an id-match, never mere
 * presence — so publishing a NEW walkthrough video re-shows the card even
 * after an old one was dismissed. 1-year expiry, `SameSite=Lax`.
 *
 * No `"use client"` on purpose: `walkthroughDismissCookieName` /
 * `isWalkthroughDismissedCookie` are pure and isomorphic; the DOM-touching
 * helpers guard on `typeof document`.
 */

/** Default cookie key. Hosts append their own suffix (e.g. `:${platform}`). */
export const WALKTHROUGH_VIDEO_DISMISS_KEY = 'walkthrough-video-dismissed';

/** THE dismissal match rule (id-match, not presence), shared everywhere.
 *  `undefined` id (no video) → false. */
export function isWalkthroughDismissedCookie(
  cookieValue: string | undefined,
  id: string | undefined,
): boolean {
  return !!id && cookieValue === id;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return undefined;
  const raw = match.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding throws URIError. This runs inside the widget's
    // delayed reveal callback, so an uncaught throw would abort the reveal and
    // hide the card forever. Fail open: treat a corrupt cookie as "not
    // dismissed" (returning the raw value would just fail the id-match anyway).
    return undefined;
  }
}

/** Persist a dismissal: cookie only (1 year). */
export function dismissWalkthrough(key: string, id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${key}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
}

/** Client-side dismissal check (id-match). Reads the cookie, so callers must
 *  invoke it from effects, never during render. */
export function isWalkthroughDismissed(key: string, id: string | undefined): boolean {
  return isWalkthroughDismissedCookie(readCookie(key), id);
}

/** Clear a platform key's dismissal (test/story helper). */
export function clearWalkthroughDismissal(key: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${key}=; path=/; max-age=0`;
}
