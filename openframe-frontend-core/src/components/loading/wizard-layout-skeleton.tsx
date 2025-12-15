import React from 'react'
import { cn } from "../../utils/cn"
import { UnifiedSkeleton, TextSkeleton } from './unified-skeleton'

interface WizardLayoutSkeletonProps {
  steps?: number
  className?: string
}

export function WizardLayoutSkeleton({ steps = 6, className }: WizardLayoutSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-label="Loading wizard layout">
      {/* Progress bar */}
      <div className="flex flex-wrap items-center gap-2">
        {Array.from({ length: steps }).map((_, i) => (
          <UnifiedSkeleton key={i} className="h-6 w-24 rounded" />
        ))}
      </div>

      {/* Header */}
      <div className="space-y-2 max-w-2xl">
        <TextSkeleton.Heading className="w-2/3" />
        <TextSkeleton.Body className="w-1/2" />
      </div>

      {/* Bottom navigation buttons */}
      <div className="flex justify-between mt-10">
        <UnifiedSkeleton className="h-10 w-24 rounded" />
        <UnifiedSkeleton className="h-10 w-32 rounded" />
      </div>
    </div>
  )
} 