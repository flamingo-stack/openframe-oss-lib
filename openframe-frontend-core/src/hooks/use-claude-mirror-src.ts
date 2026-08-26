'use client'

import { useEffect, useState } from 'react'
import { useEndpointsRuntime } from '../contexts/endpoints-runtime-context'
import { toClaudeMirrorPath } from '../utils/embed-url-converters'

/**
 * The host's SELF-HOSTED MIRROR src for a claude artifact url, or `null`
 * while none is known — THE hook behind `ClaudeEmbed`'s transparent
 * mirror leg, extracted so the component stays presentational.
 *
 * Fully under the hood: derives the candidate mirror path from the url's
 * artifact id under the host's configured storage-view proxy base
 * (`EndpointsRuntime.storageViewBaseUrl` — the SAME proxy-path mechanism
 * as every other lib→API call) and probes it with a 1-byte ranged GET
 * (the proxy forwards Range, so the probe costs nothing). Exists → the
 * mirror path; missing / no proxy / network blip → `null`, and the
 * caller's claude.ai fallback is exactly the pre-mirror behavior. A host
 * that mounts no EndpointsRuntime provider (or omits the entry) skips
 * the mirror leg entirely.
 */
export function useClaudeMirrorSrc(url: string): string | null {
  const endpoints = useEndpointsRuntime()
  const mirrorPath = toClaudeMirrorPath(url, endpoints?.storageViewBaseUrl)
  const [mirrorSrc, setMirrorSrc] = useState<string | null>(null)
  useEffect(() => {
    setMirrorSrc(null)
    if (!mirrorPath) return
    let cancelled = false
    fetch(mirrorPath, { headers: { Range: 'bytes=0-0' } })
      .then(res => {
        if (!cancelled && (res.ok || res.status === 206)) setMirrorSrc(mirrorPath)
      })
      .catch(() => {
        // No proxy on this host / network blip — the caller's claude.ai
        // fallback stands, same as before mirrors existed.
      })
    return () => {
      cancelled = true
    }
  }, [mirrorPath])
  return mirrorSrc
}
