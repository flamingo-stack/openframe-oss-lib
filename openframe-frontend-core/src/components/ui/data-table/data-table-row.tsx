'use client'

import Link from '../../../embed-shims/next-link'
import React, { memo, useCallback, useRef, type ReactNode } from 'react'
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
  /**
   * Treat the design row height as a minimum: a cell rendering multi-line
   * content (e.g. a line-clamped description) grows the row instead of being
   * clipped. Default keeps the fixed height.
   */
  autoHeight?: boolean
  className?: string
  /** Expandable content rendered below the cells, inside the same card. */
  subRow?: ReactNode
}

/**
 * Click-bubbling protocol: any element inside a cell that should NOT trigger
 * `onRowClick` / row navigation must carry the `data-no-row-click` attribute.
 * The row checks `target.closest('[data-no-row-click]')` and short-circuits:
 * in `onClick` mode it skips the consumer's handler; in link mode (when
 * `href` is set) it calls `e.preventDefault()` so `<Link>` does not navigate.
 *
 * Clicks originating from portaled descendants (e.g. `FloatingTooltip`,
 * dropdown menus rendered through `FloatingPortal`) bubble through React's
 * component tree and reach this handler, but their DOM target lives outside
 * the row subtree. The handler ignores any click whose target is not
 * physically contained within the row element — no `stopPropagation`
 * required at the source.
 *
 * In link mode the row IS the `<Link>` — content lives inside it, not under
 * an absolute overlay — so native browser link behaviour works: hover,
 * right-click "Open in new tab", middle-click, `Cmd+click`, focus outlines,
 * `:visited` styles, etc.
 *
 * Example column with action buttons:
 * ```tsx
 * {
 *   id: 'actions',
 *   cell: ({ row }) => (
 *     <div data-no-row-click className="flex gap-2 justify-end">
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
  autoHeight,
  className,
  subRow,
}: DataTableRowProps<T>) {
  const hasSubRow = subRow != null && subRow !== false
  // A sub-row carries its own interactive controls, so it must not live inside the
  // row-level <Link>; when present, the link wraps only the cells.
  const isLinkMode = Boolean(href) && !onClick
  const isWholeCardLink = isLinkMode && !hasSubRow
  const containerRef = useRef<HTMLElement | null>(null)

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement
      // React-bubbled events from portaled descendants (tooltips, dropdowns, etc.)
      // reach this handler even though their DOM target lives outside the row.
      // Suppress them — and in link mode, preventDefault so `<Link>` does not navigate.
      if (!containerRef.current?.contains(target)) {
        if (isLinkMode) e.preventDefault()
        return
      }
      if (target.closest('[data-no-row-click]')) {
        if (isLinkMode) e.preventDefault()
        return
      }
      onClick?.(row.original)
    },
    [onClick, row.original, isLinkMode],
  )

  const containerClassName = cn(
    'block rounded-md bg-ods-card border border-ods-border overflow-hidden no-underline text-inherit',
    // With a sub-row the link wraps only the cells, so keep the clickable affordance off the whole card.
    (onClick || isWholeCardLink) && 'cursor-pointer hover:bg-ods-bg-active transition-colors',
    className,
  )

  const cells = (
    <div
      className={cn(
        'flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]',
        compact
          ? 'py-[var(--spacing-system-xsf)]'
          : autoHeight
            ? 'py-[var(--spacing-system-sf)] min-h-[68px] md:min-h-[80px]'
            : `py-0 ${ROW_HEIGHT_DESKTOP}`,
        hasSubRow && 'border-b border-ods-border',
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
  )

  if (isWholeCardLink && href) {
    return (
      <Link
        href={href}
        prefetch={false}
        ref={containerRef as React.RefObject<HTMLAnchorElement>}
        className={containerClassName}
        onClick={handleClick}
      >
        {cells}
      </Link>
    )
  }

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      className={containerClassName}
      onClick={onClick ? handleClick : undefined}
    >
      {isLinkMode && href ? (
        <Link
          href={href}
          prefetch={false}
          className="block no-underline text-inherit cursor-pointer hover:bg-ods-bg-active transition-colors"
          onClick={handleClick}
        >
          {cells}
        </Link>
      ) : (
        cells
      )}
      {hasSubRow && subRow}
    </div>
  )
}

export const DataTableRow = memo(DataTableRowImpl) as typeof DataTableRowImpl

/** Wraps primitive string/number cell values in the default text style. */
function CellContent({ children }: { children: ReactNode }) {
  if (typeof children === 'string' || typeof children === 'number') {
    return (
      <span className="text-h4 text-ods-text-primary truncate" title={String(children)}>{children}</span>
    )
  }
  return <>{children}</>
}
