"use client"

import { cloneElement, useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/ui/use-local-storage'
import { useTablet } from '../../hooks/ui/use-media-query'
import { NavigationSidebarConfig, NavigationSidebarItem } from '../../types/navigation'
import { cn } from '../../utils'
import { DoubleChevronIcon, OpenFrameLogo, OpenFrameText } from '../icons'

// Constants
const MINIMIZED_WIDTH = 56 // 3.5rem = 56px
const EXPANDED_WIDTH = 224 // 14rem = 224px
const STORAGE_KEY = 'of.navigationSidebar.minimized'

export interface NavigationSidebarProps {
  config: NavigationSidebarConfig
}

export function NavigationSidebar({ config }: NavigationSidebarProps) {

  const isTablet = useTablet()

  // Initialize minimized state based on tablet mode or config
  // useLocalStorage will read from localStorage first, then fall back to this value
  const [minimized, setMinimized] = useLocalStorage<boolean>(
    STORAGE_KEY,
    isTablet || (config.minimized ?? false)
  )

  // Enable transitions only after the correct width is painted
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleToggleMinimized = useCallback(() => {
    if (isTablet) {
      setMobileMenuOpen(prev => !prev)
    } else {
      setMinimized(prev => !prev)
      config.onToggleMinimized?.()
    }
  }, [isTablet, setMinimized, config])

  const handleItemClick = useCallback((item: NavigationSidebarItem, event?: React.MouseEvent) => {
    event?.stopPropagation()

    // Close mobile menu on navigation
    if (isTablet && mobileMenuOpen) {
      setMobileMenuOpen(false)
    }

    if (item.onClick) {
      item.onClick()
    } else if (item.path) {
      config.onNavigate?.(item.path)
    }
  }, [config, isTablet, mobileMenuOpen])

  const renderNavigationItem = useCallback((
    item: NavigationSidebarItem,
    inOverlay: boolean
  ) => {
    const isActive = item.isActive ?? false
    const isMinimized = isTablet && !inOverlay ? true : minimized
    const shouldShowLabel = isTablet ? inOverlay : (inOverlay || !minimized)

    return (
      <button
        key={item.id}
        onClick={(event) => handleItemClick(item, event)}
        className={cn(
          "w-full flex items-center transition-all duration-200 relative",
          "p-4",
          // Hover and default states
          !isActive && "hover:bg-bg-hover text-text-primary [&_svg]:fill-text-secondary",
          // Active state
          isActive && [
            "bg-[var(--ods-open-yellow-light)] text-accent-primary",
            "[&_svg]:fill-accent-primary"
          ],
          // Layout - proper centering in minimized mode
          isMinimized && !inOverlay
            ? "justify-center"
            : "justify-start gap-2"
        )}
        title={isMinimized && !inOverlay ? item.label : undefined}
        aria-label={item.label}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Active indicator */}
        {isActive && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary"
            aria-hidden="true"
          />
        )}

        {/* Icon container - fixed size for consistent centering */}
        <div
          className={cn(
            "flex items-center justify-center",
            "flex-shrink-0",
            "transition-colors duration-200"
          )}
        >
          {cloneElement(item.icon as React.ReactElement<any>, {
            color: isActive ? "text-accent-primary" : "text-text-secondary"
          })}
        </div>

        {/* Label - only render when needed */}
        {shouldShowLabel && (
          <span
            className={cn(
              "font-['DM_Sans'] font-medium text-[18px] leading-[24px]",
              "flex-1 text-left truncate"
            )}
          >
            {item.label}
          </span>
        )}

        {/* Badge - only show with label */}
        {item.badge && shouldShowLabel && (
          <span
            className={cn(
              "text-sm flex-shrink-0",
              "transition-colors duration-200",
              isActive ? "text-[#ffc008]" : "text-[#888888]"
            )}
          >
            {item.badge}
          </span>
        )}
      </button>
    )
  }, [minimized, isTablet, handleItemClick])

  // Memoize items separation
  const { primaryItems, secondaryItems } = useMemo(() => ({
    primaryItems: config.items.filter(item => item.section !== 'secondary'),
    secondaryItems: config.items.filter(item => item.section === 'secondary')
  }), [config.items])

  const renderSidebarContent = useCallback((inOverlay: boolean) => (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 h-14 border-b border-border-primary">
        <div className="flex-shrink-0">
          <OpenFrameLogo
            className="w-6 h-6"
            upperPathColor="var(--color-text-primary)"
            lowerPathColor="var(--color-accent-primary)"
          />
        </div>

        {(inOverlay || !minimized) && (
          <div className="flex-1 overflow-hidden">
            <OpenFrameText textColor="var(--color-text-primary)" />
          </div>
        )}

        {/* Mobile close button */}
        {inOverlay && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 hover:bg-bg-hover rounded-md transition-colors"
            aria-label="Close menu"
          >
            <svg
              className="w-5 h-5 text-text-primary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Navigation items */}
      <div className="flex-1 flex flex-col justify-between py-4">
        {/* Primary section */}
        <nav className="flex flex-col" aria-label="Primary navigation">
          {primaryItems.map(item => renderNavigationItem(item, inOverlay))}
        </nav>

        {/* Secondary section */}
        {secondaryItems.length > 0 && (
          <nav className="flex flex-col" aria-label="Secondary navigation">
            {secondaryItems.map(item => renderNavigationItem(item, inOverlay))}
          </nav>
        )}
      </div>

      {/* Toggle button footer */}
      {(!isTablet || inOverlay) && (
        <div className="border-t border-border-primary">
          <button
            onClick={inOverlay ? () => setMobileMenuOpen(false) : handleToggleMinimized}
            className={cn(
              "w-full flex items-center gap-2 p-4",
              "hover:bg-bg-hover text-text-primary",
              "transition-colors duration-200",
              (!inOverlay && minimized) ? "justify-center" : "justify-start"
            )}
            title={inOverlay ? "Close Menu" : (minimized ? "Expand Menu" : "Hide Menu")}
            aria-label={inOverlay ? "Close Menu" : (minimized ? "Expand Menu" : "Hide Menu")}
          >
            {inOverlay ? (
              <>
                <DoubleChevronIcon direction="left" className="w-6 h-6" />
                <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px]">
                  Close Menu
                </span>
              </>
            ) : minimized ? (
              <DoubleChevronIcon direction="right" className="w-6 h-6" />
            ) : (
              <>
                <DoubleChevronIcon direction="left" className="w-6 h-6" />
                <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px]">
                  Hide Menu
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Custom footer */}
      {config.footer && (
        <div className="border-t border-border-primary p-4">
          {config.footer}
        </div>
      )}
    </>
  ), [
    minimized,
    primaryItems,
    secondaryItems,
    renderNavigationItem,
    isTablet,
    handleToggleMinimized,
    config.footer
  ])

  const sidebarWidth = useMemo(() => {
    // Use minimized width as default during SSR to prevent layout shift
    if (isTablet === undefined) {
      return `${MINIMIZED_WIDTH}px`
    }
    return isTablet
      ? `${MINIMIZED_WIDTH}px`
      : minimized
        ? `${MINIMIZED_WIDTH}px`
        : `${EXPANDED_WIDTH}px`
  }, [isTablet, minimized])

  // Don't render content until we know the screen size to prevent flashing
  const isHydrated = isTablet !== undefined

  useLayoutEffect(() => {
    if (isHydrated && !transitionsEnabled) {
      // Wait for next frame to ensure width is painted before enabling transitions
      const id = requestAnimationFrame(() => {
        setTransitionsEnabled(true)
      })
      return () => cancelAnimationFrame(id)
    }
  }, [isHydrated, transitionsEnabled])

  return (
    <aside
      className={cn(
        "flex-col h-full hidden md:flex",
        "bg-bg-card border-r border-border-primary",
        transitionsEnabled && "transition-[width] duration-300",
        config.className
      )}
      style={{
        width: sidebarWidth
      }}
      aria-label="Main navigation sidebar"
    >
      {isHydrated && renderSidebarContent(false)}
    </aside>
  )
}
