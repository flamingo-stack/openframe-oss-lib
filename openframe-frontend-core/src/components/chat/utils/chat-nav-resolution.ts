'use client'

/**
 * Embed-mode navigation resolver + shared click-handling primitives.
 *
 * Used by the lib chat panel's chip + card click handlers to force
 * new-tab + absolutize against the embedder-supplied content origin.
 *
 * Refactor from hub origin (D5): inferTargetPlatformFromHref +
 * getPlatformDomain dropped. Caller threads `targetPlatform` directly.
 * Relative URLs without a defaultContentOrigin emit a dev warning
 * and resolve against window.location.origin (likely wrong in embed
 * mode; embedder should set defaultContentOrigin).
 */

import type { ChatRuntime } from '../../../contexts/chat-runtime-context'

/** Arguments accepted by `window.open` for a new tab — keep `noopener`
 *  + `noreferrer` to prevent the opened page from accessing
 *  window.opener (reverse-tabnabbing class). */
export const NEW_TAB_FEATURES = 'noopener,noreferrer'

/** Modifier-click predicate — matches the existing useNavLink branch
 *  (cmd/ctrl/shift/alt OR non-primary mouse button). */
export function isModifierClick(e: {
  button?: number
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}): boolean {
  return (
    e.button !== 0 ||
    !!e.metaKey ||
    !!e.ctrlKey ||
    !!e.shiftKey ||
    !!e.altKey
  )
}

/** Strip the origin from a same-origin absolute URL, returning a relative
 *  path the host's router will treat as in-app navigation. Pass-through
 *  for already-relative URLs and for cross-origin URLs. */
export function stripSameOriginToPath(href: string): string {
  if (!href.startsWith('http')) return href
  try {
    const u = new URL(href)
    return u.pathname + u.search + u.hash
  } catch {
    return href
  }
}

export interface ExternalNavResolution {
  /** Absolutized href — relative paths are joined with
   *  `runtime.navigation.defaultContentOrigin` (embed contract). */
  href: string
  /** Synchronous opener. MUST be invoked inline from a user gesture for
   *  popup-blocker compatibility (Safari/Firefox). Honors
   *  runtime.navigation.openExternal override, else falls back to
   *  window.open(href, '_blank', 'noopener,noreferrer'). */
  open: () => void
}

/**
 * Pre-resolve an href against the embed-mode `defaultContentOrigin`.
 *
 * In `embed` mode every chat-rendered anchor MUST point at an absolute
 * URL on the hub origin (not the embedder origin). Without
 * pre-resolution, relative paths like `/knowledge-base/foo.md` render
 * as `<a href="/knowledge-base/...">` — the click handler intercepts
 * primary-button clicks correctly, but modifier-click (cmd/ctrl/middle/
 * right) bypasses the handler and opens `<embedder-origin>/...` → 404.
 * Pre-resolution at render time makes every browser-native navigation
 * path (hover preview, status bar, copy-link, new-tab via modifier)
 * land on the hub correctly.
 *
 * In `host` mode (the hub itself) the href is returned unchanged —
 * relative paths resolve naturally against the hub's own origin.
 *
 * Absolute URLs and protocol-relative URLs are returned unchanged in
 * both modes.
 */
export function resolveHrefForRuntime(
  href: string,
  runtime: ChatRuntime,
): string {
  if (runtime.navigation.mode !== 'embed') return href
  if (href.startsWith('http')) return href
  if (href.startsWith('//')) return href
  const origin = runtime.navigation.defaultContentOrigin
  if (!origin) return href
  return origin.replace(/\/+$/, '') + (href.startsWith('/') ? href : '/' + href)
}

/**
 * Resolve external navigation in embed mode.
 *
 * Browser-only: called from React event handlers (onClick, imperative
 * click handlers) after mount. No SSR-reachable paths.
 */
export function resolveExternalNavigation(args: {
  href: string
  targetPlatform: string | null | undefined
  runtime: ChatRuntime
}): ExternalNavResolution {
  let abs = args.href

  // Defense: protocol-relative URLs (`//evil.com/x`) are NOT same-origin —
  // browsers treat them as cross-origin absolute. Without this guard,
  // a malicious href like `//evil.com/x` would skip the `startsWith('http')`
  // check and reach the origin-concat branch below, producing a malformed
  // URL that some browsers normalize back to `https://evil.com/x`
  // (open-redirect class).
  if (abs.startsWith('//')) abs = window.location.protocol + abs

  if (!abs.startsWith('http')) {
    if (args.runtime.navigation.defaultContentOrigin) {
      // Strip trailing slashes via a loop, not `/\/+$/` — CodeQL flags
      // the greedy `+` as polynomial-redos even with the `$` anchor.
      // The loop is unambiguously O(n) in slash count.
      let origin = args.runtime.navigation.defaultContentOrigin
      while (origin.endsWith('/')) origin = origin.slice(0, -1)
      abs = origin + (abs.startsWith('/') ? abs : '/' + abs)
    } else if (
      args.runtime.navigation.mode === 'embed' &&
      process.env.NODE_ENV !== 'production'
    ) {
      console.warn(
        '[chat-nav-resolution] relative href in embed mode with no ' +
          'defaultContentOrigin set on runtime.navigation — link will resolve ' +
          'against the embedder origin.',
        { href: abs, targetPlatform: args.targetPlatform },
      )
    }
  }

  const open = () => {
    // Explicit if/else (NOT `??`) — `??` only short-circuits on
    // null/undefined LHS, but `openExternal?.(href)` returns void on a
    // successful call, which `??` treats as undefined and re-fires
    // window.open — double-open bug.
    if (args.runtime.navigation.openExternal) {
      args.runtime.navigation.openExternal(abs)
    } else {
      window.open(abs, '_blank', NEW_TAB_FEATURES)
    }
  }

  return { href: abs, open }
}
