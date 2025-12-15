'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import type { TableCardSkeletonProps } from './types'

// Consistent row height using clamp for responsive sizing
// Desktop: min 72px, preferred 5vw, max 88px
// Mobile: min 72px, preferred 18vw, max 96px
const ROW_HEIGHT_DESKTOP = 'h-[clamp(72px,5vw,88px)]'
const ROW_HEIGHT_MOBILE = 'min-h-[clamp(72px,18vw,96px)]'

export function TableCardSkeleton({
  columns,
  rows = 10,
  hasActions = false,
  className,
  rowClassName
}: TableCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'relative rounded-[6px] bg-bg-card border border-border-primary overflow-hidden animate-pulse',
            className
          )}
        >
          {/* Desktop Skeleton */}
          <div className={cn(
            'hidden md:flex items-center gap-4 px-4 py-0',
            ROW_HEIGHT_DESKTOP,
            rowClassName
          )}>
            {columns.map((column) => (
              <div
                key={column.key}
                className={cn(
                  'flex flex-col justify-center shrink-0',
                  column.width || 'flex-1'
                )}
              >
                <div className="h-5 bg-bg-surface rounded w-3/4 mb-1" />
                {/* Add second line for some columns to simulate multi-line content */}
                {index % 2 === 0 && column.key === columns[0].key && (
                  <div className="h-4 bg-bg-surface rounded w-1/2 opacity-60" />
                )}
              </div>
            ))}

            {/* Actions skeleton */}
            {hasActions && (
              <div className="flex gap-2 items-center shrink-0 ml-auto">
                <div className="h-12 w-12 bg-bg-surface rounded" />
                <div className="h-12 w-24 bg-bg-surface rounded" />
              </div>
            )}
          </div>

          {/* Mobile Skeleton */}
          <div className={cn(
            'flex md:hidden gap-3 items-center justify-start px-3 py-0',
            ROW_HEIGHT_MOBILE,
            rowClassName
          )}>
            <div className="flex-1 flex flex-col justify-center min-w-0 py-3">
              <div className="h-4 bg-bg-surface rounded w-3/4 mb-2" />
              <div className="h-3 bg-bg-surface rounded w-1/2 opacity-60" />
            </div>
            {hasActions && (
              <div className="h-12 w-12 bg-bg-surface rounded shrink-0" />
            )}
          </div>
        </div>
      ))}
    </>
  )
}

// Export the height constants for use in TableRow to ensure consistency
export { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE }