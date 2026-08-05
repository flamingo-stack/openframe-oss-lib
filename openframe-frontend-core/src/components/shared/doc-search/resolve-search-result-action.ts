/**
 * Resolve what should happen when the user picks a search result.
 * Returns one of five typed actions so the caller is a single switch.
 *
 * Resolution order:
 *  1. `externalUrl` present → resolve the href through the host's
 *     `composeContentUrl` seam (when wired), then use `decideNewTab` to
 *     choose same-tab vs new-tab against the resolved `targetPlatform`.
 *  2. Row has `id` + `sourceRepo` + `documentType` → synth an Ask-AI
 *     action (entity drill-in via primary key, no URL).
 *  3. Row has only `path` → legacy navigation fallback.
 *  4. Nothing actionable → noop.
 *
 * Lifted from the hub's `hooks/use-docs.ts:resolveSearchResultAction`.
 * Pure — no React, no telemetry.
 */

import type { SearchResult } from '../../ui/search-input'
import type { ChatRef } from '../../chat/chat-ref.types'
import type { ComposeContentUrl } from '../../../utils/content-href'
import { decideNewTab } from '../../chat/utils/decide-new-tab'

/** True for `https://…` and protocol-relative `//…`. A composed href that is
 *  NOT absolute is an in-app route the host claimed via `hostedTypes` /
 *  `overrides`. */
function isAbsoluteHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(href)
}

export type SearchResultAction =
  | { kind: 'navigate-same-tab'; href: string }
  | { kind: 'navigate-new-tab'; href: string }
  | { kind: 'ask-ai'; detail: { source: string; ref: ChatRef } }
  | { kind: 'route'; path: string }
  | { kind: 'noop' }

export function resolveSearchResultAction(
  result: SearchResult,
  source: string,
  runtimeMode?: 'host' | 'embed',
  /** The host's unified content-href seam (`runtime.composeContentUrl`).
   *  When wired, an entity row's RAG `externalUrl` is re-resolved through it,
   *  so a type the host serves in-app (`hostedTypes`) or deep-links itself
   *  (`overrides`) lands on the SAME href the catalog cards and chat cards
   *  use. Omitted → the legacy verbatim-`externalUrl` behavior. */
  composeContentUrl?: ComposeContentUrl,
): SearchResultAction {
  const meta = result.metadata ?? {}
  const externalUrl = meta.externalUrl as string | undefined
  const rowId = meta.id as string | undefined
  const sourceRepo = meta.sourceRepo as string | undefined
  const documentType = meta.documentType as string | undefined
  if (externalUrl) {
    const targetPlatform = meta.targetPlatform as string | null | undefined
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
        : null
    const href = composed?.href || externalUrl
    // A RELATIVE composed href means the host claimed this row as in-app.
    // Short-circuit BEFORE `decideNewTab`: in embed mode that helper forces
    // new-tab unconditionally, which would fire `window.open()` on a path
    // that only resolves inside this app.
    if (composed && !isAbsoluteHref(href)) {
      return { kind: 'navigate-same-tab', href }
    }
    // Same pure helper `useNavLink` and `useUnifiedNav` call — single
    // decision rule across cards, chips, and autocomplete rows. Thread
    // the caller's `source` as `currentSource` so the platform-vs-
    // platform comparison matches the hub's pre-migration behavior.
    const isNewTab = decideNewTab({
      href,
      targetPlatform: composed ? composed.targetPlatform : targetPlatform,
      surface: 'useUnifiedNav',
      runtimeMode,
      currentSource: source,
    })
    return isNewTab
      ? { kind: 'navigate-new-tab', href }
      : { kind: 'navigate-same-tab', href }
  }
  if (rowId && sourceRepo && documentType) {
    return {
      kind: 'ask-ai',
      detail: {
        source,
        ref: { type: documentType, id: rowId, title: result.title, url: null },
      },
    }
  }
  if (result.path) {
    return { kind: 'route', path: result.path }
  }
  return { kind: 'noop' }
}
