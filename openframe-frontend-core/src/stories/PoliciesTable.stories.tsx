import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PoliciesTable, PolicySummaryCards, type PolicyTableRow } from '../components/features/policies';
import { POLICIES_FIXTURE } from '../components/product-demo/fixtures/policies';
import PoliciesScreen from '../components/product-demo/screens/policies';
import { DataTable } from '../components/ui/data-table';

const meta: Meta<typeof PoliciesTable> = {
  title: 'Features/PoliciesTable',
  component: PoliciesTable,
  parameters: { layout: 'fullscreen' },
  args: {
    rows: POLICIES_FIXTURE.rows,
    rowAsLink: true,
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

/** The table as the fleet-wide Policies page shows it. */
export const Default: Story = {};

/** With the compliance counters above it, as on the page. */
export const WithSummary: Story = {
  render: args => (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <PolicySummaryCards summary={POLICIES_FIXTURE.summary} now={POLICIES_FIXTURE.now} />
      <PoliciesTable {...args} />
    </div>
  ),
};

/** The narrow rendering of the product screen: the table alone, in a narrow content area. */
export const Compact: Story = {
  render: () => (
    <div className="ods-content-area h-[300px] w-[420px]">
      <PoliciesScreen compact />
    </div>
  ),
};

/** Sortable severity and status, with the platform column (the per-device and legacy layouts). */
export const SortableWithPlatform: Story = { args: { sortable: true, showPlatform: true } };

/** Loading rows. */
export const Loading: Story = { args: { rows: [], isLoading: true, skeletonRows: 5 } };

const noop = () => {};

/** The fixture's policies with what the grid has to fit on one line: a row menu, a long description, a status note. */
const GRID_ROWS: PolicyTableRow[] = [
  ...POLICIES_FIXTURE.rows.map(row => ({
    ...row,
    platforms: ['windows', 'darwin'],
    actions: [
      { label: 'Edit policy', onClick: noop },
      { label: 'Delete policy', onClick: noop, danger: true },
    ],
  })),
  {
    id: 'policy-os-updates',
    name: 'Operating system is up to date',
    description:
      'Every device runs the latest security update of its operating system, installed within fourteen days of its release, and restarts to finish it.',
    critical: true,
    severityLabel: 'Critical',
    status: { label: 'Failing', variant: 'error', note: { text: '12 devices', tone: 'error' } },
    platforms: [],
    actions: [{ label: 'Edit policy', onClick: noop }],
    href: '#',
  },
  {
    id: 'policy-no-menu',
    name: 'Antivirus running',
    critical: false,
    severityLabel: 'Low',
    status: { label: 'Pending', variant: 'grey', note: { text: 'Not run yet', tone: 'warning' } },
    platforms: ['linux'],
    href: '#',
  },
];

/**
 * The grid layout (`layout="grid"`): one line per policy. The name keeps its width and the description after it is
 * cut; the status tag has its note beside it; the row menu and the open button are action columns, pinned right.
 */
export const Grid: Story = {
  args: {
    rows: GRID_ROWS,
    layout: 'grid',
    sortable: true,
    showPlatform: true,
    tableSettings: { storageKey: 'storybook-policies-grid' },
  },
};

/** The grid as the fleet-wide page shows it: no platform column, the table filling the height the page leaves. */
export const GridFillHeight: Story = {
  args: { rows: GRID_ROWS, layout: 'grid', tableMaxHeight: 'fill' },
  render: args => (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <PolicySummaryCards summary={POLICIES_FIXTURE.summary} now={POLICIES_FIXTURE.now} />
      <PoliciesTable {...args} />
    </div>
  ),
};

/** Loading rows in the grid: the action columns are already there, so nothing moves when the rows arrive. */
export const GridLoading: Story = { args: { rows: [], isLoading: true, skeletonRows: 5, layout: 'grid' } };
