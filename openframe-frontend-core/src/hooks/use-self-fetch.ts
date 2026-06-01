'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

export interface UseSelfFetchResult<T> {
  data: T | null
  /** Imperatively patch the fetched data (e.g. optimistic vote updates). */
  setData: Dispatch<SetStateAction<T | null>>
  isLoading: boolean
  error: boolean
  /** Re-run the fetch (error-retry affordance). */
  reload: () => void
}

/**
 * The single source for the 4 self-fetching content views
 * (`ProductReleasesView`, `RoadmapView`, the onboarding catalog/detail). GETs a
 * configured `url` into component state with **plain `fetch` + `useEffect`** —
 * deliberately NO react-query, so embedders don't need a QueryClient. This is
 * the same technology choice the shipped `DeliveryLists` makes; that component
 * predates this hook and still hand-rolls the loop (a future pass can migrate
 * it onto a two-url variant of this hook).
 *
 * Behaviour:
 *   - `url = null` → fetching is DISABLED (controlled / SSR mode, or missing
 *     config); returns `initialData ?? null` and never fetches.
 *   - `initialData` provided → hydrates immediately and SKIPS the first fetch
 *     (so the hub's server-rendered data isn't re-fetched on mount); later
 *     `url` changes still re-fetch.
 *   - a `cancelled` guard ensures an in-flight response from a STALE `url`
 *     (e.g. a fast pagination / section toggle) can't overwrite a newer one.
 *   - `reload()` bumps an internal key to retry after an error.
 *
 * Re-fetches whenever `url` changes, so callers fold all query params INTO the
 * url string (the url IS the cache key).
 */
export function useSelfFetch<T>(
  url: string | null,
  options?: { initialData?: T },
): UseSelfFetchResult<T> {
  const initialData = options?.initialData
  const [data, setData] = useState<T | null>(initialData ?? null)
  const [isLoading, setIsLoading] = useState(initialData === undefined && url !== null)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // Skip the first fetch when SSR `initialData` already hydrated the view.
  const skipFirstFetch = useRef(initialData !== undefined)

  // Re-sync when a CONTROLLED `initialData` changes (e.g. the host navigates
  // between detail slugs without remounting). No-op in self-fetch mode, where
  // `initialData` is `undefined`.
  useEffect(() => {
    if (initialData !== undefined) setData(initialData)
  }, [initialData])

  useEffect(() => {
    if (url === null) {
      setIsLoading(false)
      return
    }
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false
      return
    }
    const ctrl = new AbortController()
    let cancelled = false
    async function load() {
      try {
        setIsLoading(true)
        setError(false)
        const res = await fetch(url as string, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const json = (await res.json()) as T
        if (!cancelled) setData(json)
      } catch (err) {
        // AbortError on cleanup (unmount / stale-url change / React StrictMode's dev
        // double-invoke) is EXPECTED — the request was intentionally aborted. Aborting
        // also means the orphaned StrictMode fetch shows as "cancelled" instead of
        // completing as a wasted duplicate (parity with useChatIdentity). Only real
        // failures fall through to the error state + console.
        if (cancelled || (err as Error)?.name === 'AbortError') return
        setError(true)
        console.error('useSelfFetch:', url, err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      ctrl.abort()
    }
    // `url` folds in every query param; `reloadKey` drives retry.
  }, [url, reloadKey])

  return { data, setData, isLoading, error, reload: () => setReloadKey((k) => k + 1) }
}
