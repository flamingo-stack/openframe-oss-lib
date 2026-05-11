'use client'

import React from 'react'
import { cn } from '../../../utils/cn'

export interface ProductReleaseCardSkeletonProps {
  /** Additional CSS classes */
  className?: string
  /** Card density. Must match the loaded card's `size` prop so the loading
   *  height matches the resolved height (no layout shift on resolve). */
  size?: 'default' | 'sm'
}

export function ProductReleaseCardSkeleton({ className, size = 'default' }: ProductReleaseCardSkeletonProps) {
  // ----- COMPACT branch — must match ProductReleaseCard size='sm' exactly.
  // Same outer: span + items-start + gap-3 + p-2 + my-1.5 (no border to keep
  // the skeleton 1px lighter than the resolved card is fine — but we mirror
  // the border too so width is byte-identical). Inner row 1 = title +
  // version-pill; row 2 = date; row 3 = summary line. Heights/widths chosen
  // to match the rendered card line-heights (text-sm = 14px line-height-20,
  // text-[11px] = 11/16). The total height comes out the same as the loaded
  // card so the chat message height does NOT jump on resolve.
  if (size === 'sm') {
    return (
      <span
        className={cn(
          'my-1.5 flex w-full animate-pulse items-start gap-3',
          'rounded-lg border border-ods-border bg-ods-card p-2',
          className,
        )}
      >
        <span className="block h-14 w-14 aspect-square shrink-0 self-start rounded-md bg-ods-bg" />
        {/* Text column: 3 rows with FIXED heights matching the loaded
            card (h-5 title, h-4 + h-4 meta + summary). Skeleton bars
            sit centered inside each row container so a placeholder
            occupies the SAME pixel position as the loaded text will
            on resolve. */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 min-h-14">
          <span className="flex items-center min-w-0 h-5 gap-2">
            <span className="h-3.5 w-3/5 rounded bg-ods-bg" />
            <span className="h-4 w-12 rounded bg-ods-bg/70 shrink-0" />
          </span>
          <span className="flex items-center min-w-0 h-4">
            <span className="h-3 w-1/3 rounded bg-ods-bg/70" />
          </span>
          <span className="flex items-center min-w-0 h-4">
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
          </span>
        </span>
      </span>
    )
  }

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
