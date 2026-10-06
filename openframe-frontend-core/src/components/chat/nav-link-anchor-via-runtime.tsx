'use client';

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
 * The same component serves a host's own chrome and pages (site header,
 * footer, call-to-action links): the host mounts the runtime app-wide, names
 * the destination's platform in `targetPlatform`, and may pass its own
 * `onClick` (it runs first; `preventDefault()` cancels the navigation) and
 * plain anchor attributes (`aria-*`, `title`, `data-*`, `style`, `rel`).
 */

import type { AnchorHTMLAttributes, ReactNode, MouseEvent } from 'react';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import { useRouter } from '../../embed-shims/next-navigation';
import { useChatPanel } from './chat-panel-context';
import { resolveHrefForRuntime } from './utils/chat-nav-resolution';
import { executeNavigation } from './utils/execute-navigation';
import { computeIsNewTab, newTabAnchorAttrs } from './utils/nav-anchor-props';

export interface NavLinkAnchorViaRuntimeProps extends Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'target' | 'onClick' | 'className' | 'children'
> {
  href: string;
  path?: string | null;
  targetPlatform?: string | null;
  className?: string;
  /** Optional — matches `NavLinkAnchorComponent`'s contract so the
   *  markdown-anchor slot can render an empty anchor (rare but legal). */
  children?: ReactNode;
  /** Runs before the navigation; `preventDefault()` cancels it. */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export function NavLinkAnchorViaRuntime({
  href,
  path,
  targetPlatform,
  className,
  children,
  onClick: onClickProp,
  ...anchorAttrs
}: NavLinkAnchorViaRuntimeProps) {
  const runtime = useRequiredChatRuntime();
  const router = useRouter();
  const panel = useChatPanel();
  const resolvedHref = resolveHrefForRuntime(href, runtime);
  const isNewTab = computeIsNewTab(runtime, resolvedHref, targetPlatform ?? null);

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClickProp?.(e);
    if (e.defaultPrevented) return;
    const handled = executeNavigation({
      event: e,
      runtime,
      href: resolvedHref,
      path,
      targetPlatform,
      fallbackNavigate: router.push,
    });
    if (handled && !isNewTab && panel?.closeChat) panel.closeChat();
  };
  return (
    <a href={resolvedHref} {...newTabAnchorAttrs(isNewTab)} {...anchorAttrs} onClick={onClick} className={className}>
      {children}
    </a>
  );
}
