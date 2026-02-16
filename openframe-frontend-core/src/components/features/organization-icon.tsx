'use client'

import React from 'react'
import Image from 'next/image'
import { cn } from "../../utils/cn"
import { useAuthenticatedImage, type AuthenticatedImageConfig } from '../../hooks/use-authenticated-image'

export interface OrganizationIconProps {
  /**
   * Image URL - can be:
   * - Pre-fetched blob URL (starts with 'blob:')
   * - API path (starts with '/api/')
   * - Full URL (starts with 'http://' or 'https://')
   */
  imageUrl?: string | null

  /**
   * Organization name for fallback initials and alt text
   */
  organizationName: string

  /**
   * Size variant (matching VendorIcon sizes)
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
 * Size classes matching VendorIcon exactly
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
 * Image size mapping matching VendorIcon exactly
 */
const imageSizeMap = {
  xs: { width: 16, height: 16 },
  sm: { width: 20, height: 20 },
  md: { width: 32, height: 32 },
  lg: { width: 40, height: 40 },
  l: { width: 38, height: 38 },
  xl: { width: 40, height: 40 }
}

/**
 * Background style classes matching VendorIcon exactly
 */
const backgroundClasses = {
  dark: 'bg-[#161616] border border-ods-border',
  light: 'bg-ods-card border border-ods-border',
  white: 'bg-white border border-[#E5E5E5]'
}

/**
 * OrganizationIcon - Reusable component for displaying organization logos
 *
 * Matches VendorIcon styling and behavior exactly for 100% visual parity.
 *
 * Features:
 * - **Dual-mode support:** Auto-detects pre-fetched blob URLs vs raw URLs
 * - **Automatic fallback:** Shows 2-letter initials if no image
 * - **Loading states:** Built-in loading indicator
 * - **Zero layout jumps:** Fixed dimensions prevent shifting
 * - **ODS styling:** Consistent theming with design tokens
 * - **Flexible sizing:** Six size variants (xs/sm/md/lg/l/xl)
 * - **Background variants:** dark (default), light, white
 *
 * Usage Examples:
 *
 * ```typescript
 * // With pre-fetched blob URL (from useBatchImages)
 * const fetchedImages = useBatchImages(imageUrls)
 * <OrganizationIcon
 *   imageUrl={fetchedImages[org.imageUrl]}
 *   organizationName={org.name}
 *   size="md"
 *   preFetched={true}
 * />
 *
 * // With automatic fetching (single image)
 * <OrganizationIcon
 *   imageUrl={organization?.imageUrl}
 *   organizationName={organization?.name || 'Organization'}
 *   size="xl"
 *   refreshKey={organization?.imageVersion}
 * />
 *
 * // Without background (inline with text)
 * <OrganizationIcon
 *   imageUrl={org.imageUrl}
 *   organizationName={org.name}
 *   size="sm"
 *   showBackground={false}
 * />
 * ```
 */
export function OrganizationIcon({
  imageUrl,
  organizationName,
  size = 'md',
  className = '',
  showBackground = true,
  backgroundStyle = 'dark',
}: OrganizationIconProps) {
  const { width, height } = imageSizeMap[size]

  // Generate fallback initials (first 2 letters, matching VendorIcon)
  const initials = organizationName?.substring(0, 2) || '??'

  // Container classes matching VendorIcon exactly
  const containerClasses = cn(
    sizeClasses[size],
    'rounded-lg flex items-center justify-center flex-shrink-0 relative',
    showBackground && backgroundClasses[backgroundStyle],
    !showBackground && 'overflow-hidden',
    className
  )

  return (
    <div className={containerClasses}>
      <div className={cn(
        'flex items-center justify-center text-xs font-medium uppercase',
        imageUrl && 'hidden',
        backgroundStyle === 'white' ? 'text-ods-text-primary' : 'text-ods-text-secondary'
      )}>
        {initials}
      </div>
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={`${initials}`}
          width={width}
          height={height}
          className={cn(
            'absolute object-contain',
            showBackground ? 'p-1' : 'w-full h-full'
          )}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const el = e.currentTarget.previousElementSibling as HTMLElement
            if (el) el.classList.remove('hidden')
          }}
        />
      )}
    </div>
  )
}
