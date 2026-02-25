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
  variant = 'default',
  className
}: QueryReportTableRowProps) {
  const isCompact = variant === 'compact'

  return (
    <div
      className={cn(
        isCompact
          ? 'border-b border-ods-border'
          : 'relative rounded-[6px] bg-ods-card border border-ods-border overflow-hidden',
        className
      )}
    >
      <div className={cn(
        'flex items-center gap-4 px-4',
        isCompact ? 'h-[56px]' : 'h-[80px]'
      )}>
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
                className={cn(
                  'text-ods-text-primary',
                  isCompact
                    ? 'font-sans font-normal text-[14px] leading-[20px]'
                    : 'font-sans font-medium text-[18px] leading-[24px]'
                )}
                value={displayValue}
              />
            </div>
          )
        })}
      </div>
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
