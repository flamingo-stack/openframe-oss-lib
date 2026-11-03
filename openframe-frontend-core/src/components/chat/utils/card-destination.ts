/**
 * Where an inline chat card goes when clicked: THE one decision, pure.
 *
 * A card and the source chip for the same row must land on the same page. The server answers every record's url: on its
 * source part (`chatRef.url`) or on the row the card fetched (`item.url`). The card asks the chip's resolver
 * (`resolveSourceRowCTA`) with it, and the host's composer decides where that type lives.
 *
 * `ChatCardLoader` calls this once per render; nothing else decides a card's href. No React, no DOM.
 */

import { platformOfUrl } from '../../../platform-domains';
import type { ComposeContentUrl } from '../../../utils/content-href';
import type { ChatRef } from '../chat-ref.types';
import { safeHref } from './compact-card-classes';
import { isRelativeHref } from './new-tab-rel';
import { pickFetchedCardHref, readFetchedCardPath, resolveFetchedCardHref } from './resolve-fetched-card-href';
import { resolveSourceRowCTA, type SourceRowContext } from './source-row-cta';

export interface CardDestination {
  url: string | null;
  targetPlatform: string | null;
  /** Doc-tree path, from the ref or the fetched row. The click router uses it for in-app doc navigation. */
  path: string | null;
  /**
   * The url is a route of the host's own. The server's url is always absolute, so a relative href the composer made of it
   * can only be a route the host claimed.
   */
  hostRoute: boolean;
}

/** The routing fields of a card registry entry, generic over the row type the entry reads. */
export interface CardDestinationEntry<Item> {
  contentRefType?: string;
  fallbackHref?: (item: Item) => string | null;
  noComposedHref?: boolean;
}

export interface CardDestinationInput<Item = unknown> {
  /** The ref the card was mounted with: described by a source part, or a bare record (`url: null`). */
  chatRef: ChatRef;
  /** The row the card fetched; undefined while loading and for ref-only types. */
  item?: Item;
  /** The registry entry's routing fields. */
  entry?: CardDestinationEntry<Item> | null;
  /** `sourceRowCtxFromRuntime(runtime)`, the same context a source chip is resolved with. */
  ctx: SourceRowContext;
  /** The host's content-href seam (`runtime.composeContentUrl`). */
  composeContentUrl?: ComposeContentUrl;
}

/** The url the fetched row answers (the one rule on the server), or null. */
function readFetchedCardUrl(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const { url } = item as { url?: unknown };
  return typeof url === 'string' && url ? url : null;
}

export function resolveCardDestination<Item = unknown>({
  chatRef,
  item,
  entry,
  ctx,
  composeContentUrl,
}: CardDestinationInput<Item>): CardDestination {
  const url = chatRef.url ?? readFetchedCardUrl(item);
  const refPath = typeof chatRef.metadata?.path === 'string' && chatRef.metadata.path ? chatRef.metadata.path : null;
  // TODO(CU-17tkuw635xx): an old doc source arrives with no url, and its row's path is what a doc card opens.
  const path = refPath ?? (item ? readFetchedCardPath(item) : null);
  const cta = resolveSourceRowCTA(
    {
      documentType: chatRef.type,
      id: chatRef.id,
      title: chatRef.title,
      externalUrl: url,
      targetPlatform: platformOfUrl(url),
      path,
    },
    ctx,
  );
  if (cta.href) {
    return {
      url: cta.href,
      targetPlatform: cta.targetPlatform,
      path,
      // TODO(CU-17tkuw635xx): an old hub's row may answer a relative url, which a composer hands back as it came: the
      // content host's page, never a route of this host. Once every url is absolute, the first half alone.
      hostRoute: isRelativeHref(cta.href) && cta.href !== url,
    };
  }
  return legacyCardDestination({ chatRef, item, entry, composeContentUrl, path });
}

/**
 * TODO(CU-17tkuw635xx): the old hub's page-shaped rows answer no url, and `resolveSourceRowCTA` calls the composer only
 * with a url or a doc path. So the fetched row's own destination: an explicit host override, else the registry's
 * `fallbackHref`, else the composer's href. Only what the host composed can be a route of its own.
 */
function legacyCardDestination<Item>({
  chatRef,
  item,
  entry,
  composeContentUrl,
  path,
}: Pick<CardDestinationInput<Item>, 'chatRef' | 'item' | 'entry' | 'composeContentUrl'> & {
  path: string | null;
}): CardDestination {
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
      return {
        url,
        targetPlatform: choice.targetPlatform ?? null,
        path,
        hostRoute: choice.source !== 'item' && isRelativeHref(url),
      };
    }
  }
  return { url: null, targetPlatform: null, path, hostRoute: false };
}
