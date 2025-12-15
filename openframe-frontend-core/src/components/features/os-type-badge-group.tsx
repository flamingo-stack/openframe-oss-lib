/**
 * OSTypeBadgeGroup Component
 *
 * Displays multiple OS type badges in a horizontal group.
 * Used for showing supported platforms in scripts and other multi-OS contexts.
 */

import React from 'react'
import { OSTypeBadge } from './os-type-badge'
import { cn } from '../../utils/cn'

export interface OSTypeBadgeGroupProps {
  /** Array of OS type strings (case-insensitive, handles aliases) */
  osTypes: string[]
  /** Additional CSS classes */
  className?: string
  /** Icon size class (default: w-4 h-4) */
  iconSize?: string
  /** Maximum number of badges to display before showing "+N more" */
  maxDisplay?: number
}

/**
 * OSTypeBadgeGroup - Displays multiple OS type icons in a group (icons only, no labels)
 *
 * @example
 * ```tsx
 * <OSTypeBadgeGroup osTypes={['windows', 'darwin', 'linux']} />
 * <OSTypeBadgeGroup osTypes={['macos', 'linux']} maxDisplay={2} />
 * ```
 */
export function OSTypeBadgeGroup({
  osTypes,
  className = '',
  iconSize = 'w-5 h-5',
  maxDisplay
}: OSTypeBadgeGroupProps) {
  if (!osTypes || osTypes.length === 0) {
    return null
  }

  const displayOsTypes = maxDisplay && osTypes.length > maxDisplay
    ? osTypes.slice(0, maxDisplay)
    : osTypes

  const remainingCount = maxDisplay && osTypes.length > maxDisplay
    ? osTypes.length - maxDisplay
    : 0

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {displayOsTypes.map((osType, index) => (
        <OSTypeBadge
          key={`${osType}-${index}`}
          osType={osType}
          iconOnly
          iconSize={iconSize}
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-ods-text-secondary text-sm font-medium">
          +{remainingCount} more
        </span>
      )}
    </div>
  )
}
