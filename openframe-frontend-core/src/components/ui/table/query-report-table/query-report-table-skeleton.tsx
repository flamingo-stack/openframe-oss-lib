'use client'

import { cn } from '../../../../utils/cn'
import type { QueryReportTableSkeletonProps } from './types'

export function QueryReportTableSkeleton({
  rows,
  columns,
  columnWidth,
  variant = 'default',
  className
}: QueryReportTableSkeletonProps) {
  const isCompact = variant === 'compact'

  return (
    <div className={cn('flex flex-col', isCompact ? 'gap-0' : 'gap-2', className)}>
      {/* Skeleton header */}
      <div className={cn(
        'flex items-center gap-4 px-4',
        isCompact ? 'py-2 border-b border-ods-border' : 'py-3'
      )}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="shrink-0"
            style={{ width: columnWidth }}
          >
            <div className="h-4 bg-ods-bg-surface rounded w-3/4 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Skeleton rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          className={cn(
            'animate-pulse',
            isCompact
              ? 'border-b border-ods-border'
              : 'relative rounded-[6px] bg-ods-card border border-ods-border overflow-hidden'
          )}
        >
          <div className={cn(
            'flex items-center gap-4 px-4',
            isCompact ? 'h-[56px]' : 'h-[80px]'
          )}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="shrink-0"
                style={{ width: columnWidth }}
              >
                <div
                  className={cn('bg-ods-bg-surface rounded', isCompact ? 'h-4' : 'h-5')}
                  style={{ width: `${55 + (rowIndex * colIndex * 7) % 35}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
