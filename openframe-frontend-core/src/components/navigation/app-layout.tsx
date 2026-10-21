'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ContentAreaWidthContext, contentBreakpointFor } from '../../hooks/ui/use-content-breakpoint';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import type { NavigationSidebarConfig } from '../../types/navigation';
import { cn } from '../../utils';
import { NotificationDrawer } from '../features/notifications/notification-drawer';
import { AppHeader, type AppHeaderProps } from './app-header';
import {
  AppLayoutDrawerContainerContext,
  type AppLayoutDrawerCoordination,
  AppLayoutDrawerCoordinationContext,
  type AppLayoutDrawerHandle,
  ComposerDockHeightContext,
} from './app-layout-context';
import { AppLayoutSidePanel, type AppLayoutSidePanelConfig, useAppLayoutSidePanel } from './app-layout-side-panel';
import { MobileBurgerMenu, type MobileBurgerMenuProps } from './mobile-burger-menu';
import { NavigationSidebar } from './navigation-sidebar';

export interface AppLayoutProps {
  children: ReactNode;
  sidebarConfig: NavigationSidebarConfig;
  headerProps: Omit<AppHeaderProps, 'isMobileMenuOpen' | 'onToggleMobileMenu' | 'disabled'>;
  mainClassName?: string;
  className?: string;
  mobileBurgerMenuProps: Omit<MobileBurgerMenuProps, 'isOpen' | 'onClose' | 'config' | 'disabled'>;
  /**
   * When true, disables navigation/header chrome interactions except the mobile
   * burger menu toggle and the sidebar collapse/expand button. Main content
   * (`children`) is not affected and stays fully interactive.
   */
  disabled?: boolean;
  /**
   * Slot for an in-layout drawer (typically an `AppLayoutDrawer` tree). Rendered
   * inside the layout's drawer-container context so the drawer can portal into
   * the main-area container. Keeping it separate from `children` clarifies that
   * the drawer is part of the layout chrome, not page content.
   */
  drawer?: ReactNode;
  /**
   * Full-width banner rendered ABOVE both the sidebar and the header, spanning
   * the entire viewport width and pinned to the top of the layout. Optional —
   * when omitted the layout is unchanged. Used for global, cross-page callouts
   * (e.g. an onboarding "complete your setup" bar). The sidebar + header + main
   * area occupy the remaining height below it.
   */
  topBar?: ReactNode;
  /**
   * A panel docked beside the content (the Mingo chat). It narrows the
   * content instead of covering it, and the content then lays out by its own
   * width: `<main>` becomes an `ods-content-area` whose tokens and
   * `content-md:` / `content-lg:` classes follow the room the panel leaves.
   * Without room to dock (or on a phone) the header's Mingo button opens it
   * over the content area. Optional; without it the layout is unchanged.
   */
  sidePanel?: AppLayoutSidePanelConfig;
  /**
   * A bar docked under the page (the Mingo composer). It sits below the
   * scrolling `<main>`, outside it, so it stays put while the page scrolls and
   * the page's scroll area ends above it: nothing is ever hidden under it. It
   * spans the page column — left of a `sidePanel` — and, on a phone, sits at
   * the bottom of the screen; the bottom safe-area inset belongs to the layout
   * root (the host's `className`), not to the dock.
   *
   * With it, the page column is an adaptive content area, as with `sidePanel`:
   * `<main>` and the dock each follow the column's width in their tokens and
   * `content-md:` / `content-lg:` classes, and `useContentBreakpoint()` answers
   * from it on both. Pass `null` to keep that (and the slot) while drawing
   * nothing, e.g. behind a paywall; `undefined` removes it. Either way the page
   * stays mounted. Optional; without it the layout is unchanged.
   */
  composerDock?: ReactNode;
  /**
   * A layer over the page that ends at the `composerDock`'s top edge — the
   * conversation sheet that rises from the composer over the page (a scrim over
   * the page, the thread above the composer). The layer spans the page column,
   * takes no pointer events itself (what the host draws in it opts in with
   * `pointer-events-auto`) and is the positioning box for it: anchor the sheet to
   * its bottom. It follows the dock's height as the composer grows. It is a
   * content area like the dock, so `content-md:` / `content-lg:` and
   * `useContentBreakpoint()` answer from the column's width. Above the page's own
   * layers (sticky bars, the `contentCorner`), under in-layout drawers and modals.
   * Only with a `composerDock`; omitted, `null` or `false` draws nothing and the
   * page is unchanged.
   */
  composerSheet?: ReactNode;
  /**
   * Paints the page column — the page and the `composerDock` under it — as one
   * surface: that surface's ground and the accent corner glow, so a chat page's
   * background runs under the composer to the bottom of the window (`'mingo'`,
   * with the dock's `EmbeddableChat` portalling its thread into the page). Takes
   * effect on a column with a dock or a `contentCorner`. Omitted: the column is
   * transparent, as before.
   */
  pageSurface?: 'mingo';
  /**
   * The desktop `AppHeader`. `false` drops it from md up — the sidebar and the
   * page start at the top of the window — and keeps the phone top bar (burger,
   * logo, action cells) below md. Decided in CSS, so the first paint is right
   * at every width. Default `true`.
   *
   * Without the header the notifications bell has no place of its own: render
   * a `NotificationsBellButton variant="floating"` in `contentCorner`. The
   * `NotificationDrawer` this layout mounts follows the `NotificationsProvider`,
   * not the header.
   */
  desktopHeader?: boolean;
  /**
   * Controls pinned to the top-right corner of the page column (the
   * notifications bell when `desktopHeader` is off). Floats over the page at
   * the header's layer and does not scroll with it; in-layout drawers cover it.
   * From md up only — below md it is not displayed, as the phone top bar
   * carries those controls. Leave room for it in the page's title row.
   * Optional; without it the layout is unchanged.
   */
  contentCorner?: ReactNode;
  /**
   * Controlled phone burger menu (below md). With it the host owns whether the
   * menu is open — e.g. a top-bar cell that opens it on its chat history, or a
   * navigation started from one of its slots that has to close it. Omitted:
   * the layout keeps its own state, as before.
   */
  mobileMenuOpen?: boolean;
  /**
   * Every open / close the layout asks for, controlled or not: the burger
   * toggle, a nav entry clicked in the menu, an in-layout drawer opening over
   * it, and — when `sidebarConfig.currentPath` is set — any change of that
   * location while the menu is open (so a navigation started anywhere, a slot
   * included, closes it). A host opening it through `mobileMenuOpen` also
   * closes any open in-layout drawer, as the toggle does.
   */
  onMobileMenuOpenChange?: (open: boolean) => void;
}

export function AppLayout({
  children,
  sidebarConfig,
  headerProps,
  mainClassName,
  className,
  mobileBurgerMenuProps,
  disabled = false,
  drawer,
  topBar,
  sidePanel,
  composerDock,
  composerSheet,
  pageSurface,
  desktopHeader = true,
  contentCorner,
  mobileMenuOpen: mobileMenuOpenProp,
  onMobileMenuOpenChange,
}: AppLayoutProps) {
  const menuControlled = mobileMenuOpenProp !== undefined;
  const [uncontrolledMenuOpen, setUncontrolledMenuOpen] = useState(false);
  const mobileMenuOpen = menuControlled ? mobileMenuOpenProp : uncontrolledMenuOpen;
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(null);
  const [mainElement, setMainElement] = useState<HTMLElement | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const [dockElement, setDockElement] = useState<HTMLDivElement | null>(null);
  const [dockHeight, setDockHeight] = useState(0);

  const hasSidePanel = sidePanel !== undefined;
  const hasDock = composerDock !== undefined;
  const hasCorner = contentCorner !== undefined;
  // The page column lays out by its own width: something narrows it (the
  // panel) or shares it with the page (the dock).
  const adaptive = hasSidePanel || hasDock;
  // The column needs a box of its own only to stack the dock under <main> and
  // to anchor the corner; otherwise it is `contents` and <main> stays the row's
  // flex item exactly as before.
  const columnIsBox = hasDock || hasCorner;
  const sidePanelState = useAppLayoutSidePanel(sidePanel, drawerContainer);

  useIsomorphicLayoutEffect(() => {
    if (!adaptive || !mainElement) return undefined;
    // Every reader asks for the breakpoint (`useContentBreakpoint`), so only a
    // crossing re-renders the layout: kept at the old width, the state bails out.
    // Per pixel, the uncompiled layout and every breakpoint consumer re-rendered on
    // each frame of a sidebar toggle, a window drag or a side-panel resize.
    const update = () => {
      const width = mainElement.clientWidth;
      setContentWidth(previous =>
        previous !== null && contentBreakpointFor(previous) === contentBreakpointFor(width) ? previous : width,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(mainElement);
    return () => observer.disconnect();
  }, [adaptive, mainElement]);
  const contentAreaWidth = adaptive ? contentWidth : null;

  // The sheet layer ends where the dock begins, and the dock grows with the
  // composer (a longer draft, a staged attachment): follow its height. The page
  // reads it too (`ComposerDockHeightContext`): a phone's bottom action bar
  // (`PageActions`) is pinned to the window and would cover the composer.
  const hasSheet = hasDock && composerSheet != null && composerSheet !== false;
  useIsomorphicLayoutEffect(() => {
    if (!hasDock || !dockElement) return undefined;
    const update = () => setDockHeight(dockElement.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(dockElement);
    return () => observer.disconnect();
  }, [hasDock, dockElement]);

  // With a side panel the header's Mingo button only exists while the panel
  // cannot dock: it opens the panel over the content and closes it again.
  const resolvedHeaderProps =
    sidePanelState === null
      ? headerProps
      : {
          ...headerProps,
          showMingoAI: !sidePanelState.canDock,
          onMingoAI: sidePanelState.toggle,
          isMingoAIActive: sidePanelState.isOpen,
          mingoAICloseWhenActive: true,
        };
  const contentCovered = sidePanelState?.coversContent === true;
  const contentOverlapped = sidePanelState?.overlapsContent === true;

  // Mirrors `mobileMenuOpen` (and the host's control of it) so the callbacks
  // below can stay identity-stable. Refreshed after every commit rather than in
  // the render body: the readers are clicks and effects, always past a commit.
  const mobileMenuOpenRef = useRef(mobileMenuOpen);
  const menuControlledRef = useRef(menuControlled);
  const onMobileMenuOpenChangeRef = useRef(onMobileMenuOpenChange);
  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
    menuControlledRef.current = menuControlled;
    onMobileMenuOpenChangeRef.current = onMobileMenuOpenChange;
  });

  // Every open / close goes through here: the layout's own state when it owns
  // it, and the host hears of each actual change either way.
  const setMobileMenuOpen = useCallback((next: boolean) => {
    if (!menuControlledRef.current) setUncontrolledMenuOpen(next);
    if (next !== mobileMenuOpenRef.current) onMobileMenuOpenChangeRef.current?.(next);
  }, []);

  const drawerHandlesRef = useRef(new Set<AppLayoutDrawerHandle>());

  const handleToggleMobileMenu = useCallback(() => {
    const opening = !mobileMenuOpenRef.current;
    // Opening the menu closes any open in-layout drawer — otherwise the menu
    // would open invisibly underneath it (the drawer renders above the menu).
    if (opening) {
      for (const handle of drawerHandlesRef.current) handle.close();
    }
    setMobileMenuOpen(opening);
  }, [setMobileMenuOpen]);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, [setMobileMenuOpen]);

  // A host that opens the menu itself gets what the toggle does: no in-layout
  // drawer left open over it. Before paint, so the two never show together.
  const menuWasOpenRef = useRef(mobileMenuOpen);
  useIsomorphicLayoutEffect(() => {
    const opened = mobileMenuOpen && !menuWasOpenRef.current;
    menuWasOpenRef.current = mobileMenuOpen;
    if (opened && menuControlled) {
      for (const handle of drawerHandlesRef.current) handle.close();
    }
  }, [mobileMenuOpen, menuControlled]);

  // A navigation closes the menu wherever it started — a nav entry already
  // does, a slot (the chat history, an account item) cannot tell the menu.
  // Only a CHANGE of the location counts, and only with one to watch.
  const currentPath = sidebarConfig.currentPath;
  const menuPathRef = useRef(currentPath);
  useEffect(() => {
    if (menuPathRef.current === currentPath) return;
    menuPathRef.current = currentPath;
    if (mobileMenuOpenRef.current) setMobileMenuOpen(false);
  }, [currentPath, setMobileMenuOpen]);

  const drawerCoordination = useMemo<AppLayoutDrawerCoordination>(
    () => ({
      notifyDrawerDidOpen: self => {
        setMobileMenuOpen(false);
        // Only one in-layout panel may be open at a time — each dims the main
        // area, so stacking them reads as broken.
        for (const handle of drawerHandlesRef.current) {
          if (handle !== self) handle.close();
        }
      },
      registerDrawer: handle => {
        drawerHandlesRef.current.add(handle);
        return () => drawerHandlesRef.current.delete(handle);
      },
    }),
    [setMobileMenuOpen],
  );

  return (
    <AppLayoutDrawerContainerContext.Provider value={drawerContainer}>
      <AppLayoutDrawerCoordinationContext.Provider value={drawerCoordination}>
        <div className={cn('flex h-screen flex-col bg-ods-bg', className)}>
          {/* Full-width top banner above sidebar + header (optional) */}
          {topBar}
          {/* Sidebar + header + main occupy the remaining height below the banner.
            `relative` so the tablet sidebar (position:absolute) anchors to this
            row — below the topBar — instead of the viewport. */}
          <div className="relative flex min-h-0 flex-1">
            <NavigationSidebar
              config={sidebarConfig}
              disabled={disabled}
              pushOnTablet={hasSidePanel}
              animateWidth={!adaptive}
            />
            {/* Mobile Burger Menu - opens below header */}
            <MobileBurgerMenu
              {...mobileBurgerMenuProps}
              isOpen={mobileMenuOpen}
              onClose={handleCloseMobileMenu}
              config={sidebarConfig}
              disabled={disabled}
            />

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
              <AppHeader
                {...resolvedHeaderProps}
                className={
                  desktopHeader ? resolvedHeaderProps.className : cn(resolvedHeaderProps.className, 'md:hidden')
                }
                isMobileMenuOpen={mobileMenuOpen}
                onToggleMobileMenu={handleToggleMobileMenu}
                disabled={disabled}
              />
              <NotificationDrawer showClose={!desktopHeader} />

              {/* Main + AppLayoutDrawer portal target. `relative` so the drawer
              can absolutely position within just this area (not over
              header/sidebar); `overflow-hidden` clips the drawer's slide-in
              animation visually AND contains layout overflow so it doesn't
              propagate up to <html>. (Scroll-snap-back below handles the
              browser's programmatic scroll-on-focus side effect.) */}
              <div
                ref={setDrawerContainer}
                className={cn('relative flex flex-1 overflow-hidden', sidePanel ? 'flex-row' : 'flex-col')}
              >
                {/* The page column. One element tree whatever the slots: a
                  slot that comes or goes (the side panel on every cold load
                  with Mingo v2, the dock behind the paywall) must not change
                  the element types above the page, or React remounts it. */}
                <div
                  data-surface={columnIsBox ? pageSurface : undefined}
                  className={
                    columnIsBox
                      ? cn(
                          'relative flex min-h-0 min-w-0 flex-1 flex-col',
                          pageSurface && 'ods-glow-accent-corner bg-ods-bg',
                          contentCovered && 'hidden',
                          contentOverlapped && 'isolate',
                        )
                      : 'contents'
                  }
                >
                  {hasCorner && (
                    // z-40: the layer of the sticky header it stands in for —
                    // over the page's own layers, under in-layout drawers.
                    // Desktop only: the phone top bar holds these controls.
                    <div className="absolute right-[var(--spacing-system-mf)] top-[var(--spacing-system-mf)] z-40 hidden items-center gap-[var(--spacing-system-xsf)] md:flex">
                      {contentCorner}
                    </div>
                  )}
                  {/* `hidden` while the panel covers the area: the page stays
                    mounted, it just takes no room. */}
                  <main
                    ref={setMainElement}
                    className={cn(
                      adaptive ? 'ods-content-area min-w-0 flex-1 overflow-y-auto' : 'flex-1 overflow-y-auto',
                      contentCovered && 'hidden',
                      // While the panel is drawn over the page, keep the page's own
                      // z-indexed layers (sticky headers, fixed bars) under it.
                      contentOverlapped && 'isolate',
                      mainClassName,
                    )}
                  >
                    <ContentAreaWidthContext.Provider value={contentAreaWidth}>
                      <ComposerDockHeightContext.Provider value={hasDock ? dockHeight : 0}>
                        {/* `display: contents` either way; it carries the content
                          tokens only inside an adaptive area. */}
                        <div className={adaptive ? 'ods-content-scope' : 'contents'}>{children}</div>
                      </ComposerDockHeightContext.Provider>
                    </ContentAreaWidthContext.Provider>
                  </main>
                  {hasSheet && (
                    // Over the page down to the dock's top edge. z-40: the
                    // layer of the corner and the page's own sticky bars' top —
                    // in-layout drawers (45) and modals still cover it.
                    <div
                      data-composer-sheet-layer=""
                      className="ods-content-area pointer-events-none absolute inset-x-0 top-0 z-40"
                      style={{ bottom: dockHeight }}
                    >
                      <ContentAreaWidthContext.Provider value={contentAreaWidth}>
                        {/* The sheet's scrim runs on under the dock, by its height. */}
                        <ComposerDockHeightContext.Provider value={dockHeight}>
                          <div className="ods-content-scope">{composerSheet}</div>
                        </ComposerDockHeightContext.Provider>
                      </ContentAreaWidthContext.Provider>
                    </div>
                  )}
                  {hasDock && (
                    // Its own container + token scope: a container query cannot
                    // reach from <main> to a sibling. Same column width. With a
                    // sheet it rises over the sheet's scrim, which runs on under it.
                    <div ref={setDockElement} className={cn('ods-content-area shrink-0', hasSheet && 'relative z-40')}>
                      <ContentAreaWidthContext.Provider value={contentAreaWidth}>
                        <div className="ods-content-scope">{composerDock}</div>
                      </ContentAreaWidthContext.Provider>
                    </div>
                  )}
                </div>
                {sidePanel && sidePanelState && <AppLayoutSidePanel config={sidePanel} state={sidePanelState} />}
                {/* `drawer` slot — rendered here so it sits inside the
                AppLayoutDrawerContainerContext and can portal into this exact
                container. Mount location is irrelevant for visual placement
                (Radix Portal handles that), but keeping it close to the target
                makes the React tree match the visual nesting. */}
                {drawer}
              </div>
            </div>
          </div>
        </div>
      </AppLayoutDrawerCoordinationContext.Provider>
    </AppLayoutDrawerContainerContext.Provider>
  );
}
