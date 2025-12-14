'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { Button, Input, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, SquareAvatar } from '../ui'
import { SunIcon, UserIcon, LogOutIcon } from '../icons'
import { Bell } from 'lucide-react'

export interface AppHeaderProps {
  showSearch?: boolean
  onSearch?: (query: string) => void
  showOrganizations?: boolean
  organizations?: { id: string; name: string }[]
  selectedOrgId?: string
  onOrgChange?: (id: string) => void
  showNotifications?: boolean
  unreadCount?: number
  showThemeSwitcher?: boolean
  // User block
  showUser?: boolean
  userName?: string
  userEmail?: string
  userAvatarUrl?: string | null
  onProfile?: () => void
  onLogout?: () => void
  className?: string
}

export function AppHeader({
  showSearch,
  onSearch,
  showOrganizations,
  organizations = [],
  selectedOrgId,
  onOrgChange,
  showNotifications,
  unreadCount = 0,
  showThemeSwitcher,
  showUser,
  userName,
  userEmail,
  userAvatarUrl,
  onProfile,
  onLogout,
  className
}: AppHeaderProps) {
  const [query, setQuery] = React.useState('')
  const selectedOrg = organizations.find(o => o.id === selectedOrgId)

  const handleSearchSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (onSearch) onSearch(query)
  }, [onSearch, query])

  return (
    <header
      className={cn(
        'w-full sticky top-0 z-40 border-b border-ods-border bg-ods-card h-14',
        'px-6 py-1 flex items-center gap-3',
        className
      )}
    >
      {/* Global Search */}
      {showSearch && (
        <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] max-w-[640px]">
          <Input
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            placeholder="Global Search"
          />
        </form>
      )}

      <div className="flex items-center gap-3 ml-auto">
        {/* Organizations filter */}
        {showOrganizations && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="min-w-[180px] justify-between">
                <span className="truncate text-ods-text-primary">{selectedOrg?.name || 'All Organizations'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[220px]">
              <DropdownMenuItem onClick={() => onOrgChange && onOrgChange('')}>All Organizations</DropdownMenuItem>
              {organizations.map(org => (
                <DropdownMenuItem key={org.id} onClick={() => onOrgChange && onOrgChange(org.id)}>
                  {org.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Notifications */}
        {showNotifications && (
          <Button variant="ghost" className="relative h-10 w-10" aria-label="Notifications">
            <Bell className="h-5 w-5 text-ods-text-primary" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-ods-accent text-text-on-accent text-[10px] rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </Button>
        )}

        {/* Theme Switcher */}
        {showThemeSwitcher && (
          <Button variant="ghost" className="h-10 w-10" aria-label="Toggle theme" centerIcon={<SunIcon width={18} height={18} />} />
        )}

        {/* User Menu */}
        {showUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 px-2 flex items-center gap-2 focus-visible:ring-0"
                leftIcon={<SquareAvatar
                  src={userAvatarUrl || undefined}
                  alt={userName || 'User'}
                  size="sm"
                  variant="round"
                />}
              >
                {userName && (
                  <span className="hidden md:inline text-ods-text-primary max-w-[160px] truncate">{userName}</span>
                )}
              </Button>
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
                  <LogOutIcon className="text-error shrink-0" size={24} />
                  <span className="text-[18px] font-medium text-ods-text-primary">Log Out</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  )
}

export default AppHeader
