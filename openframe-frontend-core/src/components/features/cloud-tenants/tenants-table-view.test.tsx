import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef, useDataTable } from '../../ui/data-table';
import type { MultiCustomerTenantRow, TenantRow } from './tenant-row';
import { type TenantsTableFilters, TenantsTableView } from './tenants-table-view';

type DataTableOptions = Parameters<typeof useDataTable<TenantRow>>[0];

const seen = vi.hoisted(() => ({
  columns: [] as ColumnDef<TenantRow>[],
  onColumnFiltersChange: undefined as DataTableOptions['onColumnFiltersChange'],
}));

vi.mock('../../ui/data-table', async importOriginal => {
  const actual = await importOriginal<{ useDataTable: typeof useDataTable }>();
  return {
    ...actual,
    useDataTable: (options: DataTableOptions) => {
      seen.columns = options.columns;
      seen.onColumnFiltersChange = options.onColumnFiltersChange;
      return actual.useDataTable(options);
    },
  };
});

const ROW: MultiCustomerTenantRow = {
  id: 't1',
  name: 'Acme',
  provider: 'MICROSOFT_365',
  customers: [{ name: 'Acme' }],
  accessState: 'WRITE_ENABLED',
};

const SINGLE_CUSTOMER_ROW: TenantRow = {
  id: 't1',
  name: 'Acme',
  provider: 'MICROSOFT_365',
  customer: { name: 'Acme' },
  userCount: 227,
  accessState: 'WRITE_ENABLED',
};

const NO_SELECTION: TenantsTableFilters['selections'] = { tenant: [], customer: [], licenses: [], access: [] };

function tenantColumnFilter(filters?: TenantsTableFilters) {
  render(
    <TenantsTableView variant="multi-customer" rows={[ROW]} getHref={row => `/tenants/${row.id}`} filters={filters} />,
  );
  return seen.columns.find(column => column.id === 'tenant')?.meta?.filter;
}

describe('TenantsTableView, multi-customer', () => {
  // Below lg only a column with `meta.filter` keeps its header; with no options the filter draws the bare label
  it('declares the funnel of a column whose options came back empty', () => {
    const filter = tenantColumnFilter({ options: { tenant: [] }, selections: NO_SELECTION, onChange: () => {} });

    expect(filter).toEqual({ options: [], pending: false });
  });

  it('draws no funnel for a column the host offers none for', () => {
    expect(tenantColumnFilter()).toBeUndefined();
  });

  it('hands the host every funnel, an untouched one empty', () => {
    const onChange = vi.fn();
    tenantColumnFilter({ options: {}, selections: NO_SELECTION, onChange });

    act(() => seen.onColumnFiltersChange?.([{ id: 'customer', value: ['c1'] }]));

    expect(onChange).toHaveBeenCalledWith({ tenant: [], customer: ['c1'], licenses: [], access: [] });
  });
});

describe('TenantsTableView, single-customer (the default)', () => {
  it("lays out lib main's columns: no licences, no funnels", () => {
    render(<TenantsTableView rows={[SINGLE_CUSTOMER_ROW]} getHref={row => `/tenants/${row.id}`} />);

    expect(
      seen.columns.map(column => [column.id, column.meta?.width, column.meta?.hideAt, column.meta?.filter]),
    ).toEqual([
      ['tenant', 'flex-1 min-w-0', undefined, undefined],
      ['customer', 'w-[220px] content-lg:w-[340px]', 'md', undefined],
      ['access', 'w-[200px] content-lg:w-[216px]', undefined, undefined],
      ['open', 'w-12 shrink-0 flex-none', 'md', undefined],
    ]);
  });

  it("draws lib main's cells: the capitalised count and the last read of a tenant never read", () => {
    render(<TenantsTableView rows={[SINGLE_CUSTOMER_ROW]} getHref={row => `/tenants/${row.id}`} />);

    expect(screen.getByText('227 Users')).toBeInTheDocument();
    expect(screen.getByText('Last read: —')).toBeInTheDocument();
  });

  it('takes no multi-customer row, so a host that forgets the variant does not compile', () => {
    // @ts-expect-error multi-customer rows need variant="multi-customer"
    const forgotten = <TenantsTableView rows={[ROW]} getHref={row => `/tenants/${row.id}`} />;
    expect((forgotten.props as { variant?: string }).variant).toBeUndefined();
  });
});
