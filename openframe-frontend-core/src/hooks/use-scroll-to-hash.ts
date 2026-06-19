'use client'

import { useEffect } from 'react'
import { scrollElementIntoView } from '../utils/scroll-into-view'
import { normalizeHashFragment } from '../utils/same-page-hash-nav'

/** ~1s at 60fps — long enough to outlast Radix accordion expand + SWR
 *  mount, short enough that a missed anchor doesn't hang the page. */
const MAX_POLL_FRAMES = 60

export interface UseScrollToHashOptions {
  /** Pixels to subtract for sticky chrome. */
  headerOffset?: number
}

/**
 * Scroll the page to `window.location.hash` once `readyDep` resolves
 * to a truthy value. Polls via rAF for ~1s so lazy-mounted rows (Radix
 * accordion, SWR fetch) have time to render. Re-runs on `readyDep`
 * reference change AND on `hashchange` (browser back/forward + the
 * synthetic event `navigateSamePageHash` dispatches).
 *
 * Skipped when `readyDep == null || readyDep === false`. Default
 * `true` makes the hook run on mount for pages whose target is in the
 * initial SSR render.
 */
export function useScrollToHash(
  readyDep: unknown = true,
  options?: UseScrollToHashOptions,
): void {
  const headerOffset = options?.headerOffset ?? 0
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (readyDep === null || readyDep === false) return
    let rafId: number | null = null
    const cancelPoll = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }
    const tryScrollToHash = () => {
      // `normalizeHashFragment` heals a malformed multi-fragment hash
      // so `getElementById` resolves on deep-link entries that bypass
      // `navigateSamePageHash`'s own normalize.
      const hash = normalizeHashFragment(window.location.hash).slice(1)
      if (!hash) return
      // Cancel any in-flight poll from a prior invocation so two
      // concurrent ticks can't both call scrollElementIntoView.
      cancelPoll()
      let frames = 0
      const tick = () => {
        const el = document.getElementById(hash)
        if (el) {
          rafId = null
          scrollElementIntoView(el, { headerOffset })
          return
        }
        if (frames++ < MAX_POLL_FRAMES) {
          rafId = requestAnimationFrame(tick)
        } else {
          rafId = null
        }
      }
      tick()
    }
    tryScrollToHash()
    window.addEventListener('hashchange', tryScrollToHash)
    return () => {
      window.removeEventListener('hashchange', tryScrollToHash)
      cancelPoll()
    }
  }, [readyDep, headerOffset])
}
