/**
 * Device status configuration utilities
 * Provides consistent status mapping across the application
 */

import type { OSPlatformId } from '../../../utils/os-platforms';
import { getOSPlatformId } from '../../../utils/os-utils';
import { DEVICE_FILTER_OUTDATED } from './device-statuses';
import type { DeviceRow } from './types';

export type DeviceStatusVariant = 'success' | 'error' | 'warning' | 'grey' | 'critical';
export type DeviceCardStatus = 'active' | 'inactive' | 'offline' | 'warning' | 'error';

export interface DeviceStatusConfig {
  label: string;
  variant: DeviceStatusVariant;
  cardStatus: DeviceCardStatus;
}

/** An outdated OpenFrame client: the device lists show it in place of the status. */
const OUTDATED_STATUS_CONFIG: DeviceStatusConfig = {
  label: 'OUTDATED',
  variant: 'warning',
  cardStatus: 'warning',
};

/**
 * Get status configuration for display
 * Used by both table and grid views for consistent status representation
 */
export function getDeviceStatusConfig(status: string | null | undefined): DeviceStatusConfig {
  // A device may carry no status yet: it reads as the unknown one, never a crash.
  const known = (status ?? '').toUpperCase();
  switch (known) {
    case 'ONLINE':
      return {
        label: 'ONLINE',
        variant: 'success',
        cardStatus: 'active',
      };
    // ACTIVE reads as PENDING because the product app maps it so: this is its
    // mapping, carried into the lib unchanged. What a status reads as is a
    // product decision, not this module's.
    case 'PENDING':
    case 'ACTIVE':
      return {
        label: 'PENDING',
        variant: 'warning',
        cardStatus: 'warning',
      };
    case 'OFFLINE':
      return {
        label: 'OFFLINE',
        variant: 'error',
        cardStatus: 'offline',
      };
    case 'DECOMMISSIONED':
      return {
        label: 'DECOMMISSIONED',
        variant: 'error',
        cardStatus: 'offline',
      };
    case 'IDLE':
    case 'INACTIVE':
      return {
        label: 'INACTIVE',
        variant: 'grey',
        cardStatus: 'inactive',
      };
    case 'MAINTENANCE':
      return {
        label: 'MAINTENANCE',
        variant: 'warning',
        cardStatus: 'warning',
      };
    case 'PENDING_DELETION':
      return {
        label: 'PENDING DELETION',
        variant: 'error',
        cardStatus: 'error',
      };
    case 'ARCHIVED':
      return {
        label: 'ARCHIVED',
        variant: 'grey',
        cardStatus: 'inactive',
      };
    case 'DELETED':
      return {
        label: 'DELETED',
        variant: 'error',
        cardStatus: 'offline',
      };
    case DEVICE_FILTER_OUTDATED:
      return OUTDATED_STATUS_CONFIG;
    default:
      return {
        label: known,
        variant: 'grey',
        cardStatus: 'inactive',
      };
  }
}

/**
 * The tag a device list draws for a row: OUTDATED when the server flags the device's client
 * (`clientOutdated`), otherwise the device's status. The outdated client is what the user has to
 * act on, so it takes the place of the status rather than sitting beside it.
 */
export function getDeviceRowStatusConfig(device: Pick<DeviceRow, 'status' | 'clientOutdated'>): DeviceStatusConfig {
  return device.clientOutdated === true ? OUTDATED_STATUS_CONFIG : getDeviceStatusConfig(device.status);
}

/**
 * Get operating system type for DeviceCard component
 * Uses centralized OS type system from ui-kit
 */
export function getDeviceOperatingSystem(osType?: string): OSPlatformId | undefined {
  // Uses centralized getOSPlatformId from ui-kit
  // Returns: 'darwin' | 'windows' | 'linux' | undefined
  return getOSPlatformId(osType);
}
