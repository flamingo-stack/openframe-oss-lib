import { act, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef, useDataTable } from '../../ui/data-table';
import { GRID_ACTION_COLUMN_SIZE } from '../../ui/data-table/data-table-grid-columns';
import { GRID_MIN_WIDTH } from '../../ui/data-table/data-table-grid-resize';
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

/** What the grid layout reads of a column: its width, its floor, its kind, whether it has a one-line cell, its name. */
const gridColumns = () =>
  seen.columns.map(column => [
    column.id,
    column.size,
    column.minSize,
    column.meta?.gridKind,
    typeof column.meta?.gridCell,
    column.meta?.label,
  ]);

/**
 * A text in a grid cell's secondary part: in the part itself when it is short, inside it when it is long (the cell cuts
 * a long secondary text with an ellipsis).
 */
const secondaryText = (text: string | RegExp) =>
  screen.getByText(text, { selector: '[data-part="secondary"], [data-part="secondary"] *' });

describe('TenantsTableView in the grid layout', () => {
  const FULL_ROW: MultiCustomerTenantRow = {
    ...ROW,
    domain: 'acme.onmicrosoft.com',
    customers: [{ name: 'Acme' }, { name: 'Globex' }, { name: 'Initech' }],
    userCount: 412,
    unattributedUserCount: 30,
    licenses: { assigned: 100, purchased: 120 },
    lastReadAt: '2026-10-28T09:00:00Z',
  };
  const NOW = new Date('2026-10-28T10:00:00Z');

  it('multi-customer: every data column has a size, a one-line cell and a name; open is an action column', () => {
    render(<TenantsTableView variant="multi-customer" rows={[ROW]} getHref={row => `/tenants/${row.id}`} />);

    expect(gridColumns()).toEqual([
      ['tenant', 320, GRID_MIN_WIDTH.icon, undefined, 'function', 'Tenant'],
      ['customer', 300, GRID_MIN_WIDTH.media, undefined, 'function', 'Customers'],
      ['licenses', 200, undefined, undefined, 'function', 'Licences'],
      ['access', 260, undefined, undefined, 'function', 'Access'],
      ['open', GRID_ACTION_COLUMN_SIZE, undefined, 'action', 'function', undefined],
    ]);
  });

  it('single-customer: every data column has a size, a one-line cell and a name; open is an action column', () => {
    render(<TenantsTableView rows={[SINGLE_CUSTOMER_ROW]} getHref={row => `/tenants/${row.id}`} />);

    expect(gridColumns()).toEqual([
      ['tenant', 320, GRID_MIN_WIDTH.icon, undefined, 'function', 'Tenant'],
      ['customer', 300, GRID_MIN_WIDTH.media, undefined, 'function', 'Customers'],
      ['access', 260, undefined, undefined, 'function', 'Access'],
      ['open', GRID_ACTION_COLUMN_SIZE, undefined, 'action', 'function', undefined],
    ]);
  });

  it("keeps the card layout's widths: the grid fields are added beside them", () => {
    render(<TenantsTableView variant="multi-customer" rows={[ROW]} getHref={row => `/tenants/${row.id}`} />);

    expect(
      seen.columns.map(column => [column.id, column.meta?.width, column.meta?.hideAt, column.meta?.align]),
    ).toEqual([
      ['tenant', 'flex-1 min-w-0', undefined, undefined],
      ['customer', 'w-[220px] content-lg:w-[280px]', 'md', undefined],
      ['licenses', 'w-[150px]', 'lg', undefined],
      ['access', 'flex-none content-md:w-[200px] content-lg:w-[216px]', undefined, undefined],
      ['open', 'w-12 shrink-0 flex-none', undefined, 'right'],
    ]);
  });

  it('multi-customer: a row is one line, the second line of each card cell after the first', () => {
    render(
      <TenantsTableView
        variant="multi-customer"
        layout="grid"
        rows={[FULL_ROW]}
        now={NOW}
        getHref={row => `/tenants/${row.id}`}
      />,
    );

    // The domain follows the name, the customers past the first are one "+N", the warnings keep their words.
    expect(secondaryText('acme.onmicrosoft.com')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('30 of 412 unattributed')).toHaveClass('text-ods-warning');
    expect(screen.getByText('100 of 120')).toBeInTheDocument();
    expect(screen.getByText('20 unused')).toHaveClass('text-ods-warning');
    expect(secondaryText(/^Last read: /)).toBeInTheDocument();
    // The open button is the grid's bare one: the cell is its frame.
    expect(screen.getByRole('button', { name: 'Open Acme in new tab' })).toHaveClass('border-0');
  });

  it('single-customer: a row is one line, the count and the last read after the name and the tag', () => {
    render(<TenantsTableView layout="grid" rows={[SINGLE_CUSTOMER_ROW]} getHref={row => `/tenants/${row.id}`} />);

    expect(secondaryText('227 Users')).toBeInTheDocument();
    expect(secondaryText('Last read: —')).toBeInTheDocument();
  });

  it('cards (the default): the open button keeps its outline and the cells their two lines', () => {
    render(
      <TenantsTableView variant="multi-customer" rows={[FULL_ROW]} now={NOW} getHref={row => `/tenants/${row.id}`} />,
    );

    const open = screen.getByRole('button', { name: 'Open Acme in new tab' });
    expect(open).toHaveClass('bg-ods-card');
    expect(open).not.toHaveClass('border-0');
    expect(within(document.body).queryByText('+2')).not.toHaveAttribute('data-part', 'more');
  });
});
