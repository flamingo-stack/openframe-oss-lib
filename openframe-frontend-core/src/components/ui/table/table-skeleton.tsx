'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import type { TableCardSkeletonProps } from './types'

// INNER row heights: the bordered row card adds 1px top + bottom, so the
// outer block totals the designed 68px / 80px.
const ROW_HEIGHT_DESKTOP = 'h-[66px] md:h-[78px]'
/**
 * A `compact` row's floor. Compact rows are content-sized (`py-2`), but every
 * row in one table renders the same cell shapes, so pinning a minimum makes the
 * body's height a function of the ROW COUNT alone — which is what lets a host
 * reserve space for a full page and stop the layout jumping between a full
 * page, a short last page and the skeleton. The skeleton uses it too, so the
 * loading state is exactly as tall as the rows that replace it.
 */
const COMPACT_ROW_MIN_HEIGHT = 'min-h-[56px]'
/** The same 56, as a number, for hosts reserving `rows x height` of space.
 *  A LITERAL class above and a literal number here: an interpolated Tailwind
 *  class is invisible to the scanner and is never generated. */
const COMPACT_ROW_MIN_HEIGHT_PX = 56
const ROW_HEIGHT_MOBILE = 'h-[66px]'

/** @deprecated Use `DataTableSkeleton` from `data-table` instead. */
export function TableCardSkeleton({
  columns,
  rows = 10,
  compact = false,
  hasActions = false,
  hasChevron = false,
  className,
  rowClassName
}: TableCardSkeletonProps) {
  // The multi-line placeholder belongs to the primary text column — the wide,
  // GROWING one (`flex-1` / `flex-[n]`), not necessarily the first column, which
  // may be a narrow leading action/icon column. Falls back to the first column.
  const primaryKey = (columns.find((c) => /flex-(1|\[)/.test(c.width || '')) ?? columns[0])?.key
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
          {/* Matches the ROW it stands in for: a compact row is content-sized
              with a floor, a normal row is a fixed height. Using the taller of
              the two here made every compact table jump on its first paint. */}
          <div className={cn(
            'hidden md:flex items-center gap-4 px-4',
            compact ? cn('py-2', COMPACT_ROW_MIN_HEIGHT) : cn('py-0', ROW_HEIGHT_DESKTOP),
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
                {/* second line simulates multi-line content on the primary column */}
                {index % 2 === 0 && column.key === primaryKey && (
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
export { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE, COMPACT_ROW_MIN_HEIGHT, COMPACT_ROW_MIN_HEIGHT_PX }