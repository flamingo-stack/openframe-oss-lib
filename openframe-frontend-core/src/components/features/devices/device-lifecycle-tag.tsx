'use client';

import { Tag, type TagProps } from '../../ui/tag';
import { getDeviceLifecycleConfig } from './device-status';

export interface DeviceLifecycleTagProps extends Omit<TagProps, 'label' | 'variant' | 'icon'> {
  status: string | null | undefined;
}

/** The lifecycle tag with its icon (Figma 3324-6819): MANAGED, PENDING, PENDING DELETION, DELETED, ARCHIVED. */
export function DeviceLifecycleTag({ status, ...props }: DeviceLifecycleTagProps) {
  const { label, variant, icon: Icon } = getDeviceLifecycleConfig(status);
  return <Tag label={label} variant={variant} icon={Icon ? <Icon size={16} /> : undefined} {...props} />;
}

/** The props a `Tag` takes for a lifecycle status, for components that draw the tag themselves (`DeviceCard`). */
export function deviceLifecycleTagProps(
  status: string | null | undefined,
): Pick<TagProps, 'label' | 'variant' | 'icon'> {
  const { label, variant, icon: Icon } = getDeviceLifecycleConfig(status);
  return { label, variant, icon: Icon ? <Icon size={16} /> : undefined };
}
