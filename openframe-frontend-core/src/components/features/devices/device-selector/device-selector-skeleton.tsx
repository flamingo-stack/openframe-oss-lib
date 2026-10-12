'use client';

import { DeviceSelector } from './device-selector';
import type { DeviceSelectorProps } from './device-selector.types';

const NO_DEVICES: never[] = [];

/**
 * The props that decide the picker's SHAPE. They are forwarded, not hardcoded:
 * whichever the caller hands its real `DeviceSelector` it must hand this one too,
 * or the two disagree on how tall the block is.
 */
type DeviceSelectorSkeletonProps = Pick<DeviceSelectorProps, 'showSelectionModeRadio' | 'singleSelect' | 'hideColumns'>;

/**
 * Suspense fallback for a `DeviceSelector` whose devices come from a suspending
 * Relay query.
 *
 * Renders the REAL selector in `loading` mode rather than an approximation, so
 * the column set, row height and empty frame come from the actual component and
 * can't drift from what replaces it. Same approach as `DevicesPanelSkeleton`.
 *
 * Locked with `disabled`, the same rule `SchedulePickerSkeleton` states, and for
 * the same reason: `disabled` blocks every interaction and leaves the picker's
 * SHAPE alone. A lock that also hid the selection-mode radio and the Available /
 * Selected tab strip left this fallback two blocks shorter than the picker it
 * stands in for, and everything below it jumped down the moment the devices
 * landed.
 */
export function DeviceSelectorSkeleton(props: DeviceSelectorSkeletonProps) {
  return <DeviceSelector {...props} devices={NO_DEVICES} loading disabled />;
}
