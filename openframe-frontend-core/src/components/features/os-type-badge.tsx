"use client"

/**
 * OSTypeBadge Component
 *
 * Displays operating system type with icon and label.
 * Automatically normalizes OS type strings from various sources.
 */

import React from 'react'
import { cn } from '../../utils/cn'
import { getOSIcon, getOSLabel, normalizeOSType } from '../../utils/os-utils'

export interface OSTypeBadgeProps {
  /** OS type string (case-insensitive, handles aliases) */
  osType?: string
  /** Additional CSS classes */
  className?: string
  /** Show only icon (no label) */
  iconOnly?: boolean
  /** Icon size class (default: w-4 h-4) */
  iconSize?: string
  /** Show label only (no icon) */
  labelOnly?: boolean
  /** Icon color */
  iconColor?: string
  /** Right icon */
  rightIcon?: React.ReactNode
}

/**
 * OSTypeBadge - Displays OS type with icon and label
 *
 * @example
 * ```tsx
 * <OSTypeBadge osType="windows" />
 * <OSTypeBadge osType="Darwin" />
 * <OSTypeBadge osType="Ubuntu" iconOnly />
 * ```
 */
export const OSTypeBadge: React.FC<OSTypeBadgeProps> = ({
  osType,
  className = '',
  iconOnly = false,
  iconSize = 'w-4 h-4',
  iconColor = '#888888',
  labelOnly = false,
  rightIcon = null
}) => {
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
      <IconComponent className={cn(iconSize, 'text-ods-text-secondary', className)} />
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
    <div className={cn("flex items-center gap-1 text-ods-text-primary text-[14px] leading-[20px] md:text-[18px] md:leading-[24px]", className)}>
      {IconComponent && <IconComponent className={iconSize} color={iconColor} />}
      {label}
      {rightIcon && rightIcon}
    </div>
  )
}

OSTypeBadge.displayName = 'OSTypeBadge'

/**
 * OSTypeIcon - Displays only the OS icon
 *
 * @example
 * ```tsx
 * <OSTypeIcon osType="windows" />
 * <OSTypeIcon osType="Darwin" size="w-5 h-5" />
 * ```
 */
export const OSTypeIcon: React.FC<{
  osType?: string
  size?: string
  className?: string
}> = ({
  osType,
  size = 'w-4 h-4',
  className = ''
}) => {
  return (
    <OSTypeBadge
      osType={osType}
      iconOnly
      iconSize={size}
      className={className}
    />
  )
}

OSTypeIcon.displayName = 'OSTypeIcon'

/**
 * OSTypeLabel - Displays only the OS label
 *
 * @example
 * ```tsx
 * <OSTypeLabel osType="windows" />
 * <OSTypeLabel osType="Darwin" />
 * ```
 */
export const OSTypeLabel: React.FC<{
  osType?: string
  className?: string
}> = ({
  osType,
  className = ''
}) => {
  return (
    <OSTypeBadge
      osType={osType}
      labelOnly
      className={className}
    />
  )
}

OSTypeLabel.displayName = 'OSTypeLabel'
