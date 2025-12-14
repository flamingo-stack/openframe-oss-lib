/**
 * Unified Cursor Pagination State Hook
 *
 * Manages all common cursor-based pagination state logic:
 * - URL state management with useApiParams
 * - Debounced search input
 * - hasLoadedBeyondFirst tracking
 * - Initial load detection
 * - Search/filter change detection
 * - Pagination handlers (next, reset, filter change)
 *
 * This eliminates ~60-80 lines of boilerplate from each paginated component.
 *
 * @example
 * const {
 *   searchInput, setSearchInput,
 *   hasLoadedBeyondFirst,
 *   handleNextPage, handleResetToFirstPage
 * } = useCursorPaginationState({
 *   paramPrefix: 'current',
 *   onInitialLoad: (search, cursor) => fetchDialogs(false, search, true, cursor),
 *   onSearchChange: (search) => fetchDialogs(false, search)
 * })
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useApiParams, type ParamSchema } from './use-api-params'
import { useDebounce } from '../ui/use-debounce'

export interface UseCursorPaginationStateOptions {
  /**
   * URL param prefix for tabs (e.g., 'current' → currentSearch, currentCursor)
   * If empty string, uses 'search' and 'cursor' directly
   */
  paramPrefix?: string

  /**
   * Additional filter params schema
   * Keys will be prefixed if paramPrefix is set
   */
  filterSchema?: Record<string, { type: 'string' | 'array'; default: string | string[] }>

  /**
   * Debounce delay for search input (default: 300ms)
   */
  debounceMs?: number

  /**
   * Callback for initial page load
   * Called once on mount with current search and cursor from URL
   */
  onInitialLoad: (search: string, cursor: string | null) => void | Promise<unknown>

  /**
   * Callback when search term changes (after debounce)
   * Called after URL is updated, cursor is already reset
   */
  onSearchChange: (search: string) => void | Promise<unknown>

  /**
   * Callback when filters change
   * Called after URL is updated, cursor is already reset
   */
  onFiltersChange?: (filters: Record<string, any>) => void | Promise<unknown>
}

export interface CursorPaginationStateReturn {
  // Search
  searchInput: string
  setSearchInput: (value: string) => void

  // Pagination tracking
  hasLoadedBeyondFirst: boolean
  setHasLoadedBeyondFirst: (value: boolean) => void

  // Handlers for useTablePagination
  handleNextPage: (endCursor: string, fetchFn: () => Promise<unknown>) => Promise<void>
  handleResetToFirstPage: (fetchFn: () => Promise<unknown>) => Promise<void>

  // Filter handler
  handleFilterChange: (columnFilters: Record<string, any[]>) => void

  // URL params access (for advanced use cases)
  params: Record<string, any>
  setParam: (key: string, value: any) => void
  setParams: (updates: Record<string, any>) => void

  // Key names (for consumers who need to know the actual param names)
  searchKey: string
  cursorKey: string
}

export function useCursorPaginationState(
  options: UseCursorPaginationStateOptions
): CursorPaginationStateReturn {
  const {
    paramPrefix = '',
    filterSchema = {},
    debounceMs = 300,
    onInitialLoad,
    onSearchChange,
    onFiltersChange
  } = options

  // Build URL schema with prefix
  const prefix = paramPrefix ? `${paramPrefix}` : ''
  const searchKey = prefix ? `${prefix}Search` : 'search'
  const cursorKey = prefix ? `${prefix}Cursor` : 'cursor'

  // Build the complete URL schema
  const urlSchema = useMemo(() => {
    const schema: ParamSchema = {
      [searchKey]: { type: 'string', default: '' },
      [cursorKey]: { type: 'string', default: '' }
    }

    // Add filter params with prefix
    for (const [key, value] of Object.entries(filterSchema)) {
      const prefixedKey = prefix ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
      schema[prefixedKey] = value
    }

    return schema
  }, [searchKey, cursorKey, prefix, filterSchema])

  const { params, setParam, setParams } = useApiParams(urlSchema)

  // Local search input with debounce
  const [searchInput, setSearchInput] = useState(params[searchKey] || '')
  const debouncedSearch = useDebounce(searchInput, debounceMs)

  // Pagination tracking
  const [hasLoadedBeyondFirst, setHasLoadedBeyondFirst] = useState(false)
  // Use a counter instead of boolean to ensure effects see the latest state
  const [initialLoadCount, setInitialLoadCount] = useState(0)
  // Initialize to null to distinguish "never set" from "set to empty string"
  const lastSearchRef = useRef<string | null>(null)
  const lastFiltersRef = useRef<string | null>(null)
  // Track if we're syncing from URL to prevent loops
  const isSyncingFromUrl = useRef(false)
  // Track if initial load is in progress to block ALL other effects
  const isInitialLoadInProgress = useRef(true)

  // Sync local input with URL param (for tab switches that clear params)
  // Only sync if the URL changed externally (not from our own debounce update)
  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return

    const urlSearch = params[searchKey] || ''
    // Only sync if URL differs from current input
    if (urlSearch !== searchInput) {
      isSyncingFromUrl.current = true
      setSearchInput(urlSearch)
      // Reset the flag after a tick to allow normal operation
      setTimeout(() => { isSyncingFromUrl.current = false }, 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params[searchKey], searchKey, initialLoadCount]) // Add initialLoadCount to re-run after initial load

  // Sync debounced search to URL, reset cursor when search changes
  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return
    // Skip if we're syncing from URL to prevent loops
    if (isSyncingFromUrl.current) return

    if (debouncedSearch !== params[searchKey]) {
      setParams({
        [searchKey]: debouncedSearch,
        [cursorKey]: '' // Reset cursor when search changes
      })
    }
  }, [debouncedSearch, params, searchKey, cursorKey, setParams, initialLoadCount])

  // Initial load effect - runs once and blocks all other effects until complete
  useEffect(() => {
    if (initialLoadCount === 0) {
      const cursor = params[cursorKey] || null
      const search = params[searchKey] || ''

      // Set all refs BEFORE calling onInitialLoad
      lastSearchRef.current = search

      // If we have a cursor in URL (page refresh), we're beyond first page
      if (cursor) {
        setHasLoadedBeyondFirst(true)
      }

      // Call the initial load
      onInitialLoad(search, cursor)

      // Mark initial load as complete AFTER a microtask to ensure
      // the onInitialLoad has started and refs are set
      Promise.resolve().then(() => {
        isInitialLoadInProgress.current = false
        setInitialLoadCount(1)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Search change detection - only after initial load is fully complete
  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return
    if (initialLoadCount === 0) return

    const currentSearch = params[searchKey] || ''
    // Only trigger search change if:
    // 1. lastSearchRef has been set (not null - means initial load happened)
    // 2. The search actually changed
    if (lastSearchRef.current !== null && currentSearch !== lastSearchRef.current) {
      lastSearchRef.current = currentSearch
      setHasLoadedBeyondFirst(false)
      onSearchChange(currentSearch)
    }
  }, [params, searchKey, onSearchChange, initialLoadCount])

  // Filter change detection (if filters provided)
  const filtersKey = useMemo(() => {
    if (!Object.keys(filterSchema).length) return null

    const filterValues: Record<string, any> = {}
    for (const key of Object.keys(filterSchema)) {
      const prefixedKey = prefix ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
      filterValues[key] = params[prefixedKey]
    }
    return JSON.stringify(filterValues)
  }, [params, filterSchema, prefix])

  useEffect(() => {
    // Block during initial load
    if (isInitialLoadInProgress.current) return
    if (initialLoadCount === 0) return

    if (filtersKey && onFiltersChange) {
      if (lastFiltersRef.current !== null && lastFiltersRef.current !== filtersKey) {
        setHasLoadedBeyondFirst(false)
        onFiltersChange(JSON.parse(filtersKey))
      }
      lastFiltersRef.current = filtersKey
    }
  }, [filtersKey, onFiltersChange, initialLoadCount])

  // Pagination handlers
  const handleNextPage = useCallback(
    async (endCursor: string, fetchFn: () => Promise<unknown>) => {
      setParam(cursorKey, endCursor)
      await fetchFn()
      setHasLoadedBeyondFirst(true)
    },
    [cursorKey, setParam]
  )

  const handleResetToFirstPage = useCallback(
    async (fetchFn: () => Promise<unknown>) => {
      setParam(cursorKey, '')
      await fetchFn()
      setHasLoadedBeyondFirst(false)
    },
    [cursorKey, setParam]
  )

  const handleFilterChange = useCallback(
    (columnFilters: Record<string, any[]>) => {
      const updates: Record<string, any> = { [cursorKey]: '' }
      for (const [key, value] of Object.entries(columnFilters)) {
        const prefixedKey = prefix ? `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : key
        updates[prefixedKey] = value
      }
      setParams(updates)
      setHasLoadedBeyondFirst(false)
    },
    [cursorKey, prefix, setParams]
  )

  return {
    searchInput,
    setSearchInput,
    hasLoadedBeyondFirst,
    setHasLoadedBeyondFirst,
    handleNextPage,
    handleResetToFirstPage,
    handleFilterChange,
    params,
    setParam,
    setParams,
    searchKey,
    cursorKey
  }
}
