'use client';

import Image from '../embed-shims/next-image';
import { IMAGE_FIXED_PX, type ImageFixedSize } from '../styles/image-sizes';
import { cn } from '../utils/cn';
import { getVendorLogo, type VendorWithMedia } from '../utils/vendor-media-stub';
import { useProxiedImageUrl } from './chat/hooks/use-proxied-image-url';
import { UnifiedSkeleton } from './loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from './ui/loading-scope';

interface VendorIconProps {
  vendor: VendorWithMedia & {
    id?: number;
    title: string;
    slug?: string;
    logo?: string | null;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'l' | 'xl';
  className?: string;
  showBackground?: boolean;
  backgroundStyle?: 'dark' | 'light' | 'white';
  /** The vendor is still being read: the icon draws its skeleton, the tile's own box. A loading scope does the same. */
  loading?: boolean;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  l: 'w-14 h-14',
  xl: 'w-16 h-16',
};

/**
 * The picture's box per size, from the image-size table. On a background the logo sits padded inside the tile; with
 * `showBackground={false}` it FILLS the tile (`h-full w-full`), so it is requested at the tile's size: requesting the
 * padded size there served a 32px bitmap stretched over a 40-64px tile, blurry on every display.
 */
const PADDED_PICTURE: Record<NonNullable<VendorIconProps['size']>, ImageFixedSize> = {
  xs: 'icon',
  sm: 'glyph',
  md: 'logo',
  lg: 'logoLg',
  l: 'logoLg',
  xl: 'logoLg',
};
const TILE_PICTURE: Record<NonNullable<VendorIconProps['size']>, ImageFixedSize> = {
  xs: 'glyph',
  sm: 'logo',
  md: 'logoLg',
  lg: 'logoXl',
  l: 'tile',
  xl: 'thumb',
};

const backgroundClasses = {
  dark: 'bg-ods-bg border border-ods-border',
  light: 'bg-ods-card border border-ods-border',
  white: 'bg-white border border-[#E5E5E5]',
};

/** A vendor's logo while it is read: the tile's own box. Carries the icon's `data-*` markers (`loadingItemProps`). */
function VendorIconSkeleton({
  size = 'md',
  className,
  ...props
}: {
  size?: VendorIconProps['size'];
  className?: string;
}) {
  return (
    <UnifiedSkeleton
      className={cn(sizeClasses[size], 'flex-shrink-0 rounded-lg', className)}
      {...loadingItemProps(props)}
    />
  );
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
  backgroundStyle = 'dark',
  loading: loadingProp,
  ...props
}: VendorIconProps) {
  const loading = useLoadingScope() || !!loadingProp;
  const logoUrl = getVendorLogo(vendor);
  const logoSrc = useProxiedImageUrl(logoUrl, { directHttps: false });
  const picturePx = IMAGE_FIXED_PX[(showBackground ? PADDED_PICTURE : TILE_PICTURE)[size]];

  const containerClasses = cn(
    sizeClasses[size],
    'flex flex-shrink-0 items-center justify-center rounded-lg',
    showBackground && backgroundClasses[backgroundStyle],
    !showBackground && 'overflow-hidden',
    className,
  );

  // A list's markers (`data-loading-item`) ride on the icon in both forms.
  const markers = loadingItemProps(props);
  if (loading) return <VendorIconSkeleton size={size} className={className} {...markers} />;

  return (
    <div className={containerClasses} {...markers}>
      {logoUrl ? (
        <Image
          src={logoSrc}
          alt={`${vendor.title} logo`}
          width={picturePx}
          height={picturePx}
          className={cn('object-contain', showBackground ? 'p-1' : 'h-full w-full')}
        />
      ) : (
        <div
          className={cn(
            'flex items-center justify-center uppercase text-h6',
            backgroundStyle === 'white' ? 'text-[#333333]' : 'text-ods-text-secondary',
          )}
        >
          {vendor.title?.substring(0, 2) || '??'}
        </div>
      )}
    </div>
  );
}
