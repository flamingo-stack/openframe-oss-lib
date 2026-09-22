'use client';

import { cn } from '../../../utils/cn';
import type { QueryReportTableSkeletonProps } from './types';

export function QueryReportTableSkeleton({
  rows,
  columns,
  columnWidth,
  variant = 'default',
  className,
}: QueryReportTableSkeletonProps) {
  const isCompact = variant === 'compact';

  return (
    <div className={cn('flex flex-col', isCompact ? 'gap-0' : 'gap-[var(--spacing-system-xs)]', className)}>
      {/* Skeleton header */}
      <div className={cn('flex items-center gap-4 px-4', isCompact ? 'border-b border-ods-border py-2' : '')}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="flex shrink-0 items-center" style={{ width: columnWidth, height: 48 }}>
            <div className="h-4 w-3/4 animate-pulse rounded bg-ods-bg-surface" />
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
              : 'relative overflow-hidden rounded-[6px] border border-ods-border bg-ods-card',
          )}
        >
          <div className={cn('flex items-center gap-4 px-4', isCompact ? 'h-[56px]' : 'h-[80px]')}>
            {Array.from({ length: columns }).map((_cell, colIndex) => (
              <div key={`cell-${rowIndex}-${colIndex}`} className="shrink-0" style={{ width: columnWidth }}>
                <div
                  className={cn('rounded bg-ods-bg-surface', isCompact ? 'h-4' : 'h-5')}
                  style={{ width: `${55 + ((rowIndex * colIndex * 7) % 35)}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
