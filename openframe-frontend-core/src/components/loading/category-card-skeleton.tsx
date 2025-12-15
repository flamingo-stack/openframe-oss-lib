import React from 'react'
import { cn } from "../../utils/cn"
import { UnifiedSkeleton, TextSkeleton } from './unified-skeleton'

interface CategoryCardSkeletonProps {
  className?: string
}

export function CategoryCardSkeleton({ className }: CategoryCardSkeletonProps) {
  return (
    <article
      className={cn(
        'bg-[#1A1A1A] border border-[#424242] rounded-[12px] p-8 flex flex-col min-w-0 box-border',
        className,
      )}
      role="status"
      aria-label="Loading category card"
    >
      {/* Icons row */}
      <div className="flex gap-6 mb-8 justify-center items-center">
        {Array.from({ length: 10 }).map((_, i) => (
          <UnifiedSkeleton
            key={i}
            variant="circular"
            className="w-10 h-10 flex-shrink-0"
            aria-label="Loading icon"
          />
        ))}
      </div>

      {/* Text block */}
      <div className="flex-1 flex flex-col space-y-3">
        <TextSkeleton.Heading className="w-3/4" />
        <TextSkeleton.Body className="w-1/2" />
        <TextSkeleton.Body className="w-full" />
      </div>

      {/* Arrow button placeholder */}
      <div className="mt-4 flex justify-end">
        <UnifiedSkeleton className="w-12 h-12 rounded-[6px]" aria-label="Loading button" />
      </div>
    </article>
  )
} 