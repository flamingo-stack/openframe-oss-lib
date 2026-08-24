'use client'

import { useEffect, useReducer } from 'react'
import { embedAuthedFetch, needsBearerAssetFetch } from '../utils/embed-authed-fetch'

/**
 * Resolve ANY asset URL the browser would load natively — `<img src>`,
 * `<track src>`, a font, a poster — for hosts whose auth rides in request
 * HEADERS instead of cookies: native shells (`capacitor://`, `tauri://`) and
 * dev-ticket web, both in bearer mode. A native subresource load can't carry
 * an `Authorization` header, so a gateway URL that works on the cookie-auth
 * web 401s there.
 *
 * When `needsBearerAssetFetch` says the URL is bearer-authed, this hook
 * fetches it through `embedAuthedFetch` (bearer + deduped 401-refresh-retry +
 * the adapter's cross-origin guard — the SAME single auth knob every embedded
 * `fetch` in the lib rides) and returns a blob object-URL. Every other URL is
 * returned unchanged, so on the cookie-auth web the hook is a pass-through.
 *
 * Returns `undefined` while the fetch is in flight OR after it fails, so
 * callers show their existing placeholder / "no captions" branch instead of a
 * broken asset; a failed fetch retries on the next mount.
 *
 * Cache: module-level, session-lifetime, keyed by full URL — so the two
 * `<track>` URLs of one player, or the same avatar in twenty rows, cost one
 * request. Gateway URLs carry a `?v=<content-hash>` cache-buster, so changed
 * content is a new key; entries are never revoked (a VTT / avatar is a few KB
 * — refcount churn isn't worth it) and are dropped wholesale at session end
 * via `clearAuthedAssetCache`.
 */

const resolvedCache = new Map<string, string>()
const inFlight = new Map<string, Promise<void>>()
let cacheGeneration = 0

/**
 * Drop every cached blob and revoke its object URL. Hosts call this at
 * session end (logout / forced re-login) so a follow-on login as a
 * different identity cannot be served blobs fetched under the previous
 * one's bearer. Fetches still in flight when the clear happens are fenced
 * by a generation counter — their results are revoked instead of cached.
 */
export function clearAuthedAssetCache(): void {
  cacheGeneration++
  for (const url of resolvedCache.values()) URL.revokeObjectURL(url)
  resolvedCache.clear()
  inFlight.clear()
}

function fetchAsBlobUrl(src: string, accept: string): Promise<void> {
  let pending = inFlight.get(src)
  if (!pending) {
    const startedGeneration = cacheGeneration
    pending = embedAuthedFetch(src, { headers: { Accept: accept } })
      .then(async response => {
        if (!response.ok) throw new Error(`asset fetch failed: ${response.status}`)
        const blobUrl = URL.createObjectURL(await response.blob())
        if (startedGeneration === cacheGeneration) {
          resolvedCache.set(src, blobUrl)
        } else {
          URL.revokeObjectURL(blobUrl)
        }
      })
      .finally(() => {
        if (inFlight.get(src) === pending) inFlight.delete(src)
      })
    inFlight.set(src, pending)
  }
  return pending
}

/**
 * @param src    the asset URL (relative or absolute), or null/undefined
 * @param accept `Accept` header for the authed fetch — narrow it to what the
 *               consumer renders (`image/*`, `text/vtt`); it also replaces
 *               `embedAuthedFetch`'s default JSON `Content-Type` on the GET.
 */
export function useAuthedAssetSrc(src?: string | null, accept = '*/*'): string | undefined {
  const bearerSrc = src && needsBearerAssetFetch(src) ? src : null
  const [, rerender] = useReducer((c: number) => c + 1, 0)

  useEffect(() => {
    if (!bearerSrc || resolvedCache.has(bearerSrc)) return
    let cancelled = false
    fetchAsBlobUrl(bearerSrc, accept)
      .catch(() => {})
      .finally(() => {
        if (!cancelled) rerender()
      })
    return () => {
      cancelled = true
    }
  }, [bearerSrc, accept])

  if (!src) return undefined
  if (!bearerSrc) return src
  return resolvedCache.get(bearerSrc)
}
