/**
 * Resolve what should happen when the user picks a search result.
 * Returns one of five typed actions so the caller is a single switch.
 *
 * Resolution order:
 *  1. `url` present → resolve the href through the host's
 *     `composeContentUrl` seam (when wired), then THE navigation decision
 *     (`navLinkTarget`, the one every chat link uses) chooses same-tab vs new-tab.
 *  2. A document (`DOC_TABLE_TYPES`) with a tree path → its viewer.
 *  3. Row names a record (`sourceId`) → synth an Ask-AI action (entity drill-in
 *     via primary key, no URL).
 *  4. Row has only `path` → legacy navigation fallback.
 *  5. Nothing actionable → noop.
 *
 * Lifted from the hub's `hooks/use-docs.ts:resolveSearchResultAction`.
 * Pure — no React, no telemetry.
 */

import { parseRecordHref } from '../../../chat-protocol/record-link';
import type { ChatRuntime } from '../../../contexts/chat-runtime-context';
import { platformOfUrl } from '../../../platform-domains';
import type { ComposeContentUrl } from '../../../utils/content-href';
import { DOC_TABLE_TYPES } from '../../../utils/source-grouping';
import type { ChatRef } from '../../chat/chat-ref.types';
import { navLinkTarget } from '../../chat/utils/nav-anchor-props';
import { isRelativeHref } from '../../chat/utils/new-tab-rel';
import type { SearchResult } from '../../ui/search-input';

export type SearchResultAction =
  | { kind: 'navigate-same-tab'; href: string; targetPlatform: string | null; hostRoute?: boolean }
  | { kind: 'navigate-new-tab'; href: string; targetPlatform: string | null; hostRoute?: boolean }
  | { kind: 'ask-ai'; detail: { source: string; ref: ChatRef } }
  | { kind: 'route'; path: string }
  | { kind: 'noop' };

export function resolveSearchResultAction(
  result: SearchResult,
  source: string,
  /** The chat runtime the search runs in; null outside one (same tab, the decision's no-runtime rule). */
  runtime: ChatRuntime | null | undefined,
  /** The host's unified content-href seam (`runtime.composeContentUrl`).
   *  When wired, a row's `url` is re-resolved through it, so a type the host
   *  serves in-app (`hostedTypes`) or deep-links itself (`overrides`) lands on
   *  the SAME href the catalog cards and chat cards use. Omitted → the url as
   *  given. */
  composeContentUrl?: ComposeContentUrl,
): SearchResultAction {
  const meta = result.metadata ?? {};
  const url = meta.url as string | undefined;
  const record = parseRecordHref(meta.sourceId);
  if (url) {
    const targetPlatform = platformOfUrl(url);
    // Unified content-href seam: the same call `resolveSourceRowCTA` makes for chat rows. Hosted types relativize the
    // slug out of `url`; everything else comes back verbatim, so an unwired host (or a row naming no record) gets the
    // url as given.
    const composed =
      composeContentUrl && record
        ? composeContentUrl({
            type: record.type,
            identifier: record.id,
            externalUrl: url,
            targetPlatform,
          })
        : null;
    // THE navigation decision. A RELATIVE composed href is a route the host claimed as in-app (`hostRoute`): it stays
    // in this window in every mode, never handed to `window.open`.
    const hostRoute = !!composed?.href && isRelativeHref(composed.href);
    const actionPlatform = composed ? composed.targetPlatform : targetPlatform;
    const target = navLinkTarget(runtime, composed?.href || url, actionPlatform, { hostRoute });
    const kind = target.isNewTab ? 'navigate-new-tab' : 'navigate-same-tab';
    // The executor decides again from these same inputs, so the click lands where this action says.
    return hostRoute
      ? { kind, href: target.href, targetPlatform: actionPlatform, hostRoute }
      : { kind, href: target.href, targetPlatform: actionPlatform };
  }
  // TODO(CU-17tkuw635xx): an old hub's document has no url and opens in the doc viewer by its tree path: no row of the
  // chat can show it.
  if (result.path && record && (DOC_TABLE_TYPES as readonly string[]).includes(record.type)) {
    return { kind: 'route', path: result.path };
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
  if (result.path) {
    return { kind: 'route', path: result.path };
  }
  return { kind: 'noop' };
}
