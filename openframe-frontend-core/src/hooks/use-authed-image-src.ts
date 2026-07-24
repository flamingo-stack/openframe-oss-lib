'use client'

import { useEffect, useReducer } from 'react'
import { embedAuthedFetch, needsBearerAssetFetch } from '../utils/embed-authed-fetch'

/**
 * Resolve an image URL for hosts whose auth rides in request headers
 * instead of cookies (native shells — `capacitor://localhost`,
 * `tauri://localhost` — running in bearer mode). A native `<img>` load
 * can't carry an `Authorization` header, so a gateway image URL that
 * works on the cookie-auth web 401s in a shell. When
 * `needsBearerAssetFetch` says the URL's origin is bearer-authed, this
 * hook fetches it through `embedAuthedFetch` (bearer + deduped
 * 401-refresh-retry + the adapter's cross-origin guard) and returns a
 * blob object-URL; every other URL is returned unchanged, so on the
 * cookie-auth web the hook is a pass-through.
 *
 * Returns `undefined` while the fetch is in flight OR after it fails, so
 * callers show their existing initials/placeholder fallback instead of a
 * broken image; a failed fetch retries on the next mount.
 *
 * Cache: module-level, session-lifetime, keyed by full URL. Gateway image
 * URLs carry a `?v=<content-hash>` cache-buster, so a changed image is a
 * new key; entries are never revoked (avatars are a few KB — refcount
 * churn isn't worth it).
 *
 * Distinct from the legacy `useAuthenticatedImage`, which ALWAYS
 * blob-fetches with `credentials: 'include'` and its own global config.
 * This hook is pass-through-first and keys off the single auth knob the
 * lib already has: the registered `EmbedAuthAdapter`.
 */

const resolvedCache = new Map<string, string>()
const inFlight = new Map<string, Promise<void>>()

function fetchAsBlobUrl(src: string): Promise<void> {
  let pending = inFlight.get(src)
  if (!pending) {
    pending = embedAuthedFetch(src, { headers: { Accept: 'image/*' } })
      .then(async response => {
        if (!response.ok) throw new Error(`image fetch failed: ${response.status}`)
        resolvedCache.set(src, URL.createObjectURL(await response.blob()))
      })
      .finally(() => {
        inFlight.delete(src)
      })
    inFlight.set(src, pending)
  }
  return pending
}

export function useAuthedImageSrc(src?: string | null): string | undefined {
  const bearerSrc = src && needsBearerAssetFetch(src) ? src : null
  const [, rerender] = useReducer((c: number) => c + 1, 0)

  useEffect(() => {
    if (!bearerSrc || resolvedCache.has(bearerSrc)) return
    let cancelled = false
    fetchAsBlobUrl(bearerSrc)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) rerender()
      })
    return () => {
      cancelled = true
    }
  }, [bearerSrc])

  if (!src) return undefined
  if (!bearerSrc) return src
  return resolvedCache.get(bearerSrc)
}
