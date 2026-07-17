"use client"

import { Button } from "./ui/button"
import { getVendorLogo, VendorWithMedia } from "../utils/vendor-media-stub"
import Image from "../embed-shims/next-image"
import { getProxiedImageUrl } from "../utils/image-proxy-stub"

interface VendorDisplayButtonProps {
  vendor: VendorWithMedia
  onClick?: (vendorSlug: string) => void
  variant?: 'default' | 'compact'
  externalUrl?: string
}

export function VendorDisplayButton({ vendor, onClick, variant = 'default', externalUrl }: VendorDisplayButtonProps) {
  const handleClick = () => {
    if (externalUrl && vendor.slug) {
      // `externalUrl` is the caller-resolved platform base URL (the openmsp SSOT via
      // getPlatformProductionUrl, scheme-normalized). The old `process.env.NEXT_PUBLIC_OPENMSP_URL`
      // override is gone — it's stored scheme-less, which made this a relative window.open().
      window.open(`${externalUrl}/vendor/${vendor.slug}`, '_blank', 'noopener,noreferrer')
    } else if (onClick && vendor.slug) {
      onClick(vendor.slug)
    }
  }

  // Compact variant for flamingo-teaser
  if (variant === 'compact') {
    const logoUrl = getVendorLogo(vendor)
    
    return (
      <button 
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-ods-card border border-ods-border hover:border-ods-accent/50 transition-colors"
      >
        {logoUrl ? (
          <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0">
            <Image
              src={getProxiedImageUrl(logoUrl) || logoUrl}
              alt={`${vendor.title} logo`}
              width={20}
              height={20}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-5 h-5 rounded bg-ods-border flex items-center justify-center flex-shrink-0">
            <span className="text-ods-text-secondary text-[10px] font-medium">
              {vendor.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-h6 text-ods-text-primary">
          {vendor.title}
        </span>
      </button>
    )
  }

  // Default variant
  return (
    <button 
      onClick={handleClick}
      className="flex items-center gap-2 bg-ods-card border border-ods-border rounded-lg py-2 px-3 hover:border-ods-accent transition-colors max-w-full overflow-hidden"
    >
      {getVendorLogo(vendor) ? (
        <div className="w-8 h-8 bg-ods-card border border-ods-border rounded-lg flex items-center justify-center flex-shrink-0">
          <Image
            src={getProxiedImageUrl(getVendorLogo(vendor)!) || getVendorLogo(vendor)!}
            alt={`${vendor.title} logo`}
            width={24}
            height={24}
            className="rounded object-cover"
          />
        </div>
      ) : (
        <div className="w-8 h-8 bg-ods-border border border-ods-border rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-ods-text-primary text-h6">
            {vendor.title.charAt(0)}
          </span>
        </div>
      )}
      <span className="text-h4 text-ods-text-primary truncate min-w-0" title={vendor.title}>
        {vendor.title}
      </span>
    </button>
  )
} 