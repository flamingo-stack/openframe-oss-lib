/**
 * `scrollToAnchor` — single canonical "scroll an element into the
 * viewport with smooth animation + sticky-header offset" helper.
 *
 * Before this util existed, the same six-line snippet was copy-pasted
 * across ~10 sites (use-document-tree, multiple-vendor-selector, the
 * tickets drawer, useJoinWaitlist, the comparison page, pagination,
 * blog-section, category-filter-sidebar, mobile-category-dropdown,
 * vendor-detail-content). Each implementation diverged slightly:
 *
 *   - Some used `element.scrollIntoView({ behavior:'smooth', block:'start' })`
 *     and landed flush against the viewport top — visibly HIDDEN behind
 *     the sticky page header.
 *   - Some used `window.scrollTo({ top, behavior:'smooth' })` with a
 *     hard-coded `headerOffset` of 80 (correct for /docs) or 0 (wrong
 *     for any page with chrome).
 *   - Some called scrollIntoView, which re-targets continuously as the
 *     page layout shifts during the smooth animation — causing the
 *     visible jitter when scrolling toward an expanding accordion or a
 *     section that grows from an async fetch.
 *   - Some forgot to handle hash-anchor URLs on mount (e.g. opening
 *     `/waitlist#waitlist-form` from a marketing link), so the native
 *     browser anchor scroll never fired because the target element
 *     wasn't in the SSR snapshot.
 *
 * This util fixes all of those at once and is the only place that needs
 * to know the project's chrome offset:
 *
 *   - Pre-computes the target as `el.getBoundingClientRect().top +
 *     window.scrollY - headerOffset` BEFORE starting the animation, so
 *     the browser runs a clean uninterrupted smooth-scroll to a fixed
 *     pixel.
 *   - Header offset defaults to 80 (matches the hub's existing sticky
 *     nav height — see hooks/use-document-tree.ts:15).
 *   - `delay` option lets the caller wait for an animation to settle
 *     (e.g. Radix Collapsible ~200ms) before measuring the target.
 *   - Accepts HTMLElement, an id string (with or without leading `#`),
 *     OR null — null is a no-op so callers don't have to defensively
 *     branch.
 *
 * Why a single util instead of `scrollIntoView({block:'start'})`:
 *   1. Stable target — the smooth animation doesn't drift mid-flight.
 *   2. Header offset — the tile lands BELOW the sticky chrome, visible.
 *   3. SSR-safe — short-circuits on the server.
 *   4. One place to tune — change the offset here when the chrome
 *      height changes; every caller picks it up.
 */

/** Default sticky-header offset across the hub. Matches the existing
 *  value in `hooks/use-document-tree.ts:scrollToContent`. */
export const DEFAULT_HEADER_OFFSET = 80

export interface ScrollToAnchorOptions {
  /** Pixels to subtract from the target's top so the element doesn't
   *  land hidden behind a sticky header. Defaults to 80. Pass `0` for
   *  full-page-top alignment. */
  headerOffset?: number
  /** Scroll animation style. Defaults to `'smooth'`. Use `'instant'`
   *  for imperative jumps (restore-scroll, programmatic focus moves
   *  where animation would feel laggy). */
  behavior?: ScrollBehavior
  /** Milliseconds to wait before measuring + scrolling. Useful when an
   *  upstream animation needs to settle first (Radix Collapsible is
   *  ~200ms; an async fetch that adds content might take longer).
   *  Defaults to 0 (sync). */
  delay?: number
}

/**
 * Scroll the page so the target element lands at the top of the
 * viewport, just below sticky chrome.
 *
 * Accepts:
 *   - `HTMLElement` — direct reference (most common from `useRef`).
 *   - `string` — interpreted as a DOM id, with or without leading `#`.
 *   - `null` / `undefined` — no-op.
 *
 * Returns void; the scroll runs async via the browser's smooth-scroll.
 * If you need to run code AFTER the scroll settles, schedule it
 * separately — there's no reliable cross-browser `onscrollend` yet.
 */
export function scrollToAnchor(
  target: HTMLElement | string | null | undefined,
  options: ScrollToAnchorOptions = {},
): void {
  const {
    headerOffset = DEFAULT_HEADER_OFFSET,
    behavior = 'smooth',
    delay = 0,
  } = options

  // SSR / non-browser safety — the lib is consumed by Next.js App
  // Router where many call sites are technically "use client" but
  // still execute during module evaluation on the server. Guard
  // before touching `window`/`document`.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  const run = () => {
    const el =
      typeof target === 'string'
        ? document.getElementById(
            target.startsWith('#') ? target.slice(1) : target,
          )
        : target ?? null
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
    window.scrollTo({ top, behavior })
  }

  if (delay > 0) {
    setTimeout(run, delay)
  } else {
    run()
  }
}

/**
 * On-mount hash handler — for client-rendered pages that load via a
 * URL like `/waitlist#waitlist-form`. Next.js App Router intercepts
 * the browser's native anchor scroll, AND client-rendered content
 * may not exist in the SSR snapshot, so the native scroll-to-hash
 * silently fails. Call this from a `useEffect` on the page's
 * top-level client component.
 *
 * The optional `pollMs` parameter retries until the element exists
 * OR `maxAttempts` runs out — useful when the form is rendered
 * conditionally (auth gate, lazy-import). Defaults: 50ms poll, 40
 * attempts (~2 seconds total).
 */
export function scrollToHashOnMount(options: {
  headerOffset?: number
  behavior?: ScrollBehavior
  pollMs?: number
  maxAttempts?: number
} = {}): () => void {
  const {
    headerOffset = DEFAULT_HEADER_OFFSET,
    behavior = 'smooth',
    pollMs = 50,
    maxAttempts = 40,
  } = options

  if (typeof window === 'undefined') return () => {}
  const hash = window.location.hash
  if (!hash || hash.length <= 1) return () => {}

  const id = hash.slice(1)
  let attempts = 0
  let cancelled = false

  const attempt = () => {
    if (cancelled) return
    const el = document.getElementById(id)
    if (el) {
      scrollToAnchor(el, { headerOffset, behavior })
      return
    }
    attempts += 1
    if (attempts < maxAttempts) {
      setTimeout(attempt, pollMs)
    }
  }
  attempt()

  return () => {
    cancelled = true
  }
}
