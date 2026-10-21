import type { HTMLAttributes } from 'react';
import { DeviceCard } from '../ui/device-card';

/** The devices grid: one column, two from `content-md`, three from `content-lg`. Read by `DevicesGrid` (its cards and
 *  its next page). */
export const DEVICES_GRID_CLASS = 'grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-3';

export interface DeviceCardSkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Hold `DeviceCard`'s "more" button (its `actions.moreButton`). Default `true`. */
  moreButton?: boolean;
}

/**
 * @deprecated Render `<DeviceCard loading … />` (or the card in a loading scope): the card draws its own loading form
 * from its one structure. This alias renders exactly that.
 */
export function DeviceCardSkeleton({ moreButton = true, ...props }: DeviceCardSkeletonProps) {
  return <DeviceCard loading device={{ name: '' }} actions={{ moreButton: { visible: moreButton } }} {...props} />;
}
