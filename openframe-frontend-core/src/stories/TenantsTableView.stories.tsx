import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TenantsTableView } from '../components/features/cloud-tenants';
import { CLOUD_TENANTS_FIXTURE } from '../components/product-demo/fixtures/cloud-tenants';
import CloudTenantsScreen from '../components/product-demo/screens/cloud-tenants';

const meta: Meta<typeof TenantsTableView> = {
  title: 'Features/TenantsTableView',
  component: TenantsTableView,
  parameters: { layout: 'fullscreen' },
  args: {
    rows: CLOUD_TENANTS_FIXTURE.rows,
    now: CLOUD_TENANTS_FIXTURE.now,
    getHref: row => `#${row.id}`,
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

/** The list as the Cloud Tenant Management page shows it: tenant, customer, access. */
export const Default: Story = {};

/** The narrow rendering of the product screen: the table alone, in a narrow content area. */
export const Compact: Story = {
  render: () => (
    <div className="ods-content-area h-[300px] w-[420px]">
      <CloudTenantsScreen compact />
    </div>
  ),
};

/** A search that matched nothing. */
export const NoMatch: Story = { args: { rows: [], search: 'contoso' } };
