'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import { Checkbox } from '../checkbox'
import { TableCell } from './table-cell'
import { ROW_HEIGHT_DESKTOP } from './table-skeleton'
import type { TableRowProps } from './types'
import { getHideClasses } from './utils'

export function TableRow<T = any>({
  item,
  columns,
  onClick,
  className,
  index,
  selectable,
  selected,
  onSelect
}: TableRowProps<T>) {
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
    <div
      className={cn(
        'relative rounded-[6px] bg-[#212121] border border-[#3a3a3a] overflow-hidden',
        onClick && 'cursor-pointer hover:bg-[#2a2a2a] transition-colors',
        typeof className === 'function' ? className(item, index) : className
      )}
      onClick={handleRowClick}
    >
      <div className={cn('flex items-center gap-4 px-4 py-0', ROW_HEIGHT_DESKTOP)}>
        {/* Selection checkbox */}
        {selectable && (
          <div className="flex items-center justify-center w-10 shrink-0" data-no-row-click>
            <Checkbox
              checked={selected}
              onCheckedChange={handleSelect}
              className="border-[#3a3a3a]"
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
    </div>
  )
}