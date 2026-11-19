import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { type MultiCustomerTenantRow, TenantsTableView } from '../components/features/cloud-tenants';
import { resolveProductDemoCast } from '../components/product-demo/cast';
import { buildCloudTenantsFixture } from '../components/product-demo/fixtures/cloud-tenants';
import CloudTenantsScreen from '../components/product-demo/screens/cloud-tenants';

/** The product page's tenants, over its default cast. */
const CLOUD_TENANTS_FIXTURE = buildCloudTenantsFixture(resolveProductDemoCast());

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

/** The same list in the grid layout: one line per tenant, the customer's user count and the last read after the name. */
export const Grid: Story = {
  args: { layout: 'grid', tableSettings: { storageKey: 'story-tenants' } },
};

const MULTI_CUSTOMER_NOW = new Date('2026-10-28T10:00:00Z');

/** Tenants that serve several customers: a long domain, unattributed users, unused seats, a paused sync, never read. */
const MULTI_CUSTOMER_ROWS: MultiCustomerTenantRow[] = [
  {
    id: 't1',
    name: 'Green Valley Manufacturing',
    provider: 'MICROSOFT_365',
    domain: 'greenvalleymanufacturing.onmicrosoft.com',
    customers: [{ name: 'Green Valley Manufacturing' }, { name: 'Coastal Logistics' }, { name: 'MedCare Clinic' }],
    userCount: 412,
    unattributedUserCount: 30,
    licenses: { assigned: 100, purchased: 120 },
    accessState: 'WRITE_ENABLED',
    lastReadAt: '2026-10-28T09:00:00Z',
  },
  {
    id: 't2',
    name: 'TechFlow',
    provider: 'GOOGLE_WORKSPACE',
    domain: 'techflow.io',
    customers: [{ name: 'TechFlow Solutions' }],
    userCount: 227,
    licenses: { assigned: 118, purchased: 120 },
    accessState: 'WRITE_ENABLED',
    lastReadAt: '2026-10-27T17:05:00Z',
    syncPaused: true,
  },
  {
    id: 't3',
    name: 'Urban Design Studio',
    provider: 'MICROSOFT_365',
    domain: 'urbandesign.studio',
    customers: [{ name: 'Urban Design Studio' }, { name: 'Fromm Weller' }],
    licenses: { assigned: 88, purchased: null },
    accessState: 'READ_ONLY',
  },
  {
    id: 't4',
    name: 'New directory',
    provider: 'GOOGLE_WORKSPACE',
    customers: [],
    accessState: 'DISCONNECTED',
  },
];

const multiCustomerArgs = {
  variant: 'multi-customer' as const,
  rows: MULTI_CUSTOMER_ROWS,
  now: MULTI_CUSTOMER_NOW,
  getHref: (row: MultiCustomerTenantRow) => `#${row.id}`,
};

/** The multi-customer list on card rows: customers, licences and access, two lines a cell. */
export const MultiCustomer: Story = {
  render: () => <TenantsTableView {...multiCustomerArgs} />,
};

/** The multi-customer list in the grid layout: one line a cell, the gear's column menu, the open column pinned right. */
export const MultiCustomerGrid: Story = {
  render: () => (
    <TenantsTableView {...multiCustomerArgs} layout="grid" tableSettings={{ storageKey: 'story-tenants-multi' }} />
  ),
};

/**
 * The grid in a narrow content column (a phone, or a desktop with the chat docked): it scrolls sideways, the tenant
 * column scrolls with the rest and the open column stays on the right. The wrapper is the content area the table
 * measures: under 720px of it the first column is not pinned.
 */
export const MultiCustomerGridNarrow: Story = {
  render: () => (
    <div className="ods-content-area w-[375px]">
      <TenantsTableView {...multiCustomerArgs} layout="grid" tableSettings={{ storageKey: 'story-tenants-multi' }} />
    </div>
  ),
};
