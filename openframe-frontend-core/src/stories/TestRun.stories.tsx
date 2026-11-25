import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type ColumnDef, DataTable, useDataTable } from '../components/ui/data-table';
import { TestRunResults, TestRunStatusStat, TimingStat } from '../components/ui/test-run';

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
      {/* A run with no rows yet draws the results' loading form. */}
      <TestRunResults isActive displayRows={[]} firstError={null} />
    </div>
  ),
};

/** The Status stat states: "-" before a run, then a colored tag. */
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
      <TestRunStatusStat status="timeout" />
      <TestRunStatusStat status="canceled" />
    </div>
  ),
};

/* ───────────────────────── the grid layout (`layout="grid"`) ───────────────────────── */

/**
 * Finished run with rows in the grid: one bordered table of 48px one-line rows, a column per key of the result at its
 * least width, scrolling sideways inside itself. No settings gear: the columns are the query's own.
 */
export const GridWithResults: Story = {
  args: { isActive: false, displayRows: RESULT_ROWS, firstError: null, layout: 'grid' },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Running in the grid: the grid's own loading form, a header of bars over one 48px row. */
export const GridRunning: Story = {
  args: { isActive: true, displayRows: [], firstError: null, layout: 'grid' },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Finished with zero rows in the grid: the empty state at the height of the grid with one row (98px). */
export const GridEmptyResult: Story = {
  args: { isActive: false, displayRows: [], firstError: null, layout: 'grid' },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

/** Rows that arrived before the run failed: the error banner over the grid. */
export const GridWithErrorAndRows: Story = {
  args: {
    isActive: false,
    displayRows: RESULT_ROWS.slice(0, 1),
    firstError: 'distributed query is denylisted',
    layout: 'grid',
  },
  render: args => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <TestRunResults {...args} />
    </div>
  ),
};

interface HostRow {
  id: string;
  name: string;
  status: string;
}

const HOSTS: HostRow[] = [
  { id: 'h-1', name: 'workstation-01', status: 'Passing' },
  { id: 'h-2', name: 'workstation-02', status: 'Failing' },
  { id: 'h-3', name: 'build-server-01', status: 'Passing' },
];

const HOST_COLUMNS: ColumnDef<HostRow>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Device',
    size: 320,
    meta: { gridCell: ({ row }) => row.original.name },
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: 'Status',
    size: 200,
    meta: { gridCell: ({ row }) => row.original.status },
  },
];

/** A devices grid whose second row is open on its quick query: the results as a grid inside that row's sub-row. */
function ResultsInSubRow() {
  const table = useDataTable<HostRow>({ data: HOSTS, columns: HOST_COLUMNS, getRowId: row => row.id });
  return (
    <DataTable table={table} layout="grid">
      <DataTable.Header />
      <DataTable.Body<HostRow>
        renderSubRow={row =>
          row.id === 'h-2' ? (
            <div className="flex flex-col gap-[var(--spacing-system-s)] p-[var(--spacing-system-m)]">
              <div className="flex items-center gap-[var(--spacing-system-m)]">
                <TimingStat value="02:15 PM" label="Started" className="flex-1" />
                <TimingStat value="00:00:05" label="Duration" className="flex-1" />
                <TestRunStatusStat status="success" className="flex-1" />
              </div>
              <TestRunResults isActive={false} displayRows={RESULT_ROWS} firstError={null} layout="grid" />
            </div>
          ) : null
        }
      />
    </DataTable>
  );
}

/**
 * The quick query of a device's row (the web app's policy and query devices tables): the results grid inside the
 * sub-row of another grid. The sub-row is as wide as the visible table, so the inner grid scrolls inside it.
 */
export const GridInsideASubRow: Story = {
  args: { isActive: false, displayRows: RESULT_ROWS, firstError: null, layout: 'grid' },
  render: () => (
    <div className="max-w-[720px] bg-ods-bg p-[var(--spacing-system-mf)]">
      <ResultsInSubRow />
    </div>
  ),
};
