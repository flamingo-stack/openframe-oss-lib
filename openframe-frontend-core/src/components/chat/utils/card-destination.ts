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
import type { ChatRef } from '../chat-ref.types';
import { isRelativeHref } from './new-tab-rel';
import { resolveSourceRowCTA, type SourceRowContext } from './source-row-cta';

export interface CardDestination {
  url: string | null;
  targetPlatform: string | null;
  /** Doc-tree path, from the ref. The click router uses it for in-app doc navigation. */
  path: string | null;
  /**
   * The url is a route of the host's own. The server's url is always absolute, so a relative href the composer made of it
   * can only be a route the host claimed.
   */
  hostRoute: boolean;
}

export interface CardDestinationInput {
  /** The ref the card was mounted with: described by a source part, or a bare record (`url: null`). */
  chatRef: ChatRef;
  /** The row the card fetched; undefined while loading and for ref-only types. */
  item?: unknown;
  /** `sourceRowCtxFromRuntime(runtime)`, the same context a source chip is resolved with. */
  ctx: SourceRowContext;
}

/** The url the fetched row answers (the one rule on the server), or null. */
function readFetchedCardUrl(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const { url } = item as { url?: unknown };
  return typeof url === 'string' && url ? url : null;
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

/** Where the card opens: the source chip's resolver over the url the server answers. No url is no link. */
export function resolveCardDestination({ chatRef, item, ctx }: CardDestinationInput): CardDestination {
  const url = chatRef.url ?? readFetchedCardUrl(item);
  const path = typeof chatRef.metadata?.path === 'string' && chatRef.metadata.path ? chatRef.metadata.path : null;
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
  if (!cta.href) return { url: null, targetPlatform: null, path, hostRoute: false };
  return { url: cta.href, targetPlatform: cta.targetPlatform, path, hostRoute: isRelativeHref(cta.href) };
}
