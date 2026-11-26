'use client';

import { useLoadingScope } from '../loading-scope';
import { TablePagination, type TablePaginationProps } from '../table-pagination';
import { useDataTableContext } from './data-table';

export type DataTablePaginationProps = TablePaginationProps;

/**
 * `TablePagination` inside a `DataTable`: put it in `DataTable.Meta`'s `pagination`. An empty FIRST page draws no
 * pager (the table's empty state is the whole answer); an empty LATER page keeps it, so the way back stays.
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
  const table = useDataTableContext();
  const loadingScope = useLoadingScope();
  const rowsCount = table.getRowModel().rows.length;

  if (rowsCount === 0 && !(props.loading || loadingScope) && (props.pager.isFirstPage ?? true)) return null;

  return <TablePagination {...props} />;
}
