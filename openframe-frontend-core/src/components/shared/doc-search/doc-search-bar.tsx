'use client'

/**
 * `<DocSearchBar>` — the canonical RAG-search dropdown surface.
 *
 * Mounted by every doc-search consumer (data-room sidebar, onboarding-
 * guide catalog, and any future surface that needs typeahead against
 * `/api/docs/search`). Wraps `<SearchInput>` with the lib's standard
 * `<DocSearchResultRow>` so the dropdown looks identical everywhere.
 *
 * ## Why a presentation component, not a "search bar that owns its
 *    own hook"
 *
 * The data-fetching hook (`useDocSearch`) lives hub-side because it
 * depends on hub-only context (`useDocNavigation`, the rag-table-
 * config registry, the hub's `decideNewTab` helper). Moving the hook
 * would cascade ~5 more file migrations into the lib.
 *
 * Instead, the hook stays hub-side and callers pass its result into
 * this component as plain props. Both consumers shrink to ~5 lines.
 */

import type { ReactNode } from 'react'
import { SearchInput, type SearchResult } from '../../ui/search-input'
import { DocSearchResultRow } from './doc-search-result-row'

export interface DocSearchBarProps {
  placeholder: string
  query: string
  onQueryChange: (value: string) => void
  /** Hook-fetched results. Reuses the lib's `<SearchInput>` `SearchResult`
   *  shape directly so callers don't translate. */
  results: SearchResult[]
  isLoading: boolean
  /** Result selection handler. Mirrors `<SearchInput>` — the second
   *  `modifiers` argument is preserved so cmd-click / shift-click on
   *  a result row still forces new-tab behavior. Hub `useDocSearch`
   *  reads these to short-circuit to `window.open()`. */
  onResultSelect: (
    result: SearchResult,
    modifiers?: {
      metaKey?: boolean
      ctrlKey?: boolean
      shiftKey?: boolean
      altKey?: boolean
      button?: number
    },
  ) => void
  /** Lets the caller's hook force the dropdown open after a recent
   *  internal action (e.g. result navigation). `undefined` falls back
   *  to `<SearchInput>`'s built-in focus/hover heuristics. */
  showDropdown?: boolean
  /** Defaults to 2 — matches the existing data-room and onboarding-
   *  guide consumers. Override only if a surface needs different
   *  typeahead semantics. */
  minQueryLength?: number
  /** Defaults to 0 — both existing consumers debounce inside the
   *  hook, not the input. */
  debounceMs?: number
  className?: string
  /** Optional row-renderer override. Defaults to the lib's standard
   *  `<DocSearchResultRow>` (source icon + title + path breadcrumb).
   *  Override only when a surface needs custom row chrome. */
  renderResult?: (result: SearchResult, isHighlighted: boolean) => ReactNode
}

export function DocSearchBar({
  placeholder,
  query,
  onQueryChange,
  results,
  isLoading,
  onResultSelect,
  showDropdown,
  minQueryLength = 2,
  debounceMs = 0,
  className = 'w-full',
  renderResult,
}: DocSearchBarProps) {
  return (
    <SearchInput
      placeholder={placeholder}
      value={query}
      onChange={onQueryChange}
      results={results}
      isLoading={isLoading}
      onResultSelect={onResultSelect}
      showDropdown={showDropdown || undefined}
      debounceMs={debounceMs}
      minQueryLength={minQueryLength}
      className={className}
      renderResult={
        renderResult ??
        ((result, isHighlighted) => (
          <DocSearchResultRow result={result} isHighlighted={isHighlighted} />
        ))
      }
    />
  )
}
