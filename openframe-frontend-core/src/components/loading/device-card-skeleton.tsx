import type React from "react"
import { cn } from "../../utils/cn"
import { OrganizationIconSkeleton } from "./organization-icon-skeleton"

export interface DeviceCardSkeletonProps {
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * DeviceCardSkeleton - Loading skeleton matching DeviceCard exact layout
 *
 * Matches the structure of DeviceCard:
 * - Row 1: Device icon + Device name + More button
 * - Row 2: OS badge + Organization icon + Organization name
 * - Row 3: Status badge + Last seen
 *
 * Prevents layout jumps by matching exact dimensions.
 */
export function DeviceCardSkeleton({ className }: DeviceCardSkeletonProps) {
  return (
    <div
      className={cn(
        "bg-ods-card rounded-[6px] border border-ods-border h-full",
        className
      )}
      role="status"
      aria-label="Loading device card"
    >
      {/* Row 1: Device icon + Device name + More button */}
      <div className="flex gap-4 items-center px-4 py-3">
        {/* Device type icon (8x8 container) */}
        <div className="w-8 h-8 bg-[#161616] border border-ods-border rounded-[6px] flex items-center justify-center flex-shrink-0">
          <div className="w-4 h-4 bg-ods-border rounded animate-pulse" />
        </div>

        {/* Device name */}
        <div className="flex-1 min-w-0">
          <div className="h-6 w-3/4 bg-ods-border rounded animate-pulse" />
        </div>

        {/* More button */}
        <div className="w-12 h-12 bg-ods-border rounded-[6px] flex-shrink-0 animate-pulse" />
      </div>

      {/* Row 2: OS badge + Organization */}
      <div className="flex gap-4 items-center px-4 py-2">
        {/* OS badge */}
        <div className="w-24 h-6 bg-ods-border rounded flex-shrink-0 animate-pulse" />

        {/* Organization icon */}
        <OrganizationIconSkeleton size="sm" />

        {/* Organization name */}
        <div className="flex-1 min-w-0">
          <div className="h-5 w-1/2 bg-ods-border rounded animate-pulse" />
        </div>
      </div>

      {/* Row 3: Status badge + Last seen */}
      <div className="flex gap-4 items-center px-4 py-2">
        {/* Status badge */}
        <div className="w-20 h-6 bg-ods-border rounded-full flex-shrink-0 animate-pulse" />

        {/* Last seen */}
        <div className="flex-1">
          <div className="h-5 w-40 bg-ods-border rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

/**
 * DeviceCardSkeletonGrid - Grid of device card skeletons
 *
 * Matches DevicesGrid layout with responsive columns:
 * - Mobile: 1 column
 * - Tablet (md): 2 columns
 * - Desktop (lg): 3 columns
 * - Large (xl): 4 columns
 */
export function DeviceCardSkeletonGrid({
  count = 12,
  className
}: {
  count?: number
  className?: string
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
        className
      )}
      role="status"
      aria-label={`Loading ${count} device cards`}
    >
      {Array.from({ length: count }, (_, index) => (
        <DeviceCardSkeleton key={index} />
      ))}
    </div>
  )
}
