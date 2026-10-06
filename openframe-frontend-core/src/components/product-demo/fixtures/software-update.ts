import type { DeviceRow } from '../../features/devices';
import type { SelectedPackage, SoftwareActionFormProps, SoftwareScheduleTiming } from '../../features/software';
import { DEVICES_FIXTURE } from './devices';
import { DEMO_DEVICES, DEMO_NOW } from './shared';

/** The catalog entry the row holds: WinGet's Google Chrome. */
const chrome: SelectedPackage = {
  id: 'Google.Chrome',
  name: 'Google Chrome',
  description: 'A fast, secure web browser built for the modern web',
  version: '141.0.7390.66',
  packageType: null,
};

/** The demo day as a local calendar day, so the date field reads the same in every timezone. */
function demoDay(): Date {
  const [year, month, day] = DEMO_NOW.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

const TONIGHT_11_PM = { value: '23:00', label: '11:00 PM' };

/** A fixed reading of the schedule fields: tonight's late slots, nothing in the past. */
const timing: SoftwareScheduleTiming = {
  timeReferenceOptions: [
    { value: 'SERVER', label: 'Your account timezone' },
    { value: 'DEVICE_LOCAL', label: 'Device local timezone' },
  ],
  getTimeOptions: () => [
    { value: '22:00', label: '10:00 PM' },
    { value: '22:30', label: '10:30 PM' },
    TONIGHT_11_PM,
    { value: '23:30', label: '11:30 PM' },
  ],
  getEarliestDay: demoDay,
  getStartError: () => undefined,
};

const initialValues: SoftwareActionFormProps['initialValues'] = {
  rows: [{ key: 'row-0', packageManager: 'WINGET', pkg: chrome }],
  mode: 'schedule',
  date: demoDay(),
  time: TONIGHT_11_PM.value,
  timeReference: 'SERVER',
};

/** WinGet installs on Windows, so the picker offers the fleet's Windows devices. */
const devices: DeviceRow[] = DEVICES_FIXTURE.devices.filter(device => device.osType === 'WINDOWS');

/** Chrome updated tonight at 11 PM on two Windows devices, one of them offline until it reconnects. */
export const SOFTWARE_UPDATE_FIXTURE = {
  action: 'UPDATE',
  package: chrome,
  timing,
  initialValues,
  devices,
  selectedIds: new Set<string>([DEMO_DEVICES.reception.id, DEMO_DEVICES.samT14.id]),
} as const;
