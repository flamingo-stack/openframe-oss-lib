import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PoliciesTable, PolicySummaryCards } from '../components/features/policies';
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
