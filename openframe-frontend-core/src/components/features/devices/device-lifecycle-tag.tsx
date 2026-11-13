'use client';

import { Tag, type TagProps } from '../../ui/tag';
import { getDeviceLifecycleConfig, getLegacyDeviceStatusConfig } from './device-status';
import { type DeviceStatusDisplay, useDeviceStatusDisplay } from './device-status-display';

export interface DeviceLifecycleTagProps extends Omit<TagProps, 'label' | 'variant' | 'icon'> {
  status: string | null | undefined;
  /**
   * ONLINE / OFFLINE right now. Read only by the legacy display (`DeviceStatusDisplay`), whose one tag says ONLINE or
   * OFFLINE for a managed device; pass it wherever the row has it.
   */
  connectivity?: string | null;
}

/**
 * The lifecycle tag with its icon (Figma 3324-6819): MANAGED, PENDING, PENDING DELETION, DELETED, ARCHIVED. In the
 * legacy display, the tag from before the split instead: ONLINE / OFFLINE / PENDING, no icon.
 */
export function DeviceLifecycleTag({ status, connectivity, ...props }: DeviceLifecycleTagProps) {
  const display = useDeviceStatusDisplay();
  return <Tag {...deviceLifecycleTagProps(status, { connectivity, display })} {...props} />;
}

/**
 * The props a `Tag` takes for a device's status, for components that draw the tag themselves (`DeviceCard`). The
 * display is the caller's (`useDeviceStatusDisplay()`); without it, the lifecycle tag.
 */
export function deviceLifecycleTagProps(
  status: string | null | undefined,
  { connectivity, display = 'lifecycle' }: { connectivity?: string | null; display?: DeviceStatusDisplay } = {},
): Pick<TagProps, 'label' | 'variant' | 'icon'> {
  if (display === 'legacy') {
    const { label, variant } = getLegacyDeviceStatusConfig(status, connectivity);
    return { label, variant };
  }
  const { label, variant, icon: Icon } = getDeviceLifecycleConfig(status);
  return { label, variant, icon: Icon ? <Icon size={16} /> : undefined };
}
