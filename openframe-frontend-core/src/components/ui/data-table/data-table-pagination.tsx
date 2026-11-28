'use client';

import { useLoadingScope } from '../loading-scope';
import { isFirstPagerPage, TablePagination, type TablePaginationProps } from '../table-pagination';
import { useOptionalDataTableContext } from './data-table';

export type DataTablePaginationProps = TablePaginationProps;

/**
 * `TablePagination` inside a `DataTable`: put it in `DataTable.Meta`'s `pagination`. An empty FIRST page draws no
 * pager (the table's empty state is the whole answer); an empty LATER page keeps it, so the way back stays. Outside a
 * `DataTable` (a list drawn as tiles or rows of its own) it draws the pager it is given: the caller decided, with
 * `tableMetaRowLayout`, that the row has one.
 *
 * @example
 * <DataTable.Meta
 *   pagination={<DataTable.Pagination pager={pager} loading={isPending} />}
 *   actions={<AutoRefreshControl {...refresh} />}
 * >
 *   <DataTable.PageRange rangeStart={pager.rangeStart} totalCount={total} />
 * </DataTable.Meta>
 */
export function DataTablePagination(props: DataTablePaginationProps) {
  const table = useOptionalDataTableContext();
  const loadingScope = useLoadingScope();
  const rowsCount = table ? table.getRowModel().rows.length : null;

  if (rowsCount === 0 && !(props.loading || loadingScope) && isFirstPagerPage(props.pager)) return null;

  return <TablePagination {...props} />;
}
