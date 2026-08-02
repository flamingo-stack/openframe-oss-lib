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
    /**
     * Keep this header visible on tablet (md, below lg) even without
     * `meta.filter` — for custom headers hosting their own filter UI
     * (e.g. the date filter calendar trigger).
     */
    alwaysShowHeader?: boolean
    /**
     * If present, the column filters: the header cell survives on tablet and,
     * when there is something to choose from, renders the funnel + dropdown.
     *
     * An EMPTY `options` list draws no funnel at all — a control that cannot be
     * opened is worse than no control, and every table in the design shows the
     * bare label there. Set `pending` for the other empty case, "the options are
     * still loading": that one keeps the funnel, so it does not appear out of
     * nowhere the moment the query answers.
     */
    filter?: {
      options: DataTableFilterOption[]
      placement?: 'bottom-start' | 'bottom-end' | 'bottom'
      /** Options are in flight — draw the funnel, inert, instead of hiding it. */
      pending?: boolean
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
