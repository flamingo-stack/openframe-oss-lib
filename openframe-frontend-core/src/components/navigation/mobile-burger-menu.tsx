"use client"

import React, { useCallback, useEffect } from 'react'
import { NavigationSidebarConfig, NavigationSidebarItem } from '../../types/navigation'
import { cn } from '../../utils'
import { Logout02Icon, PenEditIcon, UserSearchIcon } from '../icons-v2-generated'
import { Button, SquareAvatar } from '../ui'

// Header height constant (h-12 = 48px)
const HEADER_HEIGHT = 48

export interface MobileBurgerMenuProps {
  /** Whether the menu is open */
  isOpen: boolean
  /** Callback to close the menu */
  onClose: () => void
  /** Sidebar configuration */
  config: NavigationSidebarConfig
  /** User info for the header card */
  user?: {
    userName?: string
    userEmail?: string
    userAvatarUrl?: string | null
    userRole?: string
  }
  /** Callback when search user button is clicked */
  onSearchUser?: () => void
  /** Callback when edit profile button is clicked */
  onEditProfile?: () => void
  /** Callback when logout button is clicked */
  onLogout?: () => void
}

export function MobileBurgerMenu({
  isOpen,
  onClose,
  config,
  user,
  onSearchUser,
  onEditProfile,
  onLogout
}: MobileBurgerMenuProps) {
  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleItemClick = useCallback((item: NavigationSidebarItem) => {
    if (item.onClick) {
      item.onClick()
    } else if (item.path) {
      config.onNavigate?.(item.path)
    }
    onClose()
  }, [config, onClose])

  // Separate primary and secondary items
  const primaryItems = config.items.filter(item => item.section !== 'secondary')
  const secondaryItems = config.items.filter(item => item.section === 'secondary')

  const renderNavigationItem = (item: NavigationSidebarItem, isGridItem = false) => {
    const isActive = item.isActive ?? false

    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        className={cn(
          "flex items-center gap-1 p-3 relative",
          "transition-colors duration-200",
          "bg-ods-card border border-ods-border rounded-md",
          "hover:bg-ods-hover",
          isGridItem ? "flex-1 min-w-0" : "w-full",
          // Active state
          isActive && "border-ods-accent"
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Icon */}
        {item.icon && (
          <div className="flex-shrink-0 size-4 flex items-center justify-center">
            {React.cloneElement(item.icon as React.ReactElement<any>, {
              size: 16,
              color: isActive ? "var(--color-accent-primary)" : "var(--color-text-secondary)"
            })}
          </div>
        )}

        {/* Label */}
        <span className={cn(
          "font-['DM_Sans'] font-medium text-sm leading-5 flex-1 text-left truncate",
          isActive ? "text-ods-accent" : "text-ods-text-primary"
        )}>
          {item.label}
        </span>
      </button>
    )
  }

  // Render grid of navigation items (2 columns)
  const renderNavigationGrid = (items: NavigationSidebarItem[]) => {
    const rows: NavigationSidebarItem[][] = []
    for (let i = 0; i < items.length; i += 2) {
      rows.push(items.slice(i, i + 2))
    }

    return (
      <div className="flex flex-col gap-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-3">
            {row.map((item) => (
              <React.Fragment key={item.id}>
                {renderNavigationItem(item, true)}
              </React.Fragment>
            ))}
            {/* Fill empty space if odd number of items in last row */}
            {row.length === 1 && <div className="flex-1" />}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Blur backdrop - positioned below header */}
      <div
        className={cn(
          "fixed inset-0 z-[100] md:hidden",
          "backdrop-blur-sm bg-ods-bg-overlay",
          "transition-all duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ top: HEADER_HEIGHT }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel - positioned below header with slide-down animation */}
      <div
        className={cn(
          "fixed left-0 right-0 z-[101] md:hidden",
          "flex flex-col",
          "bg-ods-bg border-b border-ods-border",
          "transition-all duration-300 ease-out",
          "overflow-hidden",
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        )}
        style={{
          top: HEADER_HEIGHT,
          maxHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
      >
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-4">
          {/* User Card */}
          {user && (
            <div className="flex items-center gap-3 p-3 bg-ods-card border border-ods-border rounded-md">
              <SquareAvatar
                src={user.userAvatarUrl || undefined}
                alt={user.userName || 'User'}
                fallback={user.userName}
                size="lg"
                variant="round"
                className="w-12 h-12 shrink-0"
              />

              {/* User Info */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-ods-text-primary truncate">
                    {user.userName || 'User'}
                  </span>
                  {user.userRole && (
                    <span className="shrink-0 px-2 py-0.5 bg-ods-card border border-ods-border rounded-md font-medium text-xs text-ods-text-primary uppercase tracking-tight">
                      {user.userRole}
                    </span>
                  )}
                </div>
                {user.userEmail && (
                  <span className="font-medium text-xs text-ods-text-secondary truncate">
                    {user.userEmail}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {onSearchUser && (
                  <Button
                    size="icon"
                    onClick={onSearchUser}
                    variant="outline"
                    aria-label="Search users"
                  >
                    <UserSearchIcon className="size-4 text-ods-text-primary" />
                  </Button>
                )}
                {onEditProfile && (
                  <Button
                    size="icon"
                    onClick={onEditProfile}
                    variant="outline"
                    aria-label="Edit profile"
                  >
                    <PenEditIcon className="size-4 text-ods-text-primary" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Primary Navigation Items - Grid Layout */}
          <nav aria-label="Primary navigation">
            {renderNavigationGrid(primaryItems)}
          </nav>

          {/* Secondary Navigation Items - Full Width */}
          {secondaryItems.length > 0 && (
            <nav aria-label="Secondary navigation" className="flex flex-col gap-3">
              {secondaryItems.map((item) => (
                <React.Fragment key={item.id}>
                  {renderNavigationItem(item, false)}
                </React.Fragment>
              ))}
            </nav>
          )}

          {/* Logout Button */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-1 p-3 bg-ods-card border border-ods-border rounded-md hover:bg-ods-hover transition-colors"
            >
              <Logout02Icon className="size-4 text-error" />
              <span className="font-['DM_Sans'] font-medium text-sm leading-5 flex-1 text-left text-ods-text-primary">
                Log Out
              </span>
            </button>
          )}
        </div>

        {/* Footer */}
        {config.footer && (
          <div className="border-t border-ods-border p-4 shrink-0">
            {config.footer}
          </div>
        )}
      </div>
    </>
  )
}
