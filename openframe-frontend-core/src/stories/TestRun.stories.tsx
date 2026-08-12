import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TestResultsSkeleton, TestRunResults, TestRunStatusStat, TimingStat } from '../components/ui/test-run';

const meta = {
  title: 'UI/TestRun',
  component: TestRunResults,
  parameters: {
    docs: {
      description: {
        component:
          'Building blocks for live test-run panels ("run a query somewhere, stream tabular results back"): ' +
          'timing stats, a one-row column skeleton, and a results table with always-visible headers and ' +
          'horizontal scroll fades. Pair with useTestRunState, which wraps an app-owned campaign ' +
          '(e.g. a Fleet live query hook) with the run/stop/reset state machine.',
      },
    },
  },
} satisfies Meta<typeof TestRunResults>;

export default meta;
type Story = StoryObj<typeof meta>;

const RESULT_ROWS = [
  {
    'host display name': 'workstation-01',
    pid: '1234',
    name: 'chrome',
    path: '/Applications/Google Chrome.app',
    state: 'R',
    uid: '501',
    'resident size': '245760000',
    threads: '42',
  },
  {
    'host display name': 'workstation-01',
    pid: '5678',
    name: 'node',
    path: '/usr/local/bin/node',
    state: 'S',
    uid: '501',
    'resident size': '98304000',
    threads: '12',
  },
];

/** Finished run with rows: DataTable styling, headers on all breakpoints. */
export const WithResults: Story = {
  args: {
    isActive: false,
    displayRows: RESULT_ROWS,
    firstError: null,
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Running: one-row skeleton with fixed 160px columns. */
export const Running: Story = {
  args: {
    isActive: true,
    displayRows: [],
    firstError: null,
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Finished with zero rows: fixed-height empty state (no layout jump). */
export const EmptyResult: Story = {
  args: {
    isActive: false,
    displayRows: [],
    firstError: null,
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Finished with an error: red banner with a copy action replaces the empty state. */
export const WithError: Story = {
  args: {
    isActive: false,
    displayRows: [],
    firstError: 'no such table: procesess (near "procesess": syntax error)',
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Timing cells + standalone skeleton, as composed by app test panels. */
export const TimingAndSkeleton: Story = {
  args: {
    isActive: true,
    displayRows: [],
    firstError: null,
  },
  render: () => (
    <div className="flex max-w-[720px] flex-col gap-[var(--spacing-system-m)] bg-ods-bg p-[var(--spacing-system-mf)]">
      <div className="flex items-center gap-[var(--spacing-system-m)]">
        <TimingStat value="02:15 PM" label="Started" className="flex-1" />
        <TimingStat value="00:00:05" label="Duration" className="flex-1" />
        <TestRunStatusStat status="running" className="flex-1" />
      </div>
      <TestResultsSkeleton />
    </div>
  ),
};

/** The four Status stat states: "-" before a run, then a colored tag. */
export const StatusStates: Story = {
  args: {
    isActive: false,
    displayRows: [],
    firstError: null,
  },
  render: () => (
    <div className="flex max-w-[720px] items-center gap-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunStatusStat status="idle" />
      <TestRunStatusStat status="running" />
      <TestRunStatusStat status="success" />
      <TestRunStatusStat status="error" />
    </div>
  ),
};
