import type React from "react"
import { cn } from "../../utils/cn"
import { OrganizationIconSkeleton } from "./organization-icon-skeleton"
import { TextSkeleton, MediaSkeleton, InteractiveSkeleton } from "./unified-skeleton"

export interface OrganizationCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string

  /**
   * Show footer stats area
   */
  showFooter?: boolean

  /**
   * Show description area
   */
  showDescription?: boolean

  /** Optional tailwind classes to override the card container background & border */
  containerClassName?: string
}

/**
 * OrganizationCardSkeleton - Loading skeleton matching OrganizationCard exact layout
 *
 * Matches VendorCard skeleton structure for 100% visual parity.
 *
 * Structure:
 * - Header: 60x60px org logo + title + subtitle
 * - Description: Fixed 48px height with 2-line clamp
 * - Footer: Stats display area
 *
 * Prevents layout jumps by matching exact dimensions.
 */
export function OrganizationCardSkeleton({
  className,
  containerClassName,
  showFooter = true,
  showDescription = true
}: OrganizationCardSkeletonProps) {
  return (
    <div
      className={cn(
        containerClassName || "bg-ods-card border border-ods-border",
        "rounded-lg overflow-hidden h-full flex flex-col",
        className
      )}
      role="status"
      aria-label="Loading organization card"
    >
      <div className="p-4 gap-3 flex flex-col">
        {/* Header Section - Row layout matching OrganizationCard/VendorCard */}
        <div className="flex items-start gap-3 w-full">
          {/* Logo Frame - 60px width fixed, matching actual structure */}
          <OrganizationIconSkeleton
            size="xl"
            backgroundStyle="dark"
            showBackground={true}
            className="w-[60px] h-[60px]"
          />

          {/* Text Container - Column layout, matching actual structure */}
          <div className="flex-1 flex flex-col justify-center py-2 min-w-0 space-y-1">
            {/* Title - Single line with proper width */}
            <TextSkeleton.Subheading className="w-3/4" />
            {/* Subtitle (industry/tier) - Single line, shorter */}
            <TextSkeleton.Caption className="w-1/2" />
          </div>
        </div>

        {/* Description Section - Fixed 48px height matching VendorCard */}
        {showDescription && (
          <div className="w-full h-12 overflow-hidden flex items-center">
            <div className="space-y-1 w-full">
              <TextSkeleton.Body className="w-full" />
              <TextSkeleton.Body className="w-2/3" />
            </div>
          </div>
        )}

        {/* Footer Section - Stats display */}
        {showFooter && (
          <div className="flex items-center justify-between gap-2 w-full min-w-0">
            {/* Stats Container */}
            <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-shrink">
              {/* Stat 1 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <MediaSkeleton.Icon size="sm" className="w-5 h-5" />
                <TextSkeleton.Caption className="w-8" />
              </div>

              {/* Stat 2 */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <MediaSkeleton.Icon size="sm" className="w-5 h-5" />
                <TextSkeleton.Caption className="w-10" />
              </div>
            </div>

            {/* Tag/Badge Section */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-1.5 bg-[#161616] border border-ods-border rounded px-2.5 py-1.5">
                <div className="w-4 h-4 bg-ods-border rounded-sm flex items-center justify-center flex-shrink-0">
                  <MediaSkeleton.Icon size="sm" className="w-2.5 h-2.5" />
                </div>
                <TextSkeleton.Caption className="w-16" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * OrganizationCardSkeletonGrid - Grid of organization card skeletons
 *
 * Matches responsive grid layout:
 * - Mobile: 1 column
 * - Tablet (md): 2 columns
 * - Desktop (xl): 3 columns
 */
export function OrganizationCardSkeletonGrid({
  count = 12,
  className,
  containerClassName,
  showFooter = true,
  showDescription = true
}: {
  count?: number
  className?: string
  containerClassName?: string
  showFooter?: boolean
  showDescription?: boolean
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6",
        className
      )}
      role="status"
      aria-label={`Loading ${count} organization cards`}
    >
      {Array.from({ length: count }, (_, index) => (
        <OrganizationCardSkeleton
          key={index}
          containerClassName={containerClassName}
          showFooter={showFooter}
          showDescription={showDescription}
        />
      ))}
    </div>
  )
}
