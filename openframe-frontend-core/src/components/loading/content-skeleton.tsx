import type React from "react"
import { cn } from "../../utils/cn"
import { UnifiedSkeleton, TextSkeleton, MediaSkeleton, InteractiveSkeleton } from "./unified-skeleton"

interface ContentSkeletonProps {
  className?: string
}

/**
 * Paragraph skeleton with varying line lengths for natural appearance
 */
export function ParagraphSkeleton({ 
  className,
  lines = 4 
}: ContentSkeletonProps & { lines?: number }) {
  const lineWidths = ['w-full', 'w-full', 'w-5/6', 'w-3/4', 'w-4/5', 'w-2/3']
  
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <TextSkeleton.Body 
          key={index}
          className={lineWidths[index % lineWidths.length]}
        />
      ))}
    </div>
  )
}

/**
 * List skeleton for navigation menus, categories, etc.
 */
export function ListSkeleton({ 
  className,
  items = 5,
  showIcons = false,
  showActions = false 
}: ContentSkeletonProps & { 
  items?: number
  showIcons?: boolean
  showActions?: boolean
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showIcons && <MediaSkeleton.Icon size="sm" />}
            <TextSkeleton.Body className="w-32 md:w-48" />
          </div>
          {showActions && (
            <div className="flex items-center gap-2">
              <TextSkeleton.Caption className="w-8" />
              <UnifiedSkeleton variant="default" className="w-4 h-4" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Table skeleton for data displays
 */
export function TableSkeleton({ 
  className,
  rows = 5,
  columns = 4 
}: ContentSkeletonProps & { 
  rows?: number
  columns?: number
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Table header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <TextSkeleton.Subheading key={index} className="w-3/4" />
        ))}
      </div>
      
      {/* Table rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={rowIndex} 
            className="grid gap-4 py-2 border-b border-ods-divider"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TextSkeleton.Body key={colIndex} className="w-2/3" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Form skeleton for input fields and form layouts
 */
export function FormSkeleton({ 
  className,
  fields = 4 
}: ContentSkeletonProps & { fields?: number }) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <TextSkeleton.Body className="w-24" />
          <InteractiveSkeleton.Input />
          {index % 3 === 0 && (
            <TextSkeleton.Caption className="w-48" />
          )}
        </div>
      ))}
      
      <div className="flex gap-4 pt-4">
        <InteractiveSkeleton.Button />
        <InteractiveSkeleton.Button className="bg-ods-border" />
      </div>
    </div>
  )
}

/**
 * Navigation menu skeleton
 */
export function NavigationSkeleton({ 
  className,
  items = 6,
  horizontal = true 
}: ContentSkeletonProps & { 
  items?: number
  horizontal?: boolean
}) {
  return (
    <nav 
      className={cn(
        "flex gap-4 md:gap-6",
        !horizontal && "flex-col",
        className
      )}
      role="status"
      aria-label="Loading navigation"
    >
      {Array.from({ length: items }).map((_, index) => (
        <TextSkeleton.Body key={index} className="w-16 md:w-20" />
      ))}
    </nav>
  )
}

/**
 * Profile/user info skeleton
 */
export function ProfileSkeleton({ 
  className,
  showBio = true,
  showStats = true 
}: ContentSkeletonProps & { 
  showBio?: boolean
  showStats?: boolean
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Avatar and basic info */}
      <div className="flex items-start gap-4">
        <MediaSkeleton.Avatar size="lg" />
        <div className="flex-1 space-y-2">
          <TextSkeleton.Subheading className="w-1/2" />
          <TextSkeleton.Caption className="w-1/3" />
          <TextSkeleton.Body className="w-2/3" />
        </div>
      </div>

      {/* Bio/description */}
      {showBio && (
        <div className="space-y-2">
          <TextSkeleton.Body className="w-full" />
          <TextSkeleton.Body className="w-4/5" />
          <TextSkeleton.Body className="w-3/4" />
        </div>
      )}

      {/* Stats */}
      {showStats && (
        <div className="flex gap-6">
          <div className="text-center">
            <TextSkeleton.Subheading className="w-8 mx-auto" />
            <TextSkeleton.Caption className="w-12 mx-auto" />
          </div>
          <div className="text-center">
            <TextSkeleton.Subheading className="w-8 mx-auto" />
            <TextSkeleton.Caption className="w-16 mx-auto" />
          </div>
          <div className="text-center">
            <TextSkeleton.Subheading className="w-8 mx-auto" />
            <TextSkeleton.Caption className="w-14 mx-auto" />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Comment/review skeleton for user-generated content
 */
export function CommentSkeleton({ 
  className,
  showRating = false,
  showReplies = false 
}: ContentSkeletonProps & { 
  showRating?: boolean
  showReplies?: boolean
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* User info */}
      <div className="flex items-center gap-3">
        <MediaSkeleton.Avatar size="sm" />
        <div className="flex-1 flex items-center gap-4">
          <TextSkeleton.Body className="w-24" />
          <TextSkeleton.Caption className="w-16" />
          {showRating && (
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <MediaSkeleton.Icon key={i} size="sm" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment content */}
      <div className="ml-11 space-y-2">
        <TextSkeleton.Body className="w-full" />
        <TextSkeleton.Body className="w-3/4" />
        <TextSkeleton.Body className="w-1/2" />
      </div>

      {/* Actions */}
      <div className="ml-11 flex gap-4">
        <TextSkeleton.Caption className="w-12" />
        <TextSkeleton.Caption className="w-16" />
        <TextSkeleton.Caption className="w-8" />
      </div>

      {/* Replies */}
      {showReplies && (
        <div className="ml-11 pl-4 border-l border-ods-divider space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-3">
                <MediaSkeleton.Avatar size="sm" />
                <TextSkeleton.Body className="w-20" />
                <TextSkeleton.Caption className="w-12" />
              </div>
              <div className="ml-11">
                <TextSkeleton.Body className="w-full" />
                <TextSkeleton.Body className="w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Feature list skeleton for product features, specifications, etc.
 */
export function FeatureListSkeleton({ 
  className,
  features = 6,
  showIcons = true,
  grouped = false 
}: ContentSkeletonProps & { 
  features?: number
  showIcons?: boolean
  grouped?: boolean
}) {
  if (grouped) {
    // Grouped features with sections
    return (
      <div className={cn("space-y-6", className)}>
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            <TextSkeleton.Subheading className="w-1/3" />
            <div className="space-y-2">
              {Array.from({ length: features / 3 }).map((_, featureIndex) => (
                <div key={featureIndex} className="flex items-center gap-3">
                  {showIcons && <MediaSkeleton.Icon size="sm" />}
                  <TextSkeleton.Body className="w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Simple feature list
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: features }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          {showIcons && <MediaSkeleton.Icon size="sm" />}
          <TextSkeleton.Body className="w-2/3" />
        </div>
      ))}
    </div>
  )
}

/**
 * Timeline/activity skeleton
 */
export function TimelineSkeleton({ 
  className,
  items = 5 
}: ContentSkeletonProps & { items?: number }) {
  return (
    <div className={cn("space-y-6", className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <MediaSkeleton.Icon size="sm" />
            {index < items - 1 && (
              <div className="w-px h-12 bg-ods-border mt-2" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <TextSkeleton.Body className="w-1/3" />
              <TextSkeleton.Caption className="w-16" />
            </div>
            <TextSkeleton.Body className="w-full" />
            <TextSkeleton.Body className="w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Pricing/plan skeleton
 */
export function PricingSkeleton({ 
  className,
  plans = 3 
}: ContentSkeletonProps & { plans?: number }) {
  return (
    <div className={cn(
      "grid gap-6",
      plans === 2 && "grid-cols-1 md:grid-cols-2",
      plans === 3 && "grid-cols-1 md:grid-cols-3",
      plans === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
      className
    )}>
      {Array.from({ length: plans }).map((_, index) => (
        <div key={index} className="bg-ods-card border border-ods-border rounded-lg p-6">
          <div className="space-y-4">
            {/* Plan name */}
            <TextSkeleton.Subheading className="w-1/2" />
            
            {/* Price */}
            <div className="space-y-1">
              <TextSkeleton.Heading className="w-1/3" />
              <TextSkeleton.Caption className="w-1/4" />
            </div>

            {/* Features */}
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, featureIndex) => (
                <div key={featureIndex} className="flex items-center gap-2">
                  <MediaSkeleton.Icon size="sm" />
                  <TextSkeleton.Body className="w-3/4" />
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <InteractiveSkeleton.Button className="w-full" />
          </div>
        </div>
      ))}
    </div>
  )
} 