'use client';

import Image from '../embed-shims/next-image';
import { TILE_SIZE } from '../styles/component-sizes';
import { cn } from '../utils/cn';
import { getVendorLogo, type VendorWithMedia } from '../utils/vendor-media-stub';
import { useProxiedImageUrl } from './chat/hooks/use-proxied-image-url';

/** The default button's frame, without its surface and hover (a skeleton draws the same box). */
export const VENDOR_DISPLAY_BUTTON_FRAME_CLASS =
  'flex max-w-full items-center gap-2 overflow-hidden rounded-lg border border-ods-border px-3 py-2';
/** The default button's logo box. */
export const VENDOR_DISPLAY_BUTTON_LOGO_CLASS = `flex ${TILE_SIZE.sm} flex-shrink-0 items-center justify-center rounded-lg`;

interface VendorDisplayButtonProps {
  vendor: VendorWithMedia;
  onClick?: (vendorSlug: string) => void;
  variant?: 'default' | 'compact';
  externalUrl?: string;
}

export function VendorDisplayButton({ vendor, onClick, variant = 'default', externalUrl }: VendorDisplayButtonProps) {
  const handleClick = () => {
    if (externalUrl && vendor.slug) {
      // `externalUrl` is the caller-resolved platform base URL (the openmsp SSOT via
      // getPlatformProductionUrl, scheme-normalized). The old `process.env.NEXT_PUBLIC_OPENMSP_URL`
      // override is gone — it's stored scheme-less, which made this a relative window.open().
      window.open(`${externalUrl}/vendor/${vendor.slug}`, '_blank', 'noopener,noreferrer');
    } else if (onClick && vendor.slug) {
      onClick(vendor.slug);
    }
  };

  // Resolved once for BOTH variants: the default branch used to call
  // `getVendorLogo` three times and assert the third, which is also three
  // chances for the three calls to disagree.
  const logoUrl = getVendorLogo(vendor);
  const logoSrc = useProxiedImageUrl(logoUrl, { directHttps: false });

  // Compact variant
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-full border border-ods-border bg-ods-card px-3 py-1.5 transition-colors hover:border-ods-accent/50"
      >
        {logoUrl ? (
          <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded">
            <Image
              src={logoSrc}
              alt={`${vendor.title} logo`}
              width={20}
              height={20}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-ods-border">
            <span className="text-[10px] font-medium text-ods-text-secondary">
              {vendor.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-ods-text-primary text-h6">{vendor.title}</span>
      </button>
    );
  }

  // Default variant
  return (
    <button
      onClick={handleClick}
      className={cn(VENDOR_DISPLAY_BUTTON_FRAME_CLASS, 'bg-ods-card transition-colors hover:border-ods-accent')}
    >
      {logoUrl ? (
        <div className={cn(VENDOR_DISPLAY_BUTTON_LOGO_CLASS, 'border border-ods-border bg-ods-card')}>
          <Image src={logoSrc} alt={`${vendor.title} logo`} width={24} height={24} className="rounded object-cover" />
        </div>
      ) : (
        <div className={cn(VENDOR_DISPLAY_BUTTON_LOGO_CLASS, 'border border-ods-border bg-ods-border')}>
          <span className="text-ods-text-primary text-h6">{vendor.title.charAt(0)}</span>
        </div>
      )}
      <span className="min-w-0 truncate text-ods-text-primary text-h4" title={vendor.title}>
        {vendor.title}
      </span>
    </button>
  );
}
