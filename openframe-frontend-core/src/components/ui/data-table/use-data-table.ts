'use client';

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type Table,
  type TableOptions,
} from '@tanstack/react-table';
// Ensure ColumnMeta augmentation is loaded whenever useDataTable is used.
import './types';

// Row-model factories are pure and safe to instantiate once per module.
// Calling them inside render creates a new memoized getter on every render
// whose internal cache is thrown away, causing avoidable row-model recomputes.
// Instantiated at the erased row type: the factories never touch a row's
// fields, and each use site re-applies the caller's `T` through the
// `TableOptions<T>[...]` assertions below.
const coreRowModelFactory = getCoreRowModel<unknown>();
const sortedRowModelFactory = getSortedRowModel<unknown>();
const filteredRowModelFactory = getFilteredRowModel<unknown>();

export interface UseDataTableOptions<T> extends Omit<TableOptions<T>, 'getCoreRowModel'> {
  /**
   * Enable client-side sorting via `getSortedRowModel`.
   * Default `false` — server sorts, TanStack only stores sort state.
   */
  clientSideSorting?: boolean;
  /**
   * Enable client-side filtering via `getFilteredRowModel`.
   * Default `false` — server filters, TanStack only stores filter state.
   */
  clientSideFiltering?: boolean;
}

/**
 * Thin wrapper around `useReactTable` with sensible defaults for our
 * server-driven (Relay/REST) pagination setup. Turn on `clientSideSorting` /
 * `clientSideFiltering` for fully client-side tables.
 *
 * Row-model factories (`getCoreRowModel`, `getSortedRowModel`,
 * `getFilteredRowModel`) are instantiated once at module load instead of on
 * every render, preserving TanStack's internal row-model caches.
 *
 * ## Reference-stability contract (consumer's responsibility)
 *
 * TanStack tracks several options by reference. This hook just forwards them,
 * so the rules below apply unchanged. Each row covers a different cache layer
 * inside `useReactTable`:
 *
 * | Option                                  | Inline literal OK? | Why                                                                                          |
 * | --------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------- |
 * | `data`                                  | NO — `useMemo`     | Core row-model memo is keyed on `data` ref. New ref ⇒ full row-model rebuild every render.   |
 * | `columns`                               | NO — `useMemo`     | Column model is keyed on `columns` ref. Most expensive rebuild of all.                       |
 * | `getRowId`                              | recommended `useCallback` | Called during row-model construction. Safe with stable `data`, but inline costs nothing to fix. |
 * | `state` (the wrapper object)            | YES                | TanStack reads sub-fields, never compares the wrapper. Build it inline freely.               |
 * | `state.sorting`, `state.columnFilters`, `state.pagination`, etc. | NO — must be stable | Per-feature memos compare sub-field refs. Unstable sub-field ⇒ feature recomputes each render. |
 * | `onSortingChange`, `onColumnFiltersChange`, other `onXChange` callbacks | YES | Invoked, never compared. Inline arrows are fine.                                              |
 * | `meta`, `defaultColumn`                 | recommended memo   | Read on every cell render. Inline objects don't break correctness but defeat row `React.memo`. |
 *
 * ### Common upstream pitfalls that break the contract
 *
 * - `query.data ?? []` or `query.data ?? new Map()` in a hook return — the
 *   fallback is a fresh reference every render. Hoist the empty fallback to
 *   module scope as a frozen singleton.
 * - `Object.entries(urlParams).map(...)` in render — wrap in `useMemo` keyed
 *   on the source. `useApiParams` already returns reference-stable arrays for
 *   array-typed fields, so deps can name `params.tier` directly.
 * - Building `state` from a value that's recomputed inside the same render
 *   (e.g. `state={{ sorting: [{ id: sortKey, desc: false }] }}`) — memoise
 *   the array, not just the wrapper.
 *
 * ### Minimal correct usage
 *
 * ```ts
 * const data = useMemo(() => rows.map(toUi), [rows])
 * const columns = useMemo<ColumnDef<Row>[]>(() => [...], [])
 * const getRowId = useCallback((row: Row) => row.id, [])
 * const sorting = useMemo(() => [{ id: sortKey, desc: sortDesc }], [sortKey, sortDesc])
 *
 * const table = useDataTable({
 *   data,
 *   columns,
 *   getRowId,
 *   state: { sorting },           // wrapper inline — sub-field stable
 *   onSortingChange: handleSort,  // can be inline; memoise only if it goes
 *                                 // into another component's deps
 * })
 * ```
 */
export function useDataTable<T>({
  clientSideSorting = false,
  clientSideFiltering = false,
  manualSorting,
  manualFiltering,
  getSortedRowModel: getSortedRowModelOverride,
  getFilteredRowModel: getFilteredRowModelOverride,
  ...rest
}: UseDataTableOptions<T>): Table<T> {
  // Opted out of the React Compiler on purpose — see the handle published at the
  // end of this function. Nothing here is worth memoizing anyway: `setOptions`
  // runs on every render regardless.
  'use no memo';

  const table = useReactTable<T>({
    ...rest,
    getCoreRowModel: coreRowModelFactory as TableOptions<T>['getCoreRowModel'],
    getSortedRowModel: clientSideSorting
      ? (getSortedRowModelOverride ?? (sortedRowModelFactory as TableOptions<T>['getSortedRowModel']))
      : getSortedRowModelOverride,
    getFilteredRowModel: clientSideFiltering
      ? (getFilteredRowModelOverride ?? (filteredRowModelFactory as TableOptions<T>['getFilteredRowModel']))
      : getFilteredRowModelOverride,
    manualSorting: manualSorting ?? !clientSideSorting,
    manualFiltering: manualFiltering ?? !clientSideFiltering,
  });

  // A fresh handle per render, and the reason this hook doesn't just return
  // `useReactTable`'s value.
  //
  // `useReactTable` creates ONE instance for the life of the component and
  // mutates it in place, so its identity is the same object whether a page of
  // rows just arrived or nothing happened at all. Every consumer reads rows and
  // state back out of that instance through context (`DataTable.Body`,
  // `.Header`, `.RowCount`, `.CursorFooter`) — which worked only because the
  // caller re-rendered and rebuilt their elements.
  //
  // Under the React Compiler it stops working, because the compiler caches on
  // identity: `<DataTable table={table}>` and its children get cached on
  // `table`, and inside the compiled `DataTableBody` the entire body —
  // `table.getRowModel().rows` included — sits behind a `$[n] !== table` guard.
  // A table that gains rows then renders nothing new. On an infinite-scroll
  // table that is a loop: the sentinel never moves down, so
  // `DataTable.InfiniteFooter` asks for the next page forever.
  //
  // The proxy forwards every read, write and TanStack mutation to that single
  // instance, so nothing about the table's behaviour changes — only its
  // identity, which is what puts it back inside React's reactive graph.
  //
  // The `use no memo` at the top of this hook is what keeps it a FRESH handle:
  // without it the compiler caches this very object on `table` and hands back
  // the same one forever, i.e. the bug. Keying a `useMemo` on
  // `getRowModel()`/`getState()` instead is not better — `useReactTable`
  // rebuilds `options.state` on every render anyway, so it would republish just
  // as often while reading as though it did not.
  return new Proxy(table, {});
}
