'use client'

import Link from '../../../embed-shims/next-link'
import React from 'react'
import { cn } from '../../../utils/cn'
import { Checkbox } from '../checkbox'
import { TableCell } from './table-cell'
import { ROW_HEIGHT_DESKTOP } from './table-skeleton'
import type { TableRowProps } from './types'
import { getHideClasses } from './utils'

/** @deprecated Use `DataTableRow` from `data-table` instead. */
export function TableRow<T = any>({
  item,
  columns,
  onClick,
  href,
  className,
  index,
  compact,
  selectable,
  selected,
  onSelect,
  animateRowReorder,
  motionDiv
}: TableRowProps<T>) {
  const isLinkMode = Boolean(href) && !onClick
  // Opt-in FLIP: the outer row becomes a `motion.div` (passed down lazily from
  // Table, so framer-motion stays out of the default bundle) that animates only
  // its position (`layout="position"`) so reordering doesn't distort inner cell
  // content (CircularProgress / ProgressBar). Plain `<div>` when off, or until
  // framer-motion has loaded — zero cost on the default path.
  const animate = Boolean(animateRowReorder && motionDiv)
  const Row: any = animate ? motionDiv : 'div'
  const motionProps = animate
    ? { layout: 'position' as const, transition: { layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } } }
    : {}

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[data-no-row-click]')) {
      return
    }

    if (onClick) {
      onClick(item)
    }
  }

  const handleSelect = () => {
    if (onSelect) {
      onSelect(item)
    }
  }

  const getCellValue = (column: typeof columns[0]): React.ReactNode => {
    if (column.renderCell) {
      return column.renderCell(item, column)
    }

    // Access nested properties using dot notation
    const keys = column.key.split('.')
    let value: any = item
    for (const key of keys) {
      value = value?.[key]
    }

    if (value === null || value === undefined) {
      return '-'
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }

    return String(value)
  }

  return (
    <Row
      {...motionProps}
      className={cn(
        'relative rounded-[6px] bg-ods-card border border-ods-border overflow-hidden',
        (onClick || isLinkMode) && 'cursor-pointer hover:bg-ods-bg-active transition-colors',
        typeof className === 'function' ? className(item, index) : className
      )}
      onClick={isLinkMode ? undefined : handleRowClick}
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
          'relative flex items-center gap-4 px-4',
          compact ? 'py-2' : cn('py-0', ROW_HEIGHT_DESKTOP),
          isLinkMode && 'pointer-events-none'
        )}
      >
        {/* Selection checkbox */}
        {selectable && (
          <div className="flex items-center justify-center w-10 shrink-0 pointer-events-auto" data-no-row-click>
            <Checkbox
              checked={selected}
              onCheckedChange={handleSelect}
              className="border-ods-border"
            />
          </div>
        )}

        {columns.map((column) => (
          <TableCell
            key={column.key}
            align={column.align}
            width={column.width || 'flex-1 min-w-0'}
            className={cn(column.className, getHideClasses(column.hideAt))}
          >
            {getCellValue(column)}
          </TableCell>
        ))}
      </div>
    </Row>
  )
}