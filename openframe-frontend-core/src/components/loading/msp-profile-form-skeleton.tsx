import React from 'react'
import { cn } from "../../utils/cn"
import {
  UnifiedSkeleton,
  TextSkeleton,
  InteractiveSkeleton
} from './unified-skeleton'

interface SkeletonProps {
  className?: string
  /**
   * Number of input fields to render on the right column (defaults to 4).
   */
  fields?: number
}

/**
 * MspProfileFormSkeleton
 * -----------------------------------------------------------------------------
 * Loading state for the <MspProfileForm /> component used in the Share-Your-Stack
 * wizard (and any other area that re-uses the form).
 *
 * Design Notes:
 * – Two-column grid matching the live component (logo upload on the left,
 *   text / numeric inputs on the right).
 * – Left column: square/circular media skeleton to represent logo uploader.
 * – Right column: label + input pair per field.
 * – Mobile (<768px) collapses to one column via grid existing classes.
 * – Uses UnifiedSkeleton system to stay consistent with global loading design.
 */
export function MspProfileFormSkeleton({
  className,
  fields = 4,
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch',
        className,
      )}
      role="status"
      aria-label="Loading MSP profile form"
    >
      {/* Left – Logo uploader placeholder */}
      <div className="flex flex-col space-y-2 h-full">
        {/* Label skeleton */}
        <TextSkeleton.Body className="w-28" />
        <div className="flex-1 min-h-[180px] md:min-h-full">
          <UnifiedSkeleton className="w-full h-full rounded-lg" aria-label="Loading company logo" />
        </div>
      </div>

      {/* Right – Input fields grid (mirrors form) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: fields }).map((_, idx) => (
          <div key={idx} className="space-y-2 flex flex-col">
            <TextSkeleton.Body className="w-40" />
            <InteractiveSkeleton.Input />
          </div>
        ))}
      </div>
    </div>
  )
} 