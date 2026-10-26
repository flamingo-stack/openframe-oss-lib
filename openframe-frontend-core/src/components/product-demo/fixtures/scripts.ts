import type { ScriptExecutionSource, ScriptExecutionStatus, ScriptExecutionTableRow } from '../../features/scripts';
import type { DemoCast } from '../cast';
import { DEMO_DEVICES, DEMO_ORGANIZATIONS, demoDay } from './shared';

/** The script the page's Mingo conversation writes, and the schedule that runs it. */
export interface DemoScript {
  name: string;
  /** Lowercase shell id. */
  shellType: string;
  /** The script's source, as the editor holds it. */
  code: string;
  /** Who wrote it and who approved it. */
  provenance: { author: string; approver: string };
  /** The schedule that runs it, as one line. */
  schedule: { repeat: string; time: string; deviceCount: number };
}

export interface ScriptsFixture {
  script: DemoScript;
  /** The schedule's first night, newest first (the Execution History's default order). */
  executions: ScriptExecutionTableRow[];
  /** The run whose output the picture opens. */
  openExecutionId: string;
}

/**
 * "Clear temp files", the script Mingo writes in the conversation beside the
 * picture: it empties the Windows temp folder, every user's and the update
 * download cache, then prints how much space it freed and how it exited. Short lines, so the picture
 * never cuts one in its narrow column.
 */
const CLEAR_TEMP_FILES = `$ErrorActionPreference = 'Ignore'
$paths = "$env:windir\\Temp",
  'C:\\Users\\*\\AppData\\Local\\Temp',
  "$env:windir\\SoftwareDistribution\\Download"
$before = (Get-PSDrive C).Free
foreach ($path in $paths) {
  $items = Get-ChildItem $path -Recurse -Force
  "Cleaning $path ($($items.Count) items)"
  $items | Remove-Item -Recurse -Force
}
$freed = (Get-PSDrive C).Free - $before
'Freed {0:N1} GB' -f ($freed / 1GB)
'Exit code: 0'
exit 0`;

/** The folders the script empties, in the order it prints them. */
function cleanupLines([system, users, updates]: readonly [number, number, number]): string[] {
  return [
    `Cleaning C:\\Windows\\Temp (${system} items)`,
    `Cleaning C:\\Users\\*\\AppData\\Local\\Temp (${users.toLocaleString('en-US')} items)`,
    `Cleaning C:\\Windows\\SoftwareDistribution\\Download (${updates} items)`,
  ];
}

/** What the script prints on a device: one line per folder, then the space freed and the exit code. */
function cleanupOutput(counts: readonly [number, number, number], freedGb: string): string {
  return [...cleanupLines(counts), `Freed ${freedGb} GB`, 'Exit code: 0'].join('\n');
}

const DAY = new Intl.DateTimeFormat('en-US', { dateStyle: 'short' });
const TIME = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

/**
 * A time on the demo day, in the table's own `date time` rendering. Built on
 * the local calendar day, so it reads the same in every timezone: the
 * schedule fires at 11:00 PM on the devices' clock (the time its summary
 * states beside the table), and the conversation's test ran minutes before.
 */
function onDemoDay(hours: number, minutes: number): string {
  const day = demoDay();
  const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
  return `${DAY.format(at)} ${TIME.format(at)}`;
}

interface DemoExecution {
  executionId: string;
  device: keyof typeof DEMO_DEVICES;
  /** Hour and minute it was dispatched. */
  at: readonly [number, number];
  status: ScriptExecutionStatus;
  source: ScriptExecutionSource;
  result: string;
}

/**
 * The first night of "Nightly temp cleanup" on the Windows fleet: devices pick
 * the run up as they check in, so dispatch times are minutes apart. One run is
 * still going and one failed (it ran past its 90-second timeout), the failure
 * Mingo promised to report. The oldest row is the conversation's own test on
 * RECEPTION-01, the one Mingo dispatched.
 */
const RUN: readonly DemoExecution[] = [
  {
    executionId: 'c4f1e7a2-93b0-4d6e-8a15-6e2b9f04d731',
    device: 'jenSurface',
    at: [23, 4],
    status: 'RUNNING',
    source: 'SCHEDULED',
    result: cleanupLines([254, 1377, 40])[0],
  },
  {
    executionId: '9a2d5c18-4e7f-4b31-b0c6-d85e1a3f6290',
    device: 'samT14',
    at: [23, 3],
    status: 'FAILED',
    source: 'SCHEDULED',
    result: [cleanupLines([230, 906, 51])[0], 'Execution timed out after 90 seconds'].join('\n\n'),
  },
  {
    executionId: '1e8b47d3-c25a-4f90-9e3d-07b6a2c51f84',
    device: 'warehouse',
    at: [23, 2],
    status: 'SUCCESS',
    source: 'SCHEDULED',
    result: cleanupOutput([412, 2184, 63], '2.7'),
  },
  {
    executionId: '6f30a9c5-1b84-47e2-a3d9-52c8e7b0f416',
    device: 'leoThinkPad',
    at: [23, 1],
    status: 'SUCCESS',
    source: 'SCHEDULED',
    result: cleanupOutput([288, 1530, 41], '1.9'),
  },
  {
    executionId: 'b7d26e04-8f1c-4a53-9b7e-3c0f5a9d82e1',
    device: 'priyaXps',
    at: [23, 1],
    status: 'SUCCESS',
    source: 'SCHEDULED',
    result: cleanupOutput([241, 1102, 37], '1.4'),
  },
  {
    executionId: '2c95f8b1-6d07-4e4a-8f2b-a13e9c6d70b5',
    device: 'frontDesk',
    at: [23, 0],
    status: 'SUCCESS',
    source: 'SCHEDULED',
    result: cleanupOutput([507, 2650, 72], '2.2'),
  },
  {
    executionId: 'e05b3a7f-d4c8-49e1-b6a0-8f2d17c9e358',
    device: 'reception',
    at: [22, 51],
    status: 'SUCCESS',
    source: 'AI_ASSISTANT',
    result: cleanupOutput([596, 3418, 88], '3.2'),
  },
];

/** The run the picture opens: a finished one, so its output ends in what it freed. */
const OPEN_EXECUTION = RUN[2];

/**
 * The scripts screen's story, picking up where the page's Mingo conversation
 * ends: the script it wrote, and the first night its schedule ran.
 */
export function buildScriptsFixture(cast: DemoCast): ScriptsFixture {
  const alex = cast.person('alex');
  return {
    script: {
      name: 'Clear temp files',
      shellType: 'powershell',
      code: CLEAR_TEMP_FILES,
      provenance: { author: 'Mingo', approver: alex.name },
      schedule: { repeat: 'Every day', time: '11:00 PM', deviceCount: 213 },
    },
    executions: RUN.map(run => {
      const device = DEMO_DEVICES[run.device];
      return {
        id: run.executionId,
        executionId: run.executionId,
        timestamp: onDemoDay(...run.at),
        status: run.status,
        machineName: device.hostname,
        organization: DEMO_ORGANIZATIONS[device.organization].name,
        // Every run is on behalf of Alex: the schedule is his, and the test ran because he asked.
        initiator: { name: alex.name, initials: alex.initials, image: alex.avatarUrl },
        source: run.source,
        result: run.result,
      };
    }),
    openExecutionId: OPEN_EXECUTION.executionId,
  };
}
