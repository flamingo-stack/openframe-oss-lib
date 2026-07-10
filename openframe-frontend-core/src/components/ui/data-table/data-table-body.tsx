'use client'

import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import type { NoDataProps } from '../no-data'
import { useDataTableContext } from './data-table'
import { DataTableEmpty } from './data-table-empty'
import { DataTableRow } from './data-table-row'
import {
  DataTableSkeleton,
  ROW_HEIGHT_DESKTOP,
  ROW_HEIGHT_MOBILE,
} from './data-table-skeleton'

export interface DataTableBodyProps<T = any> {
  /** Show skeleton rows while `loading` is true and data is empty. */
  loading?: boolean
  /** @deprecated Use `emptyState` instead. Legacy single-line message; mapped to the empty state's title. */
  emptyMessage?: string
  /** Props for the empty state (NoData) shown when there are no rows. Overrides `emptyMessage`. */
  emptyState?: NoDataProps
  /** Skeleton row count when loading. Default `10`. */
  skeletonRows?: number
  className?: string
  /**
   * Per-row class name. Prefer `useCallback` for function form to avoid
   * breaking `React.memo` on rows.
   */
  rowClassName?: string | ((item: T, index: number) => string)
  /** Dense row height. */
  compact?: boolean
  /**
   * Treat the design row height as a minimum so multi-line cell content grows
   * the row instead of clipping. Default keeps the fixed height.
   */
  autoHeight?: boolean
  /**
   * Click anywhere on a row (except elements with `data-no-row-click`). Prefer
   * `useCallback` to avoid breaking `React.memo` on rows.
   */
  onRowClick?: (item: T) => void
  /**
   * Turn each row into a `next/link` to the returned URL. Ignored if
   * `onRowClick` is set. Prefer `useCallback` for the same reason.
   */
  rowHref?: (item: T) => string | null | undefined
  /**
   * Keep table height stable by padding with invisible rows when data is short.
   * Typically set to the same value as `skeletonRows`. Pass `0` to disable.
   */
  minRows?: number
  /**
   * Render expandable content below a row, inside the same card. Return a node to
   * attach it (the cells row gains a bottom divider), or null/undefined for none.
   * Interactive content inside must carry `data-no-row-click`.
   */
  renderSubRow?: (item: T) => ReactNode
}

/**
 * Renders skeleton / empty state / rows based on table context state. Place
 * inside `<DataTable>`. Rows use `React.memo` for performance — memoize
 * `onRowClick` / `rowHref` / `rowClassName` (if function) with `useCallback`
 * in the consumer to get the full benefit.
 */
export function DataTableBody<T = any>({
  loading,
  emptyMessage,
  emptyState,
  skeletonRows = 10,
  className,
  rowClassName,
  compact,
  autoHeight,
  onRowClick,
  rowHref,
  minRows,
  renderSubRow,
}: DataTableBodyProps<T>) {
  const table = useDataTableContext<T>()
  const rows = table.getRowModel().rows

  if (loading && rows.length === 0) {
    return (
      <div className={cn('flex flex-col gap-[var(--spacing-system-xsf)] w-full', className)}>
        <DataTableSkeleton rows={skeletonRows} />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={cn('flex flex-col gap-[var(--spacing-system-xsf)] w-full', className)}>
        {emptyState ? (
          <DataTableEmpty {...emptyState} />
        ) : emptyMessage != null ? (
          <DataTableEmpty title={emptyMessage} description={undefined} />
        ) : (
          <DataTableEmpty />
        )}
      </div>
    )
  }

  const padCount = minRows ? Math.max(0, minRows - rows.length) : 0

  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-xsf)] w-full', className)}>
      {rows.map((row, index) => {
        const item = row.original
        const href = rowHref?.(item) ?? undefined
        const cls =
          typeof rowClassName === 'function' ? rowClassName(item, index) : rowClassName
        return (
          <DataTableRow<T>
            key={row.id}
            row={row}
            onClick={onRowClick}
            href={href}
            compact={compact}
            autoHeight={autoHeight}
            className={cls}
            subRow={renderSubRow?.(item)}
          />
        )
      })}
      {padCount > 0 &&
        Array.from({ length: padCount }).map((_, i) => (
          <div
            key={`placeholder-${i}`}
            className="relative rounded-md overflow-hidden pointer-events-none"
            aria-hidden="true"
          >
            <div
              className={cn(
                'hidden md:flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)] py-0',
                ROW_HEIGHT_DESKTOP,
              )}
            />
            <div
              className={cn(
                'flex md:hidden gap-[var(--spacing-system-sf)] items-center justify-start px-[var(--spacing-system-sf)] py-0',
                ROW_HEIGHT_MOBILE,
              )}
            />
          </div>
        ))}
    </div>
  )
}
