// Load ColumnMeta augmentation so consumers get typed `meta`.
import './types'

import { DataTableRoot } from './data-table'
import { DataTableHeader } from './data-table-header'
import { DataTableBody } from './data-table-body'
import { DataTableRow } from './data-table-row'
import { DataTableSkeleton } from './data-table-skeleton'
import { DataTableEmpty } from './data-table-empty'
import { DataTableInfiniteFooter } from './data-table-infinite-footer'
import { DataTableCursorFooter } from './data-table-cursor-footer'
import { DataTableRowCount } from './data-table-row-count'

/**
 * Compound table primitive. Use `useDataTable` to build the table instance,
 * then compose `<DataTable>` + `<DataTable.Header/>` + `<DataTable.Body/>`
 * + `<DataTable.InfiniteFooter/>` or `<DataTable.CursorFooter/>` as needed.
 *
 * @example
 * const table = useDataTable({ data, columns, ... })
 * <DataTable table={table} className={...}>
 *   <DataTable.Header stickyHeader stickyHeaderOffset="top-[56px]" />
 *   <DataTable.Body loading={isLoading} rowHref={d => `/devices/${d.id}`} />
 *   <DataTable.InfiniteFooter hasNextPage={hasNext} isFetchingNextPage={isLoadingNext} onLoadMore={() => loadNext(50)} />
 * </DataTable>
 */
export const DataTable = Object.assign(DataTableRoot, {
  Header: DataTableHeader,
  Body: DataTableBody,
  Row: DataTableRow,
  Skeleton: DataTableSkeleton,
  Empty: DataTableEmpty,
  InfiniteFooter: DataTableInfiniteFooter,
  CursorFooter: DataTableCursorFooter,
  RowCount: DataTableRowCount,
})

// Also export each piece by name for consumers that prefer named imports.
export {
  DataTableRoot,
  DataTableHeader,
  DataTableBody,
  DataTableRow,
  DataTableSkeleton,
  DataTableEmpty,
  DataTableInfiniteFooter,
  DataTableCursorFooter,
  DataTableRowCount,
}

export { useDataTableContext } from './data-table'
export { useDataTable } from './use-data-table'
export { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE } from './data-table-skeleton'
export { alignJustify, getHideClasses, multiSelectFilterFn } from './utils'

export type { DataTableFilterOption, TailwindBreakpoint } from './types'
export type { DataTableProps } from './data-table'
export type { DataTableHeaderProps } from './data-table-header'
export type { DataTableBodyProps } from './data-table-body'
export type { DataTableRowProps } from './data-table-row'
export type { DataTableSkeletonProps } from './data-table-skeleton'
export type { DataTableEmptyProps } from './data-table-empty'
export type { DataTableInfiniteFooterProps } from './data-table-infinite-footer'
export type { DataTableCursorFooterProps } from './data-table-cursor-footer'
export type { DataTableRowCountProps } from './data-table-row-count'
export type { UseDataTableOptions } from './use-data-table'

// Re-export commonly needed TanStack Table primitives so consumers don't need
// a second dependency import line.
export {
  flexRender,
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'

export type {
  CellContext,
  Column,
  ColumnDef,
  ColumnFiltersState,
  ColumnHelper,
  ColumnSort,
  HeaderContext,
  OnChangeFn,
  Row,
  RowSelectionState,
  SortingState,
  Table as DataTableInstance,
  TableOptions,
  VisibilityState,
} from '@tanstack/react-table'
