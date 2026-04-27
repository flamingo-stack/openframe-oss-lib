'use client'

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Table,
  type TableOptions,
} from '@tanstack/react-table'
// Ensure ColumnMeta augmentation is loaded whenever useDataTable is used.
import './types'

// Row-model factories are pure and safe to instantiate once per module.
// Calling them inside render creates a new memoized getter on every render
// whose internal cache is thrown away, causing avoidable row-model recomputes.
const coreRowModelFactory = getCoreRowModel<any>()
const sortedRowModelFactory = getSortedRowModel<any>()
const filteredRowModelFactory = getFilteredRowModel<any>()

export interface UseDataTableOptions<T>
  extends Omit<TableOptions<T>, 'getCoreRowModel'> {
  /**
   * Enable client-side sorting via `getSortedRowModel`.
   * Default `false` — server sorts, TanStack only stores sort state.
   */
  clientSideSorting?: boolean
  /**
   * Enable client-side filtering via `getFilteredRowModel`.
   * Default `false` — server filters, TanStack only stores filter state.
   */
  clientSideFiltering?: boolean
}

/**
 * Thin wrapper around `useReactTable` with sensible defaults for our server-driven
 * (Relay/REST) pagination setup. Turn on `clientSideSorting`/`clientSideFiltering`
 * for fully client-side tables.
 *
 * Reference-stability guarantees provided by this hook:
 * - `state` is deep-compared across renders; if content is unchanged, the same
 *   reference is passed to `useReactTable`. This shields TanStack's internal
 *   row-model memos (`getFilteredRowModel`, `getSortedRowModel`, etc.) from
 *   ref churn caused by URL-backed / `useApiParams`-backed state that rebuilds
 *   arrays on every render. Consumers can safely do:
 *
 *   ```ts
 *   const columnFilters = Object.entries(urlParams).map(([id, value]) => ({ id, value }))
 *   useDataTable({ state: { columnFilters }, onColumnFiltersChange: setUrlFilters })
 *   ```
 *
 *   without needing their own `useMemo`.
 *
 * - Row-model factories (`getCoreRowModel`, `getSortedRowModel`,
 *   `getFilteredRowModel`) are instantiated once at module load, not on every
 *   render, preserving TanStack's internal row-model caches.
 */
export function useDataTable<T>({
  clientSideSorting = false,
  clientSideFiltering = false,
  manualSorting,
  manualFiltering,
  getSortedRowModel: getSortedRowModelOverride,
  getFilteredRowModel: getFilteredRowModelOverride,
  state,
  ...rest
}: UseDataTableOptions<T>): Table<T> {
  return useReactTable<T>({
    ...rest,
    state,
    getCoreRowModel: coreRowModelFactory as TableOptions<T>['getCoreRowModel'],
    getSortedRowModel: clientSideSorting
      ? getSortedRowModelOverride ??
        (sortedRowModelFactory as TableOptions<T>['getSortedRowModel'])
      : getSortedRowModelOverride,
    getFilteredRowModel: clientSideFiltering
      ? getFilteredRowModelOverride ??
        (filteredRowModelFactory as TableOptions<T>['getFilteredRowModel'])
      : getFilteredRowModelOverride,
    manualSorting: manualSorting ?? !clientSideSorting,
    manualFiltering: manualFiltering ?? !clientSideFiltering,
  })
}
