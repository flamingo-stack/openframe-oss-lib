/**
 * Announcement dismissal store.
 *
 * The dismissal COOKIE is the single source of truth: the hub's root layout
 * reads it server-side to decide whether to SSR-seed the bar (no flash for
 * dismissed users), and the client reads it via `isAnnouncementDismissed`.
 * One cookie per platform holding the LAST dismissed announcement id —
 * dismissal is an id-match, never mere cookie presence, so a new announcement
 * always shows after an old one was dismissed, and re-activating an old
 * announcement intentionally re-shows it.
 *
 * The legacy per-id localStorage key (`<platform>-announcement-<id>-dismissed`)
 * is READ-ONLY legacy: consulted only when no cookie exists for the platform,
 * purely as the migration trigger (the bar's mount effect backfills the
 * cookie). New dismissals write the cookie only, so the second store dies out.
 *
 * No `"use client"` directive on purpose — `announcementDismissCookieName` and
 * `isDismissedCookieValue` are pure/isomorphic and imported by the hub's
 * server layout; the DOM-touching helpers guard on `typeof document`.
 */

/** Cookie name for a platform's dismissed-announcement id — the ONE home for
 *  the encoding, shared by the client writer and the hub's SSR reader. */
export function announcementDismissCookieName(platform: string): string {
  return `${platform}-announcement-dismissed`
}

/** THE dismissal match rule (id-match, not presence), shared across the
 *  server/client boundary. `undefined` id (no active announcement) → false. */
export function isDismissedCookieValue(
  cookieValue: string | undefined,
  id: string | undefined,
): boolean {
  return !!id && cookieValue === id
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

const legacyDismissKey = (platform: string, id: string) =>
  `${platform}-announcement-${id}-dismissed`

/** Persist a dismissal: cookie only (1 year). The SSR layout sees it on the
 *  next request; localStorage is intentionally NOT written (read-only legacy). */
export function dismissAnnouncement(platform: string, id: string): void {
  if (typeof document === 'undefined') return
  const name = announcementDismissCookieName(platform)
  document.cookie = `${name}=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`
}

/**
 * Client-side dismissal check — cookie-first: the legacy localStorage key is
 * consulted ONLY when no cookie exists for the platform. Reads browser
 * storage, so callers must invoke it from effects, never during render
 * (a render-time read would desync hydration from the SSR HTML).
 */
export function isAnnouncementDismissed(platform: string, id: string): boolean {
  if (typeof document === 'undefined') return false
  const cookieValue = readCookie(announcementDismissCookieName(platform))
  if (cookieValue !== undefined) return isDismissedCookieValue(cookieValue, id)
  try {
    return localStorage.getItem(legacyDismissKey(platform, id)) !== null
  } catch {
    return false
  }
}

/** Remove ALL dismissal state for a platform (cookie + legacy localStorage
 *  keys) — test/story helper so callers never restate the key encoding. */
export function clearAnnouncementDismissals(platform: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${announcementDismissCookieName(platform)}=; path=/; max-age=0`
  try {
    const prefix = `${platform}-announcement-`
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(prefix) && key.endsWith('-dismissed')) {
        localStorage.removeItem(key)
      }
    })
  } catch {
    // ignore storage errors
  }
}

/** One-time cleanup of pre-refactor storage: the orphaned announcement cache
 *  (the old "instant paint" blob) — called from the bar's mount effect. */
export function clearLegacyAnnouncementCache(platform: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(`${platform}-announcement-cache`)
  } catch {
    // ignore storage errors
  }
}
