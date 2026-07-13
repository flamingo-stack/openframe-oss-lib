'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { contentFetch } from '../utils/embed-content-fetch'

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
 *   - `revalidateOnVisibleAfterMs` (opt-in) → re-fetch when the tab becomes
 *     visible AND the held data is older than the threshold. Event-driven
 *     freshness with ZERO background requests — the replacement for
 *     setInterval polling. Data age counts from the last completed fetch, or
 *     from mount when `initialData` seeded it (an SSR seed is milliseconds
 *     old — without that, the first refocus would always refire).
 *
 * Re-fetches whenever `url` changes, so callers fold all query params INTO the
 * url string (the url IS the cache key).
 */
export function useSelfFetch<T>(
  url: string | null,
  options?: { initialData?: T; revalidateOnVisibleAfterMs?: number },
): UseSelfFetchResult<T> {
  const initialData = options?.initialData
  const revalidateOnVisibleAfterMs = options?.revalidateOnVisibleAfterMs
  const [data, setData] = useState<T | null>(initialData ?? null)
  const [isLoading, setIsLoading] = useState(initialData === undefined && url !== null)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  // When the held data was obtained: seeded at mount for SSR-hydrated data,
  // stamped after each completed fetch. Drives the visibility revalidation age
  // check. 0 = nothing held yet (first visible event may fetch).
  const dataAtRef = useRef<number>(initialData !== undefined ? Date.now() : 0)
  // The url whose data we currently hold — seeded from SSR `initialData`, then set after
  // each completed fetch. The effect skips the fetch when this equals `url` (so server-
  // rendered data isn't re-fetched on mount). A VALUE compare (not a one-shot flag) so the
  // SSR-hydration skip survives React 18 StrictMode's mount→unmount→remount in dev;
  // `reload()` nulls it to force a re-fetch of the same url.
  const dataUrlRef = useRef<string | null>(initialData !== undefined ? url : null)

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
    // Already hold data for this exact url (SSR-hydrated, or a prior completed fetch) →
    // skip. `reload()` clears `dataUrlRef` so a retry of the same url still fetches.
    if (dataUrlRef.current === url) return
    const ctrl = new AbortController()
    let cancelled = false
    async function load() {
      try {
        setIsLoading(true)
        setError(false)
        const res = await contentFetch(url as string, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        const json = (await res.json()) as T
        if (!cancelled) {
          setData(json)
          dataUrlRef.current = url // remember the url we now hold data for
          dataAtRef.current = Date.now()
        }
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

  // ONE force-refetch mechanic shared by reload() and the visibility
  // revalidation: clear the held-url skip, bump the effect key.
  const forceReload = () => {
    dataUrlRef.current = null
    setReloadKey((k) => k + 1)
  }

  // Opt-in visibility-driven revalidation. Registered only when the option is
  // set and fetching is enabled; SSR-safe (effects don't run on the server)
  // and StrictMode-safe (idempotent listener, cleaned up per mount cycle).
  useEffect(() => {
    if (!revalidateOnVisibleAfterMs || url === null) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - dataAtRef.current < revalidateOnVisibleAfterMs) return
      forceReload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [url, revalidateOnVisibleAfterMs])

  return {
    data,
    setData,
    isLoading,
    error,
    // Force a re-fetch of the current url (error-retry affordance).
    reload: forceReload,
  }
}
