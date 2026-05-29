/**
 * Wire shape returned by `/api/docs/search` (one row per result).
 * The hub's server-side RAG layer composes this; the lib hook
 * consumes it. Keep field-for-field identical with the hub's
 * `lib/data/doc-search-utils.ts:DocSearchResult` interface.
 */
export interface DocSearchResult {
  path: string
  name: string
  type: 'file' | 'folder'
  snippet: string
  matchType: 'title' | 'content'
  documentType?: string
  externalUrl?: string
  /** Platform that owns `externalUrl`. Threaded from the rag-config's
   *  `resolveUrl` so the search-bar click handler can hand it straight
   *  to the lib's `decideNewTab` for the same-tab-vs-new-tab decision.
   *  `null` when external/unknown. */
  targetPlatform?: string | null
  sourceRepo?: string
  /** Row's `RagTableConfig.primaryKey` value when known. Surfaced so the
   *  search bar consumer can synthesize a `ChatRef` for entity rows
   *  that have no public viewer (cap_table, financial-kpis, etc.) — the
   *  click handler opens the chat panel pre-filled with a row drill-in
   *  via `entityIdFilter` instead of synthesizing a 404 URL from
   *  `result.path`. */
  entityId?: string
}
