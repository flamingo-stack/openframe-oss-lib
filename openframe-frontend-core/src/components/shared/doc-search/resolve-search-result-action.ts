/**
 * Resolve what should happen when the user picks a search result.
 * Returns one of five typed actions so the caller is a single switch.
 *
 * Resolution order:
 *  1. `externalUrl` present → use `decideNewTab` to choose same-tab vs
 *     new-tab against the row's `targetPlatform`.
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
import { decideNewTab } from '../../chat/utils/decide-new-tab'

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
): SearchResultAction {
  const meta = result.metadata ?? {}
  const externalUrl = meta.externalUrl as string | undefined
  if (externalUrl) {
    // Same pure helper `useNavLink` and `useUnifiedNav` call — single
    // decision rule across cards, chips, and autocomplete rows. Thread
    // the caller's `source` as `currentSource` so the platform-vs-
    // platform comparison matches the hub's pre-migration behavior.
    const targetPlatform = meta.targetPlatform as string | null | undefined
    const isNewTab = decideNewTab({
      href: externalUrl,
      targetPlatform,
      surface: 'useUnifiedNav',
      runtimeMode,
      currentSource: source,
    })
    return isNewTab
      ? { kind: 'navigate-new-tab', href: externalUrl }
      : { kind: 'navigate-same-tab', href: externalUrl }
  }
  const rowId = meta.id as string | undefined
  const sourceRepo = meta.sourceRepo as string | undefined
  const documentType = meta.documentType as string | undefined
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
