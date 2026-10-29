'use client';

/**
 * Lib-side `<a>` wrapper for chat-rendered links (markdown bodies,
 * source-chip drill-ins, inline references).
 *
 * Reads the active `ChatRuntime` and routes clicks through
 * `handleChatNavClick`. Same single-source rules as source chips and
 * inline cards:
 *   - new-tab decision via `navLinkTarget` (embed-mode short-circuit
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

import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode, useCallback } from 'react';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import { useChatPanel } from './chat-panel-context';
import { isModifierClick } from './utils/chat-nav-resolution';
import { executeNavigation, executeNavigationImperative, executeNewTabNavigation } from './utils/execute-navigation';
import { type NavLinkTarget, type NavOpenIn, navLinkTarget, newTabAnchorAttrs } from './utils/nav-anchor-props';
import type { NewTabRel } from './utils/new-tab-rel';

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

export interface NavLinkViaRuntimeInput<Href extends string | null | undefined = string> {
  /** The destination; with none (null / undefined) the hook returns null and the caller draws no link. */
  href: Href;
  path?: string | null;
  /** The platform that owns `href`, by name. */
  targetPlatform?: string | null;
  /** The caller's explicit tab (an admin preview always opens a new one); absent = the rule decides. */
  openIn?: NavOpenIn;
  /** Runs before the navigation; `preventDefault()` cancels it. */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface NavLinkViaRuntimeProps {
  href: string;
  target?: '_blank';
  rel?: NewTabRel;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}

/** The navigation decision ({@link navLinkTarget}) for a link rendered inside the chat runtime. */
export function useNavLinkTarget(href: string, targetPlatform?: string | null, openIn?: NavOpenIn): NavLinkTarget {
  return navLinkTarget(useRequiredChatRuntime(), href, targetPlatform, { openIn });
}

/**
 * The anchor props of {@link NavLinkAnchorViaRuntime}, for an element that is
 * not a bare `<a>` (a `Button`'s `linkProps`). ONE decision and ONE click
 * handler for both forms.
 *
 * A new-tab link to one of our own sites keeps the Referer (`newTabRel`: the
 * cross-domain analytics attribute the visit by it); any other gets `noreferrer`.
 */
export function useNavLinkViaRuntime(input: NavLinkViaRuntimeInput): NavLinkViaRuntimeProps;
export function useNavLinkViaRuntime(
  input: NavLinkViaRuntimeInput<string | null | undefined>,
): NavLinkViaRuntimeProps | null;
export function useNavLinkViaRuntime({
  href,
  path,
  targetPlatform,
  openIn,
  onClick: onClickProp,
}: NavLinkViaRuntimeInput<string | null | undefined>): NavLinkViaRuntimeProps | null {
  const runtime = useRequiredChatRuntime();
  const panel = useChatPanel();
  const { href: resolvedHref, isNewTab } = useNavLinkTarget(href ?? '', targetPlatform, openIn);
  if (href == null) return null;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClickProp?.(e);
    if (e.defaultPrevented) return;
    const handled = executeNavigation({ event: e, runtime, href: resolvedHref, path, targetPlatform, openIn });
    if (handled && !isNewTab && panel?.closeChat) panel.closeChat();
  };
  return { href: resolvedHref, ...newTabAnchorAttrs(isNewTab, resolvedHref, targetPlatform), onClick };
}

/** What {@link useNavigateViaRuntime}'s function is told to follow. */
export interface NavigateViaRuntimeInput {
  href: string | null | undefined;
  path?: string | null;
  /** The platform that owns `href`, by name. */
  targetPlatform?: string | null;
  /** The caller's explicit tab; absent = the rule decides. */
  openIn?: NavOpenIn;
  /** The click that asked, when there was one: a modifier click opens a new tab, a middle click is the browser's. */
  modifierEvent?: {
    button?: number;
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
  } | null;
}

/**
 * Follow a link from code (a button, a card's click, a redirect after a save): the same decision and the same executor
 * as {@link useNavLinkViaRuntime}, for an element that is not an anchor.
 */
export function useNavigateViaRuntime(): (input: NavigateViaRuntimeInput) => void {
  const runtime = useRequiredChatRuntime();
  return useCallback(
    ({ href, path, targetPlatform, openIn, modifierEvent }: NavigateViaRuntimeInput) => {
      if (!href) return;
      if (modifierEvent && isModifierClick(modifierEvent)) {
        // Not an anchor, so the browser opens nothing itself: a modifier click asks for a new tab.
        if (modifierEvent.button === undefined || modifierEvent.button === 0) {
          executeNewTabNavigation({ runtime, href, targetPlatform });
        }
        return;
      }
      executeNavigationImperative({ runtime, href, path, targetPlatform, openIn });
    },
    [runtime],
  );
}

export function NavLinkAnchorViaRuntime({
  href,
  path,
  targetPlatform,
  className,
  children,
  onClick,
  ...anchorAttrs
}: NavLinkAnchorViaRuntimeProps) {
  const linkProps = useNavLinkViaRuntime({ href, path, targetPlatform, onClick });
  return (
    <a {...linkProps} {...anchorAttrs} className={className}>
      {children}
    </a>
  );
}
