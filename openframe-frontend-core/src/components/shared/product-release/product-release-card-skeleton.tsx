'use client'

import React from 'react'
import { cn } from '../../../utils/cn'

export interface ProductReleaseCardSkeletonProps {
  /** Additional CSS classes */
  className?: string
}

export function ProductReleaseCardSkeleton({ className }: ProductReleaseCardSkeletonProps) {
  return (
    <div
      className={cn(
        'bg-ods-card border border-ods-border rounded-[6px]',
        'flex flex-col md:flex-row',
        'items-start md:items-center',
        'gap-3 md:gap-4',
        'p-4',
        'animate-pulse',
        className
      )}
    >
      {/* Left column - content */}
      <div className="flex-1 w-full md:w-auto min-w-0 flex flex-col justify-center gap-2">
        {/* Title skeleton - 2 lines height */}
        <div className="min-h-[48px] flex items-center">
          <div className="flex flex-col gap-1 w-full">
            <div className="h-[24px] w-3/4 bg-ods-border rounded" />
            <div className="h-[24px] w-1/2 bg-ods-border rounded" />
          </div>
        </div>
        {/* Description skeleton - 3 lines */}
        <div className="flex flex-col gap-1">
          <div className="h-[24px] w-full bg-ods-border rounded" />
          <div className="h-[24px] w-full bg-ods-border rounded" />
          <div className="h-[24px] w-2/3 bg-ods-border rounded" />
        </div>
      </div>

      {/* Right column - version + date */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end shrink-0">
        <div className="w-[200px] flex flex-col justify-center gap-2">
          <div className="h-[24px] w-20 bg-ods-border rounded" />
          <div className="h-[20px] w-32 bg-ods-border rounded" />
        </div>
        {/* Icon column */}
        <div className="h-6 w-6 bg-ods-border rounded shrink-0 mx-3" />
      </div>
    </div>
  )
}
