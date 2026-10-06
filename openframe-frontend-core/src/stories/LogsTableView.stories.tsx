import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LogsTableView } from '../components/features/logs';
import LogsScreen from '../components/product-demo/screens/logs';

const meta: Meta<typeof LogsTableView> = {
  title: 'Features/LogsTableView',
  component: LogsTableView,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** The Logs page from the product-demo fixture, with the selected entry's Log Details drawer docked beside the table. */
export const WithDrawerOpen: Story = {
  render: () => (
    <div className="ods-content-area h-[80vh]">
      <LogsScreen />
    </div>
  ),
};

/** The narrow rendering: the table alone, without its action columns. */
export const Compact: Story = {
  render: () => (
    <div className="ods-content-area h-[80vh] max-w-[420px]">
      <LogsScreen compact />
    </div>
  ),
};
