import { scrollElementIntoView } from './scroll-into-view'

/**
 * Same-page hash navigation, shared by every same-tab nav surface in the
 * hub AND every embeddable surface in the lib (FAQ section, ticket cards,
 * doc-tree, HubSpot ticket embed, …). Co-located with `scrollElementIntoView`
 * because the two are a pair: the helper owns "set the URL, notify
 * listeners, run the anchoring-proof tween" — one primitive, one altitude.
 *
 * Returns `true` when `target` points at the CURRENT page — same pathname
 * + search — AND either carries a hash or matches the current URL exactly
 * (a re-click). In that case this helper owns the navigation: it reflects
 * the hash in the URL bar via `history.pushState` (App Router syncs native
 * history calls) and drives `scrollElementIntoView` to the anchor — or to
 * the page top when the anchor is unknown/absent.
 *
 * `target` accepts two forms:
 *   - **Origin-stripped path** (`/openframe#top`, `/faqs#faq-item-42`) for
 *     cross-page-aware callers — the helper checks pathname/search match
 *     before claiming the nav.
 *   - **Bare hash** (`#section-slug`, `#faq-item-42`) for same-page-only
 *     callers (FAQ pills, vendor section nav, doc-tree internal anchors)
 *     that already know they're scrolling within the current page. The
 *     helper reconstructs `pathname + search + hash` internally so callers
 *     don't have to. (DRY — three identical
 *     `pathname + search + '#' + id` reconstructions were the precursor to
 *     this overload.)
 *
 * WHY NOT `router.push` FOR THESE: Next.js performs hash scrolling as an
 * INSTANT jump (it suppresses CSS smooth behavior during navigation), so
 * the first click on a hash CTA never animated — and once the URL matched
 * exactly, `router.push` was a complete no-op. Net effect was the
 * "Get Beta Access scrolls smoothly only on the second try" bug.
 *
 * Returns `false` for cross-page targets — callers fall through to
 * `router.push` exactly as before.
 *
 * WHY THIS HELPER DISPATCHES A SYNTHETIC `hashchange` EVENT:
 * `history.pushState` does NOT fire `hashchange` (per HTML spec — the
 * event fires only on browser-driven hash navigation: back/forward,
 * manual URL edit, direct `location.hash` assignment). Pages that depend
 * on the event to re-render — the FAQ section auto-expanding the cited
 * Q&A, any future page driving accordion / tab / section state off the
 * URL hash — would otherwise see the URL update but never react. Firing
 * the event ourselves keeps this helper the SINGLE source of "the hash
 * changed → re-render listeners → smooth-tween scroll" — no per-page
 * polling, no per-page Next.js router-event subscription, no per-page
 * `popstate` fallback. Every embed and every host page inherits the
 * behavior from the same primitive.
 *
 * ## Sticky-header offsets
 *
 * Pages with a sticky header (the hub's site header, the FAQ category
 * nav, the docs sticky header) need to subtract that chrome from the
 * scroll target so the anchor lands below the header, not under it.
 * Callers pass `headerOffset` via the second argument; this overrides
 * the default 0. Pages that ALSO bind a `hashchange` listener that
 * re-scrolls with their own offset (FAQ section's `hashTarget` effect
 * is the canonical example) can rely on the listener — but the explicit
 * `headerOffset` here makes the helper land in the right place on the
 * FIRST tween, before the listener fires, which matters for same-target
 * re-clicks where the listener is a no-op (`hashTarget` reference
 * equality short-circuits).
 */
export interface NavigateSamePageHashOptions {
  /** Pixels to subtract from the anchor's `top` so it lands BELOW sticky
   *  chrome. Defaults to 0 — matches the prior contract. Pass `80` for
   *  the standard hub header, `96` for the FAQ category nav. */
  headerOffset?: number
}

export function navigateSamePageHash(
  target: string,
  options: NavigateSamePageHashOptions = {},
): boolean {
  if (typeof window === 'undefined') return false
  const { headerOffset = 0 } = options
  // Bare-hash form (`#section-slug`): treat as same-page nav. Reconstruct
  // the full `pathname + search + hash` so the rest of the function — URL
  // compare, pushState, getElementById — operates on a single
  // canonical string.
  const normalizedTarget =
    target.startsWith('#')
      ? window.location.pathname + window.location.search + target
      : target
  const url = new URL(normalizedTarget, window.location.origin)
  if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
    return false
  }
  const current = window.location.pathname + window.location.search + window.location.hash
  const id = url.hash && url.hash !== '#' ? url.hash.slice(1) : ''
  // Hash-less targets are only ours on an EXACT URL match (a re-click on
  // the current page, where router.push is a no-op — scroll to top is the
  // expected feedback). A same-page nav that merely REMOVES the hash falls
  // through to the router untouched.
  if (!id && normalizedTarget !== current) return false
  if (normalizedTarget !== current) {
    const oldURL = window.location.href
    window.history.pushState(null, '', normalizedTarget)
    // Synthetic `hashchange` so listeners (FAQ section auto-expand, any
    // other page bound to the URL hash) re-render WITHOUT having to know
    // they're being navigated by `router.push` vs the browser. Dispatch
    // BEFORE the scroll so the page settles its new layout (accordion
    // expanding, etc.) and `scrollElementIntoView`'s per-frame target
    // recompute lands on the post-layout position, not the stale one.
    window.dispatchEvent(new HashChangeEvent('hashchange', {
      oldURL,
      newURL: window.location.href,
    }))
  }
  const el = id ? document.getElementById(id) : null
  // Missing/absent anchor → tween to page top. documentElement's top is 0
  // by definition, so ONE tween path covers both cases (no cancellable
  // native `window.scrollTo({behavior:'smooth'})` anywhere on this path).
  // Dev-only warn when an explicit anchor was requested but not found —
  // helps catch typo'd citation links / deleted FAQ items in QA.
  if (id && !el && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(
      `[navigateSamePageHash] anchor "#${id}" not found on this page — scrolling to top.`,
    )
  }
  scrollElementIntoView(el ?? document.documentElement, {
    behavior: 'smooth',
    headerOffset,
  })
  return true
}
