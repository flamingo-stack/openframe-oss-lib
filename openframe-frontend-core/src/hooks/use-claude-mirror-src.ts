'use client'

import { useEffect, useState } from 'react'
import { useEndpointsRuntime } from '../contexts/endpoints-runtime-context'
import { toClaudeMirrorPath } from '../utils/embed-url-converters'

export type ClaudeMirrorStatus =
  /** No mirror candidate at all (no proxy configured, or a non-mirrorable url). */
  | 'absent'
  /** Probing the host for a self-hosted mirror (or minting one on first view). */
  | 'probing'
  /** A mirror exists and `src` points at it. */
  | 'found'

export interface ClaudeMirrorState {
  /** The mirror src when found (with a cache-bust once a re-publish is
   *  detected), else `null`. */
  src: string | null
  status: ClaudeMirrorStatus
}

/**
 * Ask the host's storage-view proxy whether the cached mirror is still the
 * artifact's CURRENT version, re-minting it silently if a re-publish moved
 * it. Returns a cache-bust token (the new version) when the mirror changed,
 * else null. Best-effort: any failure just leaves the shown mirror in place.
 */
async function revalidateMirror(mirrorPath: string): Promise<string | null> {
  try {
    const res = await fetch(`${mirrorPath}?revalidate=1`)
    if (!res.ok) return null
    const body = (await res.json()) as { updated?: boolean; version?: string | null }
    return body?.updated ? String(body.version ?? Date.now()) : null
  } catch {
    return null
  }
}

/**
 * The host's SELF-HOSTED MIRROR src for a claude artifact url, plus a
 * `status` so the viewer can show a loading state while it resolves — THE
 * hook behind `ClaudeEmbed`'s transparent mirror leg, extracted so the
 * component stays presentational.
 *
 * Fully under the hood, three moves:
 *   1. Derive the candidate mirror path from the url's artifact id under the
 *      host's configured storage-view proxy base
 *      (`EndpointsRuntime.storageViewBaseUrl`) and probe it with a 1-byte
 *      ranged GET. On a cold first view that probe IS the server-side
 *      self-heal (~1-2s), which is exactly why `status: 'probing'` exists —
 *      the viewer shows a spinner instead of the empty "no embeddable view"
 *      flash. Exists → `found`; missing / no proxy / blip → `absent`, and the
 *      caller's claude.ai fallback stands (the pre-mirror behavior).
 *   2. Once found, fire ONE background revalidation. If the artifact was
 *      re-published since the mirror was cached, the server re-mints it and
 *      reports the new version; the hook bumps a cache-bust on `src` so the
 *      iframe silently reloads the fresh bytes. Unchanged → nothing happens.
 *
 * A host that mounts no EndpointsRuntime provider (or omits the entry) skips
 * the mirror leg entirely (`absent`).
 */
export function useClaudeMirrorSrc(url: string): ClaudeMirrorState {
  const endpoints = useEndpointsRuntime()
  const mirrorPath = toClaudeMirrorPath(url, endpoints?.storageViewBaseUrl)
  const [state, setState] = useState<ClaudeMirrorState>(() => ({
    src: null,
    status: mirrorPath ? 'probing' : 'absent',
  }))

  useEffect(() => {
    if (!mirrorPath) {
      setState({ src: null, status: 'absent' })
      return
    }
    setState({ src: null, status: 'probing' })
    let cancelled = false
    fetch(mirrorPath, { headers: { Range: 'bytes=0-0' } })
      .then((res) => {
        if (cancelled) return
        if (!(res.ok || res.status === 206)) {
          setState({ src: null, status: 'absent' })
          return
        }
        setState({ src: mirrorPath, status: 'found' })
        // Background freshness check — reload in place only if it changed.
        revalidateMirror(mirrorPath).then((bust) => {
          if (!cancelled && bust) {
            setState({ src: `${mirrorPath}?v=${encodeURIComponent(bust)}`, status: 'found' })
          }
        })
      })
      .catch(() => {
        // No proxy on this host / network blip — the caller's claude.ai
        // fallback stands, same as before mirrors existed.
        if (!cancelled) setState({ src: null, status: 'absent' })
      })
    return () => {
      cancelled = true
    }
  }, [mirrorPath])

  return state
}
