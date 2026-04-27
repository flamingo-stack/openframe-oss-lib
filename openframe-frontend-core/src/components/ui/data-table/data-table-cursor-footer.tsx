'use client'

import { cn } from '../../../utils/cn'
import { CursorPagination, type CursorPaginationProps } from '../cursor-pagination'
import { useDataTableContext } from './data-table'

export interface DataTableCursorFooterProps
  extends Omit<CursorPaginationProps, 'currentCount'> {
  /**
   * Override the shown current count. Defaults to the number of currently rendered rows
   * from the table instance.
   */
  currentCount?: number
}

/**
 * Cursor-based prev/next footer for a `DataTable`. Place after `<DataTable.Body>`.
 * Thin wrapper around `<CursorPagination>` with a border-top separator to match the legacy `Table` look.
 */
export function DataTableCursorFooter({
  className,
  currentCount,
  showInfo,
  ...rest
}: DataTableCursorFooterProps) {
  const table = useDataTableContext()
  const rowsCount = table.getRowModel().rows.length

  return (
    <CursorPagination
      {...rest}
      currentCount={currentCount ?? rowsCount}
      showInfo={showInfo ?? true}
      className={cn('border-t border-ods-border pt-[var(--spacing-system-sf)] mt-[var(--spacing-system-xsf)]', className)}
    />
  )
}
