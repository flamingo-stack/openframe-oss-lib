'use client'

import { cn } from '../../utils/cn'
import { Filter02Icon } from '../icons-v2-generated'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui'

export interface HeaderOrganizationFilterOrganization {
  id: string
  name: string
  deviceCount?: number
}

export interface HeaderOrganizationFilterProps {
  /** List of organizations */
  organizations?: HeaderOrganizationFilterOrganization[]
  /** Currently selected organization ID */
  selectedOrgId?: string
  /** Callback when organization changes */
  onOrgChange?: (id: string) => void
  /** Total device count (shown when "All Organizations" is selected) */
  totalDeviceCount?: number
  /** Additional class names */
  className?: string
}

export function HeaderOrganizationFilter({
  organizations = [],
  selectedOrgId,
  onOrgChange,
  totalDeviceCount,
  className
}: HeaderOrganizationFilterProps) {
  const selectedOrg = organizations.find(o => o.id === selectedOrgId)
  const displayName = selectedOrg?.name || 'All Organizations'
  const deviceCount = selectedOrg?.deviceCount ?? totalDeviceCount

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-4 h-full px-4",
            "bg-ods-card border-l border-ods-border",
            "w-[240px] shrink-0",
            "hover:bg-ods-bg-hover transition-colors",
            className
          )}
        >
          <Filter02Icon className="w-4 h-4 shrink-0 text-ods-text-secondary" />
          <div className="flex flex-col items-start justify-center min-w-0">
            <span className="font-mono text-sm font-medium leading-5 text-ods-text-primary uppercase tracking-tight truncate">
              {displayName}
            </span>
            {deviceCount !== undefined && (
              <span className="text-sm font-medium leading-5 text-ods-text-secondary truncate">
                {deviceCount.toLocaleString()} Devices
              </span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuItem onClick={() => onOrgChange?.('')}>
          All Organizations
        </DropdownMenuItem>
        {organizations.map(org => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onOrgChange?.(org.id)}
          >
            {org.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default HeaderOrganizationFilter
