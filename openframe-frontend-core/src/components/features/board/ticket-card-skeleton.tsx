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
        <div className="flex flex-1 flex-col gap-[var(--spacing-system-xsf)]">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="size-8 rounded-full" />
      </div>
    </div>
  ),
)
TicketCardSkeleton.displayName = 'TicketCardSkeleton'
