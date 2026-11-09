'use client';

import { UnreadNotificationsIndicator } from '../../navigation/unread-notifications-indicator';
import { useDevicesViewConfig } from './devices-view-config';
import type { DeviceRow } from './types';

/** The viewer's unread notifications about a device, opening them where the host lists them. Nothing at 0. */
export function DeviceUnreadIndicator({ device }: { device: DeviceRow }) {
  const { getDeviceNotificationsHref } = useDevicesViewConfig();
  const count = device.unreadNotificationCount ?? 0;
  return (
    <UnreadNotificationsIndicator count={count} href={count > 0 ? getDeviceNotificationsHref?.(device) : undefined} />
  );
}
