'use client'

import * as React from 'react'
import { Skeleton } from '../../ui/skeleton'
import { cn } from '../../../utils/cn'

export interface TicketCardSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export const TicketCardSkeleton = React.forwardRef<HTMLDivElement, TicketCardSkeletonProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)]',
        className,
      )}
      {...props}
    >
      <div className="flex items-start gap-[var(--spacing-system-sf)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <div className="text-h3 flex items-center">
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="text-h6 flex items-center gap-[var(--spacing-system-xxs)]">
            <Skeleton className="size-4 shrink-0 rounded-sm" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[var(--spacing-system-xsf)]">
          <Skeleton className="size-4 rounded-sm" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
      <div className="flex h-8 items-center gap-[var(--spacing-system-xxs)]">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-12 rounded-md" />
      </div>
    </div>
  ),
)
TicketCardSkeleton.displayName = 'TicketCardSkeleton'
