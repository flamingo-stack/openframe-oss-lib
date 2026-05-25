/**
 * Pure new-tab decision helper.
 *
 * Same logic as the hub's prior inline `decideNewTab`, but parameterized:
 *   - `currentSource` is passed by caller (was `currentPlatform()` reads
 *     inside the body). Hub callers pass `currentPlatform()`; lib chip
 *     code passes `runtime.source ?? ''`.
 *
 * BRANCH PRIORITY:
 *   1. `runtimeMode === 'embed'` → always new-tab (embed-mode short-circuit)
 *   2. `openIn === 'new-tab'` or `'same-tab'` — explicit caller override
 *   3. `alwaysNewTab === true` (legacy synonym for `openIn: 'new-tab'`)
 *   4. `targetPlatform` defined AND `currentSource` non-empty →
 *      platform comparison (cross-app → new tab, same-app → same tab)
 *   5. Legacy fallback: `isCrossOriginUrl(href)` — origin compare. Works
 *      in prod (distinct hosts) but degrades to "always same-tab" in dev.
 *
 * No call site implements its own variant of the rule.
 */

import { isCrossOriginUrl } from './is-cross-origin-url'

export type NavSurface = 'useNavLink' | 'useUnifiedNav'
export type RuntimeMode = 'host' | 'embed'

export interface DecideNewTabInput {
  href: string | null | undefined
  targetPlatform?: string | null
  openIn?: 'new-tab' | 'same-tab'
  alwaysNewTab?: boolean
  /** Caller tag — labels the decision in any external trace logging. */
  surface?: NavSurface
  /** Optional chat-runtime mode. When omitted OR set to `'host'`,
   *  behavior is byte-equivalent to the legacy logic. Only `'embed'`
   *  triggers the new priority-1 branch that forces new-tab. */
  runtimeMode?: RuntimeMode
  /** Current chat source / platform identifier — caller-threaded.
   *  Empty string disables the platform-comparison branch (falls
   *  through to the origin-compare fallback). */
  currentSource: string
}

export function decideNewTab(input: DecideNewTabInput): boolean {
  const { href, targetPlatform, openIn, alwaysNewTab, runtimeMode, currentSource } = input

  // Priority #1: embed-mode trumps every other branch.
  if (runtimeMode === 'embed') return true
  if (openIn === 'new-tab') return true
  if (alwaysNewTab === true) return true
  if (openIn === 'same-tab') return false
  // `currentSource` falsy guard: if empty, fall through to origin check.
  if (targetPlatform !== undefined && targetPlatform !== null && currentSource) {
    return targetPlatform !== currentSource
  }
  if (!href) return false
  return isCrossOriginUrl(href)
}
