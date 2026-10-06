'use client';

import type { Table } from '@tanstack/react-table';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { createDataTableLoadMoreStore, DataTableLoadMoreContext } from './data-table-load-more';
import './types';

// The context holds the table at its ERASED row type; each `useDataTableContext<T>`
// call re-applies the consumer's own `T` (the sub-components are always
// rendered inside a `<DataTable table={...}>` of that same `T`).
const DataTableContext = createContext<Table<unknown> | null>(null);

export function useDataTableContext<T = unknown>(): Table<T> {
  const ctx = useContext(DataTableContext);
  if (!ctx) {
    throw new Error('<DataTable.Header/Body/...> must be used inside <DataTable table={...}>');
  }
  return ctx as Table<T>;
}

/**
 * The table, or `null` outside a `<DataTable>`. For the one sub-component that
 * has a job to do without a table: `<DataTable.InfiniteFooter>` is still a
 * working scroll sentinel there, it just cannot tell whether a page added rows.
 */
export function useOptionalDataTableContext(): Table<unknown> | null {
  return useContext(DataTableContext);
}

export interface DataTableProps<T> {
  table: Table<T>;
  children: ReactNode;
  className?: string;
}

export function DataTableRoot<T>({ table, children, className }: DataTableProps<T>) {
  // One per table: how `<DataTable.InfiniteFooter>` hands its load-more rows to
  // `<DataTable.Body>` — see `data-table-load-more.ts`.
  const [loadMoreStore] = useState(createDataTableLoadMoreStore);

  // Erase the row type on the way in; `useDataTableContext<T>` restores it on
  // the way out. `Table<T>` is invariant in `T`, so this assertion pair is
  // what an erased context costs — it replaces a `Table<any>` context that
  // erased the row type for every consumer, not just at the seam.
  return (
    <DataTableContext.Provider value={table as Table<unknown>}>
      <DataTableLoadMoreContext.Provider value={loadMoreStore}>
        <div className={cn('flex w-full flex-col', className)}>{children}</div>
      </DataTableLoadMoreContext.Provider>
    </DataTableContext.Provider>
  );
}
