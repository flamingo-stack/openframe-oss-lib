/**
 * Pure helpers for the new-tab decision + anchor attribute pair used
 * by chat-rendered links.
 *
 * After the navigation unification (ChatCardLoader pre-resolves
 * `chatRef.url` via `resolveSourceRowCTA` + `resolveHrefForRuntime`,
 * and `ChatCardNavWrap` handles every primary click via `onClickCapture`
 * → `handleChatNavClick`), the per-card wrapper only needs
 * `{href, target, rel}` on its inner `<a>` so modifier-click /
 * hover-preview / copy-link work natively.
 *
 * `computeIsNewTab` is the SINGLE source of the new-tab rule across
 * inline cards, source chips, and `NavLinkAnchorViaRuntime`. Do NOT
 * inline the `runtime.navigation.mode === 'embed'` short-circuit + the
 * `decideNewTab` fallback chain anywhere else.
 *
 * Rules:
 *   - `embed` mode → new-tab, EXCEPT for same-origin absolute hrefs. The chat
 *     lives on the embedder origin and most content lives on the hub (→ new
 *     tab), but an embedder may host a few content types in-app (e.g. OpenFrame
 *     serves releases / roadmap / guides under `/help-center`). Those are
 *     emitted as ABSOLUTE same-origin URLs by the embedder's `composeContentUrl`;
 *     keep them same-tab so they soft-nav in-app instead of opening a redundant
 *     new tab on the same origin. Relative hrefs stay new-tab — in embed mode
 *     they're hub-relative (absolutized against `defaultContentOrigin`).
 *   - `host` mode → defer to the runtime's `decideNewTab` callback
 *     (cross-platform → new-tab) or the lib's default.
 */

import type { ChatRuntime } from '../../../contexts/chat-runtime-context'
import { decideNewTab as libDecideNewTab } from './decide-new-tab'

/** An ABSOLUTE `http(s)` URL on the current page's origin. Relative hrefs return
 *  false (in embed mode they're hub-relative, not in-app), as do cross-origin
 *  and non-http URLs. SSR-safe: no `window` → false. */
function isSameOriginAbsoluteHref(href: string): boolean {
  if (typeof window === 'undefined') return false
  if (!/^https?:\/\//i.test(href)) return false
  try {
    return new URL(href).origin === window.location.origin
  } catch {
    return false
  }
}

export function computeIsNewTab(
  runtime: ChatRuntime,
  href: string | null | undefined,
  targetPlatform: string | null,
): boolean {
  if (!href) return false
  if (runtime.navigation.mode === 'embed') return !isSameOriginAbsoluteHref(href)
  return (
    runtime.navigation.decideNewTab?.({ href, targetPlatform }) ??
    libDecideNewTab({
      href,
      targetPlatform,
      currentSource: runtime.source ?? '',
    })
  )
}

/**
 * Returns the `target` + `rel` attribute pair for an inner `<a>` based
 * on the new-tab decision. Spread directly into JSX:
 *   <a href={href} {...newTabAnchorAttrs(isNewTab)} />
 *
 * Single helper so chat anchors stay consistent — new-tab links always
 * pair `_blank` with `noopener noreferrer` (defense against window.opener
 * tab-nabbing) and same-tab links don't render either attribute.
 */
export function newTabAnchorAttrs(isNewTab: boolean): {
  target?: '_blank'
  rel?: 'noopener noreferrer'
} {
  return isNewTab
    ? { target: '_blank' as const, rel: 'noopener noreferrer' as const }
    : {}
}

/**
 * Combine `href` + new-tab attrs into a card's `anchorProps` slot.
 * Returns `undefined` (not a falsy object) when there's no URL, so card
 * components can branch on `anchorProps != null` to render either a
 * clickable `<a>` or a static `<span>`.
 *
 * Replaces the repeated inline
 * `chatRef.url ? { href: chatRef.url, ...newTabAnchorAttrs(isNewTab) } : undefined`
 * pattern across the 7 dispatcher wrappers.
 */
export function buildAnchorProps(
  href: string | null | undefined,
  isNewTab: boolean,
): { href: string; target?: '_blank'; rel?: 'noopener noreferrer' } | undefined {
  return href ? { href, ...newTabAnchorAttrs(isNewTab) } : undefined
}
