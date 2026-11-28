'use client';

import type { ReactNode } from 'react';
import { isFirstPagerPage, TABLE_PAGINATION_PENDING, type TablePagerState } from '../table-pagination';
import { DataTableMeta, hoistAsTableMeta } from './data-table-meta';
import { DataTablePageRange } from './data-table-page-range';
import { DataTablePagination } from './data-table-pagination';

/**
 * The row above a feature view's table, as the host fills it: a paged list's pager, the wait for its next page, and
 * the controls at the row's right end. One prop for one row, the same on every view that draws its own table.
 */
export interface TableMetaRow {
  /**
   * A paged list's pager (`useCursorPager` `footerProps`): First · Previous · Next, with the page's range ("21–40 of
   * 340") in place of the count. `null`: a paged list whose first page is being read (the pager waits). Omitted: the
   * list is not paged.
   */
  pager?: (TablePagerState & { rangeStart?: number }) | null;
  /** The pager's buttons wait: the next page is being read, and the rows on screen are the last page's. */
  loading?: boolean;
  /** The controls at the row's right end, after a divider when there is a pager: the auto-refresh picker. */
  actions?: ReactNode;
}

export interface TableMetaRowLayout {
  /** The row holds the pager and the page's range. */
  paged: boolean;
  /** The row is drawn at all. When it is not, the count stays in the column header's `rightSlot`. */
  drawn: boolean;
}

/**
 * Where a view's count, pager and controls go. An empty FIRST page has no pager (the empty state is the whole
 * answer); an empty later page keeps it, so the way back stays. The row is drawn for a grid's count, a pager, or
 * the host's controls; otherwise a card table keeps its count in the header.
 */
export function tableMetaRowLayout(
  metaRow: TableMetaRow | undefined,
  {
    rowCount,
    loading = false,
    showHeader = true,
    grid = false,
  }: {
    /** Rows on the page as it came back. */
    rowCount: number;
    /** The table's first page, or placeholder rows, is being read. */
    loading?: boolean;
    /** The view draws its column header (a view hides it for an empty state of its own). */
    showHeader?: boolean;
    /** The grid layout: its count always sits in this row. */
    grid?: boolean;
  },
): TableMetaRowLayout {
  const pager = metaRow?.pager;
  const paged =
    pager !== undefined &&
    (pager === null || loading || !!metaRow?.loading || rowCount > 0 || !isFirstPagerPage(pager));
  const drawn = (showHeader && grid) || paged || (showHeader && !!metaRow?.actions);
  return { paged, drawn };
}

export interface DataTableMetaRowProps {
  metaRow: TableMetaRow | undefined;
  /** {@link tableMetaRowLayout}'s answer for the same row. */
  paged: boolean;
  /** The row's text when the list is not paged: the results count. */
  count: ReactNode;
  /** What the range counts ("21–40 of 340 devices"). Default: "result". */
  itemName?: string;
  /** The server's total, when the list knows it; the range reads "21–40" without it. */
  totalCount?: number | null;
  /** The table's first page, or placeholder rows, is being read. */
  loading?: boolean;
  /**
   * Rows on the page, for the range. Inside a `DataTable` the table's row model gives it; a list drawn without one
   * (tiles, a chat list) passes it, and the row works the same above it.
   */
  rowCount?: number;
}

/**
 * The row above a feature view's table (`DataTable.Meta`) from the host's {@link TableMetaRow}: on a paged list the
 * page's range on the left and the pager on the right, else the count; the host's controls at the right end. Draw it
 * when {@link tableMetaRowLayout} says `drawn`. Above a list that is not a `DataTable`, pass `rowCount`.
 */
export function DataTableMetaRow({
  metaRow,
  paged,
  count,
  itemName,
  totalCount,
  loading = false,
  rowCount,
}: DataTableMetaRowProps) {
  const pager = metaRow?.pager;
  return (
    <DataTableMeta
      pagination={
        paged && (
          <DataTablePagination
            pager={pager ?? TABLE_PAGINATION_PENDING}
            loading={pager === null || loading || !!metaRow?.loading}
          />
        )
      }
      actions={metaRow?.actions}
    >
      {paged ? (
        <DataTablePageRange
          itemName={itemName}
          rangeStart={pager?.rangeStart}
          totalCount={totalCount}
          hasNextPage={pager?.hasNextPage}
          currentCount={rowCount}
          loading={loading}
        />
      ) : (
        count
      )}
    </DataTableMeta>
  );
}

hoistAsTableMeta(DataTableMetaRow);
