/**
 * Where a record goes when clicked: THE one decision, pure, for every surface that shows a record (its card, its chip in
 * a sentence, a citation, a row of the sources strip, a search result).
 *
 * Every surface must land on the same page. The server answers every record's url: on its source part (`chatRef.url`)
 * or on the row the card fetched (`item.url`). The surface asks the row resolver (`resolveSourceRowCTA`) with it, the
 * host's composer decides where that type lives, and a relative href is a route of the host's own (`hostRoute`), which
 * the click router keeps on the host in every mode, embed included. `resolveRecordDestination` adds the new-tab
 * decision (`navLinkTarget`) the anchor renders with; `RecordAnchor` (entity-cards/dispatch.tsx) opens it through
 * `RecordNavWrap`. No React, no DOM.
 */

import type { ChatRuntime } from '../../../contexts/chat-runtime-context';
import { platformOfUrl } from '../../../platform-domains';
import type { ChatRef } from '../chat-ref.types';
import { navLinkTarget } from './nav-anchor-props';
import { isRelativeHref } from './new-tab-rel';
import {
  resolveSourceRowCTA,
  type SourceRowContext,
  type SourceRowCTA,
  type SourceRowInput,
  sourceRowCtxFromRuntime,
} from './source-row-cta';

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

/** The row a card's ref and its fetched row describe, in the words the row resolver reads. */
export function recordRowOf({ chatRef, item }: Pick<CardDestinationInput, 'chatRef' | 'item'>): SourceRowInput {
  const url = chatRef.url ?? readFetchedCardUrl(item);
  const path = typeof chatRef.metadata?.path === 'string' && chatRef.metadata.path ? chatRef.metadata.path : null;
  return {
    documentType: chatRef.type,
    id: chatRef.id,
    title: chatRef.title,
    externalUrl: url,
    targetPlatform: platformOfUrl(url),
    path,
  };
}

function destinationOf(
  row: SourceRowInput,
  ctx: SourceRowContext,
): { cta: SourceRowCTA; destination: CardDestination } {
  const cta = resolveSourceRowCTA(row, ctx);
  const path = row.path ?? null;
  if (!cta.href) return { cta, destination: { url: null, targetPlatform: null, path, hostRoute: false } };
  return {
    cta,
    destination: { url: cta.href, targetPlatform: cta.targetPlatform, path, hostRoute: isRelativeHref(cta.href) },
  };
}

/** Where the card opens: the row resolver over the url the server answers. No url is no link. */
export function resolveCardDestination({ chatRef, item, ctx }: CardDestinationInput): CardDestination {
  return destinationOf(recordRowOf({ chatRef, item }), ctx).destination;
}

/** Where a record opens, and in which tab: what `RecordAnchor` renders, and the row's CTA (its icon, its Ask ref). */
export interface RecordDestination extends CardDestination {
  /** The new-tab decision, the one the anchor's `target` and the click router share (`navLinkTarget`). */
  isNewTab: boolean;
  cta: SourceRowCTA;
}

/**
 * Where a record opens in this chat: THE resolver of every surface (card, record chip, citation, source row, search
 * result), over the host's composer, with the new-tab decision made once with the same `hostRoute` the click router
 * gets.
 */
export function resolveRecordDestination(row: SourceRowInput, runtime: ChatRuntime): RecordDestination {
  const { cta, destination } = destinationOf(row, sourceRowCtxFromRuntime(runtime));
  const isNewTab = destination.url
    ? navLinkTarget(runtime, destination.url, destination.targetPlatform, { hostRoute: destination.hostRoute }).isNewTab
    : false;
  return { ...destination, isNewTab, cta };
}

/** What a record's anchor opens: a destination that has a url. */
export interface RecordLinkTarget {
  url: string;
  targetPlatform: string | null;
  path: string | null;
  hostRoute: boolean;
  isNewTab: boolean;
}

/** The anchor's target of a destination, or null when it opens nothing. */
export function recordLinkTargetOf(
  destination: Omit<RecordLinkTarget, 'url'> & { url: string | null },
): RecordLinkTarget | null {
  const { url, targetPlatform, path, hostRoute, isNewTab } = destination;
  return url ? { url, targetPlatform, path, hostRoute, isNewTab } : null;
}
