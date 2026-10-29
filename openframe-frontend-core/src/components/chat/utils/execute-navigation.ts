'use client';

/**
 * THE single navigation-EXECUTION primitive for the whole lib.
 *
 * Link BUILDING is unified by `composeContentUrl`; the new-tab DECISION is
 * `navLinkTarget` (nav-anchor-props). This is the third leg: ONE place
 * that EXECUTES a navigation — new tab or same tab, in the app through the host's
 * `runtime.navigation.navigate`, or by the browser when the host does not take it.
 * Every surface routes through it:
 *   - chat cards / chips / markdown links → `executeNavigation` (click form),
 *     via the thin `handleChatNavClick` wrapper.
 *   - buttons / page rows / form redirects → `executeNavigationImperative` directly.
 *
 * Decision tree (the SAME one `handleChatNavClick` used — copied verbatim so
 * behavior is byte-identical; the hub's chat-click behavior MUST NOT change):
 *   1. empty href → no-op (click form preventDefaults + reports handled)
 *   2. (click form) modifier / non-primary button → NOT handled — let the
 *      browser do its native thing (`<a>` opens a new tab, etc.)
 *   3. `navLinkTarget(...).isNewTab` true → `runtime.navigation.openExternal(href)` else
 *      `window.open(href, '_blank', noopener,noreferrer)`
 *   4. else (same-tab) → `runtime.navigation.navigate({href,path,targetPlatform})`,
 *      the host's in-app navigation (every host wires it); a target the host does
 *      not take (another origin) is a browser navigation, `window.location.assign`.
 *
 * `runtime` is nullable: a surface with no `ChatRuntimeContext` mounted has no
 * host navigation, so its links are browser navigations.
 */

import type { ChatRuntime } from '../../../contexts/chat-runtime-context';
import { navigateSamePageHash, STICKY_HEADER_OFFSET_PX } from '../../../utils/same-page-hash-nav';
import { NEW_TAB_FEATURES, stripSameOriginToPath } from './chat-nav-resolution';
import { isSameOriginAbsoluteHref, navLinkTarget } from './nav-anchor-props';

/** Absolute `http(s)` URL pointing at an origin that is not ours. */
function isForeignOriginHref(href: string): boolean {
  return /^https?:\/\//i.test(href) && !isSameOriginAbsoluteHref(href);
}

/** Minimal mouse-event surface — structural so chip buttons / tiles can call it
 *  without casting `React.MouseEvent`. */
export interface NavClickEvent {
  preventDefault(): void;
  button?: number;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface ExecuteNavigationClickArgs {
  event: NavClickEvent;
  runtime: ChatRuntime | null | undefined;
  href: string;
  path?: string | null;
  targetPlatform?: string | null;
  /** The host's `composeContentUrl` returned `href` as its own relative route (see `navLinkTarget`). */
  hostRoute?: boolean;
}

export interface ExecuteNavigationImperativeArgs {
  runtime: ChatRuntime | null | undefined;
  href: string;
  /** Doc-tree path, for a host that swaps a mounted doc viewer in place (`runtime.navigation.navigate`). */
  path?: string | null;
  targetPlatform?: string | null;
  /** The host's `composeContentUrl` returned `href` as its own relative route (see `navLinkTarget`). */
  hostRoute?: boolean;
}

/** Core: make the new-tab decision (when a runtime is present) and execute. */
function runNavigation(
  runtime: ChatRuntime | null | undefined,
  href: string,
  path: string | null | undefined,
  targetPlatform: string | null | undefined,
  hostRoute?: boolean,
): void {
  // THE navigation decision (no runtime → same tab).
  const { isNewTab } = navLinkTarget(runtime, href, targetPlatform, { hostRoute });
  if (isNewTab) {
    if (runtime?.navigation.openExternal) runtime.navigation.openExternal(href);
    else window.open(href, '_blank', NEW_TAB_FEATURES);
    return;
  }
  // A FOREIGN href that the host's `decideNewTab` routed same-tab must reach the
  // router whole: stripping its origin pushes `/webinars/x` onto OUR origin and
  // 404s. Same-origin absolutes still get stripped, so an in-app soft nav stays
  // one. (`stripSameOriginToPath` itself strips unconditionally on purpose — the
  // hub is one app across several origins and depends on that.)
  const target = isForeignOriginHref(href) ? href : stripSameOriginToPath(href);
  // Same-page hash target (e.g. a chat card deep-linking to `/faqs#faq-item-49`):
  // route through the UNIFIED same-page-hash primitive FIRST. A host router /
  // `router.push` performs `pushState`, which the HTML spec says does NOT fire a
  // `hashchange` event — so URL-hash-bound listeners (FAQ auto-expand,
  // `useScrollToHash`) never react on a SOFT same-page nav and the cited row
  // neither opens nor scrolls. `navigateSamePageHash` does the pushState AND
  // dispatches the synthetic `hashchange` (+ anchoring-proof scroll). It returns
  // false for cross-page targets (different pathname/search) — those fall through
  // to the host's navigation below, which mounts the new route where the hash is
  // read fresh on first render.
  if (target.includes('#') && navigateSamePageHash(target, { headerOffset: STICKY_HEADER_OFFSET_PX })) {
    return;
  }
  if (!runtime?.navigation.navigate?.({ href, path, targetPlatform })) window.location.assign(target);
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
  hostRoute,
}: ExecuteNavigationClickArgs): boolean {
  if (!href) {
    event.preventDefault();
    return true;
  }
  // Modifier / non-primary clicks → NOT handled; let the browser do its native thing.
  // Deliberately NOT the shared `isModifierClick` (chat-nav-resolution): that predicate
  // treats an UNDEFINED `button` as a modifier (`button !== 0`), but a structural
  // NavClickEvent from a chip tile may omit `button` and MUST be a primary click (navigate).
  if (event.button !== undefined && event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  event.preventDefault();
  runNavigation(runtime, href, path, targetPlatform, hostRoute);
  return true;
}

/**
 * Imperative form — for buttons, list-row onClicks, and post-action redirects
 * that aren't anchor clicks. Same decision tree, no event/modifier handling.
 */
export function executeNavigationImperative({
  runtime,
  href,
  path,
  targetPlatform,
  hostRoute,
}: ExecuteNavigationImperativeArgs): void {
  runNavigation(runtime, href, path, targetPlatform, hostRoute);
}

/**
 * @deprecated Call {@link executeNavigation} directly. Kept only so external
 * embedders' imports keep resolving; no lib code path goes through it.
 */
export function handleChatNavClick(
  event: NavClickEvent,
  runtime: ChatRuntime | null | undefined,
  { href, path, targetPlatform }: ChatNavClickInput,
): boolean {
  return executeNavigation({ event, runtime, href, path, targetPlatform });
}

/** @deprecated Argument shape of the deprecated {@link handleChatNavClick}. */
export interface ChatNavClickInput {
  href: string;
  path?: string | null;
  targetPlatform?: string | null;
}
