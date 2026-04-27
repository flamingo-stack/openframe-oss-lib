'use client'

import Link from 'next/link'
import React, { memo, useCallback, type ReactNode } from 'react'
import { flexRender, type Row } from '@tanstack/react-table'
import { cn } from '../../../utils/cn'
import { ROW_HEIGHT_DESKTOP } from './data-table-skeleton'
import { alignJustify, getHideClasses } from './utils'

export interface DataTableRowProps<T> {
  row: Row<T>
  onClick?: (item: T) => void
  href?: string | null
  /** Dense row height. */
  compact?: boolean
  className?: string
}

/**
 * Click-bubbling protocol: any element inside a cell that should NOT trigger
 * `onRowClick` / row navigation must carry the `data-no-row-click` attribute.
 * The row checks `target.closest('[data-no-row-click]')` before firing
 * `onClick(item)`. This is the single primitive that interactive cells
 * (action buttons, dropdown menus, checkboxes) must opt into.
 *
 * Example column with action buttons:
 * ```tsx
 * {
 *   id: 'actions',
 *   cell: ({ row }) => (
 *     <div data-no-row-click className="flex gap-2 justify-end pointer-events-auto">
 *       <Button onClick={() => edit(row.original)}>Edit</Button>
 *     </div>
 *   ),
 *   enableSorting: false,
 *   meta: { width: 'w-[160px] shrink-0', align: 'right' },
 * }
 * ```
 *
 * Wrapped in `React.memo` — for best perf in long lists, pass stable references
 * for `onClick` and `className` (if function) via `useCallback` / `useMemo` in
 * the consumer. `href` and string `className` are compared by value.
 */
function DataTableRowImpl<T>({
  row,
  onClick,
  href,
  compact,
  className,
}: DataTableRowProps<T>) {
  const isLinkMode = Boolean(href) && !onClick

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[data-no-row-click]')) return
      onClick?.(row.original)
    },
    [onClick, row.original],
  )

  return (
    <div
      className={cn(
        'relative rounded-md bg-ods-card border border-ods-border overflow-hidden',
        (onClick || isLinkMode) &&
          'cursor-pointer hover:bg-ods-bg-active transition-colors',
        className,
      )}
      onClick={isLinkMode ? undefined : handleClick}
    >
      {isLinkMode && href && (
        <Link
          href={href}
          prefetch={false}
          className="absolute inset-0"
          aria-label="View details"
        />
      )}
      <div
        className={cn(
          'relative flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]',
          compact ? 'py-[var(--spacing-system-xsf)]' : `py-0 ${ROW_HEIGHT_DESKTOP}`,
          isLinkMode && 'pointer-events-none',
        )}
      >
        {row.getVisibleCells().map(cell => {
          const meta = cell.column.columnDef.meta
          return (
            <div
              key={cell.id}
              className={cn(
                'flex flex-col overflow-hidden',
                alignJustify(meta?.align),
                meta?.width || 'flex-1 min-w-0',
                meta?.cellClassName,
                getHideClasses(meta?.hideAt),
              )}
            >
              <CellContent>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </CellContent>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const DataTableRow = memo(DataTableRowImpl) as typeof DataTableRowImpl

/** Wraps primitive string/number cell values in the default text style. */
function CellContent({ children }: { children: ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <span className="text-h4 text-ods-text-primary truncate">{children}</span>
    )
  }
  return <>{children}</>
}
