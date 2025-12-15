import type React from "react"
import { cn } from "../../utils/cn"

export interface OrganizationIconSkeletonProps {
  /**
   * Size variant (matches OrganizationIcon/VendorIcon sizes)
   * - xs: 24px (w-6 h-6)
   * - sm: 32px (w-8 h-8) - for devices table
   * - md: 40px (w-10 h-10) - for organizations table, dashboard (default)
   * - lg: 48px (w-12 h-12)
   * - l: 56px (w-14 h-14)
   * - xl: 64px (w-16 h-16) - for detail views
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'l' | 'xl'

  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Show background container (default: true)
   */
  showBackground?: boolean

  /**
   * Background style variant (default: 'dark')
   */
  backgroundStyle?: 'dark' | 'light' | 'white'
}

/**
 * Size classes matching VendorIcon/OrganizationIcon exactly
 */
const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  l: 'w-14 h-14',
  xl: 'w-16 h-16'
}

/**
 * Background style classes matching VendorIcon/OrganizationIcon exactly
 */
const backgroundClasses = {
  dark: 'bg-[#161616] border border-ods-border',
  light: 'bg-ods-card border border-ods-border',
  white: 'bg-white border border-[#E5E5E5]'
}

/**
 * OrganizationIconSkeleton - Loading skeleton for OrganizationIcon
 *
 * Matches VendorIcon styling exactly for 100% visual parity.
 * Matches the exact dimensions of OrganizationIcon to prevent layout jumps.
 * Use this in loading states before organization data is available.
 *
 * Usage:
 *
 * ```typescript
 * // In table skeleton (matches current usage)
 * <OrganizationIconSkeleton size="md" />
 *
 * // In device card skeleton
 * <OrganizationIconSkeleton size="sm" />
 *
 * // In detail view skeleton
 * <OrganizationIconSkeleton size="xl" />
 *
 * // Without background
 * <OrganizationIconSkeleton size="sm" showBackground={false} />
 * ```
 */
export function OrganizationIconSkeleton({
  size = 'md',
  className = '',
  showBackground = true,
  backgroundStyle = 'dark'
}: OrganizationIconSkeletonProps) {
  const containerClasses = cn(
    sizeClasses[size],
    'rounded-lg flex items-center justify-center flex-shrink-0',
    showBackground && backgroundClasses[backgroundStyle],
    !showBackground && 'overflow-hidden',
    className
  )

  return (
    <div
      className={containerClasses}
      role="status"
      aria-label="Loading organization icon"
    >
      <div className="w-1/2 h-1/2 bg-ods-border rounded-sm animate-pulse" />
    </div>
  )
}
