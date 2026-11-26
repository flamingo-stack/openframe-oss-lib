/**
 * TablePagination — the pager of a cursor-paged table (the design's `table/pagination`).
 *
 * First · Previous · Next and, later, the rows-per-page menu. There are no page numbers: the backend is cursor based.
 * It belongs in the row above the table (`DataTable.Meta`'s `pagination`), right of the range text and left of the
 * auto-refresh picker, where it never scrolls with the rows.
 *
 * - Page 1: Previous waits (disabled), Next pages on.
 * - Page 2: Previous goes back; no First (Previous already goes to page 1).
 * - Page 3 and further: the quiet First before Previous.
 * - Rows per page is version 2: off unless the table passes `onPageSizeChange`.
 *
 * Figma: https://www.figma.com/design/jaJqsrONr5tWCR9X8HbdWt/openframe---assets--sync-?node-id=5296-57133
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo, useState } from 'react';
import { AUTO_REFRESH_OFF, AutoRefreshControl } from '../components/ui/auto-refresh-control';
import { type ColumnDef, DataTable, useDataTable } from '../components/ui/data-table';
import { TABLE_PAGINATION_PENDING, TablePagination, type TablePagerState } from '../components/ui/table-pagination';

const noop = () => {};

/** Page 1 of a list with more pages, `overrides` on top (a story's `pager` replaces the default one whole). */
const pagerAt = (overrides: Partial<TablePagerState> = {}): TablePagerState => ({
  hasNextPage: true,
  hasPreviousPage: false,
  isFirstPage: true,
  page: 1,
  endCursor: 'e1',
  onFirst: noop,
  onPrevious: noop,
  onNext: noop,
  ...overrides,
});

const meta = {
  title: 'UI/TablePagination',
  component: TablePagination,
  args: {
    pager: pagerAt(),
    loading: false,
  },
  decorators: [
    // The pager stories sit at the right end of a row, as in a table's meta row; the table stories draw their own.
    (Story, context) =>
      context.parameters.bare ? (
        <Story />
      ) : (
        <div className="flex justify-end bg-ods-bg p-[var(--spacing-system-l)]">
          <Story />
        </div>
      ),
  ],
} satisfies Meta<typeof TablePagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Page 1: Previous waits on the page ground, Next pages on. No First. */
export const Page1: Story = {};

/** Page 2: Previous goes back to page 1, so there is still no First. */
export const Page2: Story = {
  args: { pager: pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 2, startCursor: 's2', endCursor: 'e2' }) },
};

/** Page 3 and further: the quiet First (no surface) before Previous. */
export const Page3AndFurther: Story = {
  args: { pager: pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 3, startCursor: 's3', endCursor: 'e3' }) },
};

/** The last page: Next waits. */
export const LastPage: Story = {
  args: {
    pager: pagerAt({ hasNextPage: false, hasPreviousPage: true, isFirstPage: false, page: 17, endCursor: null }),
  },
};

/** A shared link with a cursor and no page index, on a list that cannot page back on the server: First is the way back. */
export const UnknownPage: Story = {
  args: { pager: pagerAt({ hasPreviousPage: false, isFirstPage: false, page: undefined }) },
};

/** The next page is being read: every button waits, so a second Next cannot resend the same cursor. */
export const Loading: Story = {
  args: { pager: pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 3 }), loading: true },
};

/** The first page is being read and the host has no `pageInfo` yet (`TABLE_PAGINATION_PENDING`). */
export const Pending: Story = {
  args: { pager: TABLE_PAGINATION_PENDING, loading: true },
};

/** Version 2 (not in the first release): the rows-per-page menu, 20 / 50 / 100, back to page 1 after a change. */
export const WithRowsPerPage: Story = {
  args: { pager: pagerAt({ hasPreviousPage: true, isFirstPage: false, page: 3 }) },
  render: function WithRowsPerPageStory(args) {
    const [pageSize, setPageSize] = useState(20);
    return <TablePagination {...args} rowsPerPage={{ pageSize, onChange: setPageSize }} />;
  },
};

/* ──────────────────────── in the row above a table ──────────────────────── */

interface Software {
  id: string;
  name: string;
  publisher: string;
  version: string;
}

const PUBLISHERS = ['Microsoft', 'Google', 'Mozilla', 'Adobe', 'Zoom'];
const ALL: Software[] = Array.from({ length: 47 }, (_, index) => ({
  id: `s-${index + 1}`,
  name: `Package ${index + 1}`,
  publisher: PUBLISHERS[index % PUBLISHERS.length] ?? '',
  version: `${(index % 9) + 1}.${index % 4}.0`,
}));

const COLUMNS: ColumnDef<Software>[] = [
  { id: 'name', accessorKey: 'name', header: 'Software', size: 280 },
  { id: 'publisher', accessorKey: 'publisher', header: 'Publisher', size: 200 },
  { id: 'version', accessorKey: 'version', header: 'Version', size: 160 },
];

const PAGE_SIZE = 10;

/**
 * A paged grid table: the range on the left of the row above it, then the pager, a divider and the auto-refresh
 * picker. Page through it; below 720px of content (the Mobile viewport) the pager takes its own line under the range
 * and the picker.
 */
function PagedTableDemo() {
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(AUTO_REFRESH_OFF);
  // The table's data must keep its identity between renders (TanStack re-runs on a new array, and a table state
  // change re-renders this component): a fresh slice per render loops forever on the first hover or click.
  const rows = useMemo(() => ALL.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page]);
  const table = useDataTable<Software>({ data: rows, columns: COLUMNS, getRowId: row => row.id });
  const last = page * PAGE_SIZE >= ALL.length;

  return (
    <div className="bg-ods-bg p-[var(--spacing-system-l)]">
      <DataTable table={table} layout="grid" maxHeight={360}>
        <DataTable.Meta
          pagination={
            <DataTable.Pagination
              pager={{
                hasNextPage: !last,
                hasPreviousPage: page > 1,
                isFirstPage: page === 1,
                page,
                endCursor: last ? null : `e${page}`,
                onNext: () => setPage(current => current + 1),
                onPrevious: () => setPage(current => Math.max(1, current - 1)),
                onFirst: () => setPage(1),
              }}
            />
          }
          actions={<AutoRefreshControl value={refresh} onChange={setRefresh} />}
        >
          <DataTable.PageRange rangeStart={(page - 1) * PAGE_SIZE + 1} totalCount={ALL.length} />
        </DataTable.Meta>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable>
    </div>
  );
}

export const InTableMetaRow: StoryObj = {
  parameters: { bare: true },
  render: () => <PagedTableDemo />,
};

export const InTableMetaRowMobile: StoryObj = {
  parameters: { bare: true },
  globals: { viewport: { value: 'mobile', isRotated: false } },
  render: () => <PagedTableDemo />,
};
