/**
 * Lib-internal helper — default href shape for onboarding-guide cards
 * when `runtime.composeContentUrl` is not wired (single-platform
 * embedders without cross-platform topology).
 *
 * Shared between `OnboardingGuidesCatalogView` (per-card href) and
 * `OnboardingGuideDetailView` (per-related-card href) so both views
 * compose hrefs from the same `basePath`-derived shape — no parallel
 * 4-line helper to drift apart.
 */
export function buildDefaultHref(
  basePath: string,
  slug: string,
): { href: string; targetPlatform: string | null } {
  return { href: `${basePath}/${slug}`, targetPlatform: null }
}
