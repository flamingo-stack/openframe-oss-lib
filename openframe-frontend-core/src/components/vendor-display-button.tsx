'use client';

import Image from '../embed-shims/next-image';
import { IMAGE_FIXED_PX } from '../styles/image-sizes';
import { cn } from '../utils/cn';
import { getVendorLogo, type VendorWithMedia } from '../utils/vendor-media-stub';
import { useProxiedImageUrl } from './chat/hooks/use-proxied-image-url';
import { BUTTON_KIND_CLASS, Button } from './ui/button';

/** The default button's place in its row (it never outgrows it). */
const VENDOR_DISPLAY_BUTTON_LAYOUT_CLASS = 'max-w-full overflow-hidden';
/** The default button's box: the `chip` kind's, which a skeleton draws too. */
export const VENDOR_DISPLAY_BUTTON_FRAME_CLASS = cn(BUTTON_KIND_CLASS.chip, VENDOR_DISPLAY_BUTTON_LAYOUT_CLASS);
/** The default button's logo box (it fits the chip's 32px height). */
export const VENDOR_DISPLAY_BUTTON_LOGO_CLASS = 'flex size-5 flex-shrink-0 items-center justify-center rounded';

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
      <Button variant="chip" onClick={handleClick}>
        {logoUrl ? (
          <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded">
            <Image
              src={logoSrc}
              alt={`${vendor.title} logo`}
              width={IMAGE_FIXED_PX.glyph}
              height={IMAGE_FIXED_PX.glyph}
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
      </Button>
    );
  }

  // Default variant
  return (
    <Button variant="chip" data-tone="accent" onClick={handleClick} className={VENDOR_DISPLAY_BUTTON_LAYOUT_CLASS}>
      {logoUrl ? (
        <div className={cn(VENDOR_DISPLAY_BUTTON_LOGO_CLASS, 'border border-ods-border bg-ods-card')}>
          <Image src={logoSrc} alt={`${vendor.title} logo`} width={IMAGE_FIXED_PX.glyph} height={IMAGE_FIXED_PX.glyph} className="rounded object-cover" />
        </div>
      ) : (
        <div className={cn(VENDOR_DISPLAY_BUTTON_LOGO_CLASS, 'border border-ods-border bg-ods-border')}>
          <span className="text-ods-text-primary text-h6">{vendor.title.charAt(0)}</span>
        </div>
      )}
      <span className="min-w-0 truncate text-ods-text-primary text-h4" title={vendor.title}>
        {vendor.title}
      </span>
    </Button>
  );
}
