'use client';

import { cn } from '../../utils/cn';
import { Filter02Icon } from '../icons-v2-generated';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui';

export interface HeaderOrganizationFilterOrganization {
  id: string;
  name: string;
  deviceCount?: number;
}

export interface HeaderOrganizationFilterProps {
  /** List of organizations */
  organizations?: HeaderOrganizationFilterOrganization[];
  /** Currently selected organization ID */
  selectedOrgId?: string;
  /** Callback when organization changes */
  onOrgChange?: (id: string) => void;
  /** Total device count (shown when "All Organizations" is selected) */
  totalDeviceCount?: number;
  /** Additional class names */
  className?: string;
}

export function HeaderOrganizationFilter({
  organizations = [],
  selectedOrgId,
  onOrgChange,
  totalDeviceCount,
  className,
}: HeaderOrganizationFilterProps) {
  const selectedOrg = organizations.find(o => o.id === selectedOrgId);
  const displayName = selectedOrg?.name || 'All Organizations';
  const deviceCount = selectedOrg?.deviceCount ?? totalDeviceCount;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex h-full items-center gap-4 px-4',
            // Transparent so the cell inherits the bar's background.
            'border-l border-ods-border bg-transparent',
            'w-[240px] shrink-0',
            'transition-colors hover:bg-ods-bg-hover',
            className,
          )}
        >
          <Filter02Icon className="h-4 w-4 shrink-0 text-ods-text-secondary" />
          <div className="flex min-w-0 flex-col items-start justify-center">
            <span className="truncate text-ods-text-primary text-h5" title={displayName}>
              {displayName}
            </span>
            {deviceCount !== undefined && (
              <span className="truncate text-ods-text-secondary text-h6">{deviceCount.toLocaleString()} Devices</span>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[240px]">
        <DropdownMenuItem onClick={() => onOrgChange?.('')}>All Organizations</DropdownMenuItem>
        {organizations.map(org => (
          <DropdownMenuItem key={org.id} onClick={() => onOrgChange?.(org.id)}>
            {org.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default HeaderOrganizationFilter;
