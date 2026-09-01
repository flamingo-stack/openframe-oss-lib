import { cn } from '../../utils/cn';
import { OrganizationIconSkeleton } from './organization-icon-skeleton';

export interface DeviceCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * DeviceCardSkeleton - Loading skeleton matching DeviceCard exact layout
 *
 * Matches the structure of DeviceCard:
 * - Row 1: Device icon + Device name + More button
 * - Row 2: OS badge + Organization icon + Organization name
 * - Row 3: Status badge + Last seen
 *
 * Prevents layout jumps by matching exact dimensions.
 */
export function DeviceCardSkeleton({ className }: DeviceCardSkeletonProps) {
  return (
    <div
      className={cn('h-full rounded-[6px] border border-ods-border bg-ods-card', className)}
      role="status"
      aria-label="Loading device card"
    >
      {/* Row 1: Device icon + Device name + More button */}
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Device type icon (8x8 container) */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-bg">
          <div className="h-4 w-4 animate-pulse rounded bg-ods-border" />
        </div>

        {/* Device name */}
        <div className="min-w-0 flex-1">
          <div className="h-6 w-3/4 animate-pulse rounded bg-ods-border" />
        </div>

        {/* More button */}
        <div className="h-12 w-12 flex-shrink-0 animate-pulse rounded-[6px] bg-ods-border" />
      </div>

      {/* Row 2: OS badge + Organization */}
      <div className="flex items-center gap-4 px-4 py-2">
        {/* OS badge */}
        <div className="h-6 w-24 flex-shrink-0 animate-pulse rounded bg-ods-border" />

        {/* Organization icon */}
        <OrganizationIconSkeleton size="sm" />

        {/* Organization name */}
        <div className="min-w-0 flex-1">
          <div className="h-5 w-1/2 animate-pulse rounded bg-ods-border" />
        </div>
      </div>

      {/* Row 3: Status badge + Last seen */}
      <div className="flex items-center gap-4 px-4 py-2">
        {/* Status badge */}
        <div className="h-6 w-20 flex-shrink-0 animate-pulse rounded-full bg-ods-border" />

        {/* Last seen */}
        <div className="flex-1">
          <div className="h-5 w-40 animate-pulse rounded bg-ods-border" />
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
export function DeviceCardSkeletonGrid({ count = 12, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4', className)}
      role="status"
      aria-label={`Loading ${count} device cards`}
    >
      {Array.from({ length: count }, (_, index) => (
        <DeviceCardSkeleton key={index} />
      ))}
    </div>
  );
}
