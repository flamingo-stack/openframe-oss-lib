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

const SIGN_IN_AT = demoMinutesAgo(52);

/** A night of logs: one sign-in worth a look, among routine patching and policy work. */
export const LOGS_FIXTURE_ENTRIES: UiLogEntry[] = [
  entry('evt-8f3a61c2', 52, 'ERROR', 'FLEET_MDM', sam, 'Sign-in from new country'),
  entry(
    'evt-8f3a5d07',
    96,
    'WARNING',
    'FLEET_MDM',
    { name: DEMO_DEVICES.buildServer.hostname, organization: DEMO_ORGANIZATIONS.acme.name },
    'Disk space below 10% on the system volume',
  ),
  entry(
    'evt-8f3a4b90',
    171,
    'INFO',
    'OPENFRAME_RMM',
    system(DEMO_ORGANIZATIONS.acme.name),
    'Google Chrome updated on 38 computers',
  ),
  entry(
    'evt-8f3a3e15',
    233,
    'INFO',
    'FLEET_MDM',
    system(DEMO_ORGANIZATIONS.harbor.name),
    'Firewall turned back on for 4 laptops',
  ),
  entry(
    'evt-8f3a2c44',
    318,
    'INFO',
    'MESHCENTRAL',
    { name: DEMO_DEVICES.frontDesk.hostname, organization: DEMO_ORGANIZATIONS.harbor.name },
    'Remote session ended',
  ),
  entry(
    'evt-8f3a1a02',
    402,
    'INFO',
    'OPENFRAME_RMM',
    { name: DEMO_DEVICES.mayaAir.hostname, organization: DEMO_ORGANIZATIONS.northbridge.name },
    'Script "Clear temp files" finished',
  ),
  entry(
    'evt-8f3a0b7e',
    487,
    'INFO',
    'FLEET_MDM',
    { name: DEMO_DEVICES.leoThinkPad.hostname, organization: DEMO_ORGANIZATIONS.harbor.name },
    'Policy "Disk encryption enabled" passed',
  ),
  entry(
    'evt-8f39f951',
    561,
    'INFO',
    'FLEET_MDM',
    { name: DEMO_DEVICES.reception.hostname, organization: DEMO_ORGANIZATIONS.acme.name },
    'Device checked in',
  ),
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

/** The drawer's text for the selected entry: the full log, as the product prints it. */
export const LOGS_FIXTURE_SELECTED_DETAILS: Extract<LogDrawerProps['description'], string> = [
  `Log ID: ${LOGS_FIXTURE_SELECTED.logId}`,
  'Status: ERROR',
  `Timestamp: ${SIGN_IN_AT}`,
  'Tool Type: FLEET_MDM',
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
