'use client';

import type { Table } from '@tanstack/react-table';
import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
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

export interface DataTableProps<T> {
  table: Table<T>;
  children: ReactNode;
  className?: string;
}

export function DataTableRoot<T>({ table, children, className }: DataTableProps<T>) {
  // Erase the row type on the way in; `useDataTableContext<T>` restores it on
  // the way out. `Table<T>` is invariant in `T`, so this assertion pair is
  // what an erased context costs — it replaces a `Table<any>` context that
  // erased the row type for every consumer, not just at the seam.
  return (
    <DataTableContext.Provider value={table as Table<unknown>}>
      <div className={cn('flex w-full flex-col', className)}>{children}</div>
    </DataTableContext.Provider>
  );
}
