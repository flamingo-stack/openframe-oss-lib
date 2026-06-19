'use client'

import { useEffect } from 'react'
import { scrollElementIntoView } from '../utils/scroll-into-view'

export interface UseScrollToHashOptions {
  /** Pixels to subtract from the target element's `top` so it lands
   *  BELOW sticky chrome. Defaults to 0; pass `96` for the standard hub
   *  sticky header (same offset `useNavLink` uses). */
  headerOffset?: number
}

/**
 * Run the deep-link "scroll to `window.location.hash` anchor" routine
 * once the page's data has loaded. Pairs with URL composers that emit
 * `?<filter>=<id>#<prefix>-<id>` (e.g. `buildDevSectionUrl` for
 * roadmap/delivery rows) — the URL filter narrows the list, the hash
 * scrolls the matching DOM id.
 *
 * Re-runs on:
 *   - `data` reference change. `router.push`-driven chat-card-to-chat-
 *     card navigation (search param differs) doesn't fire `hashchange`,
 *     so the only signal we get that the URL changed is the next
 *     fetch's new data ref. Using `items.length` as the dep was a bug
 *     trap — 1 → 1 doesn't trigger React's referential check.
 *   - native `hashchange` (browser back/forward) AND the synthetic
 *     `HashChangeEvent` `navigateSamePageHash` dispatches for the
 *     same-pathname-same-search case.
 *
 * Polls via `requestAnimationFrame` for ~1 second (60 frames) until the
 * target element mounts. The poll handles two race classes:
 *   1. Lazy-mounted containers (Radix `<AccordionItem>` UNMOUNTS
 *      collapsed contents; the roadmap grid is rendered inside one and
 *      a separate effect expands quarters when filters are active —
 *      one tick after `data` lands).
 *   2. Late layout shifts (images/web-fonts loading after first paint
 *      change the row's pixel `top`; `scrollElementIntoView`'s own
 *      per-frame `getBoundingClientRect` recompute handles this once
 *      the element exists, but the initial "find the element" step
 *      needs to wait for the element to be present in the first place).
 *
 * Cheap (no MutationObserver), SSR-safe (guarded `window` reads).
 *
 * @example
 *   const { data } = useSelfFetch(url)
 *   useScrollToHash(data, { headerOffset: 96 })
 */
export function useScrollToHash(
  data: unknown,
  options?: UseScrollToHashOptions,
): void {
  const headerOffset = options?.headerOffset ?? 0
  useEffect(() => {
    if (typeof window === 'undefined' || data == null) return
    const tryScrollToHash = () => {
      const hash = window.location.hash.slice(1)
      if (!hash) return
      let frames = 0
      const tick = () => {
        const el = document.getElementById(hash)
        if (el) {
          scrollElementIntoView(el, { headerOffset })
          return
        }
        if (frames++ < 60) requestAnimationFrame(tick)
      }
      tick()
    }
    tryScrollToHash()
    window.addEventListener('hashchange', tryScrollToHash)
    return () => window.removeEventListener('hashchange', tryScrollToHash)
  }, [data, headerOffset])
}
