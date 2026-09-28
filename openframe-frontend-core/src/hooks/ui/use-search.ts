'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SearchResult } from '../../components/ui/search-input';
import { useDebounce } from './use-debounce';

export interface UseSearchConfig<T> {
  /** Async function that performs the search */
  searchFn: (query: string) => Promise<T[]>;
  /** Maps each raw item to a SearchResult */
  mapResult: (item: T) => SearchResult;
  /** Debounce delay in ms. Default 300 */
  debounceMs?: number;
  /** Minimum characters before searching. Default 2 */
  minQueryLength?: number;
}

export interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null;
  clearResults: () => void;
}

// One shared empty array: `setResults([])` with a fresh literal is a new
// identity every time, which re-renders every consumer that keys off `results`.
const NO_RESULTS: SearchResult[] = [];

/**
 * Generic search state management hook.
 *
 * Debounces the query, calls `searchFn` when the debounced value meets
 * `minQueryLength`, and maps the raw results via `mapResult`.
 */
export function useSearch<T>(config: UseSearchConfig<T>): UseSearchReturn {
  const { searchFn, mapResult, debounceMs = 300, minQueryLength = 2 } = config;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>(NO_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `searchFn` and `mapResult` come from the caller and are almost always
  // written inline, so a fresh identity every render. As effect dependencies
  // they would re-fire the search on every parent render; read through refs the
  // effect keys on the QUERY only and still calls the current functions.
  const searchFnRef = useRef(searchFn);
  const mapResultRef = useRef(mapResult);
  useEffect(() => {
    searchFnRef.current = searchFn;
    mapResultRef.current = mapResult;
  });

  const debouncedQuery = useDebounce(query, debounceMs);

  const clearResults = useCallback(() => {
    setResults(NO_RESULTS);
    setError(null);
  }, []);

  // Falling below the threshold clears the panel. That is a reset driven by a
  // value we already have during render, so it uses React's "adjust state while
  // rendering" pattern rather than an effect: the keystroke that shortened the
  // query has already scheduled this render, and clearing here means the stale
  // result list never reaches the screen. From an effect it would paint once
  // with the old results still showing.
  const searchable = Boolean(debouncedQuery) && debouncedQuery.length >= minQueryLength;
  const [wasSearchable, setWasSearchable] = useState(searchable);
  if (wasSearchable !== searchable) {
    setWasSearchable(searchable);
    if (!searchable) {
      setResults(NO_RESULTS);
      setIsLoading(false);
      setError(null);
    }
  }

  useEffect(() => {
    if (!searchable) return undefined;

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const rawResults = await searchFnRef.current(debouncedQuery);

        if (!cancelled) {
          setResults(rawResults.map(mapResultRef.current));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults(NO_RESULTS);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    // Never rejects — try/catch/finally, every write gated on `cancelled`.
    void run();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, minQueryLength, searchable]);

  return { query, setQuery, results, isLoading, error, clearResults };
}
