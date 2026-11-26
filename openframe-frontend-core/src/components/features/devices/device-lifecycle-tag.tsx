'use client';

import { Tag, type TagProps } from '../../ui/tag';
import { getDeviceLifecycleConfig, getDeviceStatusConfig, getLegacyDeviceStatusConfig } from './device-status';
import { type DeviceStatusDisplay, useDeviceStatusDisplay } from './device-status-display';
import { DeviceTagHint, devicePendingHint } from './device-status-hint';
import { DEVICE_FILTER_OUTDATED } from './device-statuses';

export interface DeviceLifecycleTagProps extends Omit<TagProps, 'label' | 'variant' | 'icon'> {
  status: string | null | undefined;
  /**
   * ONLINE / OFFLINE right now. Read only by the legacy display (`DeviceStatusDisplay`), whose one tag says ONLINE or
   * OFFLINE for a managed device; pass it wherever the row has it.
   */
  connectivity?: string | null;
  /**
   * The server's verdict that the device's OpenFrame client is outdated (`DeviceRow.clientOutdated`). Read only by the
   * legacy display: true, its tag reads OUTDATED in place of the status. The lifecycle display always shows the
   * lifecycle tag; an outdated client is the `DeviceOutdatedIcon` beside it.
   */
  clientOutdated?: boolean;
  /**
   * The PENDING tag's tooltip ("Not managed yet…", Figma 5262-162002) on hover, keyboard focus and tap, in the
   * lifecycle display only; its click never reaches the row or card around it. Off by default: a row picked by a click
   * (a device picker) keeps the whole row clickable.
   */
  pendingHint?: boolean;
}

/**
 * The lifecycle tag with its icon (Figma 3324-6819): MANAGED, PENDING, PENDING DELETION, DELETED, ARCHIVED. In the
 * legacy display, the tag from before the split instead: ONLINE / OFFLINE / PENDING, no icon; there an outdated client
 * (`clientOutdated`) reads OUTDATED in place of it.
 */
export function DeviceLifecycleTag({
  status,
  connectivity,
  clientOutdated,
  pendingHint = false,
  ...props
}: DeviceLifecycleTagProps) {
  const display = useDeviceStatusDisplay();
  const tag = <Tag {...deviceLifecycleTagProps(status, { connectivity, display, clientOutdated })} {...props} />;
  const hint = pendingHint ? devicePendingHint(status, display) : null;
  return hint ? <DeviceTagHint hint={hint}>{tag}</DeviceTagHint> : tag;
}

/**
 * The props a `Tag` takes for a device's status, for components that draw the tag themselves (`DeviceCard`). The
 * display is the caller's (`useDeviceStatusDisplay()`); without it, the lifecycle tag. `clientOutdated` turns the tag
 * into OUTDATED in the legacy display only.
 */
export function deviceLifecycleTagProps(
  status: string | null | undefined,
  {
    connectivity,
    display = 'lifecycle',
    clientOutdated,
  }: { connectivity?: string | null; display?: DeviceStatusDisplay; clientOutdated?: boolean } = {},
): Pick<TagProps, 'label' | 'variant' | 'icon'> {
  if (display === 'legacy') {
    const { label, variant } =
      clientOutdated === true
        ? getDeviceStatusConfig(DEVICE_FILTER_OUTDATED)
        : getLegacyDeviceStatusConfig(status, connectivity);
    return { label, variant };
  }
  const { label, variant, icon: Icon } = getDeviceLifecycleConfig(status);
  return { label, variant, icon: Icon ? <Icon size={16} /> : undefined };
}
