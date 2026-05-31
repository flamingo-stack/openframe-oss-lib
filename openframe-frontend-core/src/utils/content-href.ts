/**
 * Embedder-configurable content-URL composer — the lib default for the
 * EXISTING `ChatRuntime.composeContentUrl` seam.
 *
 * ## Why this exists
 *
 * Lib catalog/detail views (`OnboardingGuidesCatalogView`,
 * `OnboardingGuideDetailView`, …) compose a content link via
 * `runtime.composeContentUrl?.(type, slug, platforms)`. The hub wires its
 * own composer (`composeContentUrlFromPlatforms` — cross-platform topology,
 * untouched by this module). An embedder that hosts some of those content
 * types on its OWN slugged routes needs the same seam, but without
 * re-deriving the hub's per-type suffix map by hand.
 *
 * `makeComposeContentUrl` builds that composer from a small config: the set
 * of types THIS host serves in-app (→ relative href, soft-navigates via the
 * embed-shim `Link`/`runtime.navigation`) vs. everything else (→ absolute
 * hub origin, opens out). Wire it once:
 *
 *   composeContentUrl: makeComposeContentUrl({
 *     hostedTypes: new Set(['onboarding_guide', 'product_release']),
 *     contentOrigin: VITE_HUB_ORIGIN,
 *   })
 *
 * Pure + server-safe (no React, no browser APIs).
 */

/**
 * Type → in-app route suffix. The public-hostable subset of the hub's
 * `PUBLIC_URL_PATHS` (`lib/utils/content-url-builder.ts`); the hub keeps
 * its own copy, this is the embedder default and must stay in sync. (The
 * cross-repo boundary makes a shared import impossible; the lib test pins this
 * constant against a literal copy of itself, so it does NOT detect hub-side
 * drift — values match today and are kept aligned by hand.) There
 * is deliberately NO slug-vs-id field — the seam receives an already
 * resolved id STRING, so the CALLER passes the right identifier (the
 * onboarding views pass `guide.slug`).
 */
export const DEFAULT_CONTENT_SUFFIXES: Record<string, string> = {
  onboarding_guide: 'onboarding-guides',
  product_release: 'releases',
  blog_post: 'blog',
  case_study: 'case-studies',
  customer_interview: 'interviews',
  investor_update: 'investor-updates',
  webinar: 'webinars',
  podcast: 'podcasts',
  event: 'events',
}

export interface ContentHrefOptions {
  /** Types THIS host serves in-app → relative href (soft-nav). Everything
   *  else resolves to `contentOrigin` (opens the hub). */
  hostedTypes: ReadonlySet<string>
  /** Hub origin for non-hosted types (e.g. `https://openframe.app`). */
  contentOrigin: string
  /** Per-type route suffix. Defaults to {@link DEFAULT_CONTENT_SUFFIXES}. */
  suffixes?: Record<string, string>
  /** Per-type full override — wins over the suffix logic. */
  overrides?: Record<string, (slug: string) => { href: string; targetPlatform: string | null }>
}

/** The `composeContentUrl` shape on `ChatRuntime.navigation`-adjacent
 *  config — ALWAYS returns a tuple (never null), since the seam type is
 *  non-nullable and the onboarding views read `.href` unconditionally. */
export type ComposeContentUrl = (
  type: string,
  slug: string,
  platforms?: Array<{ name?: string }>,
) => { href: string; targetPlatform: string | null }

/**
 * Build a `composeContentUrl` for the existing runtime seam.
 *
 * Resolution: `overrides[type]` → else `suffixes[type] ?? type` (never
 * `/undefined/…`); if `hostedTypes.has(type)` return a relative
 * `/<seg>/<slug>` (in-app), else `${contentOrigin}/<seg>/<slug>` (hub,
 * opens out). In-vs-out is decided by `hostedTypes` membership — NOT
 * platform equality, since an embedder has a free-form `source`. The
 * `platforms` arg is part of the seam signature but unused here (membership
 * decides); the caller passes the correct identifier as `slug`.
 */
export function makeComposeContentUrl(opts: ContentHrefOptions): ComposeContentUrl {
  const suffixes = opts.suffixes ?? DEFAULT_CONTENT_SUFFIXES
  return (type, slug) => {
    const override =
      opts.overrides && Object.prototype.hasOwnProperty.call(opts.overrides, type)
        ? opts.overrides[type]
        : undefined
    if (override) return override(slug)
    const seg =
      (Object.prototype.hasOwnProperty.call(suffixes, type) ? suffixes[type] : undefined) ?? type
    return opts.hostedTypes.has(type)
      ? { href: `/${seg}/${slug}`, targetPlatform: null }
      : { href: `${opts.contentOrigin}/${seg}/${slug}`, targetPlatform: null }
  }
}

/**
 * Default href shape when `runtime.composeContentUrl` is NOT wired
 * (single-platform embedders without cross-platform topology). Shared by
 * every catalog/detail view that composes a content link (onboarding guides,
 * product releases, …) so the no-composer fallback has ONE source — both
 * views pass their `basePath`-derived shape through here.
 */
export function buildDefaultHref(
  basePath: string,
  slug: string,
): { href: string; targetPlatform: string | null } {
  return { href: `${basePath}/${slug}`, targetPlatform: null }
}
