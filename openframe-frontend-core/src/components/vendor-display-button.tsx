'use client';

import Image from '../embed-shims/next-image';
import { getProxiedImageUrl } from '../utils/image-proxy-stub';
import { getVendorLogo, type VendorWithMedia } from '../utils/vendor-media-stub';

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

  // Compact variant for flamingo-teaser
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-full border border-ods-border bg-ods-card px-3 py-1.5 transition-colors hover:border-ods-accent/50"
      >
        {logoUrl ? (
          <div className="h-5 w-5 flex-shrink-0 overflow-hidden rounded">
            <Image
              src={getProxiedImageUrl(logoUrl) || logoUrl}
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
      className="flex max-w-full items-center gap-2 overflow-hidden rounded-lg border border-ods-border bg-ods-card px-3 py-2 transition-colors hover:border-ods-accent"
    >
      {logoUrl ? (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-card">
          <Image
            src={getProxiedImageUrl(logoUrl) || logoUrl}
            alt={`${vendor.title} logo`}
            width={24}
            height={24}
            className="rounded object-cover"
          />
        </div>
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-border">
          <span className="text-ods-text-primary text-h6">{vendor.title.charAt(0)}</span>
        </div>
      )}
      <span className="min-w-0 truncate text-ods-text-primary text-h4" title={vendor.title}>
        {vendor.title}
      </span>
    </button>
  );
}
