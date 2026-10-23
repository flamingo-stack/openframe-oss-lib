'use client';

import { useMemo } from 'react';
import { useHorizontalScrollbar } from '../../../hooks/ui/use-horizontal-scrollbar';
import { cn } from '../../../utils/cn';
import { Download02Icon } from '../../icons-v2-generated/interface/download-02-icon';
import { Button } from '../button';
import { DataTableEmpty } from '../data-table/data-table-empty';
import { InertWhileLoading, useLoadingScope } from '../loading-scope';
import { QueryReportTableHeader } from './query-report-table-header';
import { QueryReportTableRow, queryReportRowsClass } from './query-report-table-row';
import { QueryReportTableSkeleton } from './query-report-table-skeleton';
import type { QueryReportTableProps } from './types';
import { deriveColumns, exportToCSV } from './utils';

/** The rows a loading report draws when the host states none: a typical report, since a report has no page size. */
const QUERY_REPORT_TABLE_SKELETON_ROWS = 8;
/** The columns a loading report draws when the host states none: a typical result (the columns are the data's). */
const QUERY_REPORT_TABLE_SKELETON_COLUMNS = 6;

export function QueryReportTable({
  title,
  data,
  loading: loadingProp = false,
  loadingRegion = true,
  skeletonRows = QUERY_REPORT_TABLE_SKELETON_ROWS,
  skeletonColumns = QUERY_REPORT_TABLE_SKELETON_COLUMNS,
  emptyMessage,
  emptyState,
  columnWidth = 160,
  columnOrder,
  showExport = true,
  exportFilename = 'query-results',
  onExport,
  headerActions,
  variant = 'default',
  className,
  tableClassName,
}: QueryReportTableProps) {
  const loading = useLoadingScope() || loadingProp;
  const isCompact = variant === 'compact';
  const showExportButton = showExport && (loading || data.length > 0);
  const columns = useMemo(() => deriveColumns(data, columnOrder), [data, columnOrder]);

  const handleExport = () => {
    exportToCSV(data, columns, exportFilename);
    onExport?.();
  };

  const tableMinWidth = columns.length * (columnWidth + 16); // columnWidth + gap

  const {
    scrollRef,
    trackRef,
    thumbRef,
    thumbRatio,
    canScrollLeft,
    canScrollRight,
    onScroll,
    onTrackClick,
    onTrackWheel,
    onThumbPointerDown,
    onThumbPointerMove,
    onThumbPointerUp,
    onThumbPointerCancel,
  } = useHorizontalScrollbar();

  return (
    <div className={cn('flex w-full flex-col', isCompact ? 'gap-0' : 'gap-[var(--spacing-system-l)]', className)}>
      {/* Title bar — hidden in compact mode and when there is nothing to show in it. Export is drawn while the rows
          are read too (real and inert: they will hold data), so the bar does not appear when they land. */}
      {!isCompact && (title || headerActions || showExportButton) && (
        <div className="flex items-end justify-between pt-[var(--spacing-system-l)]">
          <h2 className="text-ods-text-primary text-h2">{title}</h2>
          <div className="flex items-center gap-[var(--spacing-system-s)]">
            {headerActions}
            {showExportButton && (
              <InertWhileLoading loading={loading} className="inline-flex shrink-0 content-max-md:hidden">
                <Button
                  className="bg-ods-card"
                  variant="outline"
                  leftIcon={<Download02Icon size={18} className="text-ods-text-secondary" />}
                  onClick={handleExport}
                >
                  Export CSV
                </Button>
              </InertWhileLoading>
            )}
          </div>
        </div>
      )}

      {/* One slot, three forms: loading (the rows' skeleton), empty (the same mapping `DataTable.Body` makes:
          `emptyState` wins; `emptyMessage` is its title), and the table. */}
      {loading ? (
        <QueryReportTableSkeleton
          rows={skeletonRows}
          columns={skeletonColumns}
          columnWidth={columnWidth}
          variant={variant}
          region={loadingRegion}
        />
      ) : data.length === 0 ? (
        emptyState ? (
          <DataTableEmpty {...emptyState} />
        ) : emptyMessage != null ? (
          <DataTableEmpty title={emptyMessage} description={undefined} />
        ) : (
          <DataTableEmpty />
        )
      ) : (
        <div className="flex flex-col">
          {/* Custom scrollbar track — hidden in compact mode */}
          {!isCompact && thumbRatio > 0 && (
            <div
              ref={trackRef}
              className="relative h-2 cursor-pointer rounded-full bg-ods-border"
              onClick={onTrackClick}
              onWheel={onTrackWheel}
            >
              <div
                ref={thumbRef}
                data-scrollbar-thumb
                className="absolute top-0 h-full touch-none rounded-full bg-ods-text-secondary transition-colors"
                style={{
                  width: `${thumbRatio * 100}%`,
                  cursor: 'grab',
                }}
                onPointerDown={onThumbPointerDown}
                onPointerMove={onThumbPointerMove}
                onPointerUp={onThumbPointerUp}
                onPointerCancel={onThumbPointerCancel}
              />
            </div>
          )}

          {/* Scrollable table container */}
          <div className="relative">
            <div ref={scrollRef} className={cn('overflow-x-auto', tableClassName)} onScroll={onScroll}>
              <div style={{ minWidth: tableMinWidth }}>
                <QueryReportTableHeader columns={columns} columnWidth={columnWidth} variant={variant} />
                <div className={queryReportRowsClass(isCompact)}>
                  {data.map((row, index) => (
                    <QueryReportTableRow
                      key={index}
                      data-loading-item
                      row={row}
                      columns={columns}
                      columnWidth={columnWidth}
                      variant={variant}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Edge fades — hidden in compact mode */}
            {!isCompact && canScrollLeft && (
              <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-ods-bg to-transparent" />
            )}
            {!isCompact && canScrollRight && (
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ods-bg to-transparent" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
