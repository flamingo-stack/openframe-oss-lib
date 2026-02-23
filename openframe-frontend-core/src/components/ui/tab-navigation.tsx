'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { cn } from '../../utils/cn'

export interface TabItem {
  id: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  component?: React.ComponentType<any>
  indicator?: 'good' | 'warning' | 'error'
}

export interface TabNavigationUrlSyncOptions {
  paramName?: string       // Default: 'tab'
  replaceState?: boolean   // Default: true (use replace instead of push)
}

interface TabNavigationProps {
  // Legacy controlled mode (when urlSync is disabled)
  activeTab?: string
  onTabChange?: (tabId: string) => void

  tabs: TabItem[]
  className?: string

  // URL sync mode
  urlSync?: boolean | TabNavigationUrlSyncOptions
  defaultTab?: string  // Fallback when no valid tab in URL or initial value

  // Render prop to provide active tab to children
  children?: (activeTab: string) => React.ReactNode
}

export function TabNavigation({
  activeTab: controlledActiveTab,
  onTabChange: controlledOnTabChange,
  tabs,
  className,
  urlSync = false,
  defaultTab,
  children
}: TabNavigationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Determine URL sync settings
  const isUrlSyncEnabled = !!urlSync
  const paramName = typeof urlSync === 'object' ? (urlSync.paramName || 'tab') : 'tab'
  const replaceState = typeof urlSync === 'object' ? (urlSync.replaceState !== false) : true

  // Valid tab IDs set
  const validTabIds = useMemo(() => new Set(tabs.map(t => t.id)), [tabs])

  // Get initial tab value
  const getInitialTab = () => {
    if (isUrlSyncEnabled) {
      // Try to read from URL
      const fromUrl = searchParams?.get(paramName) || ''
      if (validTabIds.has(fromUrl)) {
        return fromUrl
      }
    }

    // Fall back to defaultTab or first tab
    return defaultTab || tabs[0]?.id || ''
  }

  // Internal state for URL sync mode
  const [internalActiveTab, setInternalActiveTab] = useState(getInitialTab)

  // Use internal state if URL sync is enabled, otherwise use controlled prop
  const activeTab = isUrlSyncEnabled ? internalActiveTab : (controlledActiveTab || '')

  // Sync with URL changes (back/forward navigation)
  useEffect(() => {
    if (!isUrlSyncEnabled) return

    const fromUrl = searchParams?.get(paramName) || ''
    const nextTab = validTabIds.has(fromUrl) ? fromUrl : (defaultTab || tabs[0]?.id || '')

    if (nextTab !== internalActiveTab) {
      setInternalActiveTab(nextTab)
    }
  }, [isUrlSyncEnabled, searchParams, paramName, validTabIds, defaultTab, tabs, internalActiveTab])

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    if (isUrlSyncEnabled) {
      // Update internal state
      setInternalActiveTab(tabId)

      // Update URL
      const params = new URLSearchParams(searchParams?.toString())
      params.set(paramName, tabId)
      const method = replaceState ? 'replace' : 'push'
      router[method](`${pathname}?${params.toString()}`)

      // Call optional callback
      controlledOnTabChange?.(tabId)
    } else {
      // Legacy controlled mode
      controlledOnTabChange?.(tabId)
    }
  }

  return (
    <>
      <div className={cn("relative w-full h-14 border-b border-ods-border", className)}>
        <div className="flex gap-1 items-center justify-start h-full overflow-x-auto overflow-y-hidden">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex gap-1 items-center justify-center p-4 relative shrink-0 h-14 cursor-pointer",
                  "transition-all duration-200 bg-transparent border-none outline-none",
                  isActive
                    ? 'bg-gradient-to-b from-[rgba(255,255,255,0)] to-[rgba(255,255,255,0.1)]'
                    : 'hover:bg-gradient-to-b hover:from-[rgba(255,255,255,0)] hover:to-[rgba(255,255,255,0.1)]'
                )}
              >
                <div className="relative flex items-center justify-center">
                  <tab.icon
                    className={cn("h-6 w-6 transition-colors", isActive ? 'text-ods-accent' : 'text-ods-text-secondary')}
                  />
                  {tab.indicator && (
                    <div className={cn(
                      "absolute right-0 top-[-3px] w-3 h-3 rounded-full border-2 border-ods-bg",
                      tab.indicator === 'error' && 'bg-ods-error',
                      tab.indicator === 'warning' && 'bg-ods-accent',
                      tab.indicator === 'good' && 'bg-green-500'
                    )} />
                  )}
                </div>

                <span className={cn(
                  "font-['DM_Sans'] font-medium text-[18px] leading-6 whitespace-nowrap transition-colors",
                  isActive ? 'text-ods-text-primary' : 'text-ods-text-secondary'
                )}>
                  {tab.label}
                </span>

                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-ods-accent" />
                )}
              </button>
            )
          })}

        </div>

        {/* Fade shadows */}
        <div className="absolute left-0 top-0 w-10 h-14 pointer-events-none bg-gradient-to-r from-ods-bg to-transparent" />
        <div className="absolute right-0 top-0 w-10 h-14 pointer-events-none bg-gradient-to-r from-transparent to-ods-bg" />
      </div>

      {/* Render children with active tab if provided */}
      {children && children(activeTab)}
    </>
  )
}

// Utility function to get tab by id
export const getTabById = (tabs: TabItem[], tabId: string): TabItem | undefined =>
  tabs.find(tab => tab.id === tabId)

// Utility function to get tab component
export const getTabComponent = (tabs: TabItem[], tabId: string): React.ComponentType<any> | null => {
  const tab = getTabById(tabs, tabId)
  return tab?.component || null
}