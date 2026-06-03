'use client'

/**
 * Lib-side `<a>` wrapper for chat-rendered links (markdown bodies,
 * source-chip drill-ins, inline references).
 *
 * Reads the active `ChatRuntime` and routes clicks through
 * `handleChatNavClick`. Same single-source rules as source chips and
 * inline cards:
 *   - new-tab decision via `computeIsNewTab` (embed-mode short-circuit
 *     + `runtime.navigation.decideNewTab` + lib fallback)
 *   - `target` / `rel` via `newTabAnchorAttrs`
 *   - same-tab click → close the chat panel (via `ChatPanelContext`);
 *     new-tab click → leave panel open while the new tab loads
 *
 * Chat-only contract: uses `useRequiredChatRuntime`, which THROWS when
 * mounted outside a `<ChatRuntimeContext.Provider>`. That's by design —
 * the lib should never silently fall back when the runtime is missing
 * (the chat tree always provides one in both host + embed modes).
 *
 * For surfaces OUTSIDE the chat tree (header chrome, marketing pages, …)
 * the hub keeps its own `useNavLink`-based anchor.
 */

import type { ReactNode, MouseEvent } from 'react'
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context'
import { handleChatNavClick } from './utils/nav-click-handler'
import { resolveHrefForRuntime } from './utils/chat-nav-resolution'
import { computeIsNewTab, newTabAnchorAttrs } from './utils/nav-anchor-props'
import { useChatPanel } from './chat-panel-context'

export interface NavLinkAnchorViaRuntimeProps {
  href: string
  path?: string | null
  targetPlatform?: string | null
  className?: string
  /** Optional — matches `NavLinkAnchorComponent`'s contract so the
   *  markdown-anchor slot can render an empty anchor (rare but legal). */
  children?: ReactNode
}

export function NavLinkAnchorViaRuntime({
  href,
  path,
  targetPlatform,
  className,
  children,
}: NavLinkAnchorViaRuntimeProps) {
  const runtime = useRequiredChatRuntime()
  const panel = useChatPanel()
  const resolvedHref = resolveHrefForRuntime(href, runtime)
  const isNewTab = computeIsNewTab(runtime, resolvedHref, targetPlatform ?? null)

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const handled = handleChatNavClick(e, runtime, {
      href: resolvedHref,
      path,
      targetPlatform,
    })
    if (handled && !isNewTab && panel?.closeChat) panel.closeChat()
  }
  return (
    <a
      href={resolvedHref}
      {...newTabAnchorAttrs(isNewTab)}
      onClick={onClick}
      className={className}
    >
      {children}
    </a>
  )
}
