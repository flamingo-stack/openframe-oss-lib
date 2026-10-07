import type { DeviceFilters, DeviceRow } from '../../features/devices';
import type { DemoCast } from '../cast';
import { DEMO_DEVICES, demoMinutesAgo } from './shared';

type DemoDevice = (typeof DEMO_DEVICES)[keyof typeof DEMO_DEVICES];

function device(
  cast: DemoCast,
  demo: DemoDevice,
  type: 'laptop' | 'desktop' | 'server',
  status: 'ONLINE' | 'OFFLINE',
  lastSeenMinutesAgo: number,
): DeviceRow {
  const organization = cast.organization(demo.organization);
  return {
    id: demo.id,
    machineId: demo.id,
    hostname: demo.hostname,
    nickname: undefined,
    status,
    type,
    osType: demo.os,
    last_seen: demoMinutesAgo(lastSeenMinutesAgo),
    organizationId: organization.id,
    organization: organization.name,
    organizationImageUrl: organization.logoUrl,
  };
}

/** Rows counted by one of their fields: the facets a server would send for exactly these rows. */
function countBy(
  devices: DeviceRow[],
  pick: (row: DeviceRow) => string | undefined,
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of devices) {
    const value = pick(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count }));
}

export interface DevicesFixture {
  devices: DeviceRow[];
  deviceFilters: DeviceFilters;
  totalCount: number;
}

/** The fleet of the three demo customers on an ordinary morning: a mix of states, one desktop offline since last night. */
export function buildDevicesFixture(cast: DemoCast): DevicesFixture {
  const devices: DeviceRow[] = [
    device(cast, DEMO_DEVICES.frontDesk, 'laptop', 'ONLINE', 2),
    device(cast, DEMO_DEVICES.reception, 'desktop', 'OFFLINE', 190),
    device(cast, DEMO_DEVICES.mayaAir, 'laptop', 'ONLINE', 1),
    device(cast, DEMO_DEVICES.buildServer, 'server', 'ONLINE', 1),
    device(cast, DEMO_DEVICES.leoThinkPad, 'laptop', 'OFFLINE', 64),
    device(cast, DEMO_DEVICES.samT14, 'laptop', 'ONLINE', 3),
    device(cast, DEMO_DEVICES.jenSurface, 'laptop', 'ONLINE', 6),
    device(cast, DEMO_DEVICES.priyaXps, 'laptop', 'ONLINE', 2),
  ];
  const deviceFilters: DeviceFilters = {
    statuses: countBy(devices, row => row.status),
    deviceTypes: countBy(devices, row => row.type),
    osTypes: countBy(devices, row => row.osType),
    organizationIds: countBy(devices, row => row.organizationId).map(entry => ({
      ...entry,
      label: devices.find(row => row.organizationId === entry.value)?.organization ?? entry.value,
    })),
    tagKeys: [],
    filteredCount: devices.length,
  };
  return { devices, deviceFilters, totalCount: devices.length };
}

/** What the Devices page shows for a search: the query in the field and the rows that answer it. */
export const DEVICES_SEARCH_QUERY = 'Windows';

/** The fleet narrowed to its Windows devices, the way the list answers that search. */
export function buildWindowsDevicesFixture(cast: DemoCast): DevicesFixture {
  const fleet = buildDevicesFixture(cast);
  const devices = fleet.devices.filter(row => row.osType === 'WINDOWS');
  return {
    devices,
    deviceFilters: { ...fleet.deviceFilters, filteredCount: devices.length },
    totalCount: devices.length,
  };
}
