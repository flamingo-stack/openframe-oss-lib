import type React from "react"
import { cn } from "../../utils/cn"
import { UnifiedSkeleton, TextSkeleton, MediaSkeleton, InteractiveSkeleton } from "./unified-skeleton"

interface CardSkeletonProps {
  className?: string
  /**
   * Card layout variant
   */
  variant?: 'vendor' | 'blog' | 'category' | 'alternative'
  /**
   * Show action buttons area
   */
  showActions?: boolean
  /**
   * Show metadata footer
   */
  showMetadata?: boolean
  /** Optional tailwind classes to override the card container background & border */
  containerClassName?: string
}
 
/**
 * Unified card skeleton component for consistent card loading states
 * 
 * Supports different card types used across the application:
 * - vendor: Vendor cards with logo, title, description, and actions
 * - blog: Blog post cards with image, title, summary, and metadata  
 * - category: Category cards with icon, title, and description
 * - alternative: Alternative vendor cards in comparison lists
 */
export function CardSkeleton({
  className,
  containerClassName,
  variant = 'vendor',
  showActions = true,
  showMetadata = true,
  ...props
}: CardSkeletonProps) {
  const cardContent = {
    vendor: <VendorCardContent showActions={showActions} showMetadata={showMetadata} />,
    blog: <BlogCardContent showActions={showActions} showMetadata={showMetadata} />,
    category: <CategoryCardContent />,
    alternative: <AlternativeCardContent showActions={showActions} />
  }

  return (
    <div 
      className={cn(
        containerClassName || "bg-ods-card border border-ods-border",
        "rounded-lg overflow-hidden",
        // Flex layouts for certain variants
        variant === 'blog' && "h-full flex flex-col",
        variant === 'vendor' && "h-full flex flex-col",
        className
      )}
      role="status"
      aria-label={`Loading ${variant} card`}
      {...props}
    >
      {cardContent[variant]}
    </div>
  )
}

/**
 * Vendor card skeleton content - matches exact VendorCard structure
 */
function VendorCardContent({ showActions, showMetadata }: { showActions: boolean; showMetadata: boolean }) {
  return (
    <div className="p-4 gap-3 flex flex-col">
      {/* Header Section - Row layout matching actual VendorCard */}
      <div className="flex items-start gap-3 w-full">
        {/* Logo Frame - 60px width fixed, matching actual structure */}
        <div className="w-[60px] h-[60px] bg-[#161616] border border-ods-border rounded-lg p-2 flex items-center justify-center flex-shrink-0">
          <MediaSkeleton.Avatar size="sm" className="w-11 h-11" />
        </div>
        
        {/* Text Container - Column layout, matching actual structure */}
        <div className="flex-1 flex flex-col justify-center py-2 min-w-0 space-y-1">
          {/* Title - Single line with proper width */}
          <TextSkeleton.Subheading className="w-3/4" />
          {/* Category - Single line, shorter */}
          <TextSkeleton.Caption className="w-1/2" />
        </div>
      </div>

      {/* Description Section - Fixed 48px height matching actual VendorCard */}
      <div className="w-full h-12 overflow-hidden flex items-center">
        <div className="space-y-1 w-full">
          <TextSkeleton.Body className="w-full" />
          <TextSkeleton.Body className="w-2/3" />
        </div>
      </div>

      {/* Footer Section - Responsive layout matching actual structure */}
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        {/* Stats Container - Flexible width, no overflow */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-shrink">
          {/* OpenMSP Score skeleton */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <MediaSkeleton.Icon size="sm" className="w-5 h-5" />
            <TextSkeleton.Caption className="w-8" />
          </div>
          
          {/* GitHub Stats skeleton */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <MediaSkeleton.Icon size="sm" className="w-5 h-5" />
            <TextSkeleton.Caption className="w-10" />
          </div>
        </div>

        {/* Tag Section - Contained within card boundaries */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-[#161616] border border-ods-border rounded px-2.5 py-1.5">
            <div className="w-4 h-4 bg-ods-border rounded-sm flex items-center justify-center flex-shrink-0">
              <MediaSkeleton.Icon size="sm" className="w-2.5 h-2.5" />
            </div>
            <TextSkeleton.Caption className="w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Blog card skeleton content - matches fixed height structure
 */
function BlogCardContent({ showActions, showMetadata }: { showActions: boolean; showMetadata: boolean }) {
  return (
    <>
      {/* Image Section - 16:9 aspect ratio container */}
      <div className="blog-card-image-container relative w-full aspect-[16/9] overflow-hidden bg-[#161616]">
        <MediaSkeleton.CardImage />
      </div>
      
      {/* Content - Fixed height structure to match BlogCard */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Title Section - Fixed 2 lines with vertical centering */}
        <div className="mb-3 flex items-center min-h-[50.4px] md:min-h-[56px] lg:min-h-[61.6px]">
          <div className="space-y-1 w-full">
            <TextSkeleton.Subheading className="w-full" />
            <TextSkeleton.Subheading className="w-3/4" />
          </div>
        </div>
        
        {/* Chips Section - Fixed single line height */}
        <div className="mb-3 flex gap-2 h-[28px] items-center">
          <InteractiveSkeleton.Chip className="w-16" />
          <InteractiveSkeleton.Chip className="w-12" />
        </div>
        
        {/* Description Section - Fixed 2 lines with vertical centering */}
        <div className="mb-3 flex items-center min-h-[42px] md:min-h-[45px] lg:min-h-[48px]">
          <div className="space-y-1 w-full">
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-1/2" />
          </div>
        </div>

        {/* Actions - only if requested */}
        {showActions && (
          <div className="pt-2">
            <InteractiveSkeleton.Button className="w-24 h-8" />
          </div>
        )}
        
        {/* Metadata footer - Matches BlogMeta horizontal layout */}
        {showMetadata && (
          <div className="mt-auto">
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-ods-border">
              {/* Author section - matches AuthorMeta */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <MediaSkeleton.Avatar size="sm" />
                <TextSkeleton.Caption className="w-16" />
              </div>
              
              {/* Date and reading time section - matches BlogMeta right side */}
              <div className="flex items-center gap-3 text-[#767676] shrink-0">
                <TextSkeleton.Caption className="w-12" />
                {/* Separator dot */}
                <div className="w-1 h-1 bg-[#767676] rounded-full"></div>
                <TextSkeleton.Caption className="w-16" />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Category card skeleton content
 */
function CategoryCardContent() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Icon grid */}
      <div className="flex gap-2 md:gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <MediaSkeleton.Icon 
            key={index}
            size="lg"
            className="flex-shrink-0"
          />
        ))}
      </div>

      {/* Content */}
      <div className="space-y-2">
        <div className="space-y-1">
          <TextSkeleton.Subheading className="w-3/4" />
          <TextSkeleton.Caption className="w-1/2" />
        </div>
        
        <div className="flex items-start md:items-end justify-between gap-4 md:gap-6">
          <div className="flex-1 space-y-2">
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-2/3" />
          </div>
          
          <InteractiveSkeleton.Button className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0" />
        </div>
      </div>
    </div>
  )
}

/**
 * Alternative card skeleton content (for vendor alternatives/comparisons)
 */
function AlternativeCardContent({ showActions }: { showActions: boolean }) {
  return (
    <div className="flex items-start gap-4 p-4">
      <MediaSkeleton.Avatar size="md" className="flex-shrink-0" />
      
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <TextSkeleton.Subheading className="w-1/3" />
          <TextSkeleton.Caption className="w-16" />
        </div>
        
        <div className="space-y-1">
          <TextSkeleton.Body className="w-full" />
          <TextSkeleton.Body className="w-5/6" />
        </div>

        {showActions && (
          <div className="pt-2">
            <InteractiveSkeleton.Button className="w-20 h-8" />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Grid of card skeletons for loading lists
 */
export function CardSkeletonGrid({
  count = 6,
  variant = 'vendor',
  className,
  containerClassName,
  ...props
}: {
  count?: number
  variant?: CardSkeletonProps['variant']
  className?: string
  containerClassName?: string
} & Omit<CardSkeletonProps, 'variant'>) {
  return (
    <div 
      className={cn(
        "grid gap-4 md:gap-6",
        // Responsive grid based on card type
        variant === 'vendor' && "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
        variant === 'blog' && "grid-cols-1 md:grid-cols-2",
        variant === 'category' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
        variant === 'alternative' && "grid-cols-1",
        className
      )}
      role="status"
      aria-label={`Loading ${count} ${variant} cards`}
    >
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton 
          key={index} 
          variant={variant}
          containerClassName={containerClassName}
          {...props}
        />
      ))}
    </div>
  )
} 