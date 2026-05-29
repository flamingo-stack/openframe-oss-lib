'use client'

import React from 'react'
import { useMdUp } from '../../hooks/ui/use-media-query'
import { cn } from '../../utils/cn'
import { useOptionalNotifications } from '../features/notifications/notifications-context'
import { LogOutIcon, OpenFrameLogo, OpenFrameText, UserIcon } from '../icons'
import { BellIcon } from '../icons-v2-generated/interface/bell-icon'
import { Menu01Icon, SearchIcon, XmarkIcon } from '../icons-v2-generated'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, SquareAvatar } from '../ui'
import { HeaderButton } from './header-button'
import { HeaderGlobalSearch } from './header-global-search'
import { HeaderOrganizationFilter } from './header-organization-filter'

export interface AppHeaderProps {
  showSearch?: boolean
  onSearch?: (query: string) => void
  showOrganizations?: boolean
  organizations?: { id: string; name: string }[]
  selectedOrgId?: string
  onOrgChange?: (id: string) => void
  showNotifications?: boolean
  unreadCount?: number
  // User block
  showUser?: boolean
  userName?: string
  userEmail?: string
  userAvatarUrl?: string | null
  onProfile?: () => void
  onLogout?: () => void
  className?: string
  /** Whether the mobile menu is open */
  isMobileMenuOpen: boolean
  /** Callback to toggle mobile menu */
  onToggleMobileMenu?: () => void
  /**
   * When true, all header controls are disabled and visually dimmed
   * EXCEPT the mobile burger menu toggle, which remains interactive.
   */
  disabled?: boolean
}

export const AppHeader = React.memo(function AppHeader({
  showSearch,
  onSearch,
  showOrganizations,
  organizations = [],
  selectedOrgId,
  onOrgChange,
  showNotifications,
  unreadCount = 0,
  showUser,
  userName,
  userEmail,
  userAvatarUrl,
  onProfile,
  onLogout,
  className,
  isMobileMenuOpen,
  onToggleMobileMenu,
  disabled = false,
}: AppHeaderProps) {
  const isMdUp = useMdUp() ?? false

  const dimmedClass = disabled ? 'pointer-events-none opacity-50' : ''

  return (
    <header
      className={cn(
        'flex items-center w-full sticky top-0 z-40 border-b border-ods-border bg-ods-card h-12 md:h-14 divide-x divide-ods-border',
        className
      )}
    >
      {/* Mobile: Burger Menu Button */}
      {!isMdUp && <HeaderButton
        onClick={onToggleMobileMenu}
        isActive={isMobileMenuOpen}
        icon={isMobileMenuOpen ? <XmarkIcon className="w-4 h-4" /> : <Menu01Icon className="w-4 h-4" />}
        aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMobileMenuOpen}
      />}

      {/* Mobile: Logo section */}
      {!isMdUp && <div className="flex items-center gap-2 px-3 h-full flex-1">
        <OpenFrameLogo
          className="w-6 h-6 shrink-0"
          upperPathColor="var(--color-text-primary)"
          lowerPathColor="var(--color-accent-primary)"
        />
        <OpenFrameText textColor="var(--color-text-primary)" className="h-4" />
      </div>}

      {/* Desktop: Global Search */}
      {showSearch ? (
        <HeaderGlobalSearch
          onSubmit={onSearch}
          className={cn("hidden md:flex", dimmedClass)}
        />
      ) : <div className="hidden md:flex w-full" />}

      {/* Mobile: Search button */}
      {showSearch && (
        <HeaderButton
          icon={<SearchIcon className="w-4 h-4 md:w-6 md:h-6" />}
          aria-label="Search"
          className={cn("md:hidden", dimmedClass)}
          disabled={disabled}
        />
      )}

      {/* Desktop: Organizations filter */}
      {showOrganizations && (
        <HeaderOrganizationFilter
          organizations={organizations}
          selectedOrgId={selectedOrgId}
          onOrgChange={onOrgChange}
          className={cn("hidden lg:flex", dimmedClass)}
        />
      )}

      {/* Notifications button */}
      {showNotifications && (
        <NotificationsHeaderButton
          fallbackUnreadCount={unreadCount}
          disabled={disabled}
          dimmedClass={dimmedClass}
        />
      )}

      {isMdUp && showUser && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <HeaderButton
              icon={<SquareAvatar
                src={userAvatarUrl || undefined}
                alt={userName || 'User'}
                size="sm"
                variant="round"
                className="shrink-0 w-8 h-8 md:w-10 md:h-10"
              />}
              aria-label="User"
              disabled={disabled}
              className={dimmedClass}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[280px] p-0 bg-ods-bg border-ods-border rounded-[6px] overflow-hidden"
          >
            {/* User info header section */}
            <div className="bg-ods-card border-b border-ods-border p-3 flex items-center gap-2">
              <SquareAvatar
                src={userAvatarUrl || undefined}
                alt={userName || 'User'}
                size="sm"
                variant="round"
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                {userName && (
                  <div className="text-[18px] font-medium text-ods-text-primary truncate leading-6">
                    {userName}
                  </div>
                )}
                {userEmail && (
                  <div className="text-[14px] text-ods-text-secondary truncate leading-5">
                    {userEmail}
                  </div>
                )}
              </div>
            </div>

            {/* Menu items */}
            <DropdownMenuItem
              onClick={onProfile}
              className="bg-ods-card border-b border-ods-border rounded-none px-3 py-3 hover:bg-ods-bg-card/80 focus:bg-ods-bg-card/80 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <UserIcon className="h-6 w-6 text-ods-text-primary shrink-0" />
                <span className="text-[18px] font-medium text-ods-text-primary">Profile Settings</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={onLogout}
              className="bg-ods-card rounded-none px-3 py-3 hover:bg-ods-bg-card/80 focus:bg-ods-bg-card/80 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <LogOutIcon className="text-ods-error shrink-0" size={24} />
                <span className="text-[18px] font-medium text-ods-text-primary">Log Out</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
})

interface NotificationsHeaderButtonProps {
  fallbackUnreadCount: number
  disabled: boolean
  dimmedClass: string
}

function NotificationsHeaderButton({
  fallbackUnreadCount,
  disabled,
  dimmedClass,
}: NotificationsHeaderButtonProps) {
  const ctx = useOptionalNotifications()
  const hasUnread = (ctx?.unreadCount ?? fallbackUnreadCount) > 0
  const isActive = ctx?.isOpen ?? false
  const onClick = ctx?.toggle

  return (
    <HeaderButton
      icon={
        <div className="relative w-4 h-4 md:w-6 md:h-6">
          <BellIcon className="w-full h-full" />
          {hasUnread && (
            <span
              className="absolute top-0 right-0 bg-ods-warning rounded-full w-1.5 h-1.5 md:w-2 md:h-2"
            />
          )}
        </div>
      }
      aria-label="Notifications"
      onClick={onClick}
      isActive={isActive}
      disabled={disabled || !onClick}
      className={dimmedClass}
    />
  )
}

export default AppHeader
