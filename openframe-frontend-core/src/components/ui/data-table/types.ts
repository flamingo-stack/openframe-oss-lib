import type { RowData } from '@tanstack/react-table'

export type TailwindBreakpoint = 'md' | 'lg' | 'xl' | '2xl'

export interface DataTableFilterOption {
  id: string
  label: string
  value: string | number | boolean
}

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Tailwind width class, e.g. `'w-40'`, `'flex-1 min-w-0'`. */
    width?: string
    /** Horizontal alignment inside the cell/header. */
    align?: 'left' | 'center' | 'right'
    /** Hide column at/below these Tailwind breakpoints. */
    hideAt?: TailwindBreakpoint | TailwindBreakpoint[]
    /** If present, header renders a filter dropdown with these options. */
    filter?: {
      options: DataTableFilterOption[]
      placement?: 'bottom-start' | 'bottom-end' | 'bottom'
    }
    /**
     * Opt-in: header renders the sort indicator and clicks toggle column sort.
     * Default `false` — columns are not sortable from the UI even though
     * TanStack's `enableSorting` defaults to true.
     */
    sortable?: boolean
    /** Extra class names applied to the body cell wrapper. */
    cellClassName?: string
    /** Extra class names applied to the header cell wrapper. */
    headerClassName?: string
  }
}
