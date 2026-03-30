"use client"

import { useState, useEffect, useCallback } from "react"
import { useDebounce } from "./use-debounce"
import type { SearchResult } from "../../components/ui/search-input"

export interface UseSearchConfig<T> {
  /** Async function that performs the search */
  searchFn: (query: string) => Promise<T[]>
  /** Maps each raw item to a SearchResult */
  mapResult: (item: T) => SearchResult
  /** Debounce delay in ms. Default 300 */
  debounceMs?: number
  /** Minimum characters before searching. Default 2 */
  minQueryLength?: number
}

export interface UseSearchReturn {
  query: string
  setQuery: (q: string) => void
  results: SearchResult[]
  isLoading: boolean
  error: string | null
  clearResults: () => void
}

/**
 * Generic search state management hook.
 *
 * Debounces the query, calls `searchFn` when the debounced value meets
 * `minQueryLength`, and maps the raw results via `mapResult`.
 */
export function useSearch<T>(config: UseSearchConfig<T>): UseSearchReturn {
  const { searchFn, mapResult, debounceMs = 300, minQueryLength = 2 } = config

  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(query, debounceMs)

  const clearResults = useCallback(() => {
    setResults([])
    setError(null)
  }, [])

  useEffect(() => {
    // Clear when query is empty or below threshold
    if (!debouncedQuery || debouncedQuery.length < minQueryLength) {
      setResults([])
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const rawResults = await searchFn(debouncedQuery)

        if (!cancelled) {
          setResults(rawResults.map(mapResult))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Search failed")
          setResults([])
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, minQueryLength])

  return { query, setQuery, results, isLoading, error, clearResults }
}
