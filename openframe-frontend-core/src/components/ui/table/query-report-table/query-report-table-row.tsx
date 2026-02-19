'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '../../../../utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../tooltip'
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
          const displayValue = value === null || value === undefined ? '-' : String(value)
          return (
            <div
              key={column}
              className="shrink-0 flex flex-col justify-center overflow-hidden"
              style={{ width: columnWidth }}
            >
              <TruncatedCell
                className="font-sans font-medium text-[18px] leading-[24px] text-ods-text-primary"
                value={displayValue}
              />
            </div>
          )
        })}
      </div>
      {/* Right-edge gradient fade */}
      <div className="absolute inset-y-0 right-0 w-[40px] bg-gradient-to-l from-ods-bg to-transparent pointer-events-none" />
    </div>
  )
}

function TruncatedCell({ value, className }: { value: string; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [isTruncated, setIsTruncated] = useState(false)

  const checkTruncation = useCallback(() => {
    const el = textRef.current
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth)
    }
  }, [])

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isTruncated ? undefined : false}>
        <TooltipTrigger asChild onMouseEnter={checkTruncation}>
          <span ref={textRef} className={cn('truncate block', className)}>
            {value}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs break-words">
          {value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
