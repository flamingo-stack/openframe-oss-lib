'use client'

/**
 * `useDocSearch` — debounced RAG-search hook against `/api/docs/search`.
 *
 * Pure fetch + navigation glue. Embedders can mount this directly
 * (any host with a reverse-proxy that exposes `/api/docs/search` will
 * work). Hub callers wire it into the lib `<DocSearchBar>` for the
 * canonical typeahead dropdown.
 *
 * ## What moved from hub to lib
 *
 * Lifted from `multi-platform-hub/hooks/use-docs.ts:useDocSearch`. Two
 * hub-only concerns are now optional injection points instead of
 * direct imports:
 *
 *   - `useDocNavigation()` (hub's in-page doc-tree swap) → optional
 *     `onInPageSwap?: (path: string) => boolean` config callback. When
 *     present and returns true, the hook treats a same-origin result
 *     click as "handled in-page"; when absent or returns false, the
 *     hook falls back to `onNavigate(path)` (`router.push` on hub,
 *     `window.location.assign` on bare embedders).
 *   - `traceCompose` (hub-only telemetry) → dropped. The lib has no
 *     equivalent runtime-context yet; bring it back when there is one.
 *
 * Everything else (debounce, `useChatRuntime` for embed-mode short-
 * circuit, embed-shim router, the action-resolver + result-mapper) is
 * now lib-resident.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from '../../../embed-shims'
import { useDebounce } from '../../../hooks/ui/use-debounce'
import { useChatRuntime } from '../../../contexts/chat-runtime-context'
import { contentFetch } from '../../../utils/embed-content-fetch'
import type { SearchResult } from '../../ui/search-input'
import {
  resolveExternalNavigation,
  stripSameOriginToPath,
  NEW_TAB_FEATURES,
} from '../../chat/utils/chat-nav-resolution'
import type { DocSearchResult } from './types'
import { mapDocSearchResults } from './map-doc-search-results'
import { resolveSearchResultAction } from './resolve-search-result-action'

export interface UseDocSearchConfig {
  /** Discriminator passed to `/api/docs/search?source=` (e.g.
   *  `'openframe'`). Embedders set it to whatever discriminator their
   *  reverse-proxy expects. */
  source: string
  /** Base route prefix this search lives under (e.g. `'/onboarding-guides'`).
   *  When a result's href starts with `${baseRoute}/`, the hook
   *  attempts the optional in-page swap path before falling through
   *  to a full nav. */
  baseRoute: string
  /** Imperative navigation fallback. Called when no override
   *  (in-page swap, new-tab) applies. Hub callers pass
   *  `(path) => router.push(path)`; embedders pass an equivalent. */
  onNavigate: (path: string) => void
  /** Optional `RagTableConfig.id` list to narrow the search to specific
   *  tables (e.g. `['onboarding-guides']`). Forwarded to
   *  `/api/docs/search?tableIds=…` which intersects with the source's
   *  standing set. */
  tableIds?: string[]
  /** Optional in-page swap callback. When the result's href is under
   *  `baseRoute` AND this callback returns true, the hook treats the
   *  click as handled in-page (no router push). Hub's
   *  `<DocumentationSection>` wires this to
   *  `useDocNavigation().navigate(path)`. */
  onInPageSwap?: (path: string) => boolean
  /** Optional endpoint override. Defaults to `'/api/docs/search'`
   *  (the hub's reverse-proxy route). Embedders with a different
   *  path can override. */
  searchEndpoint?: string
}

export function useDocSearch(config: UseDocSearchConfig) {
  const {
    source,
    baseRoute,
    onNavigate,
    tableIds,
    onInPageSwap,
    searchEndpoint,
  } = config
  const tableIdsKey = tableIds && tableIds.length > 0 ? tableIds.join(',') : ''

  const router = useRouter()
  // Optional chat-runtime read — when present and mode='embed' the
  // search-result row click short-circuits to a new-tab open against
  // the absolutized URL. Null/host preserves today's behavior.
  // Also used as the proxy-prefix fallback for `searchEndpoint`, matching
  // how tickets resolves `findTicketUrl`.
  const runtime = useChatRuntime()
  const resolvedSearchEndpoint =
    searchEndpoint ?? runtime?.endpoints.docsSearchUrl ?? '/api/docs/search'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setResults([])
      setIsFetching(false)
      return
    }

    let cancelled = false

    async function fetchResults() {
      setIsFetching(true)
      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          source,
          limit: '10',
        })
        if (tableIdsKey) params.set('tableIds', tableIdsKey)

        const response = await contentFetch(`${resolvedSearchEndpoint}?${params.toString()}`)
        if (!response.ok) {
          throw new Error(`Search request failed: ${response.status}`)
        }

        const json = await response.json()

        if (!cancelled && json.success && Array.isArray(json.data)) {
          const mapped = mapDocSearchResults(json.data as DocSearchResult[])
          setResults(mapped)
        }
      } catch (error) {
        console.error('Doc search error:', error)
        if (!cancelled) {
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false)
        }
      }
    }

    fetchResults()

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, source, tableIdsKey, resolvedSearchEndpoint])

  // Derived loading state — single source of truth for "should the
  // dropdown show 'Loading...' instead of 'No results found'":
  const isLoading =
    query.trim().length >= 2 && (query !== debouncedQuery || isFetching)

  // Track whether dropdown should stay open (external link opened in new tab).
  const [keepOpen, setKeepOpen] = useState(false)

  const handleResultSelect = useCallback(
    (
      result: SearchResult,
      modifiers?: {
        metaKey?: boolean
        ctrlKey?: boolean
        shiftKey?: boolean
        altKey?: boolean
        button?: number
      },
    ) => {
      const action = resolveSearchResultAction(
        result,
        source,
        runtime?.navigation.mode,
      )
      // Modifier / non-primary mouse click → force new tab regardless of
      // same-tab/new-tab decision. The dropdown row is a `<div>`, not an
      // `<a target="_blank">`, so the browser doesn't background-tab
      // natively on cmd-click. Honor it explicitly here for parity with
      // the anchor-based surfaces (cards, chips, related-content). Plain
      // Enter from the keyboard passes `modifiers === undefined`.
      const wantsNewTab =
        modifiers &&
        (modifiers.metaKey ||
          modifiers.ctrlKey ||
          modifiers.shiftKey ||
          modifiers.altKey ||
          (typeof modifiers.button === 'number' && modifiers.button !== 0))
      switch (action.kind) {
        case 'navigate-same-tab': {
          // Embed-mode short-circuit — autocomplete row clicked while
          // the chat panel is hosted inside an embedding app.
          if (runtime?.navigation.mode === 'embed') {
            setKeepOpen(true)
            const targetPlatform =
              (result.metadata?.targetPlatform as string | null | undefined) ?? null
            resolveExternalNavigation({
              href: action.href,
              targetPlatform,
              runtime,
            }).open()
            return
          }
          if (wantsNewTab) {
            setKeepOpen(true)
            window.open(action.href, '_blank', NEW_TAB_FEATURES)
            return
          }
          // Same-origin click:
          //   1. If the href is under the current doc-tree's baseRoute AND
          //      an `onInPageSwap` callback is wired AND returns true →
          //      consider in-page swap handled.
          //   2. Otherwise → embed-shim `router.push()` (soft RSC nav on
          //      Next.js hosts, window.location.assign on bare hosts).
          setKeepOpen(false)
          const path =
            baseRoute && action.href.startsWith(`${baseRoute}/`)
              ? action.href.slice(baseRoute.length + 1)
              : null
          if (path && onInPageSwap?.(path)) return
          router.push(stripSameOriginToPath(action.href))
          return
        }
        case 'navigate-new-tab':
          // Cross-origin (e.g. clicking a flamingo.run release from
          // product-hub) — open in a new tab. Keep dropdown open so the
          // user can pick another result without re-searching.
          setKeepOpen(true)
          window.open(action.href, '_blank', NEW_TAB_FEATURES)
          return
        case 'ask-ai':
          // Row is searchable-but-not-openable (cap_table positions,
          // financial-kpi snapshots, anything backed by
          // `resolveUrl: () => null`). Dispatch a CustomEvent that
          // GlobalAskAI listens for — opens chat + drills via
          // `entityIdFilter` (primary-key only, same as inline-card Ask).
          setKeepOpen(false)
          window.dispatchEvent(
            new CustomEvent('ask-ai:open-with-ref', { detail: action.detail }),
          )
          return
        case 'route':
          // Final fallback: legacy navigation by path. Hits when a row
          // has neither URL nor pk metadata — a mapper/API regression.
          setKeepOpen(false)
          onNavigate(action.path)
          return
        case 'noop':
          return
      }
    },
    [onNavigate, source, baseRoute, router, onInPageSwap, runtime],
  )

  // Reset keepOpen when query changes.
  useEffect(() => {
    setKeepOpen(false)
  }, [query])

  return {
    query,
    setQuery,
    results,
    isLoading,
    handleResultSelect,
    keepDropdownOpen: keepOpen,
  }
}
