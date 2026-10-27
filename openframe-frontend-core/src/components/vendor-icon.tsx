'use client';

import type { AvatarSize } from '../styles/component-sizes';
import { cn } from '../utils/cn';
import { getVendorLogo, type VendorWithMedia } from '../utils/vendor-media-stub';
import { useProxiedImageUrl } from './chat/hooks/use-proxied-image-url';
import { loadingItemProps } from './ui/loading-scope';
import { SquareAvatar } from './ui/square-avatar';

interface VendorIconProps {
  vendor: VendorWithMedia & {
    id?: number;
    title: string;
    slug?: string;
    logo?: string | null;
  };
  /** A step of the shared avatar scale: the tile's box and the picture it fetches. */
  size?: AvatarSize;
  className?: string;
  /** On a background the logo sits padded on its tile; without one it fills the tile. */
  showBackground?: boolean;
  backgroundStyle?: 'dark' | 'light' | 'white';
  /** The vendor is still being read: the icon draws its skeleton, the tile's own box. A loading scope does the same. */
  loading?: boolean;
}

/** The tile's surface per background, over the avatar's own (`dark` is the avatar's). */
const BACKGROUND_CLASS = {
  dark: '',
  light: 'bg-ods-card',
  white: 'bg-white border-[#E5E5E5] [--ods-avatar-initials:#333333]',
} as const;

/**
 * A vendor's logo on its tile, for comparison tables, dropdowns and cards: the lib's `SquareAvatar` (the shared avatar
 * scale, a `contain` fit, the initials fallback and the skeleton), so a vendor logo is sized like every other avatar.
 */
export function VendorIcon({
  vendor,
  size = 'md',
  className,
  showBackground = true,
  backgroundStyle = 'dark',
  loading,
  ...props
}: VendorIconProps) {
  const logoUrl = getVendorLogo(vendor);
  const logoSrc = useProxiedImageUrl(logoUrl, { directHttps: false });
  return (
    <SquareAvatar
      src={logoUrl ? logoSrc || undefined : undefined}
      alt={`${vendor.title} logo`}
      fallback={vendor.title}
      size={size}
      fit="contain"
      padded={showBackground}
      loading={loading}
      initialsClassName="uppercase text-h6"
      className={cn(
        'rounded-lg',
        showBackground ? BACKGROUND_CLASS[backgroundStyle] : 'border-0 bg-transparent',
        className,
      )}
      {...loadingItemProps(props)}
    />
  );
}
