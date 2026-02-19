'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '../../../../utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../tooltip'
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
        <TruncatedHeaderCell
          key={column}
          value={column}
          width={columnWidth}
        />
      ))}
    </div>
  )
}

function TruncatedHeaderCell({ value, width }: { value: string; width: number }) {
  const textRef = useRef<HTMLDivElement>(null)
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
          <div
            ref={textRef}
            className="shrink-0 font-mono font-medium text-[14px] leading-[20px] text-ods-text-secondary uppercase tracking-[-0.28px] truncate"
            style={{ width }}
          >
            {value}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs break-words">
          {value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
