/**
 * Pure click-handler helper for chat-rendered nav links.
 *
 * Single click router shared by:
 *   - The chip block inside EmbeddableChat
 *   - `<ChatCardNavWrap>` inside the entity-card dispatcher
 *   - `<NavLinkAnchorViaRuntime>` (markdown-body anchor wrapper)
 *
 * Returns `true` when the handler took action (called preventDefault); the
 * caller can treat that as "I handled it" and skip any further routing.
 * Returns `false` for modifier-clicks / non-primary buttons — those pass
 * through to the browser's default behavior (open in new tab, etc.).
 *
 * The new-tab decision (`computeIsNewTab` — embed-mode short-circuit +
 * `runtime.navigation.decideNewTab` + lib fallback) is the single source
 * of truth and is consumed here directly. No caller needs to duplicate
 * the embed-vs-host logic.
 *
 * Routing rules:
 *   - Empty href → preventDefault + return true (no-op nav)
 *   - Non-primary mouse button OR any modifier key → return false (let
 *     the browser handle it; `<a>` semantics take over)
 *   - new-tab (`computeIsNewTab` true) → `runtime.navigation.openExternal`
 *     or `window.open(href, '_blank')`. Covers embed mode and
 *     cross-platform host mode uniformly.
 *   - same-tab → `runtime.navigation.navigate?.(…)` → fallback
 *     `window.location.assign(stripSameOriginToPath(href))`
 */

import { computeIsNewTab } from './nav-anchor-props'
import { NEW_TAB_FEATURES, stripSameOriginToPath } from './chat-nav-resolution'
import type { ChatRuntime } from '../../../contexts/chat-runtime-context'

export interface ChatNavClickInput {
  href: string
  path?: string | null
  targetPlatform?: string | null
}

/**
 * Minimal mouse-event surface the click handler needs. Accepting a
 * structural type rather than `React.MouseEvent<HTMLAnchorElement>` keeps
 * the helper callable from non-anchor surfaces (chip buttons, tile
 * containers) without forcing a cast.
 */
interface NavClickEvent {
  preventDefault(): void
  button?: number
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

export function handleChatNavClick(
  e: NavClickEvent,
  runtime: ChatRuntime,
  { href, path, targetPlatform }: ChatNavClickInput,
): boolean {
  if (!href) {
    e.preventDefault()
    return true
  }
  if (e.button !== undefined && e.button !== 0) return false
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false

  e.preventDefault()
  const isNewTab = computeIsNewTab(runtime, href, targetPlatform ?? null)
  if (isNewTab) {
    if (runtime.navigation.openExternal) {
      runtime.navigation.openExternal(href)
    } else {
      window.open(href, '_blank', NEW_TAB_FEATURES)
    }
    return true
  }
  const handled =
    runtime.navigation.navigate?.({ href, path, targetPlatform }) ?? false
  if (!handled) window.location.assign(stripSameOriginToPath(href))
  return true
}
