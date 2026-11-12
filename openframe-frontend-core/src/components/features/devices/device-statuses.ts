import { filterSectionValue, splitFilterSectionValues } from '../../ui/data-table/types';
import type { DeviceFilterInput, DeviceFilterValue } from './types';

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
  // The lifecycle status of a device the agent, Fleet and MeshCentral have all
  // reached at least once. Replaces ONLINE / OFFLINE, which become connectivity
  // (`DEVICE_CONNECTIVITY`) and stay on unmigrated devices until phase 3.
  MANAGED: 'MANAGED',
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

/**
 * The statuses the UI value MANAGED stands for. A device migrated by the backend
 * is MANAGED; one not migrated yet (or a backend without MANAGED) is still
 * ONLINE or OFFLINE, and the UI shows all three as "Managed". Expand with
 * `expandDeviceStatuses` where a query is built; never send MANAGED on its own.
 */
export const MANAGED_STATUSES = [DEVICE_STATUS.MANAGED, DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE] as const;

/** Whether a device's lifecycle status is the managed one (MANAGED, or the legacy ONLINE / OFFLINE). */
export function isManagedStatus(status: string | null | undefined): boolean {
  return (MANAGED_STATUSES as readonly string[]).includes((status ?? '').toUpperCase());
}

/** The UI value of a lifecycle status: the legacy ONLINE / OFFLINE read as MANAGED. */
export function toUiDeviceStatus(status: string): string {
  return isManagedStatus(status) ? DEVICE_STATUS.MANAGED : status;
}

/**
 * The statuses a query sends for UI statuses: MANAGED becomes ONLINE and OFFLINE,
 * plus MANAGED itself only when the backend's enum has it (`managedSupported`;
 * a phase-1 backend rejects the value). Order kept, duplicates dropped.
 */
export function expandDeviceStatuses(statuses: readonly string[], managedSupported: boolean): string[] {
  const out: string[] = [];
  for (const status of statuses) {
    const values = isManagedStatus(status)
      ? managedSupported
        ? MANAGED_STATUSES
        : [DEVICE_STATUS.ONLINE, DEVICE_STATUS.OFFLINE]
      : [status];
    for (const value of values) if (!out.includes(value)) out.push(value);
  }
  return out;
}

/** The status facet in UI values: the MANAGED, ONLINE and OFFLINE rows summed into one MANAGED row, where the first was. */
export function mergeStatusFacets(statuses: readonly DeviceFilterValue[]): DeviceFilterValue[] {
  const out: DeviceFilterValue[] = [];
  for (const row of statuses) {
    const value = toUiDeviceStatus(row.value);
    const existing = out.find(o => o.value === value);
    if (existing) existing.count += row.count;
    else out.push({ value, count: row.count });
  }
  return out;
}

/** Whether a device is reachable right now, apart from its lifecycle status. Absent reads as OFFLINE. */
export const DEVICE_CONNECTIVITY = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const;

export type DeviceConnectivity = (typeof DEVICE_CONNECTIVITY)[keyof typeof DEVICE_CONNECTIVITY];

/**
 * The id of the STATUS funnel's "Connectivity" group. Its picks ride in the status column's filter value as
 * `connectivity:ONLINE` (`filterSectionValue`); split them out with `splitFilterSectionValues(values, [this])`.
 */
export const DEVICE_CONNECTIVITY_FILTER_SECTION = 'connectivity';

/** The STATUS column's filter value for lifecycle statuses plus connectivity picks (`connectivity:ONLINE`). */
export function joinStatusFilterValue(statuses: readonly string[], connectivity: readonly string[] = []): string[] {
  return [...statuses, ...connectivity.map(value => filterSectionValue(DEVICE_CONNECTIVITY_FILTER_SECTION, value))];
}

/** The STATUS column's filter value split back into lifecycle statuses and connectivity picks. */
export function splitStatusFilterValue(values: readonly string[] | undefined): {
  statuses: string[];
  connectivity: string[];
} {
  const { own, sections } = splitFilterSectionValues(values, [DEVICE_CONNECTIVITY_FILTER_SECTION]);
  return { statuses: own, connectivity: sections[DEVICE_CONNECTIVITY_FILTER_SECTION] ?? [] };
}

/** The connectivity filter's options, in order. */
export const DEVICE_CONNECTIVITY_VALUES = [DEVICE_CONNECTIVITY.ONLINE, DEVICE_CONNECTIVITY.OFFLINE] as const;

/** Whether a device is online right now: only `connectivity` says so, never the lifecycle status. */
export function isDeviceConnected(connectivity: string | null | undefined): boolean {
  return (connectivity ?? '').toUpperCase() === DEVICE_CONNECTIVITY.ONLINE;
}

// The lists below are UI values: MANAGED stands for MANAGED_STATUSES and is
// expanded where the query is built (`expandDeviceStatuses`).

/** The lifecycle options the status filter offers (DELETED and legacy ARCHIVED live on /devices/archive). */
export const DEFAULT_VISIBLE_STATUSES = [
  DEVICE_STATUS.PENDING,
  DEVICE_STATUS.MANAGED,
  DEVICE_STATUS.PENDING_DELETION,
] as const satisfies string[];

// DELETED + legacy ARCHIVED both feed the dashboard's "Archived Devices" card,
// mirroring what the /devices/archive page lists.
export const DEFAULT_DASHBOARD_STATUSES = [
  DEVICE_STATUS.PENDING,
  DEVICE_STATUS.MANAGED,
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
  DEVICE_STATUS.MANAGED,
  DEVICE_STATUS.PENDING_DELETION,
] as const satisfies string[];

// Statuses fetched when the device list is used as an enrichment registry
// (e.g. monitoring query/policy tables mapping fleet hosts → device metadata).
// Includes DELETED (and legacy ARCHIVED) so archived-but-monitored hosts keep
// their org/OS/image instead of degrading to bare host rows.
export const DEVICE_ENRICHMENT_STATUSES = [
  DEVICE_STATUS.MANAGED,
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
