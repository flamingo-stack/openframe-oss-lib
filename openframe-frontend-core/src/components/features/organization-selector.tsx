'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBatchImages } from '../../hooks/use-batch-images'
import { cn } from '../../utils/cn'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select'
import { Skeleton } from '../ui/skeleton'
import { OrganizationIcon } from './organization-icon'

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

  /**
   * Whether to show a search input inside the dropdown (default: false)
   */
  searchable?: boolean

  /**
   * Placeholder text for the search input
   */
  searchPlaceholder?: string
}

/**
 * OrganizationSelector - Unified dropdown component for selecting organizations
 *
 * Features:
 * - Pre-fetched organization images via useBatchImages
 * - OrganizationIcon with fallback to initials
 * - Consistent styling with ODS design tokens
 * - Configurable icon sizes and trigger height
 * - Built-in search filtering (opt-in via `searchable` prop)
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
 *   searchable
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
  isLoading = false,
  searchable = false,
  searchPlaceholder = 'Search...'
}: OrganizationSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Limit organizations to maxItems
  const limitedOrganizations = useMemo(
    () => organizations.slice(0, maxItems),
    [organizations, maxItems]
  )

  // Filter organizations by search query
  const filteredOrganizations = useMemo(
    () =>
      searchQuery
        ? limitedOrganizations.filter((org) =>
            org.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : limitedOrganizations,
    [limitedOrganizations, searchQuery]
  )

  // Pre-fetch organization images
  const organizationImageUrls = useMemo(
    () => limitedOrganizations.map((org) => org.imageUrl).filter(Boolean) as string[],
    [limitedOrganizations]
  )
  const fetchedImageUrls = useBatchImages(organizationImageUrls)

  // Find selected organization for display
  const selectedOrg = useMemo(
    () => limitedOrganizations.find((org) => org.organizationId === value),
    [limitedOrganizations, value]
  )

  // Close dropdown and reset search
  const closeDropdown = useCallback(() => {
    setOpen(false)
    setSearchQuery('')
  }, [])

  // Handle item selection
  const handleSelect = useCallback(
    (organizationId: string) => {
      onValueChange(organizationId)
      closeDropdown()
    },
    [onValueChange, closeDropdown]
  )

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, closeDropdown])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown()
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, closeDropdown])

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [open])

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

  // Non-searchable mode: use standard Radix Select
  if (!searchable) {
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

  // Searchable mode: custom popover dropdown with built-in search
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <div className="text-ods-text-primary text-[18px] font-medium">
          {label}
        </div>
      )}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border border-ods-border p-2',
            'text-[14px] md:text-[18px] font-medium',
            'bg-[#161616] text-ods-text-primary',
            'hover:border-ods-accent/30 focus:border-ods-accent',
            'focus:outline-none focus:ring-1 focus:ring-ods-accent/20 focus:ring-offset-0',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-200 cursor-pointer',
            triggerHeight,
            triggerClassName
          )}
        >
          <span className={cn('truncate', !selectedOrg && 'text-ods-text-secondary')}>
            {selectedOrg ? (
              <span className="flex items-center gap-3">
                <OrganizationIcon
                  imageUrl={
                    selectedOrg.imageUrl
                      ? fetchedImageUrls[selectedOrg.imageUrl]
                      : undefined
                  }
                  organizationName={selectedOrg.name}
                  size={iconSize}
                />
                <span>{selectedOrg.name}</span>
              </span>
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown className="h-4 w-4 text-ods-text-muted shrink-0 ml-2" />
        </button>

        {open && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute z-[9999] mt-1 w-full rounded-lg border border-ods-border bg-[#161616] text-ods-text-primary shadow-md',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2'
            )}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-ods-border">
              <Search className="h-4 w-4 text-ods-text-muted shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full bg-transparent text-[14px] md:text-[16px] text-ods-text-primary placeholder:text-ods-text-secondary outline-none"
              />
            </div>

            {/* Options list */}
            <div className="max-h-[300px] overflow-y-auto">
              {filteredOrganizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => handleSelect(org.organizationId)}
                  className={cn(
                    'relative flex w-full items-center py-3 pl-8 pr-4 cursor-pointer',
                    'text-[14px] md:text-[18px] font-medium',
                    'hover:bg-ods-accent/10 transition-colors duration-150',
                    org.organizationId === value && 'bg-ods-accent/5'
                  )}
                >
                  {org.organizationId === value && (
                    <span className="absolute left-2 flex h-5 w-5 items-center justify-center">
                      <Check className="h-5 w-5 text-ods-accent" />
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <OrganizationIcon
                      imageUrl={
                        org.imageUrl ? fetchedImageUrls[org.imageUrl] : undefined
                      }
                      organizationName={org.name}
                      size={iconSize}
                    />
                    <span>{org.name}</span>
                  </div>
                </button>
              ))}
              {filteredOrganizations.length === 0 && (
                <div className="py-3 text-center text-[14px] text-ods-text-secondary">
                  No organizations found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
