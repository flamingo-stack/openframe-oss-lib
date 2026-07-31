'use client'

import { useRef, useState, useCallback } from 'react'
import { cn } from '../../../utils/cn'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../tooltip'
import type { QueryReportTableHeaderProps } from './types'

export function QueryReportTableHeader({
  columns,
  columnWidth,
  variant = 'default',
  className
}: QueryReportTableHeaderProps) {
  const isCompact = variant === 'compact'

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4',
        isCompact ? 'py-2 border-b border-ods-border' : '',
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
            className="shrink-0 flex items-center"
            style={{ width, height: 48 }}
          >
            <div
              ref={textRef}
              className="text-h5 text-ods-text-secondary truncate"
            >
              {value}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs break-words">
          {value}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
