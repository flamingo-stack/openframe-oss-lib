'use client';

import { cn } from '../../../utils/cn';
import { LoadingRegion } from '../../loading/loading-region';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { LoadingItems } from '../loading-scope';
import {
  QUERY_REPORT_CELL_CLASS,
  QUERY_REPORT_HEADER_CELL_CLASS,
  queryReportHeaderClass,
  queryReportRowCellsClass,
  queryReportRowFrameClass,
  queryReportRowsClass,
} from './query-report-table-row';
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
            <div className={QUERY_REPORT_HEADER_CELL_CLASS} style={{ width: columnWidth }}>
              <TextLineSkeleton type="h5" className="w-3/4" />
            </div>
          )}
        </LoadingItems>
      </div>

      {/* Skeleton rows: the result's rows (marked like the loaded rows), each `columns` cells. */}
      <div className={queryReportRowsClass(isCompact)}>
        <LoadingItems count={rows}>
          {rowIndex => (
            <div data-loading-item className={queryReportRowFrameClass(isCompact)}>
              <div className={queryReportRowCellsClass(isCompact)}>
                <LoadingItems count={columns}>
                  {colIndex => (
                    <div className={QUERY_REPORT_CELL_CLASS} style={{ width: columnWidth }}>
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
