'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Table } from '@tanstack/react-table'
import { cn } from '../../../utils/cn'
import './types'

const DataTableContext = createContext<Table<any> | null>(null)

export function useDataTableContext<T = any>(): Table<T> {
  const ctx = useContext(DataTableContext)
  if (!ctx) {
    throw new Error(
      '<DataTable.Header/Body/...> must be used inside <DataTable table={...}>',
    )
  }
  return ctx as Table<T>
}

export interface DataTableProps<T> {
  table: Table<T>
  children: ReactNode
  className?: string
}

export function DataTableRoot<T>({ table, children, className }: DataTableProps<T>) {
  return (
    <DataTableContext.Provider value={table}>
      <div className={cn('flex flex-col w-full', className)}>{children}</div>
    </DataTableContext.Provider>
  )
}
