'use client';

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
 *
 * ## Result hrefs go through the content-href seam
 *
 * A row's href is NOT the RAG `externalUrl` verbatim any more: when the
 * host wires `runtime.composeContentUrl` (or passes `composeContentUrl`
 * here), the row is re-resolved through it — the SAME seam the catalog
 * cards and the chat entity cards use. So a host that serves onboarding
 * guides at `/help-center/onboarding-guides/<slug>` gets that path from
 * the dropdown too, instead of bouncing the user to the canonical hub
 * URL. Unwired hosts keep the verbatim-`externalUrl` behavior.
 */

import { useState, useEffect, useCallback } from 'react';
import { useChatRuntime } from '../../../contexts/chat-runtime-context';
import { useRouter } from '../../../embed-shims';
import { useDebounce } from '../../../hooks/ui/use-debounce';
import type { ComposeContentUrl } from '../../../utils/content-href';
import { contentFetch } from '../../../utils/embed-content-fetch';
import {
  resolveExternalNavigation,
  stripSameOriginToPath,
  NEW_TAB_FEATURES,
} from '../../chat/utils/chat-nav-resolution';
import type { SearchResult } from '../../ui/search-input';
import { mapDocSearchResults } from './map-doc-search-results';
import { resolveSearchResultAction } from './resolve-search-result-action';
import type { DocSearchResult } from './types';

export interface UseDocSearchConfig {
  /** Discriminator passed to `/api/docs/search?source=` (e.g.
   *  `'openframe'`). Embedders set it to whatever discriminator their
   *  reverse-proxy expects. */
  source: string;
  /** Base route prefix this search lives under (e.g. `'/onboarding-guides'`).
   *  When a result's href starts with `${baseRoute}/`, the hook
   *  attempts the optional in-page swap path before falling through
   *  to a full nav. */
  baseRoute: string;
  /** Imperative navigation fallback. Called when no override
   *  (in-page swap, new-tab) applies. Hub callers pass
   *  `(path) => router.push(path)`; embedders pass an equivalent. */
  onNavigate: (path: string) => void;
  /** Optional `RagTableConfig.id` list to narrow the search to specific
   *  tables (e.g. `['onboarding-guides']`). Forwarded to
   *  `/api/docs/search?tableIds=…` which intersects with the source's
   *  standing set. */
  tableIds?: string[];
  /** Optional in-page swap callback. When the result's href is under
   *  `baseRoute` AND this callback returns true, the hook treats the
   *  click as handled in-page (no router push). Hub's
   *  `<DocumentationSection>` wires this to
   *  `useDocNavigation().navigate(path)`. */
  onInPageSwap?: (path: string) => boolean;
  /** Optional endpoint override. Defaults to `'/api/docs/search'`
   *  (the hub's reverse-proxy route). Embedders with a different
   *  path can override. */
  searchEndpoint?: string;
  /** Optional content-href seam override. Same fall-back chain as
   *  `searchEndpoint`: prop → `runtime.composeContentUrl` → none. Wired,
   *  it makes a result row honor the host's `hostedTypes` / `overrides`
   *  instead of navigating to the RAG's canonical hub URL — so a row
   *  lands where the catalog card for the same entity lands. */
  composeContentUrl?: ComposeContentUrl;
}

/** One shared empty array, so "no matches" keeps a stable identity. */
const NO_RESULTS: SearchResult[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `Array.isArray` narrows `unknown` to `any[]`; this keeps the elements `unknown`. */
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Decode `/api/docs/search`'s `{ success, data }` envelope.
 *
 * `Response.json()` is typed `any`, so the rows used to reach
 * `mapDocSearchResults` through an `as DocSearchResult[]` that asserted a
 * shape nothing had checked. `path` and `name` are the two that bite: the
 * mapper uses `path` as the row's React `id` and `name` as its title, so a row
 * missing either renders as a blank, key-colliding entry in the dropdown.
 * Such rows are dropped; the rest of the result set still lists.
 *
 * Returns null when the envelope itself is not a successful result set.
 */
function toDocSearchResults(payload: unknown): DocSearchResult[] | null {
  if (!isRecord(payload) || !payload.success || !isUnknownArray(payload.data)) return null;

  const rows: DocSearchResult[] = [];
  for (const entry of payload.data) {
    if (!isRecord(entry)) continue;
    const path = readString(entry, 'path');
    const name = readString(entry, 'name');
    const type = entry.type;
    if (path === undefined || name === undefined) continue;

    const targetPlatform = entry.targetPlatform;
    rows.push({
      path,
      name,
      type: type === 'folder' ? 'folder' : 'file',
      snippet: readString(entry, 'snippet') ?? '',
      matchType: entry.matchType === 'title' ? 'title' : 'content',
      documentType: readString(entry, 'documentType'),
      externalUrl: readString(entry, 'externalUrl'),
      targetPlatform: typeof targetPlatform === 'string' ? targetPlatform : null,
      sourceRepo: readString(entry, 'sourceRepo'),
      entityId: readString(entry, 'entityId'),
    });
  }
  return rows;
}

export function useDocSearch(config: UseDocSearchConfig) {
  const { source, baseRoute, onNavigate, tableIds, onInPageSwap, searchEndpoint, composeContentUrl } = config;
  const tableIdsKey = tableIds && tableIds.length > 0 ? tableIds.join(',') : '';

  const router = useRouter();
  // Optional chat-runtime read — when present and mode='embed' the
  // search-result row click short-circuits to a new-tab open against
  // the absolutized URL. Null/host preserves today's behavior.
  // Also used as the proxy-prefix fallback for `searchEndpoint`, matching
  // how tickets resolves `findTicketUrl`.
  const runtime = useChatRuntime();
  const resolvedSearchEndpoint = searchEndpoint ?? runtime?.endpoints.docsSearchUrl ?? '/api/docs/search';
  // Content-href seam, same prop → runtime → none chain. Threading it into
  // `resolveSearchResultAction` is what makes the dropdown obey the host's
  // route map; without it the row navigates to the RAG's canonical hub URL
  // even when the host serves that content in-app under a different path.
  const resolvedComposeContentUrl = composeContentUrl ?? runtime?.composeContentUrl;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>(NO_RESULTS);
  const [isFetching, setIsFetching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);

  // Falling below the two-character floor empties the dropdown. Adjusted while
  // rendering (React's documented pattern for a reset the render already has
  // the answer to) rather than from an effect, which committed one more frame
  // of the previous matches under a query that no longer searches for them.
  const searchable = debouncedQuery.trim().length >= 2;
  const [wasSearchable, setWasSearchable] = useState(searchable);
  if (wasSearchable !== searchable) {
    setWasSearchable(searchable);
    if (!searchable) {
      setResults(NO_RESULTS);
      setIsFetching(false);
    }
  }

  useEffect(() => {
    if (!searchable) return undefined;

    let cancelled = false;

    async function fetchResults() {
      setIsFetching(true);
      try {
        const params = new URLSearchParams({
          q: debouncedQuery,
          source,
          limit: '10',
        });
        if (tableIdsKey) params.set('tableIds', tableIdsKey);

        const response = await contentFetch(`${resolvedSearchEndpoint}?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Search request failed: ${response.status}`);
        }

        const json: unknown = await response.json();

        if (!cancelled) {
          // An envelope that is not a successful result set now clears the
          // dropdown instead of leaving it untouched. Previously a 200 that
          // carried `success: false` (or a non-array `data`) fell through
          // every branch, so the PREVIOUS query's matches stayed on screen
          // under the new query — the throw path already reset them.
          const rows = toDocSearchResults(json);
          setResults(rows ? mapDocSearchResults(rows) : NO_RESULTS);
        }
      } catch (error) {
        console.error('Doc search error:', error);
        if (!cancelled) {
          setResults(NO_RESULTS);
        }
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    }

    // Never rejects — try/catch/finally, every write gated on `cancelled`.
    void fetchResults();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, searchable, source, tableIdsKey, resolvedSearchEndpoint]);

  // Derived loading state — single source of truth for "should the
  // dropdown show 'Loading...' instead of 'No results found'":
  const isLoading = query.trim().length >= 2 && (query !== debouncedQuery || isFetching);

  // Track whether dropdown should stay open (external link opened in new tab).
  const [keepOpen, setKeepOpen] = useState(false);

  const handleResultSelect = useCallback(
    (
      result: SearchResult,
      modifiers?: {
        metaKey?: boolean;
        ctrlKey?: boolean;
        shiftKey?: boolean;
        altKey?: boolean;
        button?: number;
      },
    ) => {
      const action = resolveSearchResultAction(result, source, runtime?.navigation.mode, resolvedComposeContentUrl);
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
          (typeof modifiers.button === 'number' && modifiers.button !== 0));
      switch (action.kind) {
        case 'navigate-same-tab': {
          if (wantsNewTab) {
            setKeepOpen(true);
            window.open(action.href, '_blank', NEW_TAB_FEATURES);
            return;
          }
          // Same-origin click:
          //   1. If the href is under the current doc-tree's baseRoute AND
          //      an `onInPageSwap` callback is wired AND returns true →
          //      consider in-page swap handled.
          //   2. Otherwise → embed-shim `router.push()` (soft RSC nav on
          //      Next.js hosts, window.location.assign on bare hosts).
          setKeepOpen(false);
          const path =
            baseRoute && action.href.startsWith(`${baseRoute}/`) ? action.href.slice(baseRoute.length + 1) : null;
          if (path && onInPageSwap?.(path)) return;
          router.push(stripSameOriginToPath(action.href));
          return;
        }
        case 'navigate-new-tab':
          // Cross-origin (e.g. clicking a flamingo.run release from
          // product-hub) — open in a new tab. Keep dropdown open so the
          // user can pick another result without re-searching.
          setKeepOpen(true);
          // Embed-mode short-circuit — the row was clicked while the panel is
          // hosted inside an embedding app, so absolutize against the
          // embedder-supplied content origin and honor its `openExternal`
          // override. Not the only path an embed host takes: a composed
          // RELATIVE href resolves to `navigate-same-tab` above and never
          // reaches `decideNewTab`, which is what lets an embedder keep its
          // own in-app routes in-app.
          if (runtime?.navigation.mode === 'embed') {
            const targetPlatform = (result.metadata?.targetPlatform as string | null | undefined) ?? null;
            resolveExternalNavigation({
              href: action.href,
              targetPlatform,
              runtime,
            }).open();
            return;
          }
          window.open(action.href, '_blank', NEW_TAB_FEATURES);
          return;
        case 'ask-ai':
          // Row is searchable-but-not-openable (cap_table positions,
          // financial-kpi snapshots, anything backed by
          // `resolveUrl: () => null`). Dispatch a CustomEvent that
          // GlobalAskAI listens for — opens chat + drills via
          // `entityIdFilter` (primary-key only, same as inline-card Ask).
          setKeepOpen(false);
          window.dispatchEvent(new CustomEvent('ask-ai:open-with-ref', { detail: action.detail }));
          return;
        case 'route':
          // Final fallback: legacy navigation by path. Hits when a row
          // has neither URL nor pk metadata — a mapper/API regression.
          setKeepOpen(false);
          onNavigate(action.path);
          return;
        case 'noop':
          return;
      }
    },
    [onNavigate, source, baseRoute, router, onInPageSwap, runtime, resolvedComposeContentUrl],
  );

  // Reset keepOpen when query changes. Adjusted while rendering, not from an
  // effect: the dropdown's open state is read from this in the same render the
  // keystroke produced, so an effect held it pinned open for one extra frame.
  const [keepOpenForQuery, setKeepOpenForQuery] = useState(query);
  if (keepOpenForQuery !== query) {
    setKeepOpenForQuery(query);
    setKeepOpen(false);
  }

  return {
    query,
    setQuery,
    results,
    isLoading,
    handleResultSelect,
    keepDropdownOpen: keepOpen,
  };
}
