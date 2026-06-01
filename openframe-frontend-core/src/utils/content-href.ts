/**
 * The SINGLE content-href authority for every embeddable surface — the
 * `ChatRuntime.composeContentUrl` seam. Page views (onboarding catalog/detail,
 * product releases) AND chat surfaces (entity cards, source chips, search
 * results) all resolve a content link through this one function, so a given
 * content type lands in the SAME place no matter where it's rendered.
 *
 * ## Why this exists
 *
 * Before unification there were two link builders: `composeContentUrl` (pages)
 * and `resolveSourceRowCTA` (chat), and only the former honored the embedder's
 * in-app routing config — so the same `product_release` soft-navigated in-app on
 * the releases page but opened OUT to the hub as a chat card. Now `resolveSource-
 * RowCTA` delegates its href to this seam, so one config (`hostedTypes` /
 * `overrides`) governs internal-vs-external for pages and chat alike.
 *
 * `makeComposeContentUrl` builds the embedder default from a small config: the
 * set of types THIS host serves in-app (→ relative href, soft-navigates) vs.
 * everything else (→ the canonical hub URL, opens out). The hub wires its own
 * composer (`composeContentUrlFromPlatforms` — cross-platform topology) to the
 * same seam. Pure + server-safe (no React, no browser APIs).
 *
 *   composeContentUrl: makeComposeContentUrl({
 *     hostedTypes: new Set(['onboarding_guide', 'product_release']),
 *     contentOrigin: VITE_HUB_ORIGIN,
 *   })
 */

/**
 * Type → in-app route suffix. The public-hostable subset of the hub's
 * `PUBLIC_URL_PATHS` (`lib/utils/content-url-builder.ts`); the hub keeps
 * its own copy, this is the embedder default and must stay in sync. (The
 * cross-repo boundary makes a shared import impossible; the lib test pins this
 * constant against a literal copy of itself, so it does NOT detect hub-side
 * drift — values match today and are kept aligned by hand.)
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

/** Input to the unified content-href seam. ONE object covers both callers:
 *  page views pass `type` + `identifier` (the slug); chat rows pass `type` +
 *  `identifier` (the primary-key id) + `externalUrl` (the canonical hub URL,
 *  from which the slug is recovered for in-app routing). */
export interface ComposeContentUrlInput {
  /** The content's documentType (e.g. `'product_release'`, `'blog_post'`). */
  type: string
  /** Content identifier. Page views pass the slug; chat rows pass the
   *  primary-key id (the slug is recovered from `externalUrl` when hosted). */
  identifier: string
  /** Hydrated platform junction (page views). Unused by the embedder default
   *  — `hostedTypes` membership decides in-vs-out — but threaded for the hub
   *  composer's cross-platform topology. */
  platforms?: Array<{ name?: string }>
  /** The canonical hub URL when the caller already has it (chat entity rows
   *  carry it from the RAG mapper). Hosted types relativize it to an in-app
   *  path; non-hosted types use it verbatim (authoritative). Absent for pages. */
  externalUrl?: string | null
  /** Platform that owns `externalUrl` (chat rows). Passed through on the
   *  non-hosted branch. */
  targetPlatform?: string | null
}

export interface ContentHrefOptions {
  /** Types THIS host serves in-app → relative href (soft-nav). Everything
   *  else resolves to the row's `externalUrl` / `contentOrigin` (opens out). */
  hostedTypes: ReadonlySet<string>
  /** Hub origin for non-hosted types with no `externalUrl` (e.g.
   *  `https://openframe.app`). */
  contentOrigin: string
  /** Per-type route suffix. Defaults to {@link DEFAULT_CONTENT_SUFFIXES}. */
  suffixes?: Record<string, string>
  /** Per-type full override — wins over the suffix logic. Receives the same
   *  `identifier` the seam was called with. */
  overrides?: Record<string, (identifier: string) => { href: string; targetPlatform: string | null }>
}

/** The unified `composeContentUrl` seam shape on `ChatRuntime`. ALWAYS returns
 *  a tuple (never null) — the seam type is non-nullable and callers read
 *  `.href` unconditionally. */
export type ComposeContentUrl = (
  input: ComposeContentUrlInput,
) => { href: string; targetPlatform: string | null }

/** Last non-empty path segment of a URL (relative or absolute) — the content
 *  slug of a canonical detail URL like `https://hub/releases/my-release`.
 *  Returns `null` on a malformed URL or empty path. */
function lastPathSegment(url: string): string | null {
  try {
    // Resolve against a dummy base so relative inputs parse too.
    const pathname = new URL(url, 'https://_.local').pathname
    const segs = pathname.split('/').filter(Boolean)
    return segs.length > 0 ? segs[segs.length - 1] : null
  } catch {
    return null
  }
}

/**
 * Build the embedder's `composeContentUrl` for the unified seam.
 *
 * Resolution order (the merged rule used by BOTH page views and chat cards):
 *   1. `overrides[type]` — explicit per-type href.
 *   2. `hostedTypes.has(type)` → relative `/<suffix>/<slug>` (in-app, soft-nav).
 *      Chat rows carry the hub URL not the slug, so the slug is recovered from
 *      `externalUrl`; page views pass the slug as `identifier`.
 *   3. `externalUrl` present → use it verbatim (RAG-authoritative hub URL; the
 *      chat non-hosted case).
 *   4. else → `${contentOrigin}/<suffix>/<identifier>` (page-view non-hosted).
 *
 * In-vs-out is decided by `hostedTypes` membership — NOT platform equality,
 * since an embedder has a free-form `source`. The `platforms` arg is part of the
 * seam signature but unused here.
 */
export function makeComposeContentUrl(opts: ContentHrefOptions): ComposeContentUrl {
  const suffixes = opts.suffixes ?? DEFAULT_CONTENT_SUFFIXES
  return ({ type, identifier, externalUrl, targetPlatform }) => {
    const override =
      opts.overrides && Object.prototype.hasOwnProperty.call(opts.overrides, type)
        ? opts.overrides[type]
        : undefined
    if (override) return override(identifier)

    const seg =
      (Object.prototype.hasOwnProperty.call(suffixes, type) ? suffixes[type] : undefined) ?? type

    if (opts.hostedTypes.has(type)) {
      // In-app (soft-nav). Recover the slug from the hub URL for chat rows;
      // page views already pass the slug as `identifier`.
      const slug = externalUrl ? (lastPathSegment(externalUrl) ?? identifier) : identifier
      return { href: `/${seg}/${slug}`, targetPlatform: null }
    }
    // Not hosted → opens out. Prefer the RAG-authoritative `externalUrl` (chat);
    // else compose against the hub origin (page views with no externalUrl).
    return externalUrl
      ? { href: externalUrl, targetPlatform: targetPlatform ?? null }
      : { href: `${opts.contentOrigin}/${seg}/${identifier}`, targetPlatform: null }
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
