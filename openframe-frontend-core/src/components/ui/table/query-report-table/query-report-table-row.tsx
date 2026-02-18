'use client'

import React from 'react'
import { cn } from '../../../../utils/cn'
import type { QueryReportTableRowProps } from './types'

export function QueryReportTableRow({
  row,
  columns,
  columnWidth,
  className
}: QueryReportTableRowProps) {
  return (
    <div
      className={cn(
        'relative rounded-[6px] bg-ods-card border border-ods-border overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-4 px-4 h-[80px]">
        {columns.map((column) => {
          const value = row[column]
          return (
            <div
              key={column}
              className="shrink-0 flex flex-col justify-center overflow-hidden"
              style={{ width: columnWidth }}
            >
              <span className="font-sans font-medium text-[18px] leading-[24px] text-ods-text-primary truncate">
                {value === null || value === undefined ? '-' : String(value)}
              </span>
            </div>
          )
        })}
      </div>
      {/* Right-edge gradient fade */}
      <div className="absolute inset-y-0 right-0 w-[40px] bg-gradient-to-l from-ods-bg to-transparent pointer-events-none" />
    </div>
  )
}
