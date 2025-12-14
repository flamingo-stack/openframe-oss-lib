/**
 * OSTypeBadge Component
 *
 * Displays operating system type with icon and label using Button component.
 * Automatically normalizes OS type strings from various sources.
 */

import React from 'react'
import { Button } from '../ui/button'
import { normalizeOSType, getOSLabel, getOSIcon } from '../../types/os.types'
import { cn } from '../../utils/cn'

export interface OSTypeBadgeProps {
  /** OS type string (case-insensitive, handles aliases) */
  osType?: string
  /** Additional CSS classes */
  className?: string
  /** Show only icon (no label) */
  iconOnly?: boolean
  /** Icon size class (default: w-4 h-4) */
  iconSize?: string
  /** Icon color (default: white) */
  iconColor?: string
  variant?: "primary" | "secondary" | "table-display" | "outline" | "ghost" | "link" | "search" | "filter" | "white" | "transparent" | "ghost-nav" | "submit" | "destructive" | "success" | "warning" | "info" | "flamingo-primary" | "flamingo-secondary" | "footer-link" | "filter-active" | "section" | "section-active" | null | undefined
  alignment?: 'left' | 'center' | 'right'
  rigntIcon?: React.ReactNode
  /** Show label only (no icon) */
  labelOnly?: boolean
}

/**
 * OSTypeBadge - Displays OS type with icon and label using Button with table variant
 *
 * @example
 * ```tsx
 * <OSTypeBadge osType="windows" />
 * <OSTypeBadge osType="Darwin" />
 * <OSTypeBadge osType="Ubuntu" iconOnly />
 * ```
 */
export function OSTypeBadge({
  osType,
  className = '',
  iconOnly = false,
  alignment = 'left',
  iconSize = 'w-4 h-4',
  iconColor,
  rigntIcon=undefined,
  variant = 'table-display',
  labelOnly = false
}: OSTypeBadgeProps) {
  if (!osType) {
    return labelOnly ? (
      <span className={cn('text-ods-text-secondary', className)}>Unknown</span>
    ) : null
  }

  const normalized = normalizeOSType(osType)
  if (!normalized && !labelOnly) return null

  const label = getOSLabel(osType)
  const IconComponent = getOSIcon(osType)

  if (iconOnly && IconComponent) {
    return (
      <IconComponent
        className={cn( iconSize, className)}
        color={iconColor}
      />
    )
  }

  if (labelOnly) {
    return (
      <span className={cn('text-ods-text-primary', className)}>
        {label}
      </span>
    )
  }

  return (
    <Button
      variant={variant}
      size="none"
      leftIcon={IconComponent ? <IconComponent className={iconSize} color={iconColor} /> : undefined}
      rightIcon={rigntIcon}
      className={cn(className)}
      alignment={alignment}
    >
      {label}
    </Button>
  )
}

/**
 * OSTypeIcon - Displays only the OS icon
 *
 * @example
 * ```tsx
 * <OSTypeIcon osType="windows" />
 * <OSTypeIcon osType="Darwin" size="w-5 h-5" />
 * ```
 */
export function OSTypeIcon({
  osType,
  size = 'w-4 h-4',
  className = ''
}: {
  osType?: string
  size?: string
  className?: string
}) {
  return (
    <OSTypeBadge
      osType={osType}
      iconOnly
      iconSize={size}
      className={className}
    />
  )
}

/**
 * OSTypeLabel - Displays only the OS label
 *
 * @example
 * ```tsx
 * <OSTypeLabel osType="windows" />
 * <OSTypeLabel osType="Darwin" />
 * ```
 */
export function OSTypeLabel({
  osType,
  className = ''
}: {
  osType?: string
  className?: string
}) {
  return (
    <OSTypeBadge
      osType={osType}
      labelOnly
      className={className}
    />
  )
}
