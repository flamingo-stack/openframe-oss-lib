import type { ScriptScheduleTableRow, ScriptTableRow } from '../../features/scripts';
import type { DemoCast } from '../cast';
import type { DemoPersonKey } from './shared';

export interface ScriptsFixture {
  /** The script library, newest first. */
  scripts: ScriptTableRow[];
  /** The schedules that run scripts from it. */
  schedules: ScriptScheduleTableRow[];
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
  };
}
