"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/ui/use-local-storage'
import { useLgUp, useMdUp } from '../../hooks/ui/use-media-query'
import { NavigationSidebarConfig, NavigationSidebarItem } from '../../types/navigation'
import { cn } from '../../utils'
import { NavigationSidebarHeader } from './navigation-sidebar-header'
import { NavigationSidebarItemButton } from './navigation-sidebar-item'
import { NavigationSidebarToggle } from './navigation-sidebar-toggle'

const MINIMIZED_WIDTH = 56 // 3.5rem = 56px
const EXPANDED_WIDTH = 224 // 14rem = 224px
const STORAGE_KEY = 'of.navigationSidebar.minimized'

export interface NavigationSidebarProps {
  config: NavigationSidebarConfig
  /**
   * When true, all navigation items are disabled and visually dimmed.
   * The collapse/expand toggle button remains interactive.
   */
  disabled?: boolean
}

export function NavigationSidebar({ config, disabled = false }: NavigationSidebarProps) {
  const isMdUp = useMdUp() ?? false
  const isLgUp = useLgUp() ?? false

  // Tablet = md viewport but not lg. On tablet the sidebar floats over the
  // content area (overlay) instead of pushing it like on desktop.
  const isTablet = isMdUp && !isLgUp

  // Desktop preference persists across sessions. Tablet state is in-memory
  // only so entering tablet always starts minimized without clobbering the
  // user's desktop choice.
  const [desktopMinimized, setDesktopMinimized] = useLocalStorage<boolean>(
    STORAGE_KEY,
    config.minimized ?? false,
  )
  const [tabletMinimized, setTabletMinimized] = useState(true)

  useEffect(() => {
    if (isTablet) setTabletMinimized(true)
  }, [isTablet])

  const minimized = isTablet ? tabletMinimized : desktopMinimized

  // Enable transitions only after the correct width is painted
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)

  const isOverlayOpen = isTablet && !minimized

  const showLabel = !minimized

  const handleToggle = useCallback(() => {
    if (isTablet) {
      setTabletMinimized(prev => !prev)
    } else {
      setDesktopMinimized(prev => !prev)
    }
    config.onToggleMinimized?.()
  }, [isTablet, setDesktopMinimized, config])

  const closeOverlay = useCallback(() => {
    setTabletMinimized(true)
  }, [])

  // Dismiss the tablet overlay with Escape so it behaves like a transient panel
  useEffect(() => {
    if (!isOverlayOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeOverlay()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOverlayOpen, closeOverlay])

  const handleItemClick = useCallback((item: NavigationSidebarItem, event?: React.MouseEvent) => {
    event?.stopPropagation()

    if (item.onClick) {
      item.onClick()
    } else if (item.path) {
      config.onNavigate?.(item.path)
    }

    if (isTablet) setTabletMinimized(true)
  }, [config, isTablet])

  const { primaryItems, secondaryItems } = useMemo(() => ({
    primaryItems: config.items.filter(item => item.section !== 'secondary'),
    secondaryItems: config.items.filter(item => item.section === 'secondary'),
  }), [config.items])

  const sidebarWidth = useMemo(
    () => (minimized ? `${MINIMIZED_WIDTH}px` : `${EXPANDED_WIDTH}px`),
    [minimized],
  )

  const isHydrated = isMdUp !== undefined && isLgUp !== undefined

  useLayoutEffect(() => {
    if (isHydrated && !transitionsEnabled) {
      const id = requestAnimationFrame(() => {
        setTransitionsEnabled(true)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isHydrated, transitionsEnabled])

  return (
    <>
      {/* Backdrop scrim — only visible on tablet while the overlay is open */}
      <div
        className={cn(
          "fixed inset-0 z-[40] bg-black/50",
          "hidden md:block lg:hidden",
          "transition-opacity duration-300",
          isOverlayOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeOverlay}
        aria-hidden="true"
      />

      {/* Flex-flow placeholder — reserves the collapsed 56px slot on tablet so
          the main content keeps its position while the sidebar floats above it */}
      {isTablet && (
        <div
          className="h-full hidden md:block flex-shrink-0"
          style={{ width: `${MINIMIZED_WIDTH}px` }}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "flex-col hidden md:flex flex-shrink-0",
          "bg-ods-card border-r border-ods-border",
          isTablet ? "fixed top-0 left-0 h-screen z-[45]" : "relative h-full",
          transitionsEnabled && "transition-[width] duration-300",
          config.className,
        )}
        style={{ width: sidebarWidth }}
        aria-label="Main navigation sidebar"
      >
        {isHydrated && (
          <>
            <NavigationSidebarHeader minimized={minimized} />

            <div className="flex-1 flex flex-col justify-between py-4 overflow-y-auto">
              <nav className="flex flex-col" aria-label="Primary navigation">
                {primaryItems.map(item => (
                  <NavigationSidebarItemButton
                    key={item.id}
                    item={item}
                    showLabel={showLabel}
                    disabled={disabled}
                    onClick={handleItemClick}
                  />
                ))}
              </nav>

              {secondaryItems.length > 0 && (
                <nav className="flex flex-col" aria-label="Secondary navigation">
                  {secondaryItems.map(item => (
                    <NavigationSidebarItemButton
                      key={item.id}
                      item={item}
                      showLabel={showLabel}
                      disabled={disabled}
                      onClick={handleItemClick}
                    />
                  ))}
                </nav>
              )}
            </div>

            <NavigationSidebarToggle
              minimized={minimized}
              showLabel={showLabel}
              onToggle={handleToggle}
            />
          </>
        )}
      </aside>
    </>
  )
}
