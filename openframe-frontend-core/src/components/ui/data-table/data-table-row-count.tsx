'use client'

import { cn } from '../../../utils/cn'
import { useDataTableContext } from './data-table'

export interface DataTableRowCountProps {
  /** Singular item name. Pluralized by adding an "s". */
  itemName?: string
  /**
   * Override the count. Use this for server-paginated tables where the table
   * context only knows about loaded rows, not the total. Defaults to the
   * number of rows currently in the table's row model.
   */
  totalCount?: number
  /** Custom pluralizer for irregular nouns. */
  pluralize?: (count: number, itemName: string) => string
  /** Hide when the count is zero. Default `true`. */
  hideWhenEmpty?: boolean
  className?: string
}

/**
 * Renders "8 devices" (or your custom `itemName`) for the current row model.
 * Place wherever you want — above the table, in a toolbar, in a header right
 * slot.
 *
 * For server-paginated tables, pass `totalCount` explicitly — the table
 * context only knows about loaded rows.
 *
 * @example
 * <DataTable.Header rightSlot={
 *   <DataTable.RowCount itemName="device" totalCount={pageInfo.total} />
 * } />
 */
export function DataTableRowCount({
  itemName = 'result',
  totalCount,
  pluralize,
  hideWhenEmpty = true,
  className,
}: DataTableRowCountProps) {
  const table = useDataTableContext()
  const count = totalCount ?? table.getRowModel().rows.length

  if (hideWhenEmpty && count === 0) return null

  const label =
    pluralize?.(count, itemName) ??
    (count === 1 ? itemName : `${itemName}s`)

  return (
    <span
      className={cn(
        'text-h6 text-ods-text-secondary whitespace-nowrap',
        className,
      )}
    >
      {count} {label}
    </span>
  )
}
