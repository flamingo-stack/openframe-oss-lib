'use client'

import { createContext, Suspense, useCallback, useContext, useState } from 'react'
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
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [drawerContainer, setDrawerContainer] = useState<HTMLDivElement | null>(null)

  const handleToggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  return (
    <AppLayoutDrawerContainerContext.Provider value={drawerContainer}>
      <div className={cn("flex h-screen bg-ods-bg", className)}>
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
    </AppLayoutDrawerContainerContext.Provider>
  )
}
