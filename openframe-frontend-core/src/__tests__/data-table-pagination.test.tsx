import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AutoRefreshControl } from '../components/ui/auto-refresh-control';
import { type ColumnDef, DataTable } from '../components/ui/data-table';
import { useDataTable } from '../components/ui/data-table/use-data-table';
import { LoadingScope } from '../components/ui/loading-scope';
import { TABLE_PAGINATION_PENDING, type TablePaginationProps } from '../components/ui/table-pagination';

/**
 * A paged table's pager sits in the row above it (`DataTable.Meta`): the range on the left, the pager and the
 * auto-refresh picker on the right, a divider between the two. jsdom has no layout, so the order, the parts and the
 * text are what is locked here; the wrap below the content's md width is checked in the browser on the stories.
 */

interface Item {
  id: string;
  name: string;
}

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

const COLUMNS: ColumnDef<Item>[] = [{ id: 'name', accessorKey: 'name', header: 'Name', size: 280 }];

const PAGE_3: TablePaginationProps = {
  hasNextPage: true,
  hasPreviousPage: true,
  isFirstPage: false,
  page: 3,
  endCursor: 'e3',
  onFirst: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
};

function PagedTable({
  items = ITEMS,
  pager = PAGE_3,
  totalCount = 340,
  rangeStart = 41,
  refresh = true,
  loading = false,
}: {
  items?: Item[];
  pager?: TablePaginationProps;
  totalCount?: number;
  rangeStart?: number;
  refresh?: boolean;
  loading?: boolean;
}) {
  const table = useDataTable<Item>({ data: items, columns: COLUMNS, getRowId: item => item.id });
  return (
    <DataTable table={table} layout="grid" maxHeight={400}>
      <DataTable.Meta
        pagination={<DataTable.Pagination {...pager} />}
        actions={refresh && <AutoRefreshControl value="off" onChange={vi.fn()} />}
      >
        <DataTable.PageRange rangeStart={rangeStart} totalCount={totalCount} loading={loading} />
      </DataTable.Meta>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  );
}

const renderMarkup = (ui: ReactNode) => {
  const { container, unmount } = render(ui);
  const html = container.innerHTML;
  unmount();
  return html;
};

describe('DataTable.Meta with a pager', () => {
  it('draws the range, the pager, a divider and the auto-refresh picker, in that order, above the table', () => {
    const html = renderMarkup(<PagedTable />);
    const order = [
      'data-table-meta',
      '41–43 of 340 results',
      'aria-label="Pagination"',
      'data-grid-meta-divider',
      'aria-label="Auto-refresh: Off"',
      'data-grid-header',
    ].map(mark => html.indexOf(mark));
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('keeps the pager out of the table frame: the frame comes after the row', () => {
    const html = renderMarkup(<PagedTable />);
    expect(html.indexOf('aria-label="Pagination"')).toBeLessThan(html.indexOf('--data-table-max-height'));
  });

  it('has no divider without the auto-refresh picker', () => {
    const html = renderMarkup(<PagedTable refresh={false} />);
    expect(html).toContain('aria-label="Pagination"');
    expect(html).not.toContain('data-grid-meta-divider');
  });

  it('gives the row of 32px controls the design 8 under it; the count alone keeps its 4', () => {
    expect(renderMarkup(<PagedTable />)).toContain('pb-[var(--spacing-system-xsf)]');

    function CountOnly() {
      const table = useDataTable<Item>({ data: ITEMS, columns: COLUMNS, getRowId: item => item.id });
      return (
        <DataTable table={table} layout="grid">
          <DataTable.Meta>
            <DataTable.RowCount />
          </DataTable.Meta>
          <DataTable.Body />
        </DataTable>
      );
    }
    const countOnly = renderMarkup(<CountOnly />);
    expect(countOnly).toContain('pb-[var(--spacing-system-xxs)]');
    expect(countOnly).not.toContain('pb-[var(--spacing-system-xsf)]');
  });
});

describe('DataTable.PageRange', () => {
  it('says the range with the total, and pluralizes by the total', () => {
    render(<PagedTable />);
    expect(screen.getByText('41–43 of 340 results')).toBeTruthy();
  });

  it('is a bar while the table holds no page of its own yet', () => {
    render(<PagedTable loading />);
    expect(screen.queryByText(/41–43/)).toBeNull();
  });

  it('is a bar in a loading scope too', () => {
    render(
      <LoadingScope>
        <PagedTable />
      </LoadingScope>,
    );
    expect(screen.queryByText(/41–43/)).toBeNull();
  });

  it('draws nothing for an empty page', () => {
    render(<PagedTable items={[]} />);
    // The body's own empty state says "No results found"; the row above says nothing.
    expect(screen.queryByText(/of 340/)).toBeNull();
  });

  it('says one result in the singular', () => {
    render(<PagedTable items={ITEMS.slice(0, 1)} totalCount={1} rangeStart={1} />);
    expect(screen.getByText('1–1 of 1 result')).toBeTruthy();
  });
});

describe('DataTable.Pagination', () => {
  it('draws no pager on an empty first page: the empty state is the whole answer', () => {
    render(<PagedTable items={[]} pager={{ ...PAGE_3, isFirstPage: true, page: 1 }} />);
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
  });

  it('keeps the pager on an empty later page, so the way back stays', () => {
    render(<PagedTable items={[]} />);
    expect(screen.getByRole('button', { name: 'Go to first page' })).toBeTruthy();
  });

  it('keeps the pending pager of a first page still being read', () => {
    render(<PagedTable items={[]} pager={TABLE_PAGINATION_PENDING} />);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Go to next page' }).disabled).toBe(true);
  });
});
