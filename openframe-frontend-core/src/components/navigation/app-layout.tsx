'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { NavigationSidebarConfig } from '../../types/navigation';
import { cn } from '../../utils';
import { NotificationDrawer } from '../features/notifications/notification-drawer';
import { AppHeader, type AppHeaderProps } from './app-header';
import {
  AppLayoutDrawerContainerContext,
  type AppLayoutDrawerCoordination,
  AppLayoutDrawerCoordinationContext,
  type AppLayoutDrawerHandle,
} from './app-layout-context';
import { MobileBurgerMenu, type MobileBurgerMenuProps } from './mobile-burger-menu';
import { NavigationSidebar } from './navigation-sidebar';

export { useAppLayoutDrawerContainer, useAppLayoutDrawerCoordination } from './app-layout-context';
export type { AppLayoutDrawerHandle } from './app-layout-context';

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
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(null);

  // Mirrors `mobileMenuOpen` so the toggle callback can stay identity-stable.
  // Refreshed after every commit rather than in the render body: the only
  // reader is the burger click, which is always past a commit.
  const mobileMenuOpenRef = useRef(mobileMenuOpen);
  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  });

  const drawerHandlesRef = useRef(new Set<AppLayoutDrawerHandle>());

  const handleToggleMobileMenu = useCallback(() => {
    const opening = !mobileMenuOpenRef.current;
    // Opening the menu closes any open in-layout drawer — otherwise the menu
    // would open invisibly underneath it (the drawer renders above the menu).
    if (opening) {
      for (const handle of drawerHandlesRef.current) handle.close();
    }
    setMobileMenuOpen(opening);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

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
    [],
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
            <NavigationSidebar config={sidebarConfig} disabled={disabled} />
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
                {...headerProps}
                isMobileMenuOpen={mobileMenuOpen}
                onToggleMobileMenu={handleToggleMobileMenu}
                disabled={disabled}
              />
              <NotificationDrawer />

              {/* Main + AppLayoutDrawer portal target. `relative` so the drawer
              can absolutely position within just this area (not over
              header/sidebar); `overflow-hidden` clips the drawer's slide-in
              animation visually AND contains layout overflow so it doesn't
              propagate up to <html>. (Scroll-snap-back below handles the
              browser's programmatic scroll-on-focus side effect.) */}
              <div ref={setDrawerContainer} className="relative flex flex-1 flex-col overflow-hidden">
                <main className={cn('flex-1 overflow-y-auto', mainClassName)}>{children}</main>
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
