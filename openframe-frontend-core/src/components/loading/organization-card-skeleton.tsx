import { cn } from '../../utils/cn';
import { OrganizationIconSkeleton } from './organization-icon-skeleton';
import { TextSkeleton, MediaSkeleton } from './unified-skeleton';

export interface OrganizationCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show footer stats area
   */
  showFooter?: boolean;

  /**
   * Show description area
   */
  showDescription?: boolean;

  /** Optional tailwind classes to override the card container background & border */
  containerClassName?: string;
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
  showDescription = true,
}: OrganizationCardSkeletonProps) {
  return (
    <div
      className={cn(
        containerClassName || 'border border-ods-border bg-ods-card',
        'flex h-full flex-col overflow-hidden rounded-lg',
        className,
      )}
      role="status"
      aria-label="Loading organization card"
    >
      <div className="flex flex-col gap-3 p-4">
        {/* Header Section - Row layout matching OrganizationCard/VendorCard */}
        <div className="flex w-full items-start gap-3">
          {/* Logo Frame - 60px width fixed, matching actual structure */}
          <OrganizationIconSkeleton
            size="xl"
            backgroundStyle="dark"
            showBackground={true}
            className="h-[60px] w-[60px]"
          />

          {/* Text Container - Column layout, matching actual structure */}
          <div className="flex min-w-0 flex-1 flex-col justify-center space-y-1 py-2">
            {/* Title - Single line with proper width */}
            <TextSkeleton.Subheading className="w-3/4" />
            {/* Subtitle (industry/tier) - Single line, shorter */}
            <TextSkeleton.Caption className="w-1/2" />
          </div>
        </div>

        {/* Description Section - Fixed 48px height matching VendorCard */}
        {showDescription && (
          <div className="flex h-12 w-full items-center overflow-hidden">
            <div className="w-full space-y-1">
              <TextSkeleton.Body className="w-full" />
              <TextSkeleton.Body className="w-2/3" />
            </div>
          </div>
        )}

        {/* Footer Section - Stats display */}
        {showFooter && (
          <div className="flex w-full min-w-0 items-center justify-between gap-2">
            {/* Stats Container */}
            <div className="flex min-w-0 flex-shrink items-center gap-3 md:gap-4">
              {/* Stat 1 */}
              <div className="flex flex-shrink-0 items-center gap-1">
                <MediaSkeleton.Icon size="sm" className="h-5 w-5" />
                <TextSkeleton.Caption className="w-8" />
              </div>

              {/* Stat 2 */}
              <div className="flex flex-shrink-0 items-center gap-1">
                <MediaSkeleton.Icon size="sm" className="h-5 w-5" />
                <TextSkeleton.Caption className="w-10" />
              </div>
            </div>

            {/* Tag/Badge Section */}
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
    </div>
  );
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
  showDescription = true,
}: {
  count?: number;
  className?: string;
  containerClassName?: string;
  showFooter?: boolean;
  showDescription?: boolean;
}) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3', className)}
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
  );
}
