'use client';

import { cn } from '../../../utils/cn';
import { LoadingRegion } from '../../loading/loading-region';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { LoadingItems } from '../loading-scope';
import { queryReportHeaderClass, queryReportRowCellsClass, queryReportRowFrameClass } from './query-report-table-row';
import type { QueryReportTableSkeletonProps } from './types';

export function QueryReportTableSkeleton({
  region = true,
  rows,
  columns,
  columnWidth,
  variant = 'default',
  className,
}: QueryReportTableSkeletonProps) {
  const isCompact = variant === 'compact';

  return (
    <LoadingRegion label="Loading results" announce={region} className={cn('flex flex-col', className)}>
      {/* Skeleton header: the columns are the result's, drawn as `columns` bars (cells of one header row). It sits on
          the rows, as the loaded header does. */}
      <div className={queryReportHeaderClass(isCompact)}>
        <LoadingItems count={columns}>
          {() => (
            <div className="flex shrink-0 items-center" style={{ width: columnWidth, height: 48 }}>
              <TextLineSkeleton type="h5" className="w-3/4" />
            </div>
          )}
        </LoadingItems>
      </div>

      {/* Skeleton rows: the result's rows (marked like the loaded rows), each `columns` cells. */}
      <div className={cn('flex flex-col', isCompact ? 'gap-0' : 'gap-[var(--spacing-system-xs)]')}>
        <LoadingItems count={rows}>
          {rowIndex => (
            <div data-loading-item className={queryReportRowFrameClass(isCompact)}>
              <div className={queryReportRowCellsClass(isCompact)}>
                <LoadingItems count={columns}>
                  {colIndex => (
                    <div className="flex shrink-0 flex-col justify-center" style={{ width: columnWidth }}>
                      <TextLineSkeleton
                        type={isCompact ? 'h6' : 'h4'}
                        width={`${55 + ((rowIndex * colIndex * 7) % 35)}%`}
                      />
                    </div>
                  )}
                </LoadingItems>
              </div>
            </div>
          )}
        </LoadingItems>
      </div>
    </LoadingRegion>
  );
}
