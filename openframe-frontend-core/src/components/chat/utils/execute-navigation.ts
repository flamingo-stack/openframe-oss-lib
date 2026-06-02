'use client'

/**
 * THE single navigation-EXECUTION primitive for the whole lib.
 *
 * Link BUILDING is unified by `composeContentUrl`; the new-tab DECISION is
 * unified by `computeIsNewTab`/`decideNewTab`. This is the third leg: ONE place
 * that EXECUTES a navigation — encoding new-tab-vs-same-tab + internal-vs-external
 * + embed-vs-host + the runtime-then-router-then-window fallback chain. Every
 * surface routes through it:
 *   - chat cards / chips / markdown links → `executeNavigation` (click form),
 *     via the thin `handleChatNavClick` wrapper.
 *   - buttons / page rows / form redirects → `executeNavigationImperative` directly.
 *
 * Decision tree (the SAME one `handleChatNavClick` used — copied verbatim so
 * behavior is byte-identical; the hub's chat-click behavior MUST NOT change):
 *   1. empty href → no-op (click form preventDefaults + reports handled)
 *   2. (click form) modifier / non-primary button → NOT handled — let the
 *      browser do its native thing (`<a>` opens a new tab, etc.)
 *   3. `computeIsNewTab` true → `runtime.navigation.openExternal(href)` else
 *      `window.open(href, '_blank', noopener,noreferrer)`
 *   4. else (same-tab) → `runtime.navigation.navigate({href,path,targetPlatform})`;
 *      if the host didn't handle it → `fallbackNavigate(stripped)` else
 *      `window.location.assign(stripped)`
 *
 * `runtime` is nullable: surfaces with no `ChatRuntimeContext` mounted (e.g. the
 * announcement bar) pass `null` and get the plain same-tab fallback — there's no
 * new-tab/embed decision to make without a runtime.
 */

import { computeIsNewTab } from './nav-anchor-props'
import { NEW_TAB_FEATURES, stripSameOriginToPath } from './chat-nav-resolution'
import type { ChatRuntime } from '../../../contexts/chat-runtime-context'

/** Minimal mouse-event surface — structural so chip buttons / tiles can call it
 *  without casting `React.MouseEvent`. */
export interface NavClickEvent {
  preventDefault(): void
  button?: number
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

export interface ExecuteNavigationClickArgs {
  event: NavClickEvent
  runtime: ChatRuntime | null | undefined
  href: string
  path?: string | null
  targetPlatform?: string | null
  /** Host router fallback for same-origin soft-nav when the runtime doesn't wire
   *  `navigation.navigate` — pass `useRouter().push`. Without it, falls back to a
   *  full-page `window.location.assign`. */
  fallbackNavigate?: (path: string) => void
}

export interface ExecuteNavigationImperativeArgs {
  runtime: ChatRuntime | null | undefined
  href: string
  targetPlatform?: string | null
  fallbackNavigate?: (path: string) => void
}

/** Core: make the new-tab decision (when a runtime is present) and execute. */
function runNavigation(
  runtime: ChatRuntime | null | undefined,
  href: string,
  path: string | null | undefined,
  targetPlatform: string | null | undefined,
  fallbackNavigate?: (path: string) => void,
): void {
  // No runtime → no embed/new-tab decision possible; plain same-tab fallback.
  const isNewTab = runtime ? computeIsNewTab(runtime, href, targetPlatform ?? null) : false
  if (isNewTab) {
    if (runtime?.navigation.openExternal) runtime.navigation.openExternal(href)
    else window.open(href, '_blank', NEW_TAB_FEATURES)
    return
  }
  const handled = runtime?.navigation.navigate?.({ href, path, targetPlatform }) ?? false
  if (!handled) {
    const target = stripSameOriginToPath(href)
    if (fallbackNavigate) fallbackNavigate(target)
    else window.location.assign(target)
  }
}

/**
 * Click-handler form. Returns `true` when it took action (called
 * `preventDefault`); `false` for modifier / non-primary clicks the browser
 * should handle natively. Spread the result into your anchor's `onClick`.
 */
export function executeNavigation({
  event,
  runtime,
  href,
  path,
  targetPlatform,
  fallbackNavigate,
}: ExecuteNavigationClickArgs): boolean {
  if (!href) {
    event.preventDefault()
    return true
  }
  // Modifier / non-primary clicks → NOT handled; let the browser do its native thing.
  // Deliberately NOT the shared `isModifierClick` (chat-nav-resolution): that predicate
  // treats an UNDEFINED `button` as a modifier (`button !== 0`), but a structural
  // NavClickEvent from a chip tile may omit `button` and MUST be a primary click (navigate).
  if (event.button !== undefined && event.button !== 0) return false
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false
  event.preventDefault()
  runNavigation(runtime, href, path, targetPlatform, fallbackNavigate)
  return true
}

/**
 * Imperative form — for buttons, list-row onClicks, and post-action redirects
 * that aren't anchor clicks. Same decision tree, no event/modifier handling.
 */
export function executeNavigationImperative({
  runtime,
  href,
  targetPlatform,
  fallbackNavigate,
}: ExecuteNavigationImperativeArgs): void {
  runNavigation(runtime, href, undefined, targetPlatform, fallbackNavigate)
}
