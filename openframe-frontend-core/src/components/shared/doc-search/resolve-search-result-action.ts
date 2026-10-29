/**
 * Resolve what should happen when the user picks a search result.
 * Returns one of five typed actions so the caller is a single switch.
 *
 * Resolution order:
 *  1. `externalUrl` present → resolve the href through the host's
 *     `composeContentUrl` seam (when wired), then THE navigation decision
 *     (`navLinkTarget`, the one every chat link uses) chooses same-tab vs new-tab.
 *  2. Row has `id` + `sourceRepo` + `documentType` → synth an Ask-AI
 *     action (entity drill-in via primary key, no URL).
 *  3. Row has only `path` → legacy navigation fallback.
 *  4. Nothing actionable → noop.
 *
 * Lifted from the hub's `hooks/use-docs.ts:resolveSearchResultAction`.
 * Pure — no React, no telemetry.
 */

import type { ChatRuntime } from '../../../contexts/chat-runtime-context';
import type { ComposeContentUrl } from '../../../utils/content-href';
import type { ChatRef } from '../../chat/chat-ref.types';
import { navLinkTarget } from '../../chat/utils/nav-anchor-props';
import { isRelativeHref } from '../../chat/utils/new-tab-rel';
import type { SearchResult } from '../../ui/search-input';

export type SearchResultAction =
  | { kind: 'navigate-same-tab'; href: string; hostRoute?: boolean }
  | { kind: 'navigate-new-tab'; href: string; hostRoute?: boolean }
  | { kind: 'ask-ai'; detail: { source: string; ref: ChatRef } }
  | { kind: 'route'; path: string }
  | { kind: 'noop' };

export function resolveSearchResultAction(
  result: SearchResult,
  source: string,
  /** The chat runtime the search runs in; null outside one (same tab, the decision's no-runtime rule). */
  runtime: ChatRuntime | null | undefined,
  /** The host's unified content-href seam (`runtime.composeContentUrl`).
   *  When wired, an entity row's RAG `externalUrl` is re-resolved through it,
   *  so a type the host serves in-app (`hostedTypes`) or deep-links itself
   *  (`overrides`) lands on the SAME href the catalog cards and chat cards
   *  use. Omitted → the legacy verbatim-`externalUrl` behavior. */
  composeContentUrl?: ComposeContentUrl,
): SearchResultAction {
  const meta = result.metadata ?? {};
  const externalUrl = meta.externalUrl as string | undefined;
  const rowId = meta.id as string | undefined;
  const sourceRepo = meta.sourceRepo as string | undefined;
  const documentType = meta.documentType as string | undefined;
  if (externalUrl) {
    const targetPlatform = meta.targetPlatform as string | null | undefined;
    // Unified content-href seam — the same call `resolveSourceRowCTA` makes
    // for chat rows. Hosted types relativize the slug out of `externalUrl`;
    // everything else comes back verbatim, so an unwired host (or a row with
    // no `documentType`) keeps today's behavior byte-for-byte.
    const composed =
      composeContentUrl && documentType
        ? composeContentUrl({
            type: documentType,
            identifier: rowId ?? '',
            externalUrl,
            targetPlatform: targetPlatform ?? null,
          })
        : null;
    // THE navigation decision. A RELATIVE composed href is a route the host claimed as in-app (`hostRoute`): it stays
    // in this window in every mode, never handed to `window.open`.
    const hostRoute = !!composed?.href && isRelativeHref(composed.href);
    const target = navLinkTarget(
      runtime,
      composed?.href || externalUrl,
      composed ? composed.targetPlatform : targetPlatform,
      {
        hostRoute,
      },
    );
    const kind = target.isNewTab ? 'navigate-new-tab' : 'navigate-same-tab';
    return hostRoute ? { kind, href: target.href, hostRoute } : { kind, href: target.href };
  }
  if (rowId && sourceRepo && documentType) {
    return {
      kind: 'ask-ai',
      detail: {
        source,
        ref: { type: documentType, id: rowId, title: result.title, url: null },
      },
    };
  }
  if (result.path) {
    return { kind: 'route', path: result.path };
  }
  return { kind: 'noop' };
}
