import { cn } from '../../utils/cn';
import { LoadingRegion } from './loading-region';
import { TextLineSkeleton, UnifiedSkeleton } from './unified-skeleton';

export interface DeviceCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string;
  /** Hold `DeviceCard`'s "more" button (its `actions.moreButton`). Default `true`. */
  moreButton?: boolean;
  /**
   * Hold the box of `DeviceCard`'s `actions.detailsButton.component` with these size classes
   * (e.g. `'h-12 w-[88px]'`). Omit when the card has no details button.
   */
  detailsButtonClassName?: string;
  /** One card of a read list (`data-loading-item`), like the loaded cards of `DevicesGrid`. */
  listItem?: boolean;
}

/**
 * DeviceCardSkeleton: the loading box of `DeviceCard` (`ui/device-card.tsx`), box for box:
 * the same container classes, then
 * - Row 1: the bordered device-icon box, the OS icon and name line (`text-h4`) over the
 *   organization line (`text-h6`), the bordered "more" button (`moreButton`) and/or the details
 *   button's box (`detailsButtonClassName`);
 * - Row 2: the status tag (`Tag`'s `h-8`) and the "Last seen" line (`text-h6`).
 *
 * The loaded card replaces it with no movement.
 */
export function DeviceCardSkeleton({
  className,
  moreButton = true,
  detailsButtonClassName,
  listItem = false,
}: DeviceCardSkeletonProps) {
  return (
    <div
      {...(listItem ? { 'data-loading-item': '' } : undefined)}
      className={cn(
        'overflow-clip rounded-[6px] border border-ods-border bg-ods-card',
        'flex flex-col gap-4 p-4',
        className,
      )}
    >
      {/* Row 1: device icon | name over organization | more button */}
      <div className="flex w-full items-center gap-4">
        <div className="flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-2">
          <UnifiedSkeleton className="size-4 rounded" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          {/* OS icon (16px) + name, one `text-h4` line */}
          <div className="flex items-center gap-1 text-h4">
            <UnifiedSkeleton className="size-4 shrink-0 rounded" />
            <TextLineSkeleton type="inherit" className="w-3/4" />
          </div>
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
        {moreButton && (
          <div className="flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-3">
            <UnifiedSkeleton className="size-6 rounded" />
          </div>
        )}
        {detailsButtonClassName && <UnifiedSkeleton className={cn('shrink-0 rounded-[6px]', detailsButtonClassName)} />}
      </div>

      {/* Row 2: status tag | last seen */}
      <div className="flex w-full items-center gap-2">
        <UnifiedSkeleton className="h-8 w-20 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 text-h6">
          <TextLineSkeleton type="inherit" className="w-40 max-w-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * DeviceCardSkeletonGrid - Grid of device card skeletons
 *
 * Matches DevicesGrid layout with responsive columns:
 * - Mobile: 1 column
 * - Tablet (md): 2 columns
 * - Desktop (lg): 3 columns
 * - Large (xl): 4 columns
 */
export function DeviceCardSkeletonGrid({
  region = true,
  count = 12,
  className,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  count?: number;
  className?: string;
}) {
  return (
    <LoadingRegion
      label="Loading devices"
      announce={region}
      className={cn('grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-4', className)}
    >
      {Array.from({ length: count }, (_, index) => (
        <DeviceCardSkeleton key={index} listItem />
      ))}
    </LoadingRegion>
  );
}
