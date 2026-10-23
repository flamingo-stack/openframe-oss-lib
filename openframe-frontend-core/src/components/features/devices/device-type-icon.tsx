import type React from 'react';
import { HardDrivesIcon, LaptopIcon, MobilePhoneIcon, MonitorIcon, TabletIcon } from '../../icons-v2-generated';

const DEFAULT_CLASS_NAME = 'w-6 h-6 text-ods-text-secondary';

/**
 * Returns the icon for a device type (desktop / laptop / server / mobile / tablet),
 * using the current icons-v2 set. Replaces the deprecated `getDeviceTypeIcon` from
 * the core library.
 *
 * Returns `undefined` for unknown / missing types so the caller can skip rendering.
 * A row that names a device draws it through `DeviceTypeTile`.
 */
export function renderDeviceTypeIcon(type?: string, className: string = DEFAULT_CLASS_NAME): React.ReactNode {
  switch (type?.toLowerCase()) {
    case 'desktop':
      return <MonitorIcon className={className} />;
    case 'laptop':
      return <LaptopIcon className={className} />;
    case 'server':
      return <HardDrivesIcon className={className} />;
    case 'mobile':
      return <MobilePhoneIcon className={className} />;
    case 'tablet':
      return <TabletIcon className={className} />;
    default:
      return undefined;
  }
}
