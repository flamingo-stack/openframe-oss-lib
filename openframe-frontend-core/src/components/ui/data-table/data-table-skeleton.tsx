'use client'

import { cn } from '../../../utils/cn'
import { useDataTableContext } from './data-table'

/** Consistent row heights — identical to legacy `Table`. */
export const ROW_HEIGHT_DESKTOP = 'h-[68px] md:h-[80px]'
export const ROW_HEIGHT_MOBILE = 'h-[68px]'

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
              'hidden md:flex items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)] py-0',
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
              'flex md:hidden gap-[var(--spacing-system-sf)] items-center justify-start px-[var(--spacing-system-sf)] py-0',
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
