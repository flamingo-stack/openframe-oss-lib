import { cn } from '../../utils/cn';
import { EntityImageSkeleton } from '../ui/entity-image';
import {
  ORGANIZATION_CARD_DESCRIPTION_CLASS,
  ORGANIZATION_CARD_FOOTER_CLASS,
  ORGANIZATION_CARD_HEADER_CLASS,
  ORGANIZATION_CARD_LAYOUT_CLASS,
  ORGANIZATION_CARD_RADIUS_CLASS,
  ORGANIZATION_CARD_STAT_CLASS,
  ORGANIZATION_CARD_STATS_CLASS,
  ORGANIZATION_CARD_SURFACE_CLASS,
  ORGANIZATION_CARD_TEXT_CLASS,
} from '../ui/organization-card';
import { LoadingRegion } from './loading-region';
import { MediaSkeleton, TextLineSkeleton } from './unified-skeleton';

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

/** The two footer stats a loading card draws (a value and its label each). */
const ORGANIZATION_CARD_SKELETON_STAT_WIDTHS = ['w-16', 'w-20'] as const;

/**
 * OrganizationCard while its organization is read: the card's own layout constants (frame, header, description
 * box, footer), so it is the card's size by construction. The logo is `EntityImageSkeleton`, the name and its
 * second line `text-h3` and `text-h6` bars, the description two `text-h4` lines, the footer two stats.
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
        ORGANIZATION_CARD_LAYOUT_CLASS,
        containerClassName || ORGANIZATION_CARD_SURFACE_CLASS,
        ORGANIZATION_CARD_RADIUS_CLASS,
        className,
      )}
      aria-hidden
    >
      <div className={ORGANIZATION_CARD_HEADER_CLASS}>
        <EntityImageSkeleton />
        <div className={ORGANIZATION_CARD_TEXT_CLASS}>
          <TextLineSkeleton type="h3" className="w-3/4" />
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
      </div>
      {showDescription && (
        <div className={ORGANIZATION_CARD_DESCRIPTION_CLASS}>
          <TextLineSkeleton type="h4" lines={2} className="w-full" />
        </div>
      )}
      {showFooter && (
        <div className={ORGANIZATION_CARD_FOOTER_CLASS}>
          <div className={ORGANIZATION_CARD_STATS_CLASS}>
            {ORGANIZATION_CARD_SKELETON_STAT_WIDTHS.map(width => (
              <div key={width} className={ORGANIZATION_CARD_STAT_CLASS}>
                <MediaSkeleton.Icon size="sm" />
                <TextLineSkeleton type="h6" className={width} />
              </div>
            ))}
          </div>
        </div>
      )}
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
  region = true,
  count = 12,
  className,
  containerClassName,
  showFooter = true,
  showDescription = true,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  count?: number;
  className?: string;
  containerClassName?: string;
  showFooter?: boolean;
  showDescription?: boolean;
}) {
  return (
    <LoadingRegion
      label="Loading organizations"
      announce={region}
      className={cn('grid grid-cols-1 gap-4 content-md:grid-cols-2 content-md:gap-6 content-lg:grid-cols-3', className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <OrganizationCardSkeleton
          key={index}
          containerClassName={containerClassName}
          showFooter={showFooter}
          showDescription={showDescription}
        />
      ))}
    </LoadingRegion>
  );
}
