'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { cn } from '../../utils/cn'

export interface TabItem {
  id: string
  label: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  component?: React.ComponentType<any>
  hasAlert?: boolean
  alertType?: 'warning' | 'error'
}

export interface TabNavigationUrlSyncOptions {
  paramName?: string       // Default: 'tab'
  replaceState?: boolean   // Default: true (use replace instead of push)
}

interface TabNavigationBaseProps {
  activeTab?: string
  onTabChange?: (tabId: string) => void
  tabs: TabItem[]
  className?: string
  defaultTab?: string
  children?: (activeTab: string) => React.ReactNode
}

interface TabNavigationProps extends TabNavigationBaseProps {
  urlSync?: boolean | TabNavigationUrlSyncOptions
}

/**
 * Core tab bar UI — no router dependencies.
 */
function TabNavigationBase({
  activeTab: controlledActiveTab,
  onTabChange,
  tabs,
  className,
  defaultTab,
  children
}: TabNavigationBaseProps) {
  const activeTab = controlledActiveTab || defaultTab || tabs[0]?.id || ''

  return (
    <>
      <div
        className={cn(
          "relative w-full border-b border-ods-border bg-ods-bg",
          className
        )}
      >
        <div className="flex gap-1 items-center justify-start px-4 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={cn(
                  "flex gap-1 items-center justify-center p-4 relative shrink-0",
                  "transition-all duration-200 cursor-pointer",
                  "font-['DM_Sans'] font-medium text-lg leading-6",
                  isActive
                    ? "bg-gradient-to-b from-[rgba(255,192,8,0)] to-[rgba(255,192,8,0.1)] text-ods-text-primary"
                    : "text-ods-text-secondary hover:text-ods-text-primary hover:bg-ods-bg-hover"
                )}
              >
                <div className="relative flex items-center justify-center">
                  <Icon
                    className="h-6 w-6 transition-colors"
                    color={isActive ? '#ffc008' : '#888888'}
                  />
                  {tab.hasAlert && (
                    <div
                      className={cn(
                        "absolute -top-1 -right-1 w-2 h-2 rounded-full",
                        tab.alertType === 'error' ? 'bg-ods-error' : 'bg-ods-accent'
                      )}
                    />
                  )}
                </div>

                <span className="whitespace-nowrap">{tab.label}</span>

                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-ods-accent" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {children && children(activeTab)}
    </>
  )
}

/**
 * Wrapper that adds URL-sync via Next.js App Router.
 * Only mounts router hooks when urlSync is enabled.
 */
function TabNavigationWithUrlSync({
  urlSync,
  tabs,
  defaultTab,
  activeTab: _controlledActiveTab,
  onTabChange: controlledOnTabChange,
  ...rest
}: TabNavigationProps) {
  // Lazy-import to avoid hard dependency at module level
  const { useRouter, usePathname, useSearchParams } = require('next/navigation')

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const paramName = typeof urlSync === 'object' ? (urlSync.paramName || 'tab') : 'tab'
  const replaceState = typeof urlSync === 'object' ? (urlSync.replaceState !== false) : true

  const validTabIds = useMemo(() => new Set(tabs.map(t => t.id)), [tabs])

  const getInitialTab = () => {
    const fromUrl = searchParams?.get(paramName) || ''
    if (validTabIds.has(fromUrl)) return fromUrl
    return defaultTab || tabs[0]?.id || ''
  }

  const [activeTab, setActiveTab] = useState(getInitialTab)

  // Sync with URL changes (back/forward navigation)
  useEffect(() => {
    const fromUrl = searchParams?.get(paramName) || ''
    const nextTab = validTabIds.has(fromUrl) ? fromUrl : (defaultTab || tabs[0]?.id || '')
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [searchParams, paramName, validTabIds, defaultTab, tabs, activeTab])

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)

    const params = new URLSearchParams(searchParams?.toString())
    params.set(paramName, tabId)
    const method = replaceState ? 'replace' : 'push'
    router[method](`${pathname}?${params.toString()}`)

    controlledOnTabChange?.(tabId)
  }

  return (
    <TabNavigationBase
      {...rest}
      tabs={tabs}
      defaultTab={defaultTab}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  )
}

/**
 * Tab navigation component.
 * Supports two modes:
 * - Controlled mode (default): pass `activeTab` and `onTabChange`
 * - URL sync mode: pass `urlSync` to sync active tab with URL search params
 */
export function TabNavigation(props: TabNavigationProps) {
  if (props.urlSync) {
    return <TabNavigationWithUrlSync {...props} />
  }
  return <TabNavigationBase {...props} />
}

// Utility function to get tab by id
export const getTabById = (tabs: TabItem[], tabId: string): TabItem | undefined =>
  tabs.find(tab => tab.id === tabId)

// Utility function to get tab component
export const getTabComponent = (tabs: TabItem[], tabId: string): React.ComponentType<any> | null => {
  const tab = getTabById(tabs, tabId)
  return tab?.component || null
}
