'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, RefObject } from 'react';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { useLocalStorage } from '../../hooks/ui/use-local-storage';
import { useLgUp, useMdUp } from '../../hooks/ui/use-media-query';
import { useResizablePanelSize } from '../../hooks/ui/use-resizable-panel-size';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../../types/navigation';
import { cn } from '../../utils';
import { PanelResizeGrip, PanelResizeHandle } from '../ui/panel-resize-handle';
import { NAVIGATION_SIDEBAR_ATTRIBUTE } from './app-layout-context';
import {
  NavigationSidebarGroupedEntries,
  NavigationSidebarGroupedSkeleton,
  useOpenNavigationGroup,
  useOpenNavigationGroups,
} from './navigation-sidebar-grouped';
import { NavigationSidebarHeader } from './navigation-sidebar-header';
import { NavigationSidebarItemButton } from './navigation-sidebar-item';
import { resolveNavigationActive } from './navigation-sidebar-match';
import {
  NavigationSidebarSectionedEntries,
  SECTIONED_PRIMARY_NAV_CLASSES,
  useFoldedNavigationSections,
} from './navigation-sidebar-sectioned';
import { hasNavigationSidebarSlot, renderNavigationSidebarSlot } from './navigation-sidebar-slot';
import { NavigationSidebarIconToggle, NavigationSidebarToggle } from './navigation-sidebar-toggle';

const MINIMIZED_WIDTH = 56; // 3.5rem = 56px
const EXPANDED_WIDTH = 224; // 14rem = 224px — the default; a grouped config may set its own
/** The narrowest custom `expandedWidth`: the rows read 140px and up as expanded. */
const MIN_CUSTOM_EXPANDED_WIDTH = 141;
/**
 * Px of its row a resizable sidebar leaves to the content beside it
 * (`NavigationSidebarResizeConfig.minContentWidth`): the `content-md`
 * breakpoint, under which page content lays out for a phone.
 */
const DEFAULT_MIN_CONTENT_WIDTH = 720;
const STORAGE_KEY = 'of.navigationSidebar.minimized';

/**
 * The desktop width, as a custom property on `:root`. Read by the `lg:` rule in
 * {@link SIDEBAR_GEOMETRY_CLASSES} and written by this component whenever the
 * user toggles — but NEVER during render.
 *
 * It has to be a global variable rather than an inline style because of WHEN the
 * value is knowable. The width follows a preference in `localStorage`, which the
 * server cannot read: any markup derived from it differs between the server's
 * HTML and the client's hydration render, and React tears the tree down and
 * regenerates it. Seeding this property from a tiny script in `<head>` moves the
 * preference OUT of React's rendered output — the markup becomes identical on
 * both sides, while the width is already correct on the very first paint.
 *
 * Consumers are expected to seed it before first paint; unseeded, the fallback
 * in the class below paints the expanded width until this component's effect
 * catches up, which is the flash the seed exists to remove.
 */
export const NAVIGATION_SIDEBAR_WIDTH_VAR = '--of-navigation-sidebar-width';

/**
 * The desktop width of a `side: 'right'` sidebar — {@link NAVIGATION_SIDEBAR_WIDTH_VAR}
 * for the other edge. Its own property, so a layout with a sidebar on each side
 * seeds and publishes two widths instead of one overwriting the other.
 */
export const NAVIGATION_SIDEBAR_END_WIDTH_VAR = '--of-navigation-sidebar-end-width';

/**
 * A grouped config's own `expandedWidth`, as an inline custom property on the
 * sidebar and its tablet push slot. Unlike the width above it is a prop, the
 * same on the server and the client, so it can sit in the markup: the tablet
 * overlay, the push slot and the desktop fallback read it on the first paint.
 * Set only when the config gives a width, so a config without one renders the
 * literal classes it always did.
 */
const EXPANDED_WIDTH_VAR = '--of-navigation-sidebar-expanded-width';

/**
 * The rail as a query container, so the parts of the sidebar that follow its
 * collapsed state can read that state off the rail's own width — currently the
 * collapse chevron's direction, in `navigation-sidebar-toggle.tsx`.
 *
 * There is no second source of truth for "is it collapsed", and that is the
 * point: the width already has to be correct on the first paint and at every
 * breakpoint, so anything derived from it is too — the seeded desktop
 * preference, the tablet rail and an overlay opened on tablet all come along for
 * free. A parallel copy would have to be kept in step with each of the three
 * separately, and the custom property that used to live here fell out of step on
 * the last one: it could not see the tablet rail, so that case got its own media
 * query, which in turn could not see an open overlay and pointed the chevron
 * backwards under it.
 *
 * Queried as `@[140px]/of-nav-sidebar:` — 140px is the midpoint between the 56px
 * rail and the 224px expanded sidebar, so the width only crosses it mid-toggle
 * (a custom `expandedWidth` is kept above it).
 * Container queries are min-width, so a follower styles its COLLAPSED look as the
 * default and lets the query take it back. Written out literally at each use
 * rather than interpolated from a constant: Tailwind scans source text, and a
 * class it cannot see spelled out is a class it never generates.
 */
const SIDEBAR_CONTAINER = '@container/of-nav-sidebar';

/**
 * Where the sidebar sits and how wide it is, per breakpoint — as literal classes,
 * because this cannot be decided in JavaScript in time.
 *
 * `useMdUp`/`useLgUp` answer `undefined` until an effect has run, so `isTablet`
 * is false on the first render — the SERVER's render included. A tablet
 * therefore received the desktop branch in its HTML (`relative`, `width:224px`,
 * an inline style no class could outrank) and only snapped to the 56px rail once
 * hydration and an effect had both completed. That is the wide sidebar that
 * flashed on every load, and no amount of JS could fix it: the server has no
 * viewport to consult, so the answer has to be deferred to the one consumer that
 * always knows — the browser's own media evaluation.
 *
 * The state that a viewport CANNOT determine still lives outside the render: the
 * persisted desktop preference reaches the `lg:` rule through
 * {@link NAVIGATION_SIDEBAR_WIDTH_VAR}. An inline width would be simpler than a
 * custom property, but it would also override the tablet rail on the very first
 * paint, which is the bug being fixed.
 *
 * The tablet WIDTH is deliberately not here — see {@link SIDEBAR_TABLET_WIDTH}.
 *
 * Widths are `w-14`/`w-56` — the class equivalents of `MINIMIZED_WIDTH` and
 * `EXPANDED_WIDTH`, as is the `14rem` fallback below. Keep them in step; a class
 * string cannot interpolate a constant.
 */
const SIDEBAR_POSITION_CLASSES = [
  // Tablet: float over the content, anchored to the layout row (`absolute`
  // within AppLayout's `relative` row) — NOT the viewport — so an optional
  // `topBar` above the row is not overlapped. With no topBar the row spans the
  // full viewport, so this is visually identical to a viewport-fixed sidebar.
  'md:absolute md:inset-y-0 md:z-[45]',
  // Desktop: back in the flex flow, width from the persisted preference.
  'lg:relative lg:inset-auto lg:z-auto lg:h-full',
];
const SIDEBAR_GEOMETRY_CLASSES = {
  left: {
    // The fallback IS the default, so the property needs no global declaration
    // and an unseeded consumer gets the full sidebar rather than a rail with no
    // labels.
    default: [...SIDEBAR_POSITION_CLASSES, 'md:left-0', 'lg:w-[var(--of-navigation-sidebar-width,14rem)]'].join(' '),
    // With a config width the fallback is that width (`EXPANDED_WIDTH_VAR`).
    custom: [
      ...SIDEBAR_POSITION_CLASSES,
      'md:left-0',
      'lg:w-[var(--of-navigation-sidebar-width,var(--of-navigation-sidebar-expanded-width))]',
    ].join(' '),
  },
  // `side: 'right'`: the other edge, and its own width property
  // (`NAVIGATION_SIDEBAR_END_WIDTH_VAR`), spelled out for Tailwind's scan.
  right: {
    default: [...SIDEBAR_POSITION_CLASSES, 'md:right-0', 'lg:w-[var(--of-navigation-sidebar-end-width,14rem)]'].join(
      ' ',
    ),
    custom: [
      ...SIDEBAR_POSITION_CLASSES,
      'md:right-0',
      'lg:w-[var(--of-navigation-sidebar-end-width,var(--of-navigation-sidebar-expanded-width))]',
    ].join(' '),
  },
} as const;

/**
 * `config.overlay`: the tablet geometry at every width from md up — no `lg:` rule puts
 * the sidebar back in the flow or gives it the desktop width, so the tablet width
 * classes below decide (the rail, or the overlay the user opened).
 */
const SIDEBAR_OVERLAY_GEOMETRY_CLASSES = {
  left: 'md:absolute md:inset-y-0 md:z-[45] md:left-0',
  right: 'md:absolute md:inset-y-0 md:z-[45] md:right-0',
} as const;

/**
 * The tablet width, as ONE `md:` class rather than a rail plus an override.
 *
 * Tablet is a 56px rail by design and only widens for an overlay the user has
 * opened — state no viewport can imply, so it has to come from JS. Written as
 * `md:w-14` + `max-lg:w-56` the two rules both match between md and lg at equal
 * specificity, and Tailwind emits the `max-lg` block BEFORE the `md` one, so
 * source order hands the tablet straight back to the rail. Picking one class
 * removes the contest instead of trying to win it — and keeps the `!important`
 * that winning it would need out of the tree.
 *
 * `lg:` still governs desktop either way: it is emitted after `md:`, so an
 * overlay left open while the window widens does not leak into the desktop width.
 */
const SIDEBAR_TABLET_WIDTH = {
  rail: 'md:w-14',
  overlay: 'md:w-56',
  customOverlay: 'md:w-[var(--of-navigation-sidebar-expanded-width)]',
} as const;

/**
 * The width of the sidebar's row — its parent, the room it shares with the
 * content — for the resize clamp. 0 until measured, and when there is nothing to
 * measure (not resizable, no parent, the server).
 */
function useRowWidth(asideRef: RefObject<HTMLElement | null>, enabled: boolean): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const row = enabled ? asideRef.current?.parentElement : null;
    if (!row) return undefined;
    const update = () => setWidth(row.clientWidth);
    update();
    // An environment without ResizeObserver (jsdom in a consumer's tests) measures once.
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [asideRef, enabled]);
  return width;
}

/** A click the browser will resolve itself — new tab, new window, middle button. */
export const isModifiedClick = (event?: MouseEvent): boolean =>
  !!event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0);

export interface NavigationSidebarProps {
  config: NavigationSidebarConfig;
  /**
   * When true, all navigation items are disabled and visually dimmed.
   * The collapse/expand toggle button remains interactive.
   */
  disabled?: boolean;
  /**
   * On tablet, open the expanded sidebar beside the content instead of over
   * it: the slot it holds widens with it and there is no scrim. A layout with
   * a docked side panel needs the content's real width to change. Default
   * false (overlay).
   */
  pushOnTablet?: boolean;
  /**
   * Animate the width where it moves the content (the desktop rail, the tablet
   * slot with `pushOnTablet`). Default true. `AppLayout` turns it off while the
   * page column is a size container (a side panel or a composer dock): each frame
   * of the transition then re-evaluated the page's `content-*` container queries,
   * ~25 ms of layout per frame on a large page in WebKit, so there the width snaps.
   * The tablet overlay still slides: it floats over the content.
   */
  animateWidth?: boolean;
}

export function NavigationSidebar({
  config,
  disabled = false,
  pushOnTablet = false,
  animateWidth = true,
}: NavigationSidebarProps) {
  const isMdUp = useMdUp() ?? false;
  const isLgUp = useLgUp() ?? false;

  // Tablet = md viewport but not lg. On tablet the sidebar floats over the
  // content area (overlay) instead of pushing it like on desktop. `config.overlay`
  // asks for that form on desktop too (the host keeps its content wide enough).
  // `'drawer'`: no rail either, from md up — closed it takes no room.
  const drawer = config.overlay === 'drawer' && isMdUp;
  const forcedOverlay = (config.overlay === true && isLgUp) || drawer;
  const isTablet = (isMdUp && !isLgUp) || forcedOverlay;

  // The edge it stands on (`config.side`), and the width property that goes with it.
  const side = config.side ?? 'left';
  // `surface: 'panel'`: the shell's panel ground; a left panel's borders are the subtle ones.
  const panel = config.surface === 'panel';
  const dividerClass = panel && side === 'left' ? 'border-ods-border-panel' : 'border-ods-border';
  const widthVar = side === 'right' ? NAVIGATION_SIDEBAR_END_WIDTH_VAR : NAVIGATION_SIDEBAR_WIDTH_VAR;

  // Desktop preference persists across sessions. Tablet state is in-memory
  // only so entering tablet always starts minimized without clobbering the
  // user's desktop choice.
  const [storedMinimized, setStoredMinimized] = useLocalStorage<boolean>(STORAGE_KEY, config.minimized ?? false);
  const [tabletMinimized, setTabletMinimized] = useState(true);

  // Controlled collapse (`config.collapsed`) replaces the persisted desktop
  // preference — the store is still read (hooks run unconditionally) but never
  // consulted or written. The tablet overlay stays this component's own.
  const isControlled = config.collapsed !== undefined;
  const desktopMinimized = isControlled ? (config.collapsed ?? false) : storedMinimized;

  // A CHANGE of the controlled value is also a command for the tablet overlay:
  // `false` opens it, `true` closes it — so a host can reveal the sidebar from
  // anywhere (⌘K) at every width without the overlay ever writing back into the
  // host's desktop preference. Adjusted while rendering, like the reset below.
  const [collapsedSeen, setCollapsedSeen] = useState(config.collapsed);
  if (collapsedSeen !== config.collapsed) {
    setCollapsedSeen(config.collapsed);
    if (isTablet && config.collapsed !== undefined) setTabletMinimized(config.collapsed);
  }

  // `revealSignal`: each change shows the expanded sidebar. The tablet overlay
  // is this component's own state, so it opens while rendering, like the
  // `collapsed` command above — and unlike it, also when `collapsed` is already
  // `false`. Desktop is the host's preference (or the stored one): that is
  // written from the effect below, never during render.
  const [revealSeen, setRevealSeen] = useState(config.revealSignal);
  if (revealSeen !== config.revealSignal) {
    setRevealSeen(config.revealSignal);
    if (isTablet && config.revealSignal !== undefined) setTabletMinimized(false);
  }

  // `dismissSignal`: each change closes the overlay; and while the form is forced, so
  // does a new page (the host navigated from inside it).
  const [dismissSeen, setDismissSeen] = useState(config.dismissSignal);
  if (dismissSeen !== config.dismissSignal) {
    setDismissSeen(config.dismissSignal);
    if (isTablet && config.dismissSignal !== undefined) setTabletMinimized(true);
  }
  const [pathSeen, setPathSeen] = useState(config.currentPath);
  if (pathSeen !== config.currentPath) {
    setPathSeen(config.currentPath);
    if (forcedOverlay) setTabletMinimized(true);
  }

  // Entering tablet always starts minimized. Adjusted while rendering — React's
  // documented pattern for a reset driven by a value the render already has —
  // rather than from an effect, which committed the crossover frame with the
  // sidebar still expanded over the content and collapsed it on the pass after.
  const [tabletFor, setTabletFor] = useState(isTablet);
  if (tabletFor !== isTablet) {
    setTabletFor(isTablet);
    if (isTablet) setTabletMinimized(true);
  }

  // `useLocalStorage` reads the store SYNCHRONOUSLY in its initializer, so on the
  // hydration render it already knows a preference the server could not. Anything
  // derived from it — labels, `aria-hidden`, the chevron, the placeholder rows —
  // then differs from the server's HTML, and React throws out the whole tree and
  // regenerates it. So until hydration is done, this renders the server's answer
  // and nothing else.
  //
  // That costs nothing visually. The width is already correct at that point (it
  // comes from the seeded CSS var, not from here), and at the minimized width
  // every label is a `flex-1` in a rail with no room to give — zero-wide whatever
  // this says. What flips on the next commit is opacity and margin on boxes that
  // were never visible.
  const hydrated = useIsHydrated();

  // A controlled value is the host's, identical on both sides of hydration, so it
  // needs no gate; the persisted one does.
  const serverMinimized = isControlled ? desktopMinimized : (config.minimized ?? false);
  const minimized = hydrated ? (isTablet ? tabletMinimized : desktopMinimized) : serverMinimized;

  // Enable transitions only after the correct width is painted
  const [transitionsEnabled, setTransitionsEnabled] = useState(false);

  // A grouped config's own expanded width (`expandedWidth`); `null` = the
  // default 224px through the literal classes, exactly as before.
  const configExpandedWidth =
    (config.variant === 'grouped' || config.variant === 'sectioned') && config.expandedWidth !== undefined
      ? Math.max(config.expandedWidth, MIN_CUSTOM_EXPANDED_WIDTH)
      : null;

  // `config.resizable`: the expanded width is the user's — dragged or stepped on
  // the handle below, kept under the config's storage key — and the config width
  // is where it starts. Clamped to the config's bounds and to the row, so the
  // content beside the rail keeps `minContentWidth`. Not resizable: the config
  // width, and the hook reads and writes nothing.
  const resize = config.resizable;
  const asideRef = useRef<HTMLElement>(null);
  const rowWidth = useRowWidth(asideRef, resize !== undefined);
  const resizeMinWidth = Math.max(resize?.minWidth ?? MIN_CUSTOM_EXPANDED_WIDTH, MIN_CUSTOM_EXPANDED_WIDTH);
  const {
    size: chosenExpandedWidth,
    setSize: setChosenExpandedWidth,
    resetSize: resetChosenExpandedWidth,
    clampSize: clampExpandedWidth,
  } = useResizablePanelSize({
    enabled: resize !== undefined,
    minSize: resizeMinWidth,
    maxSize: resize?.maxWidth ?? Number.POSITIVE_INFINITY,
    defaultSize: configExpandedWidth ?? EXPANDED_WIDTH,
    available: rowWidth,
    reserve: resize?.minContentWidth ?? DEFAULT_MIN_CONTENT_WIDTH,
    storageKey: resize?.storageKey,
  });

  // The desktop width — what the effect below publishes. The chosen width may
  // be used here as soon as it is known: an effect never runs into the SSR HTML.
  const expandedWidth = resize !== undefined ? chosenExpandedWidth : (configExpandedWidth ?? EXPANDED_WIDTH);
  // The width in the MARKUP — the inline custom property on the rail and its
  // tablet slot, which the tablet overlay opens to and the desktop rule falls
  // back on, and the handle's `aria-valuenow`: the chosen width only once
  // hydrated. The server could not read it, and a first client render that
  // differs is a hydration mismatch, which React reports and leaves in the DOM.
  // Until then the config width stands, as for a sidebar that is not resizable;
  // on desktop the seeded width shows throughout, so nothing moves.
  const markupExpandedWidth = hydrated ? chosenExpandedWidth : (configExpandedWidth ?? EXPANDED_WIDTH);
  const customExpandedWidth = resize !== undefined ? markupExpandedWidth : configExpandedWidth;
  const expandedWidthStyle =
    customExpandedWidth === null ? undefined : ({ [EXPANDED_WIDTH_VAR]: `${customExpandedWidth}px` } as CSSProperties);

  // A drag moves the rail's own width property on every pointer move and marks
  // the rail (`data-resizing`, read by a class on it) so its width transition
  // does not trail the pointer; the choice is committed once, on release, which
  // also lifts the mark. Neither write concerns hydration: both run on the
  // client only, once the user has the handle.
  const dragExpandedWidth = useCallback(
    (next: number) => {
      const aside = asideRef.current;
      if (!aside) return;
      aside.setAttribute('data-resizing', '');
      aside.style.setProperty(widthVar, `${Math.round(next)}px`);
    },
    [widthVar],
  );
  const commitExpandedWidth = useCallback(
    (next: number) => {
      asideRef.current?.removeAttribute('data-resizing');
      setChosenExpandedWidth(next);
    },
    [setChosenExpandedWidth],
  );

  // A new expanded width (the host swapped configs — e.g. a placeholder for
  // the grouped tree; a resize committed, stepped or reset on the handle) is a
  // different sidebar, not a toggle: it snaps instead of animating. The
  // transition is dropped in the same commit that moves the width and comes
  // back a frame later (the effect below).
  const [widthFor, setWidthFor] = useState(expandedWidth);
  if (widthFor !== expandedWidth) {
    setWidthFor(expandedWidth);
    setTransitionsEnabled(false);
  }

  const isOverlayOpen = isTablet && !minimized;

  const showLabel = !minimized;

  const handleToggle = useCallback(() => {
    if (isTablet) {
      setTabletMinimized(prev => !prev);
    } else {
      if (!isControlled) setStoredMinimized(prev => !prev);
      config.onCollapsedChange?.(!desktopMinimized);
    }
    config.onToggleMinimized?.();
  }, [isTablet, isControlled, setStoredMinimized, desktopMinimized, config]);

  const closeOverlay = useCallback(() => {
    setTabletMinimized(true);
  }, []);

  // The desktop half of `revealSignal`: expand a collapsed sidebar — through
  // the host when it owns the value, through the stored preference otherwise.
  // Only a CHANGE counts; the value the sidebar mounted with is no command.
  const revealHandledRef = useRef(config.revealSignal);
  const { revealSignal, onCollapsedChange } = config;
  useEffect(() => {
    if (revealHandledRef.current === revealSignal) return;
    revealHandledRef.current = revealSignal;
    if (revealSignal === undefined || isTablet || !isLgUp || !desktopMinimized) return;
    if (!isControlled) setStoredMinimized(false);
    onCollapsedChange?.(false);
  }, [revealSignal, isTablet, isLgUp, desktopMinimized, isControlled, setStoredMinimized, onCollapsedChange]);

  // Dismiss the tablet overlay with Escape so it behaves like a transient panel
  useEffect(() => {
    if (!isOverlayOpen) return undefined;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayOpen, closeOverlay]);

  // The entry the user just clicked, held until the route commits.
  //
  // PENDING IS NOT ACTIVE, and keeping the two apart is the whole point. Active
  // means "this is the page you are on" — it carries the accent bar and
  // `aria-current="page"`, and it stays derived from the pathname, so it is
  // never asserted before it is true. Pending only means "this is the one you
  // clicked": a click deserves an answer, but the answer must not be a claim
  // about where you are. Folding pending into active would light the accent on
  // a section still loading and announce it as the current page to a screen
  // reader — a statement that is simply false until the router says otherwise.
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const grouped = config.variant === 'grouped';
  const sectioned = config.variant === 'sectioned';
  // ONE active entry for the whole tree. Flat: `items.find(isActive)`, exactly
  // as before, unless the host also hands over `currentPath` for entries that
  // leave `isActive` out. Grouped: resolved through the children too, so the
  // committed id — and the pending hint cleared by it — can be a child's.
  const { activeId: committedActiveId, groupId: activeGroupId } = useMemo(
    () =>
      resolveNavigationActive(config.items, { currentPath: config.currentPath, includeChildren: grouped || sectioned }),
    [config.items, config.currentPath, grouped, sectioned],
  );
  const [openGroupId, setOpenGroupId] = useOpenNavigationGroup(activeGroupId);
  // `groupMode: 'multi'`: every group opens and folds on its own (both hooks run; one is read).
  const multiGroups = config.groupMode === 'multi';
  const [openGroupIds, toggleOpenGroup] = useOpenNavigationGroups(activeGroupId, config.groupsStorageKey);
  // `variant: 'sectioned'`: every section open until folded.
  const [foldedSectionIds, toggleSection] = useFoldedNavigationSections(activeGroupId, config.groupsStorageKey);

  // Any committed change clears it — including one that landed somewhere else
  // entirely (a redirect, a link elsewhere on the page). A navigation that never
  // commits leaves a faint hold on the row it started from; because pending is
  // only ever a soft hint, that costs nothing but a stale hover-weight tint,
  // where a stale ACTIVE state would have been a lie about the current page.
  // Adjusted while rendering, not from an effect: the commit that lights the
  // NEW row active is exactly the one that must stop hinting at the old one, and
  // an effect left both marked for a frame.
  const [pendingClearedFor, setPendingClearedFor] = useState(committedActiveId);
  if (pendingClearedFor !== committedActiveId) {
    setPendingClearedFor(committedActiveId);
    setPendingItemId(null);
  }

  const handleItemClick = useCallback(
    (item: NavigationSidebarItem, event?: MouseEvent) => {
      event?.stopPropagation();

      if (item.onClick) {
        item.onClick();
        if (isTablet) setTabletMinimized(true);
        return;
      }

      if (!item.path) return;

      // ⌘/Ctrl/Shift-click and middle-click open the link somewhere else. THIS
      // window is not going anywhere, so the browser is left to it: no
      // preventDefault, no optimistic highlight, no closing the tablet overlay.
      // Entries render as real anchors precisely so those gestures work at all.
      if (isModifiedClick(event)) return;

      // A plain click stays the host's to perform, through `onNavigate` exactly
      // as before — the anchor is here for the href (Next prefetches links in the
      // viewport) and for the browser affordances, not to take over routing.
      //
      // `onNavigate` is optional, though, and with no host router there is nothing
      // to hand the click to: swallowing it would leave a real anchor, with a real
      // href, that does nothing at all. So the guard is on having somewhere to
      // send it — otherwise the anchor navigates on its own and we only close the
      // overlay behind it.
      if (config.onNavigate) {
        event?.preventDefault();
        // Re-clicking the page you are already on starts no navigation, so there
        // is nothing to mark — and nothing would ever clear it, since the
        // committed active id is not about to change.
        if (item.id !== committedActiveId) setPendingItemId(item.id);
        config.onNavigate(item.path);
      }

      if (isTablet) setTabletMinimized(true);
    },
    [config, isTablet, committedActiveId],
  );

  // A group parent (grouped variant) only opens and folds; it goes nowhere. The
  // one-open rule closes whichever group was open.
  const handleGroupClick = useCallback(
    (item: NavigationSidebarItem) => {
      if (sectioned) toggleSection(item.id);
      else if (multiGroups) toggleOpenGroup(item.id);
      else setOpenGroupId(current => (current === item.id ? null : item.id));
    },
    [sectioned, toggleSection, multiGroups, toggleOpenGroup, setOpenGroupId],
  );

  const { primaryItems, secondaryItems } = useMemo(
    () => ({
      primaryItems: config.items.filter(item => item.section !== 'secondary'),
      secondaryItems: config.items.filter(item => item.section === 'secondary'),
    }),
    [config.items],
  );

  // Placeholder rows while the host cannot know its entries yet — see
  // `NavigationSidebarConfig.loading`. Only the ROWS are stood in for: the header,
  // the collapse toggle, the widths and the tablet overlay all behave exactly as
  // when loaded, so this is the loaded rail with unknown contents rather than a
  // separate skeleton sidebar to keep in sync.
  const loadingRows = useMemo(() => {
    if (!config.loading) return null;
    const primary = config.loadingRows?.primary ?? 7;
    const secondary = config.loadingRows?.secondary ?? 2;
    return {
      primary: Array.from({ length: Math.max(0, primary) }, (_, i) => `primary-${i}`),
      secondary: Array.from({ length: Math.max(0, secondary) }, (_, i) => `secondary-${i}`),
    };
  }, [config.loading, config.loadingRows?.primary, config.loadingRows?.secondary]);

  // The grouped rows glide and fade with the width, on the same curve.
  const widthTransition = cn(
    'transition-[width] duration-300',
    (grouped || sectioned) && '[transition-timing-function:cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
  );

  const sidebarWidth = useMemo(
    () => (minimized ? `${MINIMIZED_WIDTH}px` : `${expandedWidth}px`),
    [minimized, expandedWidth],
  );

  // Shown from 140px, fading in as it arrives (the rows' labels fade the same
  // way, and a node section has no width to fade in below that).
  const sectionRailHidden =
    typeof config.sectionSlot !== 'function' &&
    'hidden @[140px]/of-nav-sidebar:flex animate-in fade-in duration-300 motion-reduce:animate-none';

  // Published to CSS from an EFFECT, never from render. Before hydration the
  // width belongs to whatever seeded `NAVIGATION_SIDEBAR_WIDTH_VAR` in `<head>`
  // — put it in the markup instead and it becomes part of what React hydrates,
  // which is precisely what cannot agree across the server boundary. Afterwards
  // this is what a toggle moves.
  //
  // On the rail, not on `<html>` where the seed sits: the rail is its only reader,
  // and an inherited custom property on the root made WebKit restyle the whole
  // document on every toggle. Its own value overrides the inherited seed.
  useIsomorphicLayoutEffect(() => {
    asideRef.current?.style.setProperty(widthVar, sidebarWidth);
  }, [sidebarWidth, widthVar]);

  // There used to be an `isHydrated` gate here — `isMdUp !== undefined && ...`
  // — meant to hold the sidebar's contents back until the media queries
  // resolved. It could never be false: the `?? false` above had already
  // swallowed the `undefined` it tested for. Removed rather than repaired,
  // because repairing it would be the regression: the contents are server-
  // rendered today, and gating them behind a client-only media query would
  // trade a first paint of the real navigation for an empty rail.
  useIsomorphicLayoutEffect(() => {
    if (transitionsEnabled) return undefined;
    const id = requestAnimationFrame(() => {
      setTransitionsEnabled(true);
    });
    return () => cancelAnimationFrame(id);
  }, [transitionsEnabled]);

  // One `<nav>` block's rows: placeholders while loading, else the entries in
  // the variant's geometry.
  const renderEntries = (placeholders: string[] | null, items: NavigationSidebarItem[]): ReactNode => {
    if (placeholders) {
      return placeholders.map(key =>
        grouped || sectioned ? (
          <NavigationSidebarGroupedSkeleton key={key} />
        ) : (
          <NavigationSidebarItemButton key={key} loading showLabel={showLabel} />
        ),
      );
    }
    if (sectioned) {
      return (
        <NavigationSidebarSectionedEntries
          items={items}
          activeId={committedActiveId}
          pendingId={pendingItemId}
          foldedIds={foldedSectionIds}
          showLabel={showLabel}
          disabled={disabled}
          onItemClick={handleItemClick}
          onSectionClick={handleGroupClick}
        />
      );
    }
    if (grouped) {
      return (
        <NavigationSidebarGroupedEntries
          items={items}
          activeId={committedActiveId}
          pendingId={pendingItemId}
          openGroupId={openGroupId}
          openGroupIds={multiGroups ? openGroupIds : undefined}
          showLabel={showLabel}
          disabled={disabled}
          onItemClick={handleItemClick}
          onGroupClick={handleGroupClick}
        />
      );
    }
    return items.map(item => (
      <NavigationSidebarItemButton
        key={item.id}
        item={item}
        isActive={item.id === committedActiveId}
        isPending={item.id === pendingItemId}
        showLabel={showLabel}
        disabled={disabled}
        onClick={handleItemClick}
      />
    ));
  };

  return (
    <>
      {/* Backdrop scrim — only visible on tablet while the overlay is open */}
      <div
        className={cn(
          'fixed inset-0 z-[40] bg-ods-overlay',
          forcedOverlay ? 'hidden md:block' : 'hidden md:block lg:hidden',
          'transition-opacity duration-300',
          isOverlayOpen && !pushOnTablet ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={closeOverlay}
        aria-hidden="true"
      />

      {/* Flex-flow placeholder — reserves the collapsed 56px slot on tablet so
          the main content keeps its position while the sidebar floats above it.
          Rendered unconditionally and scoped by classes for the same reason the
          geometry is: gated on `isTablet`, it was missing from the server HTML
          and from the first client paint — exactly when the sidebar it
          compensates for has already gone `absolute`. */}
      <div
        className={cn(
          drawer
            ? 'hidden'
            : forcedOverlay
              ? 'hidden h-full flex-shrink-0 md:block'
              : 'hidden h-full flex-shrink-0 md:block lg:hidden',
          isOverlayOpen && pushOnTablet
            ? customExpandedWidth === null
              ? 'w-56'
              : 'w-[var(--of-navigation-sidebar-expanded-width)]'
            : 'w-14',
          transitionsEnabled && animateWidth && widthTransition,
        )}
        style={expandedWidthStyle}
        aria-hidden="true"
      />

      <aside
        className={cn(
          SIDEBAR_CONTAINER,
          'hidden flex-shrink-0 flex-col md:flex',
          side === 'right' ? 'border-l' : 'border-r',
          dividerClass,
          panel ? 'bg-ods-panel' : 'bg-ods-card',
          forcedOverlay
            ? SIDEBAR_OVERLAY_GEOMETRY_CLASSES[side]
            : customExpandedWidth === null
              ? SIDEBAR_GEOMETRY_CLASSES[side].default
              : SIDEBAR_GEOMETRY_CLASSES[side].custom,
          // The one width a viewport cannot imply: an overlay the user opened on
          // tablet. Only ever true after a click, so the first paint always gets
          // the rail.
          !isOverlayOpen
            ? SIDEBAR_TABLET_WIDTH.rail
            : customExpandedWidth === null
              ? SIDEBAR_TABLET_WIDTH.overlay
              : SIDEBAR_TABLET_WIDTH.customOverlay,
          transitionsEnabled && widthTransition,
          // A drag on the resize handle in progress: the width follows the
          // pointer, with no transition trailing it (`dragExpandedWidth`).
          'data-[resizing]:transition-none',
          // A closed drawer is nothing at all.
          drawer && minimized && 'md:hidden',
          // Snaps where its width moves the content: the desktop rail, and the
          // tablet overlay too when it pushes (its slot above snaps with it).
          !animateWidth && (pushOnTablet ? 'transition-none' : !forcedOverlay && 'lg:transition-none'),
          config.className,
        )}
        ref={asideRef}
        style={expandedWidthStyle}
        aria-label="Main navigation sidebar"
        {...{ [NAVIGATION_SIDEBAR_ATTRIBUTE]: '' }}
      >
        {config.header !== false && <NavigationSidebarHeader minimized={minimized} borderClassName={dividerClass} />}

        <div
          className={cn(
            'flex flex-1 flex-col justify-between overflow-y-auto',
            // Grouped: one inset all round the rows (8px), so the first row sits as far under the
            // header's border as the rows sit from the sidebar's sides.
            sectioned ? 'p-0' : grouped ? 'p-[var(--spacing-system-xsf)]' : 'py-4',
          )}
        >
          {/* The top slot, the primary nav and the section are ONE
              `justify-between` child. As siblings the spare space would open
              between them instead of above the secondary nav. */}
          {/* `sectionFill`: it takes the body's spare height and passes it to the
              section, where an empty chat list centres. */}
          <div className={cn('flex flex-col', config.sectionFill && 'flex-1')}>
            {config.topSlot?.({ minimized })}

            {/* `aria-busy` on the nav, not the rows: the region is what is loading,
                and each placeholder row is already `aria-hidden`. */}
            <nav
              className={cn(
                'flex flex-col',
                grouped && 'gap-[var(--spacing-system-xxs)]',
                sectioned && SECTIONED_PRIMARY_NAV_CLASSES,
              )}
              aria-label="Primary navigation"
              aria-busy={!!loadingRows}
            >
              {renderEntries(loadingRows?.primary ?? null, primaryItems)}
            </nav>

            {/* The host's section (the chat history), in the flow at its full
                height: the body scrolls the tree and the section as one, so
                there is one scroll to follow and none to get caught in. A node
                has no use for a 56px rail and is hidden there by the rail's
                width (mounted, so its search survives a toggle); a function
                decides for itself. */}
            {hasNavigationSidebarSlot(config.sectionSlot) && (
              // A divider between the tree and the section, as under the top slot's rows.
              <div
                className={cn(
                  'flex flex-col',
                  config.sectionFill && 'flex-1',
                  config.sectionDivider === false
                    ? 'pt-[var(--spacing-system-sf)]'
                    : cn('mt-[var(--spacing-system-xsf)] border-t pt-[var(--spacing-system-sf)]', dividerClass),
                  sectionRailHidden,
                )}
              >
                {renderNavigationSidebarSlot(config.sectionSlot, { minimized, inDrawer: false, toggle: handleToggle })}
              </div>
            )}
          </div>

          {(loadingRows ? loadingRows.secondary.length > 0 : secondaryItems.length > 0) && (
            <nav className="flex flex-col" aria-label="Secondary navigation" aria-busy={!!loadingRows}>
              {renderEntries(loadingRows?.secondary ?? null, secondaryItems)}
            </nav>
          )}
        </div>

        {/* The host's footer (the account row), pinned above the toggle and inset
            like the rows. Rendered in both widths: a function adapts to
            `minimized`, a node is clipped to the rail. */}
        {hasNavigationSidebarSlot(config.footerSlot) && (
          <div
            className={cn(
              'shrink-0 overflow-hidden border-t',
              dividerClass,
              config.footerInset !== false && 'px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xxs)]',
            )}
          >
            {renderNavigationSidebarSlot(config.footerSlot, { minimized, inDrawer: false, toggle: handleToggle })}
          </div>
        )}

        {config.toggle === 'icon' && (
          <NavigationSidebarIconToggle
            minimized={minimized}
            onToggle={handleToggle}
            side={side}
            borderClassName={dividerClass}
          />
        )}
        {(config.toggle ?? 'row') === 'row' && (
          <NavigationSidebarToggle
            minimized={minimized}
            showLabel={showLabel}
            onToggle={handleToggle}
            compact={grouped}
            side={side}
            borderClassName={dividerClass}
          />
        )}

        {/* The resize handle (`config.resizable`), astride the rail's right edge —
            the grip the Mingo chat drawer had — on desktop while expanded: the
            56px rail has nothing to resize, and below `lg` the width is the
            tablet's. The 24px track straddles the border, half of it over the
            content's edge; the grip marks the border as draggable. */}
        {/* Not over the content (`config.overlay`): the overlay's width is the tablet's. */}
        {resize !== undefined && !minimized && !forcedOverlay && (
          <PanelResizeHandle
            // The handle's `side` is the panel's: astride the right edge of a left
            // sidebar, the left edge of a right one.
            side={side}
            variant="inLayout"
            size={markupExpandedWidth}
            minSize={resizeMinWidth}
            maxSize={clampExpandedWidth(Number.POSITIVE_INFINITY)}
            clampSize={clampExpandedWidth}
            onSize={commitExpandedWidth}
            onDrag={dragExpandedWidth}
            onReset={resetChosenExpandedWidth}
            ariaLabel="Resize navigation sidebar"
            className={
              side === 'right'
                ? 'inset-y-0 hidden w-6 translate-x-1/2 justify-center pr-0 lg:flex'
                : 'inset-y-0 hidden w-6 -translate-x-1/2 justify-center pl-0 lg:flex'
            }
            grip={<PanelResizeGrip />}
          />
        )}
      </aside>
    </>
  );
}
