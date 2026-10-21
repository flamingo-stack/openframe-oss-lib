import { cn } from '../../utils/cn';
import { MonitorIcon } from '../icons-v2-generated/devices/monitor-icon';
import { TagSkeleton } from '../ui/tag';
import { LoadingRegion } from './loading-region';
import { InteractiveSkeleton, TextLineSkeleton, UnifiedSkeleton } from './unified-skeleton';

/** `DeviceCard`'s frame, read by the card and by its skeleton. */
export const DEVICE_CARD_FRAME_CLASS =
  'flex flex-col gap-4 overflow-clip rounded-[6px] border border-ods-border bg-ods-card p-4';
/** The bordered box of the device-type icon. */
export const DEVICE_CARD_ICON_BOX_CLASS =
  'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-2';
/** The bordered "more" button. */
export const DEVICE_CARD_MORE_BUTTON_CLASS =
  'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-3';
/** The devices grid: one column, two from `content-md`, three from `content-lg`. Read by `DevicesGrid` (its cards,
 *  its next page) and by `DeviceCardSkeletonGrid`. */
export const DEVICES_GRID_CLASS = 'grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-3';

export interface DeviceCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string;
  /** Hold `DeviceCard`'s "more" button (its `actions.moreButton`). Default `true`. */
  moreButton?: boolean;
  /** Hold `DeviceCard`'s details button (its `actions.detailsButton.component`) as a button's box. Default `false`. */
  detailsButton?: boolean;
  /**
   * The details button's box with these size classes (e.g. `'h-12 w-[88px]'`), for a host whose button is not a
   * default-size `Button`. Implies `detailsButton`.
   * @deprecated The card draws a default-size button box for its details button (`detailsButton`); pass this only
   * to override that box.
   */
  detailsButtonClassName?: string;
  /** One card of a read list (`data-loading-item`), like the loaded cards of `DevicesGrid`. */
  listItem?: boolean;
}

/**
 * DeviceCardSkeleton: the loading box of `DeviceCard` (`ui/device-card.tsx`), box for box, from the card's own class
 * constants:
 * - Row 1: the device-type icon (static, drawn for real), the OS icon and name line (`text-h4`) over the
 *   organization line (`text-h6`), the "more" button (`moreButton`) and the details button's box (`detailsButton`);
 * - Row 2: the status tag (`TagSkeleton`) and the "Last Seen:" line (`text-h6`, its label drawn for real).
 *
 * The loaded card replaces it with no movement.
 */
export function DeviceCardSkeleton({
  className,
  moreButton = true,
  detailsButton = false,
  detailsButtonClassName,
  listItem = false,
}: DeviceCardSkeletonProps) {
  return (
    <div {...(listItem ? { 'data-loading-item': '' } : undefined)} className={cn(DEVICE_CARD_FRAME_CLASS, className)}>
      {/* Row 1: device icon | name over organization | more button | details button */}
      <div className="flex w-full items-center gap-4">
        <div className={DEVICE_CARD_ICON_BOX_CLASS}>
          <MonitorIcon className="text-ods-text-secondary" size={16} />
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
          <div className={DEVICE_CARD_MORE_BUTTON_CLASS}>
            <UnifiedSkeleton className="size-6 rounded" />
          </div>
        )}
        {detailsButtonClassName ? (
          <UnifiedSkeleton className={cn('shrink-0 rounded-[6px]', detailsButtonClassName)} />
        ) : (
          detailsButton && <InteractiveSkeleton.Button className="shrink-0" />
        )}
      </div>

      {/* Row 2: status tag | last seen */}
      <div className="flex w-full items-center gap-2">
        <TagSkeleton />
        <span className="flex min-w-0 flex-1 items-center gap-1 text-ods-text-secondary text-h6">
          <span className="shrink-0">Last Seen:</span>
          <TextLineSkeleton type="inherit" as="span" className="w-28 max-w-full" />
        </span>
      </div>
    </div>
  );
}

/**
 * DeviceCardSkeletonGrid: a grid of device card skeletons in `DevicesGrid`'s own grid (`DEVICES_GRID_CLASS`).
 */
export function DeviceCardSkeletonGrid({
  region = true,
  count = 12,
  moreButton = true,
  className,
}: {
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
  count?: number;
  /** Hold each card's "more" button, as the loaded cards show it (`DevicesGrid`'s cards hide it). Default `true`. */
  moreButton?: boolean;
  className?: string;
}) {
  return (
    <LoadingRegion label="Loading devices" announce={region} className={cn(DEVICES_GRID_CLASS, className)}>
      {Array.from({ length: count }, (_, index) => (
        <DeviceCardSkeleton key={index} moreButton={moreButton} listItem />
      ))}
    </LoadingRegion>
  );
}
