import React from 'react'
import { cn } from "../../utils/cn"

interface ProfileLoadingSkeletonProps {
  className?: string;
}

export function ProfileLoadingSkeleton({ className }: ProfileLoadingSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Header skeleton */}
      <div className="flex items-center space-x-4">
        <div className="h-16 w-16 bg-ods-skeleton rounded-full animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 w-32 bg-ods-skeleton rounded animate-pulse" />
          <div className="h-3 w-24 bg-ods-skeleton rounded animate-pulse" />
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="h-4 w-full bg-ods-skeleton rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-ods-skeleton rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-ods-skeleton rounded animate-pulse" />
      </div>
    </div>
  )
}