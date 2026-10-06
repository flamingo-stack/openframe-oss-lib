/**
 * Where an inline chat card goes when clicked: THE one decision, pure.
 *
 * A card and the source chip for the same row must land on the same page. The
 * chip always has its row (`externalUrl`, `path`); a card may arrive as a bare
 * `[card://type:id]` marker and learn the rest only when its row loads. So the
 * card asks the chip's resolver (`resolveSourceRowCTA`) with everything known
 * at that moment, the marker's fields first and the fetched row's `path` when
 * the marker had none, and falls back to the fetched row's own destination
 * (`pickFetchedCardHref`) only when that resolver has nothing to route.
 *
 * `ChatCardLoader` calls this once per render; nothing else decides a card's
 * href. No React, no DOM.
 */

import type { ComposeContentUrl } from '../../../utils/content-href';
import type { ChatRef } from '../chat-ref.types';
import { safeHref } from './compact-card-classes';
import { pickFetchedCardHref, readFetchedCardPath, resolveFetchedCardHref } from './resolve-fetched-card-href';
import { resolveSourceRowCTA, type SourceRowContext } from './source-row-cta';

/** Which rule produced the destination (for tests and debugging). */
export type CardDestinationSource = 'row' | 'hostOverride' | 'item' | 'composed' | 'none';

export interface CardDestination {
  url: string | null;
  targetPlatform: string | null;
  /** Doc-tree path, from the ref or the fetched row. The click router uses it for in-app doc navigation. */
  path: string | null;
  source: CardDestinationSource;
}

/** The routing fields of a card registry entry, generic over the row type the entry reads. */
export interface CardDestinationEntry<Item> {
  contentRefType?: string;
  fallbackHref?: (item: Item) => string | null;
  noComposedHref?: boolean;
}

export interface CardDestinationInput<Item = unknown> {
  /** The ref the card was mounted with: a full ref, or a bare marker (`url: null`, no metadata). */
  chatRef: ChatRef;
  /** The row the card fetched; undefined while loading and for ref-only types. */
  item?: Item;
  /** The registry entry's routing fields. */
  entry?: CardDestinationEntry<Item> | null;
  /** `sourceRowCtxFromRuntime(runtime, surface)`, the same context a source chip is resolved with. */
  ctx: SourceRowContext;
  /** The host's content-href seam (`runtime.composeContentUrl`). */
  composeContentUrl?: ComposeContentUrl;
  /** Embed-mode origin prefix (`resolveHrefForRuntime`), applied to a row-resolved href. */
  resolveHref?: (href: string) => string;
}

export function resolveCardDestination<Item = unknown>({
  chatRef,
  item,
  entry,
  ctx,
  composeContentUrl,
  resolveHref = href => href,
}: CardDestinationInput<Item>): CardDestination {
  const refPath = typeof chatRef.metadata?.path === 'string' && chatRef.metadata.path ? chatRef.metadata.path : null;
  const path = refPath ?? (item ? readFetchedCardPath(item) : null);

  // 1. The chip's resolver, with the row as far as it is known.
  const cta = resolveSourceRowCTA(
    {
      sourceRepo: chatRef.sourceRepo,
      documentType: chatRef.type,
      id: chatRef.id,
      title: chatRef.title,
      externalUrl: chatRef.url,
      targetPlatform: chatRef.targetPlatform,
      path,
    },
    ctx,
  );
  const rowUrl = cta.href ? resolveHref(cta.href) : (chatRef.url ?? null);
  const rowPlatform = cta.targetPlatform ?? chatRef.targetPlatform ?? null;
  if (rowUrl) return { url: rowUrl, targetPlatform: rowPlatform, path, source: 'row' };

  // 2. The fetched row's own destination: an explicit host override, else the
  //    registry's `fallbackHref`, else the host seam's composed href.
  if (entry?.contentRefType && item) {
    const choice = pickFetchedCardHref({
      composed: resolveFetchedCardHref({
        contentRefType: entry.contentRefType,
        id: chatRef.id,
        item,
        composeContentUrl,
      }),
      itemHref: entry.fallbackHref?.(item) ?? null,
      allowComposed: !entry.noComposedHref,
    });
    const url = choice ? (safeHref(choice.href) ?? null) : null;
    if (choice && url) {
      // The `item` branch carries no platform of its own: keep the ref's.
      return { url, targetPlatform: choice.targetPlatform ?? rowPlatform, path, source: choice.source };
    }
  }
  return { url: null, targetPlatform: rowPlatform, path, source: 'none' };
}
