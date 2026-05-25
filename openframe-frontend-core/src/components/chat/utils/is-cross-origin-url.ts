/**
 * Pure utility — true iff `url` resolves to a different origin than the
 * current `window.location.origin`. Used by chat nav decisions and the
 * extracted `decideNewTab` helper. Browser-only (SSR returns false).
 */
export function isCrossOriginUrl(url: string | null | undefined): boolean {
  if (!url) return false
  // Relative URL — by definition same origin.
  if (url.startsWith('/') && !url.startsWith('//')) return false
  if (typeof window === 'undefined') return false
  try {
    const u = new URL(url, window.location.origin)
    return u.origin !== window.location.origin
  } catch {
    return false
  }
}
