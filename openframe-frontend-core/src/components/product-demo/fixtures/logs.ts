import { logSeverityVariant, type LogDrawerProps, type LogsTableViewProps, type UiLogEntry } from '../../features/logs';
import type { DeviceCardProps } from '../../ui/device-card';
import { DEMO_DEVICES, DEMO_ORGANIZATIONS, DEMO_PEOPLE, demoMinutesAgo } from './shared';

const DAY = new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone: 'UTC' });

/** The table's own date and time rendering, pinned to one locale and zone so it never drifts. */
function displayTime(iso: string): string {
  const date = new Date(iso);
  return `${DAY.format(date)} ${TIME.format(date)}`;
}

function entry(
  logId: string,
  minutesAgo: number,
  severity: 'INFO' | 'WARNING' | 'ERROR',
  toolType: string,
  device: UiLogEntry['device'],
  summary: string,
): UiLogEntry {
  return {
    id: logId,
    logId,
    timestamp: displayTime(demoMinutesAgo(minutesAgo)),
    status: { label: severity, variant: logSeverityVariant(severity) },
    source: { name: toolType, toolType },
    device,
    description: { title: summary },
  };
}

const sam = { name: DEMO_DEVICES.samT14.hostname, organization: DEMO_ORGANIZATIONS.northbridge.name };
/** A system event has no device: the API sends the literal the table maps to "System". */
const system = (organization: string) => ({ name: 'null', organization });

/** What the Logs page is searched for in the picture: the rows below are what answers it. */
export const LOGS_FIXTURE_SEARCH = 'sign-in';

const device = (key: keyof typeof DEMO_DEVICES) => ({
  name: DEMO_DEVICES[key].hostname,
  organization: DEMO_ORGANIZATIONS[DEMO_DEVICES[key].organization].name,
});

/** A day of sign-ins across the three customers: one worth a look, a burst of failures, the rest routine. */
export const LOGS_FIXTURE_ENTRIES: UiLogEntry[] = [
  entry('evt-8f3a61c2', 52, 'ERROR', 'FLEET_MDM', sam, 'Sign-in from new country'),
  entry(
    'evt-8f3a5d07',
    96,
    'WARNING',
    'OPENFRAME_RMM',
    system(DEMO_ORGANIZATIONS.northbridge.name),
    '27 failed sign-ins for one account in 10 minutes',
  ),
  entry('evt-8f3a4b90', 171, 'INFO', 'FLEET_MDM', device('mayaAir'), 'Sign-in from a new device, approved with MFA'),
  entry(
    'evt-8f3a3e15',
    233,
    'INFO',
    'OPENFRAME_RMM',
    system(DEMO_ORGANIZATIONS.acme.name),
    'Sign-in blocked: the source address is on the block list',
  ),
  entry('evt-8f3a2c44', 318, 'INFO', 'FLEET_MDM', device('frontDesk'), 'Sign-in after a password reset'),
  entry('evt-8f3a1a02', 402, 'INFO', 'MESHCENTRAL', device('buildServer'), 'Technician sign-in to a remote session'),
  entry('evt-8f3a0b7e', 487, 'INFO', 'FLEET_MDM', device('leoThinkPad'), 'Sign-in from the office network'),
  entry('evt-8f39f951', 561, 'INFO', 'FLEET_MDM', device('reception'), 'Sign-in from the office network'),
];

/** The filters the column headers offer. */
export const LOGS_FIXTURE_FACETS: NonNullable<LogsTableViewProps['facets']> = {
  severities: ['ERROR', 'WARNING', 'INFO'],
  toolTypes: ['FLEET_MDM', 'OPENFRAME_RMM', 'MESHCENTRAL'],
  organizations: Object.values(DEMO_ORGANIZATIONS).map(organization => ({
    id: organization.id,
    label: organization.name,
    value: organization.id,
  })),
};

/** The entry open in the Log Details drawer. */
export const LOGS_FIXTURE_SELECTED: UiLogEntry = LOGS_FIXTURE_ENTRIES[0];

/** The drawer's text for the selected entry, as the product prints a log: what happened and to whom (its id, source and device are the fields under it). */
export const LOGS_FIXTURE_SELECTED_DETAILS: Extract<LogDrawerProps['description'], string> = [
  'Event Type: sign-in',
  'Message: Sign-in from new country',
  `Details: ${DEMO_PEOPLE.sam.name} signed in on ${DEMO_DEVICES.samT14.hostname} from a country not seen for this account before.`,
].join('\n');

/** The device card pinned under the selected entry. */
export const LOGS_FIXTURE_DEVICE: Pick<DeviceCardProps, 'device' | 'statusTag'> = {
  device: {
    id: DEMO_DEVICES.samT14.id,
    machineId: DEMO_DEVICES.samT14.id,
    name: DEMO_DEVICES.samT14.hostname,
    organization: DEMO_ORGANIZATIONS.northbridge.name,
    lastSeen: demoMinutesAgo(3),
    operatingSystem: 'windows',
  },
  statusTag: { label: 'ONLINE', variant: 'success' },
};
