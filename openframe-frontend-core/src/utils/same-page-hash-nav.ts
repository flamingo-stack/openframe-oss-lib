import { scrollElementIntoView } from './scroll-into-view'

/** Standard hub sticky-header offset (px). Shared by every `useScrollToHash`
 *  caller AND by per-row click-to-expand `scrollElementIntoView` calls so
 *  the anchor lands at the same Y regardless of entry point. */
export const STICKY_HEADER_OFFSET_PX = 96

/**
 * Take only the FIRST hash segment from a fragment that may contain extra
 * `#` characters. `'' → ''`, `'#a' → '#a'`, `'#a#b' → '#a'`.
 *
 * No real DOM id contains `#`, so a multi-fragment hash is always a bug at
 * the composer site; `navigateSamePageHash` + `useScrollToHash` both call
 * this so URL bar and `getElementById` stay in sync.
 */
export function normalizeHashFragment(hash: string): string {
  if (!hash) return ''
  const second = hash.indexOf('#', 1)
  return second < 0 ? hash : hash.slice(0, second)
}

export interface NavigateSamePageHashOptions {
  /** Pixels to subtract for sticky chrome. */
  headerOffset?: number
  /** `'push'` (default) — new history entry; `'replace'` — overwrite
   *  current entry (use for TOC-style in-page navigators). */
  history?: 'push' | 'replace'
}

/**
 * Same-page hash navigation primitive: pushState + synthetic `hashchange`
 * + anchoring-proof smooth scroll. Replaces `router.push` for hash CTAs
 * (Next.js suppresses smooth-scroll during navigation; `router.push` on
 * an exact-URL match is a no-op). Returns `true` when the helper claimed
 * the nav (same pathname + search); `false` for cross-page targets so
 * callers fall through to `router.push`.
 *
 * `target` accepts an origin-stripped path (`/x#anchor`) or a bare hash
 * (`#anchor`); bare-hash callers don't need to reconstruct `pathname +
 * search` themselves.
 */
export function navigateSamePageHash(
  target: string,
  options: NavigateSamePageHashOptions = {},
): boolean {
  if (typeof window === 'undefined') return false
  const { headerOffset = 0, history: historyMode = 'push' } = options
  const normalizedTarget =
    target.startsWith('#')
      ? window.location.pathname + window.location.search + target
      : target
  // `new URL(absoluteUrl, base)` ignores `base` per RFC 3986; an absolute
  // cross-origin target sharing pathname/search would otherwise pass the
  // check below and trip pushState's same-origin enforcement. Parse with
  // an explicit base so malformed inputs cleanly fall through.
  let url: URL
  try {
    url = new URL(normalizedTarget, window.location.href)
  } catch {
    return false
  }
  if (
    url.origin !== window.location.origin ||
    url.pathname !== window.location.pathname ||
    url.search !== window.location.search
  ) {
    return false
  }
  const current = window.location.pathname + window.location.search + window.location.hash
  // Heal a malformed multi-fragment hash so the URL bar is clean and
  // `getElementById` resolves. Dev-warn fingers the upstream composer.
  const normalizedHash = normalizeHashFragment(url.hash)
  if (process.env.NODE_ENV === 'development' && normalizedHash !== url.hash) {
    // eslint-disable-next-line no-console
    console.warn(
      `[navigateSamePageHash] malformed fragment "${url.hash}" → normalizing to "${normalizedHash}". Fix the upstream composer.`,
    )
  }
  const next = url.pathname + url.search + normalizedHash
  const id = normalizedHash && normalizedHash !== '#' ? normalizedHash.slice(1) : ''
  // Hash-less targets are only ours on an EXACT URL re-click.
  if (!id && next !== current) return false
  if (next !== current) {
    const oldURL = window.location.href
    if (historyMode === 'replace') {
      window.history.replaceState(null, '', next)
    } else {
      window.history.pushState(null, '', next)
    }
    // Synthetic `hashchange` — `pushState` doesn't fire it (HTML spec),
    // so URL-hash-bound listeners (FAQ auto-expand, etc.) wouldn't react.
    window.dispatchEvent(new HashChangeEvent('hashchange', {
      oldURL,
      newURL: window.location.href,
    }))
  }
  const el = id ? document.getElementById(id) : null
  if (id && !el && process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.warn(
      `[navigateSamePageHash] anchor "#${id}" not found — scrolling to top.`,
    )
  }
  // Missing anchor → tween to page top. `documentElement` is at 0 by
  // definition, so one tween covers both branches.
  scrollElementIntoView(el ?? document.documentElement, {
    behavior: 'smooth',
    headerOffset,
  })
  return true
}
