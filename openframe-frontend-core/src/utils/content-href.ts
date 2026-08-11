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

import { canonicalContentRefType } from './list-url'
import { byKey, getPlatformProductionUrl } from '../platform-domains'

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
  // Author profile pages (`/authors/<slug>`) — identified by the profile
  // slug. Mirrors the hub's `PUBLIC_URL_PATHS.author`, which derives from
  // `AUTHORS_PATH` in the hub's `lib/utils/breadcrumbs.ts` (the hub-side
  // SSOT for the segment).
  author: 'authors',
}

/** Input to the unified content-href seam. ONE object covers both callers:
 *  page views pass `type` + `identifier` (the slug); chat rows pass `type` +
 *  `identifier` (the primary-key id) + `externalUrl` (the canonical hub URL,
 *  from which the slug is recovered for in-app routing). */
export interface ComposeContentUrlInput {
  /** The content's CANONICAL documentType (e.g. `'product_release'`,
   *  `'blog_post'`).
   *
   *  Rail-vocab aliases (`'blog_post_existing'`) must be canonicalized by the
   *  caller via `canonicalContentRefType` BEFORE they reach the seam: a host
   *  writes its `hostedTypes` / `suffixes` / `overrides` against the canonical
   *  vocabulary, so an alias silently misses every one of them and falls
   *  through to the default `<contentOrigin>/<type>/<id>` branch — which is how
   *  the same blog post reached `/blog/<slug>` from one path and
   *  `/blog_post_existing/<slug>` from another. */
  type: string
  /** Content identifier. Page views pass the slug; chat rows pass the
   *  primary-key id (the slug is recovered from `externalUrl` when hosted). */
  identifier: string
  /** Preferred path segment for HOSTED types when there is no `externalUrl`
   *  to recover the slug from — the Mingo/NATS transport ships bare
   *  `[card://type:id]` markers with no ref metadata, so a fetch-mode card
   *  knows the row's slug only AFTER it loads the row. `identifier` must stay
   *  the primary key (that is what `overrides` deep-link on), hence a separate
   *  field rather than overloading it. Ignored for non-hosted types. */
  slug?: string | null
  /** Hydrated platform junction from the list APIs. `hostedTypes` membership
   *  still decides in-app vs out; this decides WHICH origin an out-link points
   *  at — an OpenMSP-owned row resolves to openmsp.ai, not to the embedder's
   *  `contentOrigin`. Read only when `targetPlatform` is absent. Accepts the
   *  three junction shapes the DALs produce (see `primaryPlatformOf`). */
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
  /** Fallback origin for non-hosted types with no `externalUrl` AND no
   *  resolvable owning platform (e.g. `https://openframe.app`). When the row
   *  DOES name its platform, that platform's canonical origin wins — otherwise
   *  cross-platform content (an OpenMSP blog post) would be linked to the
   *  wrong site. */
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

/**
 * Owning platform of a content row, from the hydrated junction the list APIs
 * return. Mirrors the hub's `extractPrimaryPlatform` (`lib/utils/content-url-
 * builder.ts`): the same junction arrives in three shapes depending on which
 * DAL produced it, so all three are read.
 *
 *   1. `{ platforms: { name } }`  — raw Supabase row (rag-mappers)
 *   2. `{ platform_name }`        — legacy pre-flattened admin endpoints
 *   3. `{ name }`                 — modern flattened shape (blog / case-study utils)
 *
 * Returns the FIRST resolvable name; `null` when the junction is absent or
 * carries no usable platform (caller then falls back to `contentOrigin`).
 */
function primaryPlatformOf(
  platforms: ComposeContentUrlInput['platforms'],
): string | null {
  if (!Array.isArray(platforms)) return null
  for (const entry of platforms) {
    const row = entry as {
      name?: unknown
      platform_name?: unknown
      platforms?: { name?: unknown }
    }
    const name = row?.platforms?.name ?? row?.platform_name ?? row?.name
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return null
}

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
  return ({
    type: rawType,
    identifier,
    slug: slugHint,
    externalUrl,
    targetPlatform,
    platforms,
  }) => {
    // Defence in depth: callers are expected to hand over a canonical
    // documentType (see `ComposeContentUrlInput.type`), but a stray alias must
    // not silently produce a `<origin>/blog_post_existing/<slug>` URL. Same
    // canonicalizer `buildListUrl` uses — one alias table, both paths.
    const type = canonicalContentRefType(rawType)
    const override =
      opts.overrides && Object.prototype.hasOwnProperty.call(opts.overrides, type)
        ? opts.overrides[type]
        : undefined
    if (override) return override(identifier)

    const seg =
      (Object.prototype.hasOwnProperty.call(suffixes, type) ? suffixes[type] : undefined) ?? type

    if (opts.hostedTypes.has(type)) {
      // In-app (soft-nav). Recover the slug from the hub URL for chat rows;
      // page views already pass the slug as `identifier`. Guard: if the recovered
      // segment is the type's OWN suffix (e.g. a malformed/list externalUrl like
      // `https://hub/releases/` → `'releases'`), fall back to `identifier` instead
      // of emitting a nonsensical `/releases/releases`.
      //
      // `slug` (the explicit hint) sits between the two: a Mingo fetch-mode card
      // has NO externalUrl to recover from but DOES know the row's slug once it
      // loads, and its `identifier` must stay the primary key so `overrides`
      // still deep-link correctly.
      const recovered = externalUrl ? lastPathSegment(externalUrl) : null
      const slug =
        recovered && recovered !== seg ? recovered : (slugHint?.trim() || identifier)
      return { href: `/${seg}/${slug}`, targetPlatform: null }
    }
    // Not hosted → opens out. Prefer the RAG-authoritative `externalUrl` (chat).
    if (externalUrl) return { href: externalUrl, targetPlatform: targetPlatform ?? null }

    // No externalUrl → compose it. The destination is the origin of the
    // platform that OWNS the row, not a fixed hub: an OpenMSP blog post lives
    // on openmsp.ai, and pinning every non-hosted type to `contentOrigin` sent
    // it to flamingo.run (a 404 / wrong site). Owner comes from the explicit
    // `targetPlatform`, else the hydrated platforms junction — mirroring the
    // hub's `composeContentUrlFromPlatforms` + `extractPrimaryPlatform`.
    // Origins resolve through the platform-domain SSOT (env override → default
    // production URL), so a per-deploy `NEXT_PUBLIC_*_URL` is honoured here too.
    //
    // `contentOrigin` stays the fallback for rows with no resolvable owner and
    // for platform names the registry doesn't know — an embedder's explicit
    // configuration must win over the registry's flamingo default.
    // Only a REGISTRY-RESOLVED owner counts. An unknown name (a platform the
    // registry doesn't carry) falls back to `contentOrigin` for the href, and
    // reporting it as the `targetPlatform` anyway made the two disagree:
    // `decideNewTab` prefers `targetPlatform` over its origin check, so a link
    // pointing at the CURRENT host opened in a new tab.
    const claimedOwner = targetPlatform ?? primaryPlatformOf(platforms)
    const owner = claimedOwner && byKey(claimedOwner) ? claimedOwner : null
    const origin = owner ? getPlatformProductionUrl(owner) : opts.contentOrigin
    // The hub's public detail routes are SLUG-based, so the `slug` hint wins
    // over `identifier` here too — a Mingo fetch-mode card knows the row's slug
    // but its `identifier` is the marker's primary key, which would 404.
    return {
      href: `${origin.replace(/\/+$/, '')}/${seg}/${slugHint?.trim() || identifier}`,
      // Report the owner so `decideNewTab` can compare it against the current
      // app instead of falling back to an origin guess (which is unreliable in
      // dev, where every platform shares localhost). `null` whenever the href
      // came from `contentOrigin`, so the two never disagree.
      targetPlatform: owner,
    }
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

/**
 * Resolve a content link via the host's `composeContentUrl` when wired, else the
 * same-origin `buildDefaultHref` fallback — the exact ternary every catalog/detail page
 * VIEW repeated. Centralizes the `composeContentUrl` input shape + the fallback in one
 * place so a future input-shape change lands once, not per view.
 */
export function resolveContentHref(
  composeContentUrl: ComposeContentUrl | undefined,
  args: { type: string; slug: string; basePath: string; platforms?: ComposeContentUrlInput['platforms'] },
): { href: string; targetPlatform: string | null } {
  return composeContentUrl
    ? composeContentUrl({ type: args.type, identifier: args.slug, platforms: args.platforms })
    : buildDefaultHref(args.basePath, args.slug)
}
