'use client';

import { cn } from '../../../utils/cn';
import type { TableCardSkeletonProps } from './types';

// INNER row heights: the bordered row card adds 1px top + bottom, so the
// outer block totals the designed 68px / 80px.
const ROW_HEIGHT_DESKTOP = 'h-[66px] md:h-[78px]';
const ROW_HEIGHT_MOBILE = 'h-[66px]';

/** @deprecated Use `DataTableSkeleton` from `data-table` instead. */
export function TableCardSkeleton({
  columns,
  rows = 10,
  hasActions = false,
  hasChevron = false,
  className,
  rowClassName,
}: TableCardSkeletonProps) {
  // The multi-line placeholder belongs to the primary text column — the wide,
  // GROWING one (`flex-1` / `flex-[n]`), not necessarily the first column, which
  // may be a narrow leading action/icon column. Falls back to the first column.
  const primaryKey = (columns.find(c => /flex-(1|\[)/.test(c.width || '')) ?? columns[0])?.key;
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'relative animate-pulse overflow-hidden rounded-[6px] border border-ods-border bg-ods-card',
            className,
          )}
        >
          {/* Desktop Skeleton */}
          <div className={cn('hidden items-center gap-4 px-4 py-0 md:flex', ROW_HEIGHT_DESKTOP, rowClassName)}>
            {columns.map(column => (
              <div key={column.key} className={cn('flex shrink-0 flex-col justify-center', column.width || 'flex-1')}>
                <div className="mb-1 h-5 w-3/4 rounded bg-ods-bg-surface" />
                {/* second line simulates multi-line content on the primary column */}
                {index % 2 === 0 && column.key === primaryKey && (
                  <div className="h-4 w-1/2 rounded bg-ods-bg-surface opacity-60" />
                )}
              </div>
            ))}

            {/* Actions skeleton */}
            {hasActions && (
              <div className={cn('flex shrink-0 items-center gap-2', !hasChevron && 'ml-auto')}>
                <div className="h-12 w-12 rounded bg-ods-bg-surface" />
                <div className="h-12 w-24 rounded bg-ods-bg-surface" />
              </div>
            )}

            {/* Chevron skeleton */}
            {hasChevron && (
              <div className={cn('flex w-12 shrink-0 items-center justify-end', !hasActions && 'ml-auto')}>
                <div className="h-8 w-8 rounded bg-ods-bg-surface" />
              </div>
            )}
          </div>

          {/* Mobile Skeleton */}
          <div
            className={cn('flex items-center justify-start gap-3 px-3 py-0 md:hidden', ROW_HEIGHT_MOBILE, rowClassName)}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center py-3">
              <div className="mb-2 h-4 w-3/4 rounded bg-ods-bg-surface" />
              <div className="h-3 w-1/2 rounded bg-ods-bg-surface opacity-60" />
            </div>
            {hasActions && <div className="h-12 w-12 shrink-0 rounded bg-ods-bg-surface" />}
            {hasChevron && <div className="h-8 w-8 shrink-0 rounded bg-ods-bg-surface" />}
          </div>
        </div>
      ))}
    </>
  );
}

/** @deprecated */
export { ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE };
