'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import type { TableCellProps } from './types'

export function TableCell({
  children,
  align = 'left',
  className,
  width
}: TableCellProps) {
  const getAlignment = () => {
    switch (align) {
      case 'center':
        return 'justify-center text-center'
      case 'right':
        return 'justify-end text-right'
      default:
        return 'justify-start text-left'
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden',
        getAlignment(),
        width || 'flex-1 min-w-0',
        className
      )}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] truncate">
          {children}
        </span>
      ) : (
        children
      )}
    </div>
  )
}