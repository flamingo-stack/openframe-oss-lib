/**
 * Pure utility — true iff `url` has an explicit host (i.e. would resolve
 * to a different origin than where the consumer is running). Used by
 * chat nav decisions and the extracted `decideNewTab` helper.
 *
 * SSR-deterministic: any URL with an explicit host (http://, https://,
 * or protocol-relative //) is treated as cross-origin. By convention
 * same-origin same-app navigation uses RELATIVE paths; an absolute URL
 * with a host is external.
 *
 * Why deterministic: an earlier `window`-dependent implementation
 * returned different values during SSR (false — no window) vs client
 * hydration (true — origin differs), causing React hydration mismatches
 * on every anchor that fell into the no-targetPlatform fallback (e.g.
 * footer "Support" links to flamingo.run/support). Same-platform
 * absolute URLs (rare — they only happen when a composer like
 * `buildContentURL` returns an absolute URL for a non-current platform)
 * flow through `decideNewTab`'s PLATFORM branch first (which uses
 * `targetPlatform !== currentSource`) and never reach this fallback.
 */
export function isCrossOriginUrl(url: string | null | undefined): boolean {
  if (!url) return false
  // Same-document references — a bare fragment (`#anchor`) or query
  // (`?tab=x`) resolves against the current page and can never leave
  // the origin.
  if (url.startsWith('#') || url.startsWith('?')) return false
  // Relative URL — by definition same origin.
  if (url.startsWith('/') && !url.startsWith('//')) return false
  // Anything else — absolute URL (http(s)://) or protocol-relative (//)
  // — is treated as cross-origin.
  return true
}
