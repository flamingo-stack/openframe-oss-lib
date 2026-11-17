'use client';

import { Tag, type TagProps } from '../../ui/tag';
import { getDeviceLifecycleConfig, getDeviceStatusConfig, getLegacyDeviceStatusConfig } from './device-status';
import { type DeviceStatusDisplay, useDeviceStatusDisplay } from './device-status-display';
import { DEVICE_FILTER_OUTDATED } from './device-statuses';

export interface DeviceLifecycleTagProps extends Omit<TagProps, 'label' | 'variant' | 'icon'> {
  status: string | null | undefined;
  /**
   * ONLINE / OFFLINE right now. Read only by the legacy display (`DeviceStatusDisplay`), whose one tag says ONLINE or
   * OFFLINE for a managed device; pass it wherever the row has it.
   */
  connectivity?: string | null;
  /**
   * The server's verdict that the device's OpenFrame client is outdated (`DeviceRow.clientOutdated`). True: the tag
   * reads OUTDATED in place of the status, in either display, as the device lists show it.
   */
  clientOutdated?: boolean;
}

/**
 * The lifecycle tag with its icon (Figma 3324-6819): MANAGED, PENDING, PENDING DELETION, DELETED, ARCHIVED. In the
 * legacy display, the tag from before the split instead: ONLINE / OFFLINE / PENDING, no icon. An outdated client
 * (`clientOutdated`) reads OUTDATED in place of either.
 */
export function DeviceLifecycleTag({ status, connectivity, clientOutdated, ...props }: DeviceLifecycleTagProps) {
  const display = useDeviceStatusDisplay();
  return <Tag {...deviceLifecycleTagProps(status, { connectivity, display, clientOutdated })} {...props} />;
}

/**
 * The props a `Tag` takes for a device's status, for components that draw the tag themselves (`DeviceCard`). The
 * display is the caller's (`useDeviceStatusDisplay()`); without it, the lifecycle tag.
 */
export function deviceLifecycleTagProps(
  status: string | null | undefined,
  {
    connectivity,
    display = 'lifecycle',
    clientOutdated,
  }: { connectivity?: string | null; display?: DeviceStatusDisplay; clientOutdated?: boolean } = {},
): Pick<TagProps, 'label' | 'variant' | 'icon'> {
  if (clientOutdated === true) {
    const { label, variant } = getDeviceStatusConfig(DEVICE_FILTER_OUTDATED);
    return { label, variant };
  }
  if (display === 'legacy') {
    const { label, variant } = getLegacyDeviceStatusConfig(status, connectivity);
    return { label, variant };
  }
  const { label, variant, icon: Icon } = getDeviceLifecycleConfig(status);
  return { label, variant, icon: Icon ? <Icon size={16} /> : undefined };
}
