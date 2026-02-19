'use client'

import React, { useMemo } from 'react'
import { cn } from '../../../../utils/cn'
import { Button } from '../../button'
import { Download02Icon } from '../../../icons-v2-generated/interface/download-02-icon'
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
  className,
  tableClassName
}: QueryReportTableProps) {
  const columns = useMemo(
    () => deriveColumns(data, columnOrder),
    [data, columnOrder]
  )

  const handleExport = () => {
    exportToCSV(data, columns, exportFilename)
    onExport?.()
  }

  const tableMinWidth = columns.length * (columnWidth + 16) // columnWidth + gap

  return (
    <div className={cn('flex flex-col gap-6 w-full', className)}>
      {/* Title bar */}
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

      {/* Loading state */}
      {loading && (
        <QueryReportTableSkeleton
          rows={skeletonRows}
          columns={skeletonColumns}
          columnWidth={columnWidth}
        />
      )}

      {/* Empty state */}
      {!loading && data.length === 0 && (
        <TableEmptyState message={emptyMessage} />
      )}

      {/* Table content */}
      {!loading && data.length > 0 && (
        <div className={cn('overflow-x-scroll', tableClassName)}>
          <div style={{ minWidth: tableMinWidth }}>
            <QueryReportTableHeader
              columns={columns}
              columnWidth={columnWidth}
            />
            <div className="flex flex-col gap-2">
              {data.map((row, index) => (
                <QueryReportTableRow
                  key={index}
                  row={row}
                  columns={columns}
                  columnWidth={columnWidth}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
