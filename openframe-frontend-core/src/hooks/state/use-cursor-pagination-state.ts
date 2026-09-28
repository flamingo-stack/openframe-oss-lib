/**
 * Unified Cursor Pagination State Hook
 *
 * Manages all common cursor-based pagination state logic:
 * - URL state management with useApiParams
 * - Debounced search input
 * - hasLoadedBeyondFirst tracking
 * - Initial load detection
 * - Search change detection
 * - Pagination handlers (next, reset)
 *
 * This eliminates ~60-80 lines of boilerplate from each paginated component.
 *
 * @example
 * const {
 *   searchInput, setSearchInput,
 *   hasLoadedBeyondFirst,
 *   handleNextPage, handleResetToFirstPage
 * } = useCursorPaginationState({
 *   onInitialLoad: (search, cursor) => fetchDialogs(false, search, true, cursor),
 *   onSearchChange: (search) => fetchDialogs(false, search)
 * })
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiParams, type UseApiParamsReturn } from './use-api-params';

export interface UseCursorPaginationStateOptions {
  /**
   * Debounce delay for search input (default: 300ms)
   */
  debounceMs?: number;

  /**
   * Callback for initial page load
   * Called once on mount with current search and cursor from URL
   */
  onInitialLoad: (search: string, cursor: string | null) => void | Promise<unknown>;

  /**
   * Callback when search term changes (after debounce)
   * Called after URL is updated, cursor is already reset
   */
  onSearchChange: (search: string) => void | Promise<unknown>;
}

const urlSchema = {
  search: { type: 'string' as const, default: '' },
  cursor: { type: 'string' as const, default: '' },
};

type ApiParamsReturn = UseApiParamsReturn<typeof urlSchema>;

/** Pagination params managed by this hook */
export type PaginationParams = ApiParamsReturn['params'];

export interface CursorPaginationStateReturn {
  // Search
  searchInput: string;
  setSearchInput: (value: string) => void;

  // Pagination tracking
  hasLoadedBeyondFirst: boolean;
  setHasLoadedBeyondFirst: (value: boolean) => void;

  // Handlers for useTablePagination
  handleNextPage: (endCursor: string, fetchFn: () => Promise<unknown>) => Promise<void>;
  handleResetToFirstPage: (fetchFn: () => Promise<unknown>) => Promise<void>;

  // URL params access (for advanced use cases)
  params: PaginationParams;
  setParam: ApiParamsReturn['setParam'];
  setParams: ApiParamsReturn['setParams'];
}

export function useCursorPaginationState(options: UseCursorPaginationStateOptions): CursorPaginationStateReturn {
  const { onInitialLoad, onSearchChange } = options;

  const { params, setParam, setParams } = useApiParams(urlSchema);

  // Local search input with debounce
  const [searchInput, setSearchInput] = useState(params.search || '');

  // Pagination tracking
  const [hasLoadedBeyondFirst, setHasLoadedBeyondFirst] = useState(false);
  // Use a counter instead of boolean to ensure effects see the latest state
  const [initialLoadCount, setInitialLoadCount] = useState(0);
  // Initialize to null to distinguish "never set" from "set to empty string"
  const lastSearchRef = useRef<string | null>(null);
  // Track if we're syncing from URL to prevent loops
  const isSyncingFromUrl = useRef(false);
  // Track if initial load is in progress to block ALL other effects
  const isInitialLoadInProgress = useRef(true);

  // Latest values for the effects below, none of which may take them as
  // dependencies: the URL->input sync would revert the user's keystrokes the
  // moment they typed, and the mount-once initial load would re-fire on every
  // param change. Declared first so the sync runs before either of them.
  const searchInputRef = useRef(searchInput);
  const onInitialLoadRef = useRef(onInitialLoad);
  const paramsRef = useRef(params);
  useEffect(() => {
    searchInputRef.current = searchInput;
    onInitialLoadRef.current = onInitialLoad;
    paramsRef.current = params;
  });

  // Sync local input with URL param (for tab switches that clear params)
  // Only sync if the URL changed externally (not from our own debounce update)
  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return;

    const urlSearch = params.search || '';
    // Only sync if URL differs from current input
    if (urlSearch !== searchInputRef.current) {
      isSyncingFromUrl.current = true;
      setSearchInput(urlSearch);
      // Reset the flag after a tick to allow normal operation
      setTimeout(() => {
        isSyncingFromUrl.current = false;
      }, 0);
    }
  }, [params.search, initialLoadCount]); // Add initialLoadCount to re-run after initial load

  // Sync debounced search to URL, reset cursor when search changes
  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return;
    // Skip if we're syncing from URL to prevent loops
    if (isSyncingFromUrl.current) return;

    if (searchInput !== params.search) {
      setParams({
        search: searchInput,
        cursor: '', // Reset cursor when search changes
      });
    }
  }, [searchInput, params.search, setParams, initialLoadCount]);

  // Initial load effect - runs once and blocks all other effects until complete
  useEffect(() => {
    if (initialLoadCount === 0) {
      const cursor = paramsRef.current.cursor || null;
      const search = paramsRef.current.search || '';

      // Set all refs BEFORE calling onInitialLoad
      lastSearchRef.current = search;

      // If we have a cursor in URL (page refresh), we're beyond first page
      if (cursor) {
        setHasLoadedBeyondFirst(true);
      }

      // Call the initial load and wait for it to complete before
      // marking initial load as done (handles async onInitialLoad)
      // `.catch` BEFORE `.finally` so a rejecting `onInitialLoad` is reported
      // instead of becoming an unhandled rejection, while the unblock below
      // still runs on both paths (it must: otherwise every other effect in
      // this hook stays permanently gated behind `isInitialLoadInProgress`).
      void Promise.resolve(onInitialLoadRef.current(search, cursor))
        .catch((err: unknown) => {
          console.error('[useCursorPaginationState] onInitialLoad failed:', err);
        })
        .finally(() => {
          isInitialLoadInProgress.current = false;
          setInitialLoadCount(1);
        });
    }
  }, [initialLoadCount]);

  // Search change detection - only after initial load is fully complete
  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return;
    if (initialLoadCount === 0) return;

    const currentSearch = params.search || '';
    // Only trigger search change if:
    // 1. lastSearchRef has been set (not null - means initial load happened)
    // 2. The search actually changed
    if (lastSearchRef.current !== null && currentSearch !== lastSearchRef.current) {
      lastSearchRef.current = currentSearch;
      setHasLoadedBeyondFirst(false);
      // `onSearchChange` is declared `void | Promise<unknown>`; normalise so a
      // rejecting async implementation is logged rather than left unhandled.
      void Promise.resolve(onSearchChange(currentSearch)).catch((err: unknown) => {
        console.error('[useCursorPaginationState] onSearchChange failed:', err);
      });
    }
  }, [params.search, onSearchChange, initialLoadCount]);

  // Pagination handlers
  const handleNextPage = useCallback(
    async (endCursor: string, fetchFn: () => Promise<unknown>) => {
      setParam('cursor', endCursor);
      await fetchFn();
      setHasLoadedBeyondFirst(true);
    },
    [setParam],
  );

  const handleResetToFirstPage = useCallback(
    async (fetchFn: () => Promise<unknown>) => {
      setParam('cursor', '');
      await fetchFn();
      setHasLoadedBeyondFirst(false);
    },
    [setParam],
  );

  return {
    searchInput,
    setSearchInput,
    hasLoadedBeyondFirst,
    setHasLoadedBeyondFirst,
    handleNextPage,
    handleResetToFirstPage,
    params,
    setParam,
    setParams,
  };
}
