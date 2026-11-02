import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef, useDataTable } from '../../ui/data-table';
import type { TenantRow } from './tenant-row';
import { type TenantsTableFilters, TenantsTableView } from './tenants-table-view';

const seen = vi.hoisted(() => ({ columns: [] as ColumnDef<TenantRow>[] }));

vi.mock('../../ui/data-table', async importOriginal => {
  const actual = await importOriginal<{ useDataTable: typeof useDataTable }>();
  return {
    ...actual,
    useDataTable: (options: Parameters<typeof useDataTable<TenantRow>>[0]) => {
      seen.columns = options.columns;
      return actual.useDataTable(options);
    },
  };
});

const ROW: TenantRow = {
  id: 't1',
  name: 'Acme',
  provider: 'MICROSOFT_365',
  customers: [{ name: 'Acme' }],
  accessState: 'WRITE_ENABLED',
};

const NO_SELECTION: TenantsTableFilters['selections'] = { tenant: [], customer: [], licenses: [], access: [] };

function tenantColumnFilter(filters?: TenantsTableFilters) {
  render(<TenantsTableView rows={[ROW]} getHref={row => `/tenants/${row.id}`} filters={filters} />);
  return seen.columns.find(column => column.id === 'tenant')?.meta?.filter;
}

describe('TenantsTableView', () => {
  // Below lg only a column with `meta.filter` keeps its header; with no options the filter draws the bare label
  it('declares the funnel of a column whose options came back empty', () => {
    const filter = tenantColumnFilter({ options: { tenant: [] }, selections: NO_SELECTION, onChange: () => {} });

    expect(filter).toEqual({ options: [], pending: false });
  });

  it('draws no funnel for a column the host offers none for', () => {
    expect(tenantColumnFilter()).toBeUndefined();
  });
});
