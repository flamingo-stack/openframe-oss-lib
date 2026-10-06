import type { DeviceFilters, DeviceRow } from '../../features/devices';
import { DEMO_DEVICES, DEMO_ORGANIZATIONS, demoMinutesAgo } from './shared';

type DemoDevice = (typeof DEMO_DEVICES)[keyof typeof DEMO_DEVICES];

function device(
  demo: DemoDevice,
  type: 'laptop' | 'desktop' | 'server',
  status: 'ONLINE' | 'OFFLINE',
  lastSeenMinutesAgo: number,
): DeviceRow {
  const organization = DEMO_ORGANIZATIONS[demo.organization];
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
  };
}

const devices: DeviceRow[] = [
  device(DEMO_DEVICES.frontDesk, 'laptop', 'ONLINE', 2),
  device(DEMO_DEVICES.mayaAir, 'laptop', 'ONLINE', 1),
  device(DEMO_DEVICES.reception, 'desktop', 'OFFLINE', 190),
  device(DEMO_DEVICES.leoThinkPad, 'laptop', 'ONLINE', 4),
  device(DEMO_DEVICES.samT14, 'laptop', 'ONLINE', 3),
  device(DEMO_DEVICES.buildServer, 'server', 'ONLINE', 1),
];

/** Rows counted by one of their fields: the facets a server would send for exactly these rows. */
function countBy(pick: (row: DeviceRow) => string | undefined): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of devices) {
    const value = pick(row);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts, ([value, count]) => ({ value, count }));
}

const deviceFilters: DeviceFilters = {
  statuses: countBy(row => row.status),
  deviceTypes: countBy(row => row.type),
  osTypes: countBy(row => row.osType),
  organizationIds: countBy(row => row.organizationId).map(entry => ({
    ...entry,
    label: devices.find(row => row.organizationId === entry.value)?.organization ?? entry.value,
  })),
  tagKeys: [],
  filteredCount: devices.length,
};

/** The fleet of the three demo customers on an ordinary morning: one desktop is offline. */
export const DEVICES_FIXTURE = {
  devices,
  deviceFilters,
  totalCount: devices.length,
} as const;
