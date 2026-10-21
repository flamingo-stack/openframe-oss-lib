import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { MonitorIcon } from '../icons-v2-generated/devices/monitor-icon';
import { Ellipsis01Icon } from '../icons-v2-generated/interface';
import { Tag } from '../ui/tag';
import { InteractiveSkeleton, MediaSkeleton, TextLineSkeleton } from './unified-skeleton';

/** `DeviceCard`'s frame, read by the card and by its skeleton. */
export const DEVICE_CARD_FRAME_CLASS =
  'flex flex-col gap-4 overflow-clip rounded-[6px] border border-ods-border bg-ods-card p-4';
/** The card's first row: the device icon, the name stack, the buttons. */
export const DEVICE_CARD_HEAD_ROW_CLASS = 'flex w-full items-center gap-4';
/** The name stack: the OS icon and name line over the organization line. */
export const DEVICE_CARD_NAME_STACK_CLASS = 'flex min-w-0 flex-1 flex-col justify-center';
/** The OS icon and the name, one `text-h4` line. */
export const DEVICE_CARD_NAME_LINE_CLASS = 'flex items-center gap-1';
/** The card's status row: the status tag and the "Last Seen:" line. */
export const DEVICE_CARD_STATUS_ROW_CLASS = 'flex w-full items-center gap-2';
/** The bordered box of the device-type icon. */
export const DEVICE_CARD_ICON_BOX_CLASS =
  'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-2';
/** The bordered "more" button. */
export const DEVICE_CARD_MORE_BUTTON_CLASS =
  'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border p-3';
/** The devices grid: one column, two from `content-md`, three from `content-lg`. Read by `DevicesGrid` (its cards and
 *  its next page). */
export const DEVICES_GRID_CLASS = 'grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-3';

export interface DeviceCardSkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Hold `DeviceCard`'s "more" button (its `actions.moreButton`). Default `true`. */
  moreButton?: boolean;
  /** Hold `DeviceCard`'s details button (its `actions.detailsButton.component`) as a button's box. Default `false`. */
  detailsButton?: boolean;
}

/**
 * DeviceCardSkeleton: the loading box of `DeviceCard` (`ui/device-card.tsx`), box for box, from the card's own class
 * constants:
 * - Row 1: the device-type icon (static, drawn for real), the OS icon and name line (`text-h4`) over the
 *   organization line (`text-h6`), the "more" button drawn for real (`moreButton`) and the details button's box
 *   (`detailsButton`);
 * - Row 2: the status tag (the tag's own skeleton) and the "Last Seen:" line (`text-h6`, its label drawn for real).
 *
 * The card's `data-*` markers (`data-loading-item`) ride on its root, as on the loaded card. The loaded card replaces
 * it with no movement.
 */
export function DeviceCardSkeleton({
  className,
  moreButton = true,
  detailsButton = false,
  ...props
}: DeviceCardSkeletonProps) {
  return (
    <div aria-hidden className={cn(DEVICE_CARD_FRAME_CLASS, className)} {...props}>
      {/* Row 1: device icon | name over organization | more button | details button */}
      <div className={DEVICE_CARD_HEAD_ROW_CLASS}>
        <div className={DEVICE_CARD_ICON_BOX_CLASS}>
          <MonitorIcon className="text-ods-text-secondary" size={16} />
        </div>
        <div className={DEVICE_CARD_NAME_STACK_CLASS}>
          <div className={cn(DEVICE_CARD_NAME_LINE_CLASS, 'text-h4')}>
            <MediaSkeleton.Icon size="sm" className="shrink-0" />
            <TextLineSkeleton type="inherit" className="w-3/4" />
          </div>
          <TextLineSkeleton type="h6" className="w-1/2" />
        </div>
        {moreButton && (
          <div className={DEVICE_CARD_MORE_BUTTON_CLASS}>
            <Ellipsis01Icon className="text-ods-text-primary" />
          </div>
        )}
        {detailsButton && <InteractiveSkeleton.Button className="shrink-0" />}
      </div>

      {/* Row 2: status tag | last seen */}
      <div className={DEVICE_CARD_STATUS_ROW_CLASS}>
        <Tag loading label="" />
        <span className="flex min-w-0 flex-1 items-center gap-1 text-ods-text-secondary text-h6">
          <span className="shrink-0">Last Seen:</span>
          <TextLineSkeleton type="inherit" as="span" className="w-28 max-w-full" />
        </span>
      </div>
    </div>
  );
}
