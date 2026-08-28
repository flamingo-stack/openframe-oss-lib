/**
 * Post-fetch href fallback for an inline chat card whose `ChatRef` carried no
 * `externalUrl`.
 *
 * ## Why a fetch-mode card can arrive without a URL
 *
 * The two chat transports deliver entity references differently:
 *
 *   - **SSE / guide transport** — the server ships a `refs` metadata frame, so
 *     each `[card://type:id]` marker expands into a FULL `ChatRef`
 *     (`title` / `url` / `targetPlatform` / `sourceRepo`). `resolveSourceRowCTA`
 *     then routes that `externalUrl` through the host's `composeContentUrl`
 *     seam and the card is clickable.
 *   - **Mingo / NATS transport** (`messageData: [{ type: 'GUIDE' | 'TEXT', text }]`)
 *     — the body carries bare `[card://type:id]` markers and NOTHING else.
 *     `chat-message-enhanced.tsx` synthesizes a minimal `{ type, id, title: id,
 *     url: null }` ref so fetch-mode cards can still self-fetch their row, but
 *     `resolveSourceRowCTA` has no `externalUrl`, no `path` and no
 *     `targetPlatform` to work with → `href: null` → the card renders with its
 *     real title and description but goes nowhere when clicked.
 *
 * This resolver closes that gap WITHOUT a second URL vocabulary: it calls the
 * exact same `composeContentUrl` seam the page cards (`resolveContentHref`) and
 * the SSE cards (`resolveSourceRowCTA`) use, so one host config —
 * `hostedTypes` / `suffixes` / `overrides` — governs all three.
 *
 * `identifier` stays the marker's primary key (that is what `overrides` such as
 * roadmap's `?search=<task id>` deep-link on); the row's `slug` rides the
 * separate `slug` hint for hosted types whose detail route is slug-based.
 *
 * Pure — no React, no DOM. The caller owns `safeHref` validation.
 */

import type { ComposeContentUrl } from '../../../utils/content-href';
import { canonicalContentRefType } from '../../../utils/list-url';

export interface FetchedCardHrefInput {
  /** Canonical `documentType` for the seam (registry `contentRefType`). */
  contentRefType: string;
  /** The marker's primary key — `ChatRef.id`, NOT the fetched row's id. */
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
 * Human title of a fetched row — `title`, else `name`, else null.
 *
 * A Mingo synthetic ref carries `title: <the marker id>` because that is all
 * the transport shipped. Everything downstream that prints or sends the title
 * (the "Ask Mingo" prompt, host renderers falling back to `ref.title`) would
 * otherwise say `86ad3qvv5`. Once the row loads, this is the real title.
 */
export function readFetchedCardTitle(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  for (const key of ['title', 'name'] as const) {
    const value = (item as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Read the row's platform-association array — the hub composer keys its
 *  cross-platform topology off it; the embedder default ignores it. Hub
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
export function resolveFetchedCardHref({
  contentRefType,
  id,
  item,
  composeContentUrl,
}: FetchedCardHrefInput): { href: string; targetPlatform: string | null } | null {
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
