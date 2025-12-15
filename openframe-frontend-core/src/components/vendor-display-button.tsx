import { Button } from "./ui/button"
import { getVendorLogo, VendorWithMedia } from "../utils/vendor-media-stub"
import Image from "next/image"
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
      // Use environment variable or fallback to provided URL
      const baseUrl = process.env.NEXT_PUBLIC_OPENMSP_URL || externalUrl
      window.open(`${baseUrl}/vendor/${vendor.slug}`, '_blank', 'noopener,noreferrer')
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
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] hover:border-[#FFC008]/50 transition-colors"
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
          <div className="w-5 h-5 rounded bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
            <span className="text-[#666666] text-[10px] font-medium">
              {vendor.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-sm font-medium text-white">
          {vendor.title}
        </span>
      </button>
    )
  }

  // Default variant
  return (
    <button 
      onClick={handleClick}
      className="flex items-center gap-2 bg-ods-card border border-ods-border rounded-lg py-2 px-3 hover:border-[#FFC008] transition-colors max-w-full overflow-hidden"
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
          <span className="text-ods-text-primary text-[12px] font-medium">
            {vendor.title.charAt(0)}
          </span>
        </div>
      )}
      <span className="font-['DM_Sans'] font-medium text-[18px] leading-[1.33] text-ods-text-primary truncate min-w-0">
        {vendor.title}
      </span>
    </button>
  )
} 