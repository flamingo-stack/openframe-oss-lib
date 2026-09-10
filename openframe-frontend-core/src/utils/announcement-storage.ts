/**
 * Announcement dismissal store.
 *
 * The dismissal COOKIE is the source of truth wherever cookies work: the hub's
 * root layout reads it server-side to decide whether to SSR-seed the bar (no
 * flash for dismissed users), and the client reads it via
 * `isAnnouncementDismissed`. One cookie per platform holding the LAST dismissed
 * announcement id — dismissal is an id-match, never mere cookie presence, so a
 * new announcement always shows after an old one was dismissed, and
 * re-activating an old announcement intentionally re-shows it.
 *
 * On a cookie-averse document (see `utils/dismiss-cookie.ts`) the primitive
 * writes `<platform>-announcement-dismissed` to localStorage instead. Do not
 * mistake it for the legacy key below and delete the write: it is the ONLY
 * thing making a dismissal persist in a shell. `clearAnnouncementDismissals`' prefix sweep does match it, which
 * is right — a full reset should take both.
 *
 * The legacy per-id localStorage key (`<platform>-announcement-<id>-dismissed`)
 * is READ-ONLY legacy: consulted only when no cookie exists for the platform,
 * purely as the migration trigger (the bar's mount effect backfills the
 * cookie). Nothing writes it any more, so that store dies out.
 *
 * No `"use client"` directive on purpose — `announcementDismissCookieName` and
 * `isDismissedCookieValue` are pure/isomorphic and imported by the hub's
 * server layout; the DOM-touching helpers guard on `typeof document`.
 */

import { isDismissedCookieValue, readDismissCookie, writeDismissCookie, clearDismissCookie } from './dismiss-cookie';

/** Cookie name for a platform's dismissed-announcement id — the ONE home for
 *  the encoding, shared by the client writer and the hub's SSR reader. */
export function announcementDismissCookieName(platform: string): string {
  return `${platform}-announcement-dismissed`;
}

/** THE dismissal match rule (id-match, not presence), shared across the
 *  server/client boundary. `undefined` id (no active announcement) → false. */
// The match rule + cookie IO live in `utils/dismiss-cookie.ts` — shared with
// every other dismissible surface. Re-exported so existing importers (incl. the
// hub's SSR layout) keep their import path.
export { isDismissedCookieValue } from './dismiss-cookie';

const legacyDismissKey = (platform: string, id: string) => `${platform}-announcement-${id}-dismissed`;

/** Persist a dismissal (1 year). The SSR layout sees it on the next request —
 *  except in a native shell, where the primitive falls back to localStorage and
 *  there is no SSR layout to see it anyway. The LEGACY per-id key is still never
 *  written. */
export function dismissAnnouncement(platform: string, id: string): void {
  if (typeof document === 'undefined') return;
  writeDismissCookie(announcementDismissCookieName(platform), id);
}

/**
 * Client-side dismissal check — primary store first, with the legacy
 * localStorage key consulted ONLY when that comes back empty. Reads browser
 * storage, so callers must invoke it
 * from effects, never during render (a render-time read would desync hydration
 * from the SSR HTML).
 */
export function isAnnouncementDismissed(platform: string, id: string): boolean {
  if (typeof document === 'undefined') return false;
  const cookieValue = readDismissCookie(announcementDismissCookieName(platform));
  if (cookieValue !== undefined) return isDismissedCookieValue(cookieValue, id);
  try {
    return localStorage.getItem(legacyDismissKey(platform, id)) !== null;
  } catch {
    return false;
  }
}

/** Remove ALL dismissal state for a platform — test/story helper so callers
 *  never restate the key encoding. The header owns the tier inventory. */
export function clearAnnouncementDismissals(platform: string): void {
  if (typeof document === 'undefined') return;
  clearDismissCookie(announcementDismissCookieName(platform));
  try {
    const prefix = `${platform}-announcement-`;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(prefix) && key.endsWith('-dismissed')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // ignore storage errors
  }
}

/** One-time cleanup of pre-refactor storage: the orphaned announcement cache
 *  (the old "instant paint" blob) — called from the bar's mount effect. */
export function clearLegacyAnnouncementCache(platform: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${platform}-announcement-cache`);
  } catch {
    // ignore storage errors
  }
}
