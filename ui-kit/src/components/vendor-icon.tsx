import React from 'react'
import Image from 'next/image'
import { cn } from "../utils/cn"
import { getVendorLogo, VendorWithMedia } from '../utils/vendor-media-stub'
import { getProxiedImageUrl } from '../utils/image-proxy-stub'

interface VendorIconProps {
  vendor: VendorWithMedia & {
    id?: number
    title: string
    slug?: string
    logo?: string | null
  }
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'l' | 'xl'
  className?: string
  showBackground?: boolean
  backgroundStyle?: 'dark' | 'light' | 'white'
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8', 
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  l: 'w-14 h-14',
  xl: 'w-16 h-16'
}

const imageSizeMap = {
  xs: { width: 16, height: 16 },
  sm: { width: 20, height: 20 },
  md: { width: 32, height: 32 },
  lg: { width: 40, height: 40 },
  l: { width: 38, height: 38 },
  xl: { width: 40, height: 40 }
}

const backgroundClasses = {
  dark: 'bg-[#161616] border border-ods-border',
  light: 'bg-ods-card border border-ods-border',
  white: 'bg-white border border-[#E5E5E5]'
}

/**
 * Common VendorIcon component for displaying vendor logos consistently across the platform
 * Extracted from vendor-card.tsx for reuse in comparison tables, dropdowns, etc.
 */
export function VendorIcon({ 
  vendor, 
  size = 'md', 
  className = '',
  showBackground = true,
  backgroundStyle = 'dark'
}: VendorIconProps) {
  const logoUrl = getVendorLogo(vendor)
  const { width, height } = imageSizeMap[size]
  
  const containerClasses = cn(
    sizeClasses[size],
    'rounded-lg flex items-center justify-center flex-shrink-0',
    showBackground && backgroundClasses[backgroundStyle],
    !showBackground && 'overflow-hidden',
    className
  )

  return (
    <div className={containerClasses}>
      {logoUrl ? (
        <Image
          src={getProxiedImageUrl(logoUrl) || logoUrl}
          alt={`${vendor.title} logo`}
          width={width}
          height={height}
          className={cn(
            'object-contain',
            showBackground ? 'p-1' : 'w-full h-full'
          )}
        />
      ) : (
        <div className={cn(
          'flex items-center justify-center text-xs font-medium uppercase',
          backgroundStyle === 'white' ? 'text-[#333333]' : 'text-ods-text-secondary'
        )}>
          {vendor.title?.substring(0, 2) || '??'}
        </div>
      )}
    </div>
  )
} 