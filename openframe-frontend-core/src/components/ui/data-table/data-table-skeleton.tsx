'use client'

import { cn } from '../../../utils/cn'
import { useDataTableContext } from './data-table'
import { getHideClasses } from './utils'

/**
 * Consistent INNER row heights. The row card wraps these in a 1px border on
 * each side, so the outer block lands on the designed 68px / 80px total —
 * hence the 66/78 values here.
 */
export const ROW_HEIGHT_DESKTOP = 'h-[66px] md:h-[78px]'
export const ROW_HEIGHT_MOBILE = 'h-[66px]'

/**
 * The row shell's inset and column gap.
 *
 * Shared by the real row (`data-table-row`), the skeleton rows below and the
 * pad rows in `data-table-body`, because a difference between them is a visible
 * shift on load — and there WAS one: all three placeholders used
 * `--spacing-system-sf` (12px) in their mobile variant while the real row uses
 * `--spacing-system-mf` (16px) at every width, so a loading table sat 4px closer
 * to the card edge than the loaded one and its content nudged over when data
 * arrived. Kept as a constant rather than three copies so that cannot drift again.
 */
export const ROW_SHELL_CLASSES = 'items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]'

export interface DataTableSkeletonProps {
  rows?: number
  className?: string
  rowClassName?: string
}

export function DataTableSkeleton({
  rows = 10,
  className,
  rowClassName,
}: DataTableSkeletonProps) {
  const table = useDataTableContext()
  const columns = table.getVisibleFlatColumns()
  const firstColumnId = columns[0]?.id

  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'relative rounded-md bg-ods-card border border-ods-border overflow-hidden animate-pulse',
            className,
          )}
        >
          <div
            className={cn(
              'hidden md:flex py-0',
              ROW_SHELL_CLASSES,
              ROW_HEIGHT_DESKTOP,
              rowClassName,
            )}
          >
            {columns.map(column => {
              const meta = column.columnDef.meta
              return (
                <div
                  key={column.id}
                  className={cn(
                    'flex flex-col justify-center shrink-0',
                    meta?.width || 'flex-1',
                    // Same responsive hiding the real header and row apply.
                    // Without it a `hideAt` column was drawn in the skeleton and
                    // absent from the loaded table, so below that breakpoint the
                    // remaining columns were sized against a different total and
                    // the whole row re-laid-out the moment data arrived.
                    getHideClasses(meta?.hideAt),
                  )}
                >
                  <div className="h-5 bg-ods-bg-surface rounded-sm w-3/4 mb-[var(--spacing-system-xxs)]" />
                  {index % 2 === 0 && column.id === firstColumnId && (
                    <div className="h-4 bg-ods-bg-surface rounded-sm w-1/2 opacity-60" />
                  )}
                </div>
              )
            })}
          </div>
          <div
            className={cn(
              'flex md:hidden justify-start py-0',
              ROW_SHELL_CLASSES,
              ROW_HEIGHT_MOBILE,
              rowClassName,
            )}
          >
            <div className="flex-1 flex flex-col justify-center min-w-0 py-[var(--spacing-system-sf)]">
              <div className="h-4 bg-ods-bg-surface rounded-sm w-3/4 mb-[var(--spacing-system-xsf)]" />
              <div className="h-3 bg-ods-bg-surface rounded-sm w-1/2 opacity-60" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
