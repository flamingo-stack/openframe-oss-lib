'use client'

import React from 'react'
import { cn } from '../../../../utils/cn'
import type { QueryReportTableSkeletonProps } from './types'

export function QueryReportTableSkeleton({
  rows,
  columns,
  columnWidth,
  className
}: QueryReportTableSkeletonProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Skeleton header */}
      <div className="flex items-center gap-4 px-4 py-3">
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
          className="relative rounded-[6px] bg-ods-card border border-ods-border overflow-hidden animate-pulse"
        >
          <div className="flex items-center gap-4 px-4 h-[80px]">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={`cell-${rowIndex}-${colIndex}`}
                className="shrink-0"
                style={{ width: columnWidth }}
              >
                <div
                  className="h-5 bg-ods-bg-surface rounded"
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
