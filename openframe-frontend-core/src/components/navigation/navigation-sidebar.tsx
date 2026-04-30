"use client"

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/ui/use-local-storage'
import { useLgUp } from '../../hooks/ui/use-media-query'
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
  const isLgUp = useLgUp() ?? false

  // useLocalStorage reads from localStorage first, then falls back to this value
  const [minimized, setMinimized] = useLocalStorage<boolean>(
    STORAGE_KEY,
    !isLgUp || (config.minimized ?? false)
  )

  // Enable transitions only after the correct width is painted
  const [transitionsEnabled, setTransitionsEnabled] = useState(false)

  // On tablet (md but not lg), force minimized layout regardless of stored value
  const isMinimized = !isLgUp || minimized
  const showLabel = isLgUp && !minimized

  const handleToggle = useCallback(() => {
    setMinimized(prev => !prev)
    config.onToggleMinimized?.()
  }, [setMinimized, config])

  const handleItemClick = useCallback((item: NavigationSidebarItem, event?: React.MouseEvent) => {
    event?.stopPropagation()

    if (item.onClick) {
      item.onClick()
    } else if (item.path) {
      config.onNavigate?.(item.path)
    }
  }, [config])

  const { primaryItems, secondaryItems } = useMemo(() => ({
    primaryItems: config.items.filter(item => item.section !== 'secondary'),
    secondaryItems: config.items.filter(item => item.section === 'secondary'),
  }), [config.items])

  const sidebarWidth = useMemo(() => {
    if (isLgUp === undefined) {
      return `${MINIMIZED_WIDTH}px`
    }
    return isMinimized ? `${MINIMIZED_WIDTH}px` : `${EXPANDED_WIDTH}px`
  }, [isLgUp, isMinimized])

  const isHydrated = isLgUp !== undefined

  useLayoutEffect(() => {
    if (isHydrated && !transitionsEnabled) {
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
        "bg-ods-card border-r border-ods-border",
        transitionsEnabled && "transition-[width] duration-300",
        config.className,
      )}
      style={{ width: sidebarWidth }}
      aria-label="Main navigation sidebar"
    >
      {isHydrated && (
        <>
          <NavigationSidebarHeader minimized={isMinimized} />

          <div className="flex-1 flex flex-col justify-between py-4">
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

          {isLgUp && (
            <NavigationSidebarToggle
              minimized={isMinimized}
              showLabel={showLabel}
              onToggle={handleToggle}
            />
          )}
        </>
      )}
    </aside>
  )
}
