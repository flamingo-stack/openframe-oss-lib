'use client'

/**
 * Click router for chat-rendered nav links — chip block, `<ChatCardNavWrap>`,
 * `<NavLinkAnchorViaRuntime>`.
 *
 * @deprecated Thin wrapper around the unified `executeNavigation` primitive
 * (`execute-navigation.ts`). Kept so the existing chat callers' call shape
 * (`handleChatNavClick(e, runtime, {href,path,targetPlatform}, fallbackNavigate)`)
 * keeps working unchanged. New code should call `executeNavigation` directly.
 * The decision tree (empty-href no-op, modifier/non-primary passthrough,
 * new-tab via openExternal/window.open, same-tab via navigate→fallback→
 * window.location) lives ONCE in `executeNavigation` now.
 */

import { executeNavigation, type NavClickEvent } from './execute-navigation'
import type { ChatRuntime } from '../../../contexts/chat-runtime-context'

export interface ChatNavClickInput {
  href: string
  path?: string | null
  targetPlatform?: string | null
}

export function handleChatNavClick(
  e: NavClickEvent,
  runtime: ChatRuntime,
  { href, path, targetPlatform }: ChatNavClickInput,
  /** Host-router fallback for same-origin soft-nav when the runtime does NOT
   *  wire `navigation.navigate` (pass `useRouter().push`). */
  fallbackNavigate?: (path: string) => void,
): boolean {
  return executeNavigation({ event: e, runtime, href, path, targetPlatform, fallbackNavigate })
}
