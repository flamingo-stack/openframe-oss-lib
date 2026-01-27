'use client'

import { Suspense, useCallback, useState } from 'react'
import { NavigationSidebarConfig } from '../../types/navigation'
import { cn } from '../../utils'
import { AppHeader, AppHeaderProps } from './app-header'
import { MobileBurgerMenu, MobileBurgerMenuProps } from './mobile-burger-menu'
import { NavigationSidebar } from './navigation-sidebar'

export interface AppLayoutProps {
  children: React.ReactNode
  sidebarConfig: NavigationSidebarConfig
  headerProps: Omit<AppHeaderProps, 'isMobileMenuOpen' | 'onToggleMobileMenu'>
  loadingFallback?: React.ReactNode
  mainClassName?: string
  className?: string
  mobileBurgerMenuProps: Omit<MobileBurgerMenuProps, 'isOpen' | 'onClose' | 'config'>
}

export function AppLayout({
  children,
  sidebarConfig,
  headerProps,
  loadingFallback,
  mainClassName,
  className,
  mobileBurgerMenuProps,
}: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleToggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  return (
    <div className={cn("flex h-screen bg-ods-bg", className)}>
      <NavigationSidebar config={sidebarConfig} />
      {/* Mobile Burger Menu - opens below header */}
      <MobileBurgerMenu
        {...mobileBurgerMenuProps}
        isOpen={mobileMenuOpen}
        onClose={handleCloseMobileMenu}
        config={sidebarConfig}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader
          {...headerProps}
          isMobileMenuOpen={mobileMenuOpen}
          onToggleMobileMenu={handleToggleMobileMenu}
        />

        {/* Main Content */}
        <main className={cn("flex-1 overflow-y-auto p-6 pt-0", mainClassName)}>
          <Suspense fallback={loadingFallback ?? null}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  )
}
