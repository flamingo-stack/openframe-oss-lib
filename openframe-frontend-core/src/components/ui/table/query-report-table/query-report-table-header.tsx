'use client'

import React from 'react'
import { cn } from '../../../../utils/cn'
import type { QueryReportTableHeaderProps } from './types'

export function QueryReportTableHeader({
  columns,
  columnWidth,
  className
}: QueryReportTableHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3',
        className
      )}
    >
      {columns.map((column) => (
        <div
          key={column}
          className="shrink-0 font-mono font-medium text-[14px] leading-[20px] text-ods-text-secondary uppercase tracking-[-0.28px] truncate"
          style={{ width: columnWidth }}
        >
          {column}
        </div>
      ))}
    </div>
  )
}
