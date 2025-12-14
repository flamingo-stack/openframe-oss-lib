'use client'

import React from 'react'
import { InteractiveCard } from '../../ui/interactive-card'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../../utils/cn'

export interface ProductReleaseCardProps {
  /** Release title */
  title: string
  /** Release summary/description */
  summary?: string | null
  /** Version string (e.g., "1.2.0") */
  version: string
  /** Formatted date string for display */
  formattedDate: string
  /** Click handler for navigation */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
}

export function ProductReleaseCard({
  title,
  summary,
  version,
  formattedDate,
  onClick,
  className
}: ProductReleaseCardProps) {
  return (
    <InteractiveCard
      clickable={true}
      onClick={onClick}
      className={cn(
        'bg-ods-card border border-ods-border rounded-[6px]',
        'flex flex-col md:flex-row',
        'items-start md:items-center',
        'gap-3 md:gap-4',
        'p-4',
        className
      )}
    >
      {/* Left column - content */}
      <div className="flex-1 w-full md:w-auto min-w-0 flex flex-col justify-center gap-2">
        <div className="min-h-[48px] flex items-center">
          <h3 className="font-['DM_Sans'] font-bold text-[18px] leading-[24px] text-ods-text-primary tracking-[-0.36px] line-clamp-2">
            {title}
          </h3>
        </div>
        <p className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-ods-text-secondary line-clamp-3">
          {summary || '\u00A0'}
        </p>
      </div>

      {/* Right column - version + date */}
      <div
        className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[200px] flex flex-col justify-center gap-2">
          <p className="font-['DM_Sans'] font-bold text-[18px] leading-[24px] text-ods-text-primary tracking-[-0.36px] truncate">
            {version}
          </p>
          <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
            {formattedDate}
          </p>
        </div>
        {/* Icon column */}
        <div className="flex items-center justify-center p-3 shrink-0">
          <ChevronRight className="h-6 w-6 text-ods-text-primary" />
        </div>
      </div>
    </InteractiveCard>
  )
}
