/**
 * TODO(CU-17tkuw61kfy): post-fetch href fallback for a record whose row answers no url (the old hub's page-shaped rows).
 * It calls the exact same `composeContentUrl` seam the page cards (`resolveContentHref`) and the rows with a url
 * (`resolveSourceRowCTA`) use, so one host config (`hostedTypes` / `suffixes` / `overrides`) governs all three.
 *
 * `identifier` stays the record's primary key (that is what `overrides` such as roadmap's `?search=<task id>` deep-link
 * on); the row's `slug` rides the separate `slug` hint for hosted types whose detail route is slug-based.
 *
 * Pure: no React, no DOM. The caller owns `safeHref` validation.
 */

import type { ComposeContentUrl, ComposedContentUrl } from '../../../utils/content-href';
import { canonicalContentRefType } from '../../../utils/list-url';

export interface FetchedCardHrefInput {
  /** Canonical `documentType` for the seam (registry `contentRefType`). */
  contentRefType: string;
  /** The record's primary key — `ChatRef.id`, NOT the fetched row's id. */
  id: string;
  /** The row the card fetched. Shape is per-type and opaque here; only
   *  `slug` and `platforms` are read, both defensively. */
  item: unknown;
  /** Host seam. Absent (unwired runtime) → no fallback, same as today. */
  composeContentUrl?: ComposeContentUrl;
}

/** Read `item.slug` when it is a non-empty string. */
function readSlug(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const slug = (item as { slug?: unknown }).slug;
  return typeof slug === 'string' && slug.trim() ? slug.trim() : null;
}

/**
 * Human title of a fetched row: `title`, else `name`, else null.
 *
 * A bare record ref carries no title of its own. Everything downstream that prints or sends the title (the "Ask Mingo"
 * prompt, host renderers falling back to `ref.title`) would otherwise say `86ad3qvv5`. Once the row loads, this is the
 * real title.
 */
export function readFetchedCardTitle(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  for (const key of ['title', 'name'] as const) {
    const value = (item as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Doc-tree path of a fetched row (`metadata.path`), or null.
 *
 * A doc card (`markdown`, `data_room_doc`) has no public url: its destination
 * is its viewer plus this path, the route `resolveSourceRowCTA` composes for a
 * source chip. A bare record link (`record://type/id`) carries no path, so the loader
 * reads it from the row once it loads and resolves the card the way the chip
 * was resolved.
 */
export function readFetchedCardPath(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const metadata = (item as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const path = (metadata as { path?: unknown }).path;
  return typeof path === 'string' && path.trim() ? path.trim() : null;
}

/** Read the row's platform-association array: the embedder default falls back to it for a row's owner. Hub
 *  list-API rows carry the array under the registry arrayKey
 *  `<canonicalType>_platforms` (e.g. `blog_post_platforms`), with a plain
 *  `platforms` fallback for shapes that use the generic key. */
function readPlatforms(item: unknown, canonicalType: string): Array<{ name?: string }> | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const obj = item as Record<string, unknown>;
  for (const key of [`${canonicalType}_platforms`, 'platforms']) {
    const platforms = obj[key];
    if (Array.isArray(platforms)) return platforms as Array<{ name?: string }>;
  }
  return undefined;
}

/**
 * Resolve `{href, targetPlatform}` for a freshly fetched card row, or `null`
 * when the host wired no seam (the caller then keeps the card unlinked, which
 * is the pre-existing behavior).
 */
/**
 * Where a fetch-mode card's destination came from. The loader needs the source,
 * not just the string: only the `item` branch must leave the ref's own
 * `targetPlatform` untouched.
 */
export type FetchedCardHrefChoice =
  | { source: 'hostOverride'; href: string; targetPlatform: string | null }
  | { source: 'item'; href: string; targetPlatform?: undefined }
  | { source: 'composed'; href: string; targetPlatform: string | null };

/**
 * Decide a fetched card's destination between the two producers that can claim
 * it. Pure, so the precedence is testable on its own — it used to live as
 * inline ternaries in `ChatCardLoader`.
 *
 *   1. an EXPLICIT host override — the host said where this type lives in its
 *      own app, which beats everything;
 *   2. the fetched row's own url (`registry.fallbackHref`) — minted by the
 *      content host for ITS surface, authoritative in the absence of (1);
 *   3. the composer's synthesized href, unless the registry opted out
 *      (`noComposedHref`) because the synthesis would be a 404.
 *
 * (2) beating (3) is why `noComposedHref` exists; (1) beating (2) is what keeps
 * a re-homed type (an embedder serving hub tickets under `/help-center/tickets`)
 * from following the content host's path into an unrelated route of its own.
 */
export function pickFetchedCardHref({
  composed,
  itemHref,
  allowComposed,
}: {
  /** Result of {@link resolveFetchedCardHref}, or null when unresolvable. */
  composed: ComposedContentUrl | null;
  /** `registry.fallbackHref(item)` — the fetched row's own destination. */
  itemHref: string | null;
  /** False for registry entries flagged `noComposedHref`. */
  allowComposed: boolean;
}): FetchedCardHrefChoice | null {
  if (composed?.hostOverride) {
    return { source: 'hostOverride', href: composed.href, targetPlatform: composed.targetPlatform };
  }
  if (itemHref) return { source: 'item', href: itemHref };
  if (composed && allowComposed) {
    return { source: 'composed', href: composed.href, targetPlatform: composed.targetPlatform };
  }
  return null;
}

export function resolveFetchedCardHref({
  contentRefType,
  id,
  item,
  composeContentUrl,
}: FetchedCardHrefInput): ComposedContentUrl | null {
  if (!composeContentUrl || !contentRefType || !id) return null;
  const canonicalType = canonicalContentRefType(contentRefType);
  return composeContentUrl({
    // The card registry keys some entries by the legacy rail vocabulary
    // (`blog_post_existing`) because that is what `buildListUrl` expects.
    // The seam speaks the CANONICAL vocabulary — a host's `hostedTypes` /
    // `overrides` are written against `blog_post`, so an un-aliased type
    // misses them all and lands on `<origin>/blog_post_existing/<slug>`.
    type: canonicalType,
    identifier: id,
    slug: readSlug(item),
    platforms: readPlatforms(item, canonicalType),
  });
}
