'use client'

/**
 * `useVideoWarmup` — single-source-of-truth hook for warming the
 * network path to a public entity's main video so click→first-frame
 * lands in sub-second on Fast 4G.
 *
 * Behavior:
 *
 *   1. **Preconnect on every render** (`ReactDOM.preconnect`) — buys
 *      the TCP / TLS handshakes to the video-bearing origins. React
 *      19 de-dupes identical preconnects, so this is safe to call
 *      on every render.
 *
 *   2. **Preload the video bytes** (`<link rel="preload" as="video">`)
 *      ONLY when:
 *        - the consumer's container scrolls within `nearMargin` of
 *          the viewport (gated via the lib's IO singleton hook), AND
 *        - `navigator.connection?.saveData !== true`, AND
 *        - the URL is on the Supabase storage origin (Mux HLS warms
 *          via its own manifest fetch when MuxPlayer mounts; YouTube
 *          has its own origin pool, no preload benefit).
 *
 * Origin configuration:
 *   - Mux origins (`stream.mux.com` / `image.mux.com`) are public
 *     Mux CDN hostnames and stable across the Mux API contract —
 *     hardcoded here.
 *   - Supabase storage origin varies per-deployment (different
 *     project per env). Threaded via the `supabaseStorageOrigin`
 *     argument so the lib stays env-agnostic; hub callers pass
 *     `getSupabaseStorageOrigin()` from their env config, or read
 *     it from `ChatRuntime.endpoints.supabaseStorageOrigin`.
 *
 * Lifted from hub `hooks/use-video-warmup.ts`. The Mux constants
 * and the IO-gated preload semantics are byte-equivalent.
 */

import { useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useNearViewport } from '../../hooks/use-near-viewport'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
// Re-export from the server-safe `mux-origins.ts` module so the
// constants are NOT bound to this `'use client'` file. See the
// JSDoc in `mux-origins.ts` for the bug history. Backward-compat:
// existing imports that read `MUX_STREAM_ORIGIN` from
// `@flamingo-stack/openframe-frontend-core/components/features`
// continue to resolve through this re-export.
export { MUX_STREAM_ORIGIN, MUX_IMAGE_ORIGIN } from './mux-origins'
import { MUX_STREAM_ORIGIN, MUX_IMAGE_ORIGIN } from './mux-origins'

/**
 * Save-Data detection — the ONE source of truth for "is this a metered
 * connection". Consumed by the preload gate below and by `video.tsx`'s
 * default `preload` policy. SSR-safe (returns false on the server).
 */
export function saveDataEnabled(): boolean {
  if (typeof navigator === 'undefined') return false
  type Connection = { saveData?: boolean }
  const conn = (navigator as Navigator & { connection?: Connection }).connection
  return conn?.saveData === true
}

/**
 * Preconnect-only variant — fires the three video-bearing origin
 * preconnects (Supabase Storage + Mux stream + Mux image) without
 * setting up the IntersectionObserver subscription or the preload
 * `<link>` injection.
 *
 * Use this when the consumer can't attach a `ref` to the video
 * container (e.g. release detail page, which delegates the player
 * render to a sibling component). Calling the full `useVideoWarmup`
 * from there would subscribe to a never-mounted ref and ship dead
 * preload machinery in the bundle.
 *
 * For consumers that own the video container, use `useVideoWarmup`
 * (which composes this hook + the IO-gated preload step).
 *
 * Reads `supabaseStorageOrigin` from `ChatRuntime.endpoints` by
 * default — callers in hosts that mount `HubRuntimeProvider` (or
 * any equivalent provider that wires the field) get the origin
 * automatically. The explicit `supabaseStorageOrigin` argument
 * overrides the runtime value when set.
 */
export function useVideoOriginPreconnect({
  supabaseStorageOrigin,
}: { supabaseStorageOrigin?: string } = {}): void {
  const runtime = useChatRuntime()
  const resolvedOrigin =
    supabaseStorageOrigin ?? runtime?.endpoints.supabaseStorageOrigin
  try {
    ReactDOM.preconnect(MUX_STREAM_ORIGIN, { crossOrigin: 'anonymous' })
    ReactDOM.preconnect(MUX_IMAGE_ORIGIN, { crossOrigin: 'anonymous' })
    if (resolvedOrigin) {
      ReactDOM.preconnect(resolvedOrigin, { crossOrigin: 'anonymous' })
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[useVideoOriginPreconnect] preconnect failed:', err)
    }
  }
}

interface UseVideoWarmupOptions {
  /**
   * Effective video URL the page renders. Pass null/undefined when
   * there's no video yet (the hook still preconnects). Only URLs on
   * `supabaseStorageOrigin` are preloaded — Mux HLS and YouTube are
   * no-ops on the preload side.
   */
  videoUrl?: string | null
  /**
   * Supabase storage origin (e.g. `https://xyz.supabase.co`). When
   * omitted, falls back to `ChatRuntime.endpoints.supabaseStorageOrigin`
   * — hosts that mount `HubRuntimeProvider` (or any equivalent
   * provider) get the origin automatically. When neither is set, the
   * preload step is skipped (preconnect to Mux still fires).
   */
  supabaseStorageOrigin?: string
  /**
   * IO root margin gate for the preload step. Default `'1000px'` —
   * about one viewport's worth of lookahead on desktop.
   */
  nearMargin?: string
}

export interface UseVideoWarmupResult<T extends Element = HTMLDivElement> {
  ref: (node: T | null) => void
  isNear: boolean
}

export function useVideoWarmup<T extends Element = HTMLDivElement>({
  videoUrl,
  supabaseStorageOrigin,
  nearMargin = '1000px',
}: UseVideoWarmupOptions = {}): UseVideoWarmupResult<T> {
  // Resolve origin once — runtime fallback so callers in hosts that
  // mount `HubRuntimeProvider` don't need to thread it themselves.
  const runtime = useChatRuntime()
  const resolvedOrigin =
    supabaseStorageOrigin ?? runtime?.endpoints.supabaseStorageOrigin

  // Preconnect on every render — React 19 dedupes. Delegates to the
  // shared preconnect-only variant so the origin list is a single
  // source of truth.
  useVideoOriginPreconnect({ supabaseStorageOrigin: resolvedOrigin })

  const { ref, isNear } = useNearViewport<T>(nearMargin)

  useEffect(() => {
    if (!isNear || !videoUrl || !resolvedOrigin) return

    // Save-Data gate — metered connections skip preload.
    if (saveDataEnabled()) return

    // Origin gate: only preload Supabase-hosted MP4s. Mux HLS warms
    // via the manifest fetch when MuxPlayer mounts; YouTube has no
    // preload benefit.
    let videoOrigin: string
    try {
      videoOrigin = new URL(videoUrl, 'http://placeholder.local').origin
    } catch {
      return
    }
    if (videoOrigin !== resolvedOrigin) return

    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'video'
    link.href = videoUrl
    link.crossOrigin = 'anonymous'
    // `fetchPriority='low'` matches the plan — the hint should not
    // steal network from the LCP image; the click→first-frame win is
    // in milliseconds, not the first paint.
    if ('fetchPriority' in link) {
      ;(link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = 'low'
    }
    document.head.appendChild(link)

    return () => {
      link.remove()
    }
  }, [isNear, videoUrl, resolvedOrigin])

  return { ref, isNear }
}
