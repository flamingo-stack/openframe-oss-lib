// Mirrors the hub's canonical `PUBLIC_URL_PATHS` (lib/utils/content-url-builder.ts) — the
// per-content-type route suffix that `buildContentURL` uses to build `/${path}/${slug}`.
//
// This is the ONE place to OVERRIDE where each content type's detail page lives in THIS app.
// The example's react-router routes (app-routes.tsx) must match these suffixes. Mounting a
// type elsewhere (e.g. onboarding under `/docs/onboarding`) = change it here + the <Route>.
export const PUBLIC_URL_PATHS: Record<string, string> = {
  onboarding_guide: 'onboarding-guides',
  product_release: 'releases',
  blog_post: 'blog',
  blog_post_existing: 'blog',
  blog_post_seed: 'blog',
  case_study: 'case-studies',
  event: 'events',
  podcast: 'podcasts',
  webinar: 'webinars',
  customer_interview: 'interviews',
  investor_update: 'investor-updates',
}

/**
 * Canonical local content path for a type + slug — same shape as the project's
 * `buildContentURL` (`/${PUBLIC_URL_PATHS[type]}/${slug}`). Returns null for types this
 * app doesn't host a route for (caller falls back to the hub origin).
 */
export function resolveContentPath(type: string, slug: string): string | null {
  const path = PUBLIC_URL_PATHS[type]
  return path ? `/${path}/${slug}` : null
}
