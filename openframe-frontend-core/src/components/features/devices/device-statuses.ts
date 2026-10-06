import type { DeviceFilterInput } from './types';

/**
 * Default visible device statuses (excludes ARCHIVED and DELETED).
 * Deleted devices live on the dedicated /devices/archive page as read-only
 * records. Use this constant for all device queries that should show "active"
 * devices only.
 *
 * NOTE: If new statuses are added to the backend, they must be added here
 * to appear in default views.
 */

export const DEVICE_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  MAINTENANCE: 'MAINTENANCE',
  DECOMMISSIONED: 'DECOMMISSIONED',
  PENDING: 'PENDING',
  // Filter values are sanitized against the generated `DeviceStatus` enum
  // (`toRelayDeviceFilter`) before hitting GraphQL, so PENDING_DELETION is
  // silently dropped from queries until the backend adds it to the schema and
  // `schema.graphql` / schema-enums are refreshed. Safe to ship ahead of BE.
  PENDING_DELETION: 'PENDING_DELETION',
  // No archive action exists anymore, ARCHIVED survives only as a legacy
  // status on devices archived before the delete/archive rework.
  ARCHIVED: 'ARCHIVED',
  DELETED: 'DELETED',
} as const;

export type DeviceStatus = (typeof DEVICE_STATUS)[keyof typeof DEVICE_STATUS];

export const DEFAULT_VISIBLE_STATUSES = [
  DEVICE_STATUS.ONLINE,
  DEVICE_STATUS.OFFLINE,
  DEVICE_STATUS.PENDING,
  DEVICE_STATUS.PENDING_DELETION,
] as const satisfies string[];

// DELETED + legacy ARCHIVED both feed the dashboard's "Archived Devices" card,
// mirroring what the /devices/archive page lists.
export const DEFAULT_DASHBOARD_STATUSES = [
  DEVICE_STATUS.ONLINE,
  DEVICE_STATUS.OFFLINE,
  DEVICE_STATUS.PENDING,
  DEVICE_STATUS.PENDING_DELETION,
  DEVICE_STATUS.ARCHIVED,
  DEVICE_STATUS.DELETED,
] as const satisfies string[];

// PENDING is intentionally not part of the default list view, pending
// (still-enrolling) devices appear only when the user explicitly checks the
// PENDING status filter. The option itself stays in DEFAULT_VISIBLE_STATUSES.
// PENDING_DELETION stays in the default view: a device scheduled for uninstall
// must remain visible until the uninstall actually completes.
export const DEFAULT_DEVICES_LIST_STATUSES = [
  DEVICE_STATUS.ONLINE,
  DEVICE_STATUS.OFFLINE,
  DEVICE_STATUS.PENDING_DELETION,
] as const satisfies string[];

// Statuses fetched when the device list is used as an enrichment registry
// (e.g. monitoring query/policy tables mapping fleet hosts → device metadata).
// Includes DELETED (and legacy ARCHIVED) so archived-but-monitored hosts keep
// their org/OS/image instead of degrading to bare host rows.
export const DEVICE_ENRICHMENT_STATUSES = [
  DEVICE_STATUS.ONLINE,
  DEVICE_STATUS.OFFLINE,
  DEVICE_STATUS.ARCHIVED,
  DEVICE_STATUS.DELETED,
] as const satisfies string[];

/**
 * The device-registry filter the monitoring tables read: the enrichment statuses
 * as a ready `DeviceFilterInput`. Shared so the policy and query tables ask for
 * the same fleet and therefore share one cached fetch.
 */
export const DEVICE_ENRICHMENT_FILTER: DeviceFilterInput = { statuses: [...DEVICE_ENRICHMENT_STATUSES] };

export type DefaultVisibleStatus = (typeof DEFAULT_VISIBLE_STATUSES)[number];

/**
 * Statuses that are hidden by default (for documentation/reference)
 */
export const HIDDEN_DEVICE_STATUSES = [DEVICE_STATUS.ARCHIVED, DEVICE_STATUS.DELETED] as const;

export type HiddenDeviceStatus = (typeof HIDDEN_DEVICE_STATUSES)[number];
