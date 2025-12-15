'use client'

import React, { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { Skeleton } from '../ui/skeleton'
import { OrganizationIcon } from './organization-icon'
import { useBatchImages } from '../../hooks/use-batch-images'
import { cn } from '../../utils/cn'

export interface OrganizationOption {
  /**
   * Unique identifier for the organization
   */
  id: string

  /**
   * Organization ID used as the select value
   */
  organizationId: string

  /**
   * Display name of the organization
   */
  name: string

  /**
   * Whether this is the default organization
   */
  isDefault?: boolean

  /**
   * URL for the organization's logo/image
   */
  imageUrl?: string
}

export interface OrganizationSelectorProps {
  /**
   * Array of organizations to display in the dropdown
   */
  organizations: OrganizationOption[]

  /**
   * Currently selected organization ID
   */
  value: string

  /**
   * Callback when selection changes
   */
  onValueChange: (value: string) => void

  /**
   * Placeholder text when no organization is selected
   */
  placeholder?: string

  /**
   * Label text displayed above the selector
   */
  label?: string

  /**
   * Size of organization icons
   */
  iconSize?: 'xs' | 'sm' | 'md'

  /**
   * Whether the selector is disabled
   */
  disabled?: boolean

  /**
   * Additional CSS classes for the trigger
   */
  triggerClassName?: string

  /**
   * Additional CSS classes for the container
   */
  className?: string

  /**
   * Height of the trigger button
   */
  triggerHeight?: string

  /**
   * Maximum number of organizations to display (default: 1000)
   */
  maxItems?: number

  /**
   * Whether the selector is in a loading state
   */
  isLoading?: boolean
}

/**
 * OrganizationSelector - Unified dropdown component for selecting organizations
 *
 * Features:
 * - Pre-fetched organization images via useBatchImages
 * - OrganizationIcon with fallback to initials
 * - Consistent styling with ODS design tokens
 * - Configurable icon sizes and trigger height
 *
 * Usage Example:
 * ```tsx
 * import { OrganizationSelector } from '@flamingo/ui-kit/components/features'
 *
 * const [selectedOrgId, setSelectedOrgId] = useState('')
 *
 * <OrganizationSelector
 *   organizations={orgs}
 *   value={selectedOrgId}
 *   onValueChange={setSelectedOrgId}
 *   label="Select Organization"
 *   placeholder="Choose organization"
 * />
 * ```
 */
export function OrganizationSelector({
  organizations,
  value,
  onValueChange,
  placeholder = 'Choose organization',
  label,
  iconSize = 'sm',
  disabled = false,
  triggerClassName,
  className,
  triggerHeight = 'h-[60px]',
  maxItems = 1000,
  isLoading = false
}: OrganizationSelectorProps) {
  // Limit organizations to maxItems
  const limitedOrganizations = useMemo(
    () => organizations.slice(0, maxItems),
    [organizations, maxItems]
  )

  // Pre-fetch organization images
  const organizationImageUrls = useMemo(
    () => limitedOrganizations.map((org) => org.imageUrl).filter(Boolean) as string[],
    [limitedOrganizations]
  )
  const fetchedImageUrls = useBatchImages(organizationImageUrls)

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        {label && (
          <div className="text-ods-text-primary text-[18px] font-medium">
            {label}
          </div>
        )}
        <div
          className={cn(
            'bg-ods-card border border-ods-border rounded-md flex items-center px-3',
            triggerHeight,
            triggerClassName
          )}
        >
          <div className="flex items-center gap-3 w-full">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 ml-auto" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <div className="text-ods-text-primary text-[18px] font-medium">
          {label}
        </div>
      )}
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          className={cn(
            'bg-ods-card border border-ods-border',
            triggerHeight,
            triggerClassName
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {limitedOrganizations.map((org) => (
            <SelectItem key={org.id} value={org.organizationId}>
              <div className="flex items-center gap-3">
                <OrganizationIcon
                  imageUrl={
                    org.imageUrl ? fetchedImageUrls[org.imageUrl] : undefined
                  }
                  organizationName={org.name}
                  size={iconSize}
                  preFetched={true}
                />
                <span>{org.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
