'use client'

import { createContext, Suspense, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { NavigationSidebarConfig } from '../../types/navigation'
import { cn } from '../../utils'
import { NotificationDrawer } from '../features/notifications/notification-drawer'
import { AppHeader, AppHeaderProps } from './app-header'
import { MobileBurgerMenu, MobileBurgerMenuProps } from './mobile-burger-menu'
import { NavigationSidebar } from './navigation-sidebar'

/**
 * Container element that wraps `<main>` and serves as the portal target for
 * `AppLayoutDrawer`. Drawers rendered into this container sit on top of the
 * main content area only — the sidebar and header remain visible and
 * interactive. Null when AppLayout hasn't mounted (or when used outside of it).
 */
const AppLayoutDrawerContainerContext = createContext<HTMLElement | null>(null)

export function useAppLayoutDrawerContainer(): HTMLElement | null {
  return useContext(AppLayoutDrawerContainerContext)
}

/**
 * Two-way coordination between AppLayout's mobile burger menu and in-layout
 * drawers (`AppLayoutDrawer`), which render above the menu (z-[103] vs
 * z-[101]) — the two must never be open at the same time:
 *   - a drawer that opens calls `notifyDrawerDidOpen` so the layout closes
 *     the menu (otherwise it would resurface once the drawer closes);
 *   - each drawer registers a close handle so opening the menu via the
 *     burger button closes any open drawer instead of hiding the menu
 *     underneath it. Null outside of AppLayout.
 */
export interface AppLayoutDrawerHandle {
  close: () => void
}

interface AppLayoutDrawerCoordination {
  notifyDrawerDidOpen: () => void
  /** Returns an unregister cleanup. */
  registerDrawer: (handle: AppLayoutDrawerHandle) => () => void
}

const AppLayoutDrawerCoordinationContext = createContext<AppLayoutDrawerCoordination | null>(null)

export function useAppLayoutDrawerCoordination(): AppLayoutDrawerCoordination | null {
  return useContext(AppLayoutDrawerCoordinationContext)
}

export interface AppLayoutProps {
  children: React.ReactNode
  sidebarConfig: NavigationSidebarConfig
  headerProps: Omit<AppHeaderProps, 'isMobileMenuOpen' | 'onToggleMobileMenu' | 'disabled'>
  loadingFallback?: React.ReactNode
  mainClassName?: string
  className?: string
  mobileBurgerMenuProps: Omit<MobileBurgerMenuProps, 'isOpen' | 'onClose' | 'config' | 'disabled'>
  /**
   * When true, disables navigation/header chrome interactions except the mobile
   * burger menu toggle and the sidebar collapse/expand button. Main content
   * (`children`) is not affected and stays fully interactive.
   */
  disabled?: boolean
  /**
   * Slot for an in-layout drawer (typically an `AppLayoutDrawer` tree). Rendered
   * inside the layout's drawer-container context so the drawer can portal into
   * the main-area container. Keeping it separate from `children` clarifies that
   * the drawer is part of the layout chrome, not page content.
   */
  drawer?: React.ReactNode
  /**
   * Full-width banner rendered ABOVE both the sidebar and the header, spanning
   * the entire viewport width and pinned to the top of the layout. Optional —
   * when omitted the layout is unchanged. Used for global, cross-page callouts
   * (e.g. an onboarding "complete your setup" bar). The sidebar + header + main
   * area occupy the remaining height below it.
   */
  topBar?: React.ReactNode
}

export function AppLayout({
  children,
  sidebarConfig,
  headerProps,
  loadingFallback,
  mainClassName,
  className,
  mobileBurgerMenuProps,
  disabled = false,
  drawer,
  topBar,
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(null)

  // Mirrors `mobileMenuOpen` so the toggle callback can stay identity-stable.
  const mobileMenuOpenRef = useRef(mobileMenuOpen)
  mobileMenuOpenRef.current = mobileMenuOpen

  const drawerHandlesRef = useRef(new Set<AppLayoutDrawerHandle>())

  const handleToggleMobileMenu = useCallback(() => {
    const opening = !mobileMenuOpenRef.current
    // Opening the menu closes any open in-layout drawer — otherwise the menu
    // would open invisibly underneath it (the drawer renders above the menu).
    if (opening) {
      for (const handle of drawerHandlesRef.current) handle.close()
    }
    setMobileMenuOpen(opening)
  }, [])

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  const drawerCoordination = useMemo<AppLayoutDrawerCoordination>(() => ({
    notifyDrawerDidOpen: () => setMobileMenuOpen(false),
    registerDrawer: (handle) => {
      drawerHandlesRef.current.add(handle)
      return () => drawerHandlesRef.current.delete(handle)
    },
  }), [])

  return (
    <AppLayoutDrawerContainerContext.Provider value={drawerContainer}>
      <AppLayoutDrawerCoordinationContext.Provider value={drawerCoordination}>
      <div className={cn("flex flex-col h-screen bg-ods-bg", className)}>
        {/* Full-width top banner above sidebar + header (optional) */}
        {topBar}
        {/* Sidebar + header + main occupy the remaining height below the banner.
            `relative` so the tablet sidebar (position:absolute) anchors to this
            row — below the topBar — instead of the viewport. */}
        <div className="flex flex-1 min-h-0 relative">
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
        <div className="flex-1 flex flex-col overflow-hidden">
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
          <div
            ref={setDrawerContainer}
            className="flex-1 flex flex-col relative overflow-hidden"
          >
            <main className={cn("flex-1 overflow-y-auto", mainClassName)}>
              <Suspense fallback={loadingFallback ?? null}>
                {children}
              </Suspense>
            </main>
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
  )
}
