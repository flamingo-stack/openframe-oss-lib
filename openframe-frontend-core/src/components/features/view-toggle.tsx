"use client"

import React from 'react'
import { ToggleGroup, ToggleGroupItem } from '../ui'
import { GridViewIcon, TableViewIcon } from '../icons'
import { cn } from '../../utils/cn'

type ViewMode = 'grid' | 'table'

interface ViewToggleProps {
  /**
   * Current selected view mode
   */
  value: ViewMode
  /**
   * Callback fired when view mode changes
   */
  onValueChange: (value: ViewMode) => void
  /**
   * Whether the toggle is disabled
   */
  disabled?: boolean
  /**
   * Additional CSS classes for the toggle group
   */
  className?: string
  /**
   * Size of the toggle buttons
   */
  size?: 'default' | 'sm' | 'lg'
  /**
   * Custom ARIA label for accessibility
   */
  'aria-label'?: string
}

/**
 * ViewToggle - A 2-state button component for switching between grid and table views
 *
 * Built on top of Radix UI ToggleGroup for accessibility and proper keyboard navigation.
 * Uses ODS design tokens for consistent theming across platforms.
 *
 * @example
 * ```tsx
 * const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
 *
 * <ViewToggle
 *   value={viewMode}
 *   onValueChange={setViewMode}
 *   className="bg-ods-card border border-ods-border"
 * />
 * ```
 */
export function ViewToggle({
  value,
  onValueChange,
  disabled = false,
  className,
  size = 'default',
  'aria-label': ariaLabel = 'Switch between grid and table view',
}: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue: ViewMode) => {
        // Only update if we have a valid value (user clicked a different option)
        if (newValue && newValue !== value) {
          onValueChange(newValue)
        }
      }}
      className={cn(
        "flex bg-ods-card border border-ods-border rounded-[6px] p-1",
        className
      )}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <ToggleGroupItem
        value="grid"
        size={size}
        className={cn(
          "p-2 rounded transition-all duration-200",
          value === 'grid'
            ? "bg-ods-accent text-ods-text-on-accent"
            : "text-ods-text-secondary hover:text-ods-text-primary hover:bg-ods-bg-hover",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Grid view"
        disabled={disabled}
      >
        <GridViewIcon 
          className="w-5 h-5" 
          color={
            disabled 
              ? "var(--ods-system-greys-grey)" 
              : value === 'grid' 
              ? "var(--ods-system-greys-black)" 
              : "var(--ods-system-greys-grey)"
          }
        />
      </ToggleGroupItem>

      <ToggleGroupItem
        value="table"
        size={size}
        className={cn(
          "p-2 rounded transition-all duration-200",
          value === 'table'
            ? "bg-ods-accent text-ods-text-on-accent"
            : "text-ods-text-secondary hover:text-ods-text-primary hover:bg-ods-bg-hover",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        aria-label="Table view"
        disabled={disabled}
      >
        <TableViewIcon 
          className="w-5 h-5" 
          color={
            disabled 
              ? "var(--ods-system-greys-grey)" 
              : value === 'table' 
              ? "var(--ods-system-greys-black)" 
              : "var(--ods-system-greys-grey)"
          }
        />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

// Type exports for consumers
export type { ViewMode, ViewToggleProps }