/**
 * Device status configuration utilities
 * Provides consistent status mapping across the application
 */

import type { ComponentType } from 'react';
import type { OSPlatformId } from '../../../utils/os-platforms';
import { getOSPlatformId } from '../../../utils/os-utils';
import { CheckCircleIcon, DotsLoaderIcon, TrashClockIcon, TrashIcon } from '../../icons-v2-generated';
import { isDeviceConnected, isManagedStatus } from './device-statuses';

export type DeviceStatusVariant = 'success' | 'error' | 'warning' | 'grey' | 'critical';
export type DeviceCardStatus = 'active' | 'inactive' | 'offline' | 'warning' | 'error';

export interface DeviceStatusConfig {
  label: string;
  variant: DeviceStatusVariant;
  cardStatus: DeviceCardStatus;
}

/** The icon a lifecycle tag leads with (Figma 3324-6819). */
export type DeviceLifecycleIcon = ComponentType<{ size?: number; className?: string }>;

export interface DeviceLifecycleConfig {
  label: string;
  variant: DeviceStatusVariant;
  icon?: DeviceLifecycleIcon;
}

/**
 * How a device's lifecycle status reads: the tag beside the connectivity icon
 * (Figma 3324-6819). MANAGED and the legacy ONLINE / OFFLINE all read
 * "MANAGED": whether the device is online is `getDeviceConnectivityConfig`'s,
 * never the tag's.
 */
export function getDeviceLifecycleConfig(status: string | null | undefined): DeviceLifecycleConfig {
  const known = (status ?? '').toUpperCase();
  if (isManagedStatus(known)) return { label: 'MANAGED', variant: 'success', icon: CheckCircleIcon };
  switch (known) {
    case 'PENDING':
    case 'ACTIVE':
      return { label: 'PENDING', variant: 'warning', icon: DotsLoaderIcon };
    case 'PENDING_DELETION':
      return { label: 'PENDING DELETION', variant: 'error', icon: TrashClockIcon };
    case 'DELETED':
      return { label: 'DELETED', variant: 'grey', icon: TrashIcon };
    case 'ARCHIVED':
      return { label: 'ARCHIVED', variant: 'grey' };
    case 'INACTIVE':
    case 'IDLE':
      return { label: 'INACTIVE', variant: 'grey' };
    case 'MAINTENANCE':
      return { label: 'MAINTENANCE', variant: 'warning' };
    case 'DECOMMISSIONED':
      return { label: 'DECOMMISSIONED', variant: 'error' };
    default:
      return { label: known, variant: 'grey' };
  }
}

export interface DeviceConnectivityConfig {
  online: boolean;
  /** "Online" / "Offline": the icon's accessible name. */
  label: string;
}

/** Whether the device is online right now, from `connectivity` only. Null (never reported) reads as offline. */
export function getDeviceConnectivityConfig(connectivity: string | null | undefined): DeviceConnectivityConfig {
  const online = isDeviceConnected(connectivity);
  return { online, label: online ? 'Online' : 'Offline' };
}

/**
 * Get status configuration for display
 * @deprecated Mixes lifecycle and connectivity. Use `getDeviceLifecycleConfig` for the tag and
 * `getDeviceConnectivityConfig` for whether the device is online. Kept for hosts that still show the
 * raw status (multi-platform-hub's device health).
 */
export function getDeviceStatusConfig(status: string | null | undefined): DeviceStatusConfig {
  // A device may carry no status yet: it reads as the unknown one, never a crash.
  const known = (status ?? '').toUpperCase();
  switch (known) {
    case 'MANAGED':
      return {
        label: 'MANAGED',
        variant: 'success',
        cardStatus: 'active',
      };
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
    default:
      return {
        label: known,
        variant: 'grey',
        cardStatus: 'inactive',
      };
  }
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
