/**
 * Pure helpers for the new-tab decision + anchor attribute pair used
 * by chat-rendered links.
 *
 * After the navigation unification (ChatCardLoader pre-resolves
 * `chatRef.url` via `resolveSourceRowCTA` + `resolveHrefForRuntime`,
 * and `ChatCardNavWrap` handles every primary click via `onClickCapture`
 * → `executeNavigation`), the per-card wrapper only needs
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

import type { ChatRuntime } from '../../../contexts/chat-runtime-context';
import { resolveHrefForRuntime } from './chat-nav-resolution';
import { decideNewTab as libDecideNewTab } from './decide-new-tab';
import { isRelativeHref, newTabRel, type NewTabRel } from './new-tab-rel';

/** An ABSOLUTE `http(s)` URL on the current page's origin. Relative hrefs return
 *  false (in embed mode they're hub-relative, not in-app), as do cross-origin
 *  and non-http URLs. SSR-safe: no `window` → false. */
export function isSameOriginAbsoluteHref(href: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    // Origin off `location.href`, not `location.origin`: jsdom leaves the latter
    // undefined, which reads as "every URL is foreign" under test.
    return new URL(href).origin === new URL(window.location.href).origin;
  } catch {
    return false;
  }
}

export function computeIsNewTab(
  runtime: ChatRuntime,
  href: string | null | undefined,
  targetPlatform: string | null,
): boolean {
  if (!href) return false;
  if (runtime.navigation.mode === 'embed') return !isSameOriginAbsoluteHref(href);
  return (
    runtime.navigation.decideNewTab?.({ href, targetPlatform }) ??
    libDecideNewTab({
      href,
      targetPlatform,
      currentSource: runtime.source ?? '',
    })
  );
}

/** A caller's explicit tab for a link (an admin preview always opens a new tab); absent = the rule decides. */
export type NavOpenIn = 'new-tab' | 'same-tab';

/** Where a chat link goes: its href as the runtime resolves it, and whether it opens in a new tab. */
export interface NavLinkTarget {
  href: string;
  isNewTab: boolean;
}

/**
 * THE navigation decision for every link the lib renders or follows: the href resolved for the runtime
 * (`resolveHrefForRuntime`) and the new-tab rule on that resolved href (`computeIsNewTab`). Anchors
 * (`useNavLinkTarget` / `useNavLinkViaRuntime`), cards, chips, search results and the click executor
 * (`executeNavigation`) all read it; nothing else calls `computeIsNewTab` or `decideNewTab` (a test fails if it does).
 * Without a runtime there is no embed or host rule to apply: the href as given, decided by the lib's default rule
 * (the caller's `openIn`, else another origin opens a new tab).
 *
 * `hostRoute`: the host's `composeContentUrl` returned this href as a RELATIVE route of its own (a type it serves
 * in-app). It is the host's page, not the hub's, so it is never resolved against the hub's origin and stays in this
 * tab in any mode (in embed mode a relative href is otherwise taken as hub-relative), unless the caller asks for a new
 * tab itself (`openIn: 'new-tab'`).
 *
 * `openIn`: the caller names the tab itself (an admin preview always opens a new one). The embed rule still comes
 * first: an embedded guest never navigates its host page to the hub.
 */
export function navLinkTarget(
  runtime: ChatRuntime | null | undefined,
  href: string,
  targetPlatform?: string | null,
  { hostRoute = false, openIn }: { hostRoute?: boolean; openIn?: NavOpenIn } = {},
): NavLinkTarget {
  if (!runtime) return { href, isNewTab: libDecideNewTab({ href, openIn, currentSource: '' }) };
  if (hostRoute && isRelativeHref(href)) return { href, isNewTab: openIn === 'new-tab' };
  const resolved = resolveHrefForRuntime(href, runtime);
  const isNewTab =
    runtime.navigation.mode !== 'embed' && openIn
      ? openIn === 'new-tab'
      : computeIsNewTab(runtime, resolved, targetPlatform ?? null);
  return { href: resolved, isNewTab };
}

/**
 * Returns the `target` + `rel` attribute pair for an inner `<a>` based
 * on the new-tab decision. Spread directly into JSX:
 *   <a href={href} {...newTabAnchorAttrs(isNewTab)} />
 *
 * Single helper so anchors stay consistent: a new-tab link pairs `_blank` with the one referrer rule
 * (`newTabRel`: `noopener` always, `noreferrer` for a third party) and a same-tab link renders neither.
 */
export function newTabAnchorAttrs(
  isNewTab: boolean,
  href?: string | null,
  targetPlatform?: string | null,
): {
  target?: '_blank';
  rel?: NewTabRel;
} {
  return isNewTab ? { target: '_blank' as const, rel: newTabRel(href, targetPlatform) } : {};
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
  targetPlatform?: string | null,
): { href: string; target?: '_blank'; rel?: NewTabRel } | undefined {
  return href ? { href, ...newTabAnchorAttrs(isNewTab, href, targetPlatform) } : undefined;
}
