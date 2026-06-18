import { scrollElementIntoView } from './scroll-into-view'

/**
 * Same-page hash navigation, shared by every same-tab nav surface in the
 * hub AND every embeddable surface in the lib (FAQ section, ticket cards,
 * doc-tree, HubSpot ticket embed, …). Co-located with `scrollElementIntoView`
 * because the two are a pair: the helper owns "set the URL, notify
 * listeners, run the anchoring-proof tween" — one primitive, one altitude.
 *
 * Returns `true` when `target` (an origin-stripped path like
 * `/openframe#top` or `/faqs#faq-item-42`) points at the CURRENT page —
 * same pathname + search — AND either carries a hash or matches the
 * current URL exactly (a re-click). In that case this helper owns the
 * navigation: it reflects the hash in the URL bar via `history.pushState`
 * (App Router syncs native history calls) and drives
 * `scrollElementIntoView` to the anchor — or to the page top when the
 * anchor is unknown/absent.
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
 */
export function navigateSamePageHash(target: string): boolean {
  if (typeof window === 'undefined') return false
  const url = new URL(target, window.location.origin)
  if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
    return false
  }
  const current = window.location.pathname + window.location.search + window.location.hash
  const id = url.hash && url.hash !== '#' ? url.hash.slice(1) : ''
  // Hash-less targets are only ours on an EXACT URL match (a re-click on
  // the current page, where router.push is a no-op — scroll to top is the
  // expected feedback). A same-page nav that merely REMOVES the hash falls
  // through to the router untouched.
  if (!id && target !== current) return false
  if (target !== current) {
    const oldURL = window.location.href
    window.history.pushState(null, '', target)
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
  scrollElementIntoView(el ?? document.documentElement, { behavior: 'smooth' })
  return true
}
