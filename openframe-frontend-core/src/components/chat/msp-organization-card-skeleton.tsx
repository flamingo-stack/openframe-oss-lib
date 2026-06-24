'use client'

import { cn } from '../../utils/cn'
import { Skeleton } from '../ui/skeleton'

export interface MspOrganizationCardSkeletonProps {
  /** Appended to the root element. */
  className?: string
}

/**
 * Loading placeholder for {@link MspOrganizationCard}. Mirrors the card's blocks
 * — square logo, title + website lines, and the trailing external-link button —
 * inside the same 80px container, so the welcome screen doesn't shift once the
 * tenant info resolves and the real card replaces it.
 */
export function MspOrganizationCardSkeleton({ className }: MspOrganizationCardSkeletonProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-[var(--spacing-system-m)] rounded-md bg-ods-bg p-[var(--spacing-system-m)] ring-1 ring-inset ring-ods-border',
        className,
      )}
    >
      <Skeleton className="size-12 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 self-stretch">
        <Skeleton className="h-5 w-3/5 rounded-md" />
        <Skeleton className="h-4 w-2/5 rounded-md" />
      </div>
      <Skeleton className="size-12 shrink-0 rounded-md" />
    </div>
  )
}
