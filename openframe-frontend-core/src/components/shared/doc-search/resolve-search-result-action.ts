/**
 * Resolve what should happen when the user picks a search result.
 * Returns one of four typed actions so the caller is a single switch.
 *
 * Resolution order:
 *  1. `url` present → the record's destination from the one record resolver (`resolveRecordDestination`, the card's,
 *     the chip's and the citation's), so a search row lands on the page its card opens, with the same new-tab decision.
 *  2. Row names a record (`sourceId`) → synth an Ask-AI action (entity drill-in via primary key, no URL).
 *  3. Nothing actionable → noop.
 *
 * Pure: no React, no telemetry.
 */

import { parseRecordHref } from '../../../chat-protocol/record-link';
import type { ChatRuntime } from '../../../contexts/chat-runtime-context';
import { platformOfUrl } from '../../../platform-domains';
import type { ComposeContentUrl } from '../../../utils/content-href';
import { defaultTableIdForDocumentType } from '../../../utils/source-icons';
import type { ChatRef } from '../../chat/chat-ref.types';
import { resolveRecordDestination } from '../../chat/utils/card-destination';
import { safeHref } from '../../chat/utils/compact-card-classes';
import { navLinkTarget } from '../../chat/utils/nav-anchor-props';
import type { SearchResult } from '../../ui/search-input';

export type SearchResultAction =
  | { kind: 'navigate-same-tab'; href: string; targetPlatform: string | null; hostRoute?: boolean }
  | { kind: 'navigate-new-tab'; href: string; targetPlatform: string | null; hostRoute?: boolean }
  | { kind: 'ask-ai'; detail: { source: string; ref: ChatRef } }
  | { kind: 'noop' };

export function resolveSearchResultAction(
  result: SearchResult,
  source: string,
  /** The chat runtime the search runs in; null outside one (same tab, the decision's no-runtime rule). */
  runtime: ChatRuntime | null | undefined,
  /** A composer that stands in for the runtime's own (`useDocSearch`'s `composeContentUrl` prop). */
  composeContentUrl?: ComposeContentUrl,
): SearchResultAction {
  const meta = result.metadata ?? {};
  const url = typeof meta.url === 'string' && meta.url ? meta.url : undefined;
  const record = parseRecordHref(meta.sourceId);
  if (url) {
    if (!runtime) {
      // Outside a chat (nothing to route through): the url as given, and the navigation decision's no-runtime rule.
      const safe = safeHref(url);
      if (!safe) return { kind: 'noop' };
      const targetPlatform = platformOfUrl(safe);
      const { href, isNewTab } = navLinkTarget(null, safe, targetPlatform);
      return { kind: isNewTab ? 'navigate-new-tab' : 'navigate-same-tab', href, targetPlatform };
    }
    const destination = resolveRecordDestination(
      {
        sourceRepo: record ? defaultTableIdForDocumentType(record.type) : null,
        documentType: record?.type ?? null,
        id: record?.id ?? null,
        title: result.title,
        externalUrl: url,
        targetPlatform: platformOfUrl(url),
      },
      composeContentUrl ? { ...runtime, composeContentUrl } : runtime,
    );
    if (!destination.url) return { kind: 'noop' };
    const { hostRoute, targetPlatform } = destination;
    // The executor decides again from these same inputs, so the click lands where this action says.
    const { href } = navLinkTarget(runtime, destination.url, targetPlatform, { hostRoute });
    const kind = destination.isNewTab ? 'navigate-new-tab' : 'navigate-same-tab';
    return hostRoute ? { kind, href, targetPlatform, hostRoute } : { kind, href, targetPlatform };
  }
  if (record) {
    return {
      kind: 'ask-ai',
      detail: {
        source,
        ref: { type: record.type, id: record.id, title: result.title, url: null },
      },
    };
  }
  return { kind: 'noop' };
}
