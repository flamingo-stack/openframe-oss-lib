'use client'

import React from 'react'
import { FileX2 } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { Button } from '../button'
import type { TableEmptyStateProps } from './types'

export function TableEmptyState({
  message = 'No data available',
  icon,
  action,
  className
}: TableEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 rounded-[6px] bg-[#212121] border border-[#3a3a3a]',
        className
      )}
    >
      {/* Icon */}
      <div className="mb-4 text-[#888888]">
        {icon || <FileX2 className="w-12 h-12" />}
      </div>
      
      {/* Message */}
      <p className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#888888] text-center mb-6">
        {message}
      </p>
      
      {/* Action Button */}
      {action && (
        <Button
          variant="outline"
          onClick={action.onClick}
          className="bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] text-[#fafafa]"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}