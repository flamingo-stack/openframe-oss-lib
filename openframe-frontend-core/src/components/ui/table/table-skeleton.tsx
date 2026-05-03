'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import type { TableCardSkeletonProps } from './types'

const ROW_HEIGHT_DESKTOP = 'h-[68px] md:h-[80px]'
const ROW_HEIGHT_MOBILE = 'h-[68px]'

/** @deprecated Use `DataTableSkeleton` from `data-table` instead. */
export function TableCardSkeleton({
  columns,
  rows = 10,
  hasActions = false,
  hasChevron = false,
  className,
  rowClassName
}: TableCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'relative rounded-[6px] bg-ods-card border border-ods-border overflow-hidden animate-pulse',
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
                <div className="h-5 bg-ods-bg-surface rounded w-3/4 mb-1" />
                {/* Add second line for some columns to simulate multi-line content */}
                {index % 2 === 0 && column.key === columns[0].key && (
                  <div className="h-4 bg-ods-bg-surface rounded w-1/2 opacity-60" />
                )}
              </div>
            ))}

            {/* Actions skeleton */}
            {hasActions && (
              <div className={cn('flex gap-2 items-center shrink-0', !hasChevron && 'ml-auto')}>
                <div className="h-12 w-12 bg-ods-bg-surface rounded" />
                <div className="h-12 w-24 bg-ods-bg-surface rounded" />
              </div>
            )}

            {/* Chevron skeleton */}
            {hasChevron && (
              <div className={cn('flex items-center justify-end shrink-0 w-12', !hasActions && 'ml-auto')}>
                <div className="h-8 w-8 bg-ods-bg-surface rounded" />
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
              <div className="h-4 bg-ods-bg-surface rounded w-3/4 mb-2" />
              <div className="h-3 bg-ods-bg-surface rounded w-1/2 opacity-60" />
            </div>
            {hasActions && (
              <div className="h-12 w-12 bg-ods-bg-surface rounded shrink-0" />
            )}
            {hasChevron && (
              <div className="h-8 w-8 bg-ods-bg-surface rounded shrink-0" />
            )}
          </div>
        </div>
      ))}
    </>
  )
}

/** @deprecated */
export { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE }