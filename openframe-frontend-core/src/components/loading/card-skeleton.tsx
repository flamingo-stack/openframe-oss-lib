import { cn } from '../../utils/cn';
import { LoadingRegion } from './loading-region';
import { UnifiedSkeleton, TextSkeleton, MediaSkeleton, InteractiveSkeleton } from './unified-skeleton';

interface CardSkeletonProps {
  className?: string;
  /**
   * Card layout variant
   */
  variant?: 'vendor' | 'blog' | 'alternative';
  /**
   * Show action buttons area
   */
  showActions?: boolean;
  /**
   * Show metadata footer
   */
  showMetadata?: boolean;
  /** Optional tailwind classes to override the card container background & border */
  containerClassName?: string;
}

/**
 * Unified card skeleton component for consistent card loading states
 *
 * Supports different card types used across the application:
 * - vendor: Vendor cards with logo, title, description, and actions
 * - blog: Blog post cards with image, title, summary, and metadata
 * - alternative: Alternative vendor cards in comparison lists
 *
 * A category card's loading box is `CategoryCardSkeleton`.
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
    vendor: <VendorCardContent showMetadata={showMetadata} />,
    blog: <BlogCardContent showActions={showActions} showMetadata={showMetadata} />,
    alternative: <AlternativeCardContent showActions={showActions} />,
  };

  return (
    <div
      className={cn(
        containerClassName || 'border border-ods-border bg-ods-card',
        'overflow-hidden rounded-lg',
        // Flex layouts for certain variants
        variant === 'blog' && 'flex h-full flex-col',
        variant === 'vendor' && 'flex h-full flex-col',
        className,
      )}
      {...props}
    >
      {cardContent[variant]}
    </div>
  );
}

/**
 * Vendor card skeleton content - matches exact VendorCard structure
 */
function VendorCardContent({ showMetadata }: { showMetadata: boolean }) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Header Section - Row layout matching actual VendorCard */}
      <div className="flex w-full items-start gap-3">
        {/* Logo Frame - 60px width fixed, matching actual structure */}
        <div className="flex h-[60px] w-[60px] flex-shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg p-2">
          <MediaSkeleton.Avatar size="sm" className="h-11 w-11" />
        </div>

        {/* Text Container - Column layout, matching actual structure */}
        <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1 py-2">
          {/* Title - Single line with proper width */}
          <TextSkeleton.Subheading className="w-3/4" />
          {/* Category - Single line, shorter */}
          <TextSkeleton.Caption className="w-1/2" />
        </div>
      </div>

      {/* Description Section - Fixed 48px height matching actual VendorCard */}
      <div className="flex h-12 w-full items-center overflow-hidden">
        <div className="w-full space-y-1">
          <TextSkeleton.Body className="w-full" />
          <TextSkeleton.Body className="w-2/3" />
        </div>
      </div>

      {/* Footer Section - Responsive layout matching actual structure */}
      {showMetadata && (
        <div className="flex w-full min-w-0 items-center justify-between gap-2">
          {/* Stats Container - Flexible width, no overflow */}
          <div className="flex min-w-0 flex-shrink items-center gap-3 content-md:gap-4">
            {/* OpenMSP Score skeleton */}
            <div className="flex flex-shrink-0 items-center gap-1">
              <MediaSkeleton.Icon size="sm" className="h-5 w-5" />
              <TextSkeleton.Caption className="w-8" />
            </div>

            {/* GitHub Stats skeleton */}
            <div className="flex flex-shrink-0 items-center gap-1">
              <MediaSkeleton.Icon size="sm" className="h-5 w-5" />
              <TextSkeleton.Caption className="w-10" />
            </div>
          </div>

          {/* Tag Section - Contained within card boundaries */}
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1.5 rounded border border-ods-border bg-ods-bg px-2.5 py-1.5">
              <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-ods-border">
                <MediaSkeleton.Icon size="sm" className="h-2.5 w-2.5" />
              </div>
              <TextSkeleton.Caption className="w-16" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Blog card skeleton content - matches fixed height structure
 */
function BlogCardContent({ showActions, showMetadata }: { showActions: boolean; showMetadata: boolean }) {
  return (
    <>
      {/* Image Section — OG 1200×630 aspect (matches blog-card.tsx loaded state) */}
      <div className="blog-card-image-container relative aspect-[1200/630] w-full overflow-hidden bg-ods-bg">
        <MediaSkeleton.CardImage />
      </div>

      {/* Content - Fixed height structure to match BlogCard */}
      <div className="flex flex-grow flex-col p-4">
        {/* Title Section - Fixed 2 lines with vertical centering */}
        <div className="mb-3 flex min-h-[50.4px] items-center content-md:min-h-[56px] content-lg:min-h-[61.6px]">
          <div className="w-full space-y-1">
            <TextSkeleton.Subheading className="w-full" />
            <TextSkeleton.Subheading className="w-3/4" />
          </div>
        </div>

        {/* Chips Section - Fixed single line height */}
        <div className="mb-3 flex h-[28px] items-center gap-2">
          <InteractiveSkeleton.Chip className="w-16" />
          <InteractiveSkeleton.Chip className="w-12" />
        </div>

        {/* Description Section - Fixed 2 lines with vertical centering */}
        <div className="mb-3 flex min-h-[42px] items-center content-md:min-h-[45px] content-lg:min-h-[48px]">
          <div className="w-full space-y-1">
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-1/2" />
          </div>
        </div>

        {/* Actions - only if requested */}
        {showActions && (
          <div className="pt-2">
            <InteractiveSkeleton.Button className="h-8 w-24" />
          </div>
        )}

        {/* Metadata footer - Matches BlogMeta horizontal layout */}
        {showMetadata && (
          <div className="mt-auto">
            <div className="flex items-center justify-between gap-4 border-t border-ods-border pt-4">
              {/* Author section - matches AuthorMeta */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <MediaSkeleton.Avatar size="sm" />
                <TextSkeleton.Caption className="w-16" />
              </div>

              {/* Date and reading time section - matches BlogMeta right side */}
              <div className="flex shrink-0 items-center gap-3 text-ods-text-muted">
                <TextSkeleton.Caption className="w-12" />
                {/* Separator dot */}
                <UnifiedSkeleton variant="circular" className="h-1 w-1" />
                <TextSkeleton.Caption className="w-16" />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
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
            <InteractiveSkeleton.Button className="h-8 w-20" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Grid of card skeletons for loading lists
 */
export function CardSkeletonGrid({
  region = true,
  count = 6,
  variant = 'vendor',
  className,
  containerClassName,
  ...props
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  count?: number;
  variant?: CardSkeletonProps['variant'];
  className?: string;
  containerClassName?: string;
} & Omit<CardSkeletonProps, 'variant'>) {
  return (
    <LoadingRegion
      label={`Loading ${variant} cards`}
      announce={region}
      className={cn(
        'grid gap-4 content-md:gap-6',
        // Responsive grid based on card type
        variant === 'vendor' && 'grid-cols-1 content-md:grid-cols-2 content-lg:grid-cols-3',
        variant === 'blog' && 'grid-cols-1 content-md:grid-cols-2',
        variant === 'alternative' && 'grid-cols-1',
        className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <CardSkeleton key={index} variant={variant} containerClassName={containerClassName} {...props} />
      ))}
    </LoadingRegion>
  );
}
