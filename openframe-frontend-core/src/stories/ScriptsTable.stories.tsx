import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  ScriptExecutionsTable,
  type ScriptScheduleTableRow,
  ScriptSchedulesTable,
  ScriptsTable,
  type ScriptTableRow,
} from '../components/features/scripts';
import { resolveProductDemoCast } from '../components/product-demo/cast';
import { buildScriptsFixture } from '../components/product-demo/fixtures/scripts';
import ScriptsScreen from '../components/product-demo/screens/scripts';
import { DataTable } from '../components/ui/data-table';

const FIXTURE = buildScriptsFixture(resolveProductDemoCast());

const LIBRARY: ScriptTableRow[] = [
  {
    id: 'clear-temp',
    name: 'Clear temp files',
    description: 'Empties the user and system temp folders and reports the space freed.',
    shellType: 'powershell',
    supportedPlatforms: ['windows'],
    author: { name: 'Alex Reed', initials: 'AR' },
    href: '#',
  },
  {
    id: 'restart-spooler',
    name: 'Restart print spooler',
    description: 'Stops the spooler, clears stuck jobs and starts it again.',
    shellType: 'cmd',
    supportedPlatforms: ['windows'],
    author: { name: 'Dana Reyes', initials: 'DR' },
    href: '#',
  },
  {
    id: 'disk-report',
    name: 'Disk health report',
    description: 'Reads SMART status and free space on every drive.',
    shellType: 'bash',
    supportedPlatforms: ['darwin', 'linux'],
    author: { name: 'Sara Kim', initials: 'SK' },
    href: '#',
  },
];

const SCHEDULES: ScriptScheduleTableRow[] = [
  {
    id: 'clear-temp',
    name: 'Clear temp files',
    supportedPlatforms: ['windows'],
    startsAt: { date: '10/06/2026', time: '11:00 PM' },
    repeat: 'Every day',
    deviceCount: 213,
    href: '#',
  },
  {
    id: 'map-printers',
    name: 'Map office printers',
    supportedPlatforms: ['windows'],
    trigger: 'Device Online',
    deviceCount: 36,
    href: '#',
  },
];

const meta: Meta<typeof ScriptsTable> = {
  title: 'Features/ScriptsTable',
  component: ScriptsTable,
  parameters: { layout: 'fullscreen' },
  args: {
    rows: LIBRARY,
    rightSlot: <DataTable.RowCount />,
  },
  decorators: [
    Story => (
      <div className="ods-content-area bg-ods-bg p-[var(--spacing-system-l)]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The script library as the Scripts page lists it. */
export const Default: Story = {};

/** The schedules that run the library's scripts. */
export const Schedules: Story = {
  render: () => <ScriptSchedulesTable rows={SCHEDULES} rightSlot={<DataTable.RowCount />} />,
};

/** A script's Execution History: every run, its device and status, and what dispatched it. */
export const Executions: Story = {
  render: () => (
    <ScriptExecutionsTable rows={FIXTURE.executions} rightSlot={<DataTable.RowCount itemName="execution" />} />
  ),
};

/** The product screen: the script beside its first night of runs, in the frame's size. */
export const Screen: Story = {
  render: () => (
    <div className="ods-content-area h-[440px] w-[1400px]">
      <ScriptsScreen />
    </div>
  ),
};

/** The narrow rendering of the product screen: the run alone. */
export const Compact: Story = {
  render: () => (
    <div className="ods-content-area h-[300px] w-[420px]">
      <ScriptsScreen compact />
    </div>
  ),
};

/** Loading rows. */
export const Loading: Story = { args: { rows: [], isLoading: true, skeletonRows: 5 } };
