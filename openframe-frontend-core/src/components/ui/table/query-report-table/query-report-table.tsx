'use client'

import { useMemo } from 'react'
import { cn } from '../../../../utils/cn'
import { Button } from '../../button'
import { Download02Icon } from '../../../icons-v2-generated/interface/download-02-icon'
import { useHorizontalScrollbar } from '../../../../hooks/ui/use-horizontal-scrollbar'
import { TableEmptyState } from '../table-empty-state'
import { QueryReportTableHeader } from './query-report-table-header'
import { QueryReportTableRow } from './query-report-table-row'
import { QueryReportTableSkeleton } from './query-report-table-skeleton'
import { deriveColumns, exportToCSV } from './utils'
import type { QueryReportTableProps } from './types'

export function QueryReportTable({
  title,
  data,
  loading = false,
  skeletonRows = 8,
  skeletonColumns = 6,
  emptyMessage = 'No results found',
  columnWidth = 160,
  columnOrder,
  showExport = true,
  exportFilename = 'query-results',
  onExport,
  headerActions,
  variant = 'default',
  className,
  tableClassName
}: QueryReportTableProps) {
  const isCompact = variant === 'compact'
  const columns = useMemo(
    () => deriveColumns(data, columnOrder),
    [data, columnOrder]
  )

  const handleExport = () => {
    exportToCSV(data, columns, exportFilename)
    onExport?.()
  }

  const tableMinWidth = columns.length * (columnWidth + 16) // columnWidth + gap

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
  } = useHorizontalScrollbar()

  return (
    <div className={cn('flex flex-col w-full', isCompact ? 'gap-0' : 'gap-6', className)}>
      {/* Title bar — hidden in compact mode */}
      {!isCompact && (
        <div className="flex items-end justify-between pt-6">
          <h2 className="font-mono font-semibold text-[32px] leading-[40px] text-ods-text-primary">
            {title}
          </h2>
          <div className="flex items-center gap-3">
            {headerActions}
            {showExport && data.length > 0 && (
              <Button
                className='bg-ods-card'
                variant="outline"
                size="sm"
                leftIcon={<Download02Icon size={18} />}
                onClick={handleExport}
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <QueryReportTableSkeleton
          rows={skeletonRows}
          columns={skeletonColumns}
          columnWidth={columnWidth}
          variant={variant}
        />
      )}

      {/* Empty state */}
      {!loading && data.length === 0 && (
        <TableEmptyState message={emptyMessage} />
      )}

      {/* Table content */}
      {!loading && data.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* Custom scrollbar track — hidden in compact mode */}
          {!isCompact && thumbRatio > 0 && (
            <div
              ref={trackRef}
              className="relative h-2 rounded-full bg-ods-border cursor-pointer"
              onClick={onTrackClick}
              onWheel={onTrackWheel}
            >
              <div
                ref={thumbRef}
                data-scrollbar-thumb
                className="absolute top-0 h-full rounded-full bg-ods-text-secondary transition-colors"
                style={{
                  width: `${thumbRatio * 100}%`,
                  cursor: 'grab',
                }}
                onPointerDown={onThumbPointerDown}
                onPointerMove={onThumbPointerMove}
                onPointerUp={onThumbPointerUp}
              />
            </div>
          )}

          {/* Scrollable table container */}
          <div className="relative">
            <div
              ref={scrollRef}
              className={cn('overflow-x-auto', tableClassName)}
              onScroll={onScroll}
            >
              <div style={{ minWidth: tableMinWidth }}>
                <QueryReportTableHeader
                  columns={columns}
                  columnWidth={columnWidth}
                  variant={variant}
                />
                <div className={cn('flex flex-col', isCompact ? 'gap-0' : 'gap-2')}>
                  {data.map((row, index) => (
                    <QueryReportTableRow
                      key={index}
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
              <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-ods-bg to-transparent pointer-events-none" />
            )}
            {!isCompact && canScrollRight && (
              <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ods-bg to-transparent pointer-events-none" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
