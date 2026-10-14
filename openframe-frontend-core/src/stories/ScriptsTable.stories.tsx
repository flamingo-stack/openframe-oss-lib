import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ScriptSchedulesTable, ScriptsTable } from '../components/features/scripts';
import { resolveProductDemoCast } from '../components/product-demo/cast';
import { buildScriptsFixture } from '../components/product-demo/fixtures/scripts';
import ScriptsScreen from '../components/product-demo/screens/scripts';
import { DataTable } from '../components/ui/data-table';

const FIXTURE = buildScriptsFixture(resolveProductDemoCast());

const meta: Meta<typeof ScriptsTable> = {
  title: 'Features/ScriptsTable',
  component: ScriptsTable,
  parameters: { layout: 'fullscreen' },
  args: {
    rows: FIXTURE.scripts,
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
  render: () => <ScriptSchedulesTable rows={FIXTURE.schedules} rightSlot={<DataTable.RowCount />} />,
};

/** The product screen: the library and the schedules side by side, in the frame's size. */
export const Screen: Story = {
  render: () => (
    <div className="ods-content-area h-[440px] w-[1400px]">
      <ScriptsScreen />
    </div>
  ),
};

/** The narrow rendering of the product screen: the schedules alone. */
export const Compact: Story = {
  render: () => (
    <div className="ods-content-area h-[300px] w-[420px]">
      <ScriptsScreen compact />
    </div>
  ),
};

/** Loading rows. */
export const Loading: Story = { args: { rows: [], isLoading: true, skeletonRows: 5 } };
