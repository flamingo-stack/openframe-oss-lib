import {
  applyTimeSlot,
  DEFAULT_SCHEDULE_FORM_VALUES,
  EMPTY_SCHEDULE_SCRIPT_ROW,
  type ScheduleFormData,
  type ScheduleScriptSearchResult,
  type ScheduleTimeSlot,
  type ScriptScheduleTableRow,
  type ScriptTableRow,
} from '../../features/scripts';
import type { DemoCast } from '../cast';
import { type DemoPersonKey, demoDay } from './shared';

/** The "New Script Schedule" form, filled in. */
export interface ScheduleFormFixture {
  /** What the form opens with. */
  values: ScheduleFormData;
  /** A fixed reading of the Time dropdown: the evening's late slots. */
  timeSlots: ScheduleTimeSlot[];
  /** What "Select Script" offers: the library. */
  scripts: ScheduleScriptSearchResult[];
}

export interface ScriptsFixture {
  /** The script library, newest first. */
  scripts: ScriptTableRow[];
  /** The schedules that run scripts from it. */
  schedules: ScriptScheduleTableRow[];
  /** One of those schedules as the form that makes it. */
  scheduleForm: ScheduleFormFixture;
}

const WINDOWS = ['windows'];
const MAC = ['darwin'];
const UNIX = ['darwin', 'linux'];

interface DemoScript {
  id: string;
  name: string;
  description: string;
  shellType: string;
  supportedPlatforms: string[];
  author: DemoPersonKey;
}

const SCRIPTS: DemoScript[] = [
  {
    id: 'script-clear-temp',
    name: 'Clear temp files',
    description: 'Empties the user and system temp folders and reports the space freed.',
    shellType: 'powershell',
    supportedPlatforms: WINDOWS,
    author: 'dana',
  },
  {
    id: 'script-restart-spooler',
    name: 'Restart print spooler',
    description: 'Stops the spooler, clears stuck jobs and starts it again.',
    shellType: 'cmd',
    supportedPlatforms: WINDOWS,
    author: 'alex',
  },
  {
    id: 'script-disk-report',
    name: 'Disk health report',
    description: 'Reads SMART status and free space on every drive.',
    shellType: 'bash',
    supportedPlatforms: UNIX,
    author: 'sara',
  },
  {
    id: 'script-map-printers',
    name: 'Map office printers',
    description: 'Adds the front desk and second floor printers for the signed-in user.',
    shellType: 'powershell',
    supportedPlatforms: WINDOWS,
    author: 'roman',
  },
  {
    id: 'script-rotate-admin',
    name: 'Rotate local admin password',
    description: 'Sets a new random password and stores it in the client vault.',
    shellType: 'bash',
    supportedPlatforms: MAC,
    author: 'dana',
  },
];

/** A schedule runs one script of the library: its name, description and platforms are that script's. */
function schedule(
  id: string,
  scriptId: string,
  timing: Pick<ScriptScheduleTableRow, 'startsAt' | 'trigger' | 'repeat'>,
  deviceCount: number,
): ScriptScheduleTableRow {
  const script = SCRIPTS.find(item => item.id === scriptId);
  if (!script) throw new Error(`Unknown demo script "${scriptId}"`);
  return {
    id,
    name: script.name,
    description: script.description,
    supportedPlatforms: script.supportedPlatforms,
    deviceCount,
    href: '#',
    ...timing,
  };
}

const TONIGHT_11_PM: ScheduleTimeSlot = { value: '23:00', label: '11:00 PM' };

const TIME_SLOTS: ScheduleTimeSlot[] = [
  { value: '22:00', label: '10:00 PM' },
  { value: '22:30', label: '10:30 PM' },
  TONIGHT_11_PM,
  { value: '23:30', label: '11:30 PM' },
];

/**
 * "Nightly temp cleanup": the library's "Clear temp files" on Windows, every
 * day at 11 PM from the demo day on.
 */
function buildScheduleForm(): ScheduleFormFixture {
  const script = SCRIPTS[0];
  const day = demoDay();
  return {
    values: {
      ...DEFAULT_SCHEDULE_FORM_VALUES,
      name: 'Nightly temp cleanup',
      scheduledDate: day,
      scheduledTime: TONIGHT_11_PM.value,
      // The start the form holds is the one it was opened with, so it stays legal whatever today is.
      startAtStored: applyTimeSlot(day, TONIGHT_11_PM.value).toISOString(),
      repeatEnabled: true,
      repeatInterval: 1,
      repeatUnit: 'day',
      supportedPlatforms: script.supportedPlatforms,
      scripts: [
        {
          ...EMPTY_SCHEDULE_SCRIPT_ROW,
          scriptId: script.id,
          name: script.name,
          supportedPlatforms: script.supportedPlatforms,
          timeoutSeconds: 90,
        },
      ],
    },
    timeSlots: TIME_SLOTS,
    scripts: SCRIPTS.map(item => ({ id: item.id, name: item.name, supportedPlatforms: item.supportedPlatforms })),
  };
}

/**
 * The product's Scripts pages: the library a team keeps, and the schedules
 * that run it across a fleet (every night, every week, or the moment a device
 * comes back online).
 */
export function buildScriptsFixture(cast: DemoCast): ScriptsFixture {
  return {
    scripts: SCRIPTS.map(script => {
      const author = cast.person(script.author);
      return {
        id: script.id,
        name: script.name,
        description: script.description,
        shellType: script.shellType,
        supportedPlatforms: script.supportedPlatforms,
        author: { name: author.name, initials: author.initials, image: author.avatarUrl },
        href: '#',
      };
    }),
    schedules: [
      schedule(
        'schedule-clear-temp',
        'script-clear-temp',
        { startsAt: { date: '10/06/2026', time: '11:00 PM' }, repeat: 'Every day' },
        213,
      ),
      schedule(
        'schedule-disk-report',
        'script-disk-report',
        { startsAt: { date: '10/11/2026', time: '6:00 AM' }, repeat: 'Every week' },
        48,
      ),
      schedule('schedule-map-printers', 'script-map-printers', { trigger: 'Device Online' }, 36),
      schedule(
        'schedule-rotate-admin',
        'script-rotate-admin',
        { startsAt: { date: '11/01/2026', time: '2:00 AM' }, repeat: 'Every month' },
        27,
      ),
      schedule(
        'schedule-restart-spooler',
        'script-restart-spooler',
        { startsAt: { date: '10/07/2026', time: '7:30 AM' }, repeat: 'Every day' },
        12,
      ),
    ],
    scheduleForm: buildScheduleForm(),
  };
}
