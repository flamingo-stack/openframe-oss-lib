/**
 * Dismissal-cookie primitives — THE one implementation of "this surface was
 * dismissed", shared by every dismissible surface (announcement bar, floating
 * walkthrough video, and anything added later).
 *
 * The dismissal rule is an ID MATCH, never mere cookie presence: the cookie
 * stores the id of the LAST dismissed item, so publishing a NEW item re-shows
 * the surface while the old dismissal still suppresses the old item.
 *
 * No `"use client"` on purpose — `isDismissedCookieValue` is pure and is used by
 * server code (the hub's root layout reads the cookie during SSR to avoid a
 * flash); the DOM-touching helpers guard on `typeof document`.
 */

/** One year, the standard dismissal horizon for these surfaces. */
const DISMISS_COOKIE_MAX_AGE_SECONDS = 31_536_000;

/** THE dismissal match rule. `undefined` id (nothing active) → not dismissed. */
export function isDismissedCookieValue(
  cookieValue: string | undefined,
  id: string | undefined,
): boolean {
  return !!id && cookieValue === id;
}

/**
 * Read a dismissal cookie. Returns `undefined` when absent OR malformed:
 * `decodeURIComponent` throws `URIError` on bad percent-encoding, and callers
 * run this inside reveal paths where an uncaught throw would hide the surface
 * permanently. Failing open (treated as not-dismissed) is always the safe side.
 */
export function readDismissCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return undefined;
  }
}

/** Persist a dismissal (cookie only, 1 year). */
export function writeDismissCookie(name: string, id: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${encodeURIComponent(id)}; path=/; max-age=${DISMISS_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Clear a dismissal (test/story helper). */
export function clearDismissCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0`;
}
