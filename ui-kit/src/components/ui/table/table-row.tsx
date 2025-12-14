'use client'

import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { Button } from '../button'
import { Checkbox } from '../checkbox'
import { TableCell } from './table-cell'
import { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE } from './table-skeleton'
import type { TableRowProps } from './types'

export function TableRow<T = any>({
  item,
  columns,
  rowKey,
  onClick,
  className,
  index,
  mobileColumns,
  renderMobileRow,
  rowActions,
  renderRowActions,
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

  // Filter columns for mobile display
  const mobileColumnsToShow = mobileColumns
    ? columns.filter(col => mobileColumns.includes(col.key))
    : columns.filter(col => !col.hideOnMobile).slice(0, 3) // Default: show first 3 columns

  return (
    <div
      className={cn(
        'relative rounded-[6px] bg-[#212121] border border-[#3a3a3a] overflow-hidden',
        onClick && 'cursor-pointer hover:bg-[#2a2a2a] transition-colors',
        typeof className === 'function' ? className(item, index) : className
      )}
      onClick={handleRowClick}
    >
      {/* Desktop Layout */}
      <div className={cn('hidden md:flex items-center gap-4 px-4 py-0', ROW_HEIGHT_DESKTOP)}>
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
            width={column.width}
            className={column.className}
          >
            {getCellValue(column)}
          </TableCell>
        ))}
      </div>

      {/* Mobile Layout */}
      <div className={cn('flex md:hidden gap-3 items-center justify-start px-3 py-0', ROW_HEIGHT_MOBILE)}>
        {renderMobileRow ? (
          // Custom mobile renderer
          renderMobileRow(item)
        ) : (
          // Default mobile layout
          <>
            <div className="flex-1 flex flex-col justify-center min-w-0 py-3">
              {mobileColumnsToShow.map((column, colIndex) => (
                <div key={column.key} className="flex flex-col">
                  {colIndex === 0 ? (
                    // First column - primary text
                    <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-[#fafafa] truncate">
                      {getCellValue(column)}
                    </span>
                  ) : (
                    // Other columns - secondary text
                    <span className="font-['DM_Sans'] font-medium text-[12px] leading-[16px] text-[#888888] truncate">
                      {getCellValue(column)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile Actions */}
            {rowActions && rowActions.length > 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation()
                  if (rowActions.length === 1) {
                    rowActions[0].onClick(item)
                  } else {
                    rowActions[0].onClick(item)
                  }
                }}
              // className="bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] h-12 w-12 shrink-0"
              >
                {rowActions.length === 1 && rowActions[0].icon ? (
                  rowActions[0].icon
                ) : (
                  <MoreHorizontal className="h-6 w-6 text-[#fafafa]" />
                )}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}