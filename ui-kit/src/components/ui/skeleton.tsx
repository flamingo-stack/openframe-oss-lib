"use client"

import * as React from 'react'
import { cn } from "../../utils/cn"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "animate-pulse rounded-md bg-ods-border",
          className
        )}
        {...props}
      />
    )
  }
)
Skeleton.displayName = 'Skeleton'

interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
  className?: string
}

const SkeletonText = React.forwardRef<HTMLDivElement, SkeletonTextProps>(
  ({ lines = 1, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            className={cn(
              "h-4",
              i === lines - 1 && lines > 1 && "w-3/4" // Last line shorter for multi-line
            )} 
          />
        ))}
      </div>
    )
  }
)
SkeletonText.displayName = 'SkeletonText'

interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  showImage?: boolean
  className?: string
}

const SkeletonCard = React.forwardRef<HTMLDivElement, SkeletonCardProps>(
  ({ showImage = false, className, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(
          "rounded-lg border border-ods-border overflow-hidden",
          className
        )}
        {...props}
      >
        {showImage && (
          <Skeleton className="h-48 w-full" />
        )}
        <div className="p-6">
          <Skeleton className="h-6 w-3/4 mb-4" />
          <SkeletonText lines={3} />
        </div>
      </div>
    )
  }
)
SkeletonCard.displayName = 'SkeletonCard'

interface SkeletonGridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: number
  items?: number
  showImages?: boolean
  className?: string
}

const SkeletonGrid = React.forwardRef<HTMLDivElement, SkeletonGridProps>(
  ({ columns = 3, items = 6, showImages = false, className, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(
          `grid grid-cols-1 gap-6`,
          columns === 2 && "md:grid-cols-2",
          columns === 3 && "md:grid-cols-3",
          columns === 4 && "md:grid-cols-4",
          className
        )}
        {...props}
      >
        {Array.from({ length: items }).map((_, i) => (
          <SkeletonCard key={i} showImage={showImages} />
        ))}
      </div>
    )
  }
)
SkeletonGrid.displayName = 'SkeletonGrid'

interface SkeletonButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

const SkeletonButton = React.forwardRef<HTMLDivElement, SkeletonButtonProps>(
  ({ size = 'default', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'h-8 w-20',
      default: 'h-10 w-32',
      lg: 'h-12 w-40'
    }
    
    return (
      <Skeleton 
        ref={ref}
        className={cn(
          "rounded-lg",
          sizeClasses[size],
          className
        )}
        {...props}
      />
    )
  }
)
SkeletonButton.displayName = 'SkeletonButton'

interface SkeletonHeadingProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3 | 4 | 5 | 6
  className?: string
}

const SkeletonHeading = React.forwardRef<HTMLDivElement, SkeletonHeadingProps>(
  ({ level = 1, className, ...props }, ref) => {
    const heightClasses = {
      1: 'h-12',
      2: 'h-10',
      3: 'h-8',
      4: 'h-7',
      5: 'h-6',
      6: 'h-5'
    }
    
    return (
      <Skeleton 
        ref={ref}
        className={cn(
          heightClasses[level],
          "w-3/4",
          className
        )}
        {...props}
      />
    )
  }
)
SkeletonHeading.displayName = 'SkeletonHeading'

interface SkeletonListProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: number
  className?: string
}

const SkeletonList = React.forwardRef<HTMLDivElement, SkeletonListProps>(
  ({ items = 5, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-3", className)} {...props}>
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/3 mb-1" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }
)
SkeletonList.displayName = 'SkeletonList'

interface SkeletonNavigationProps extends React.HTMLAttributes<HTMLDivElement> {
  items?: number
  className?: string
}

const SkeletonNavigation = React.forwardRef<HTMLDivElement, SkeletonNavigationProps>(
  ({ items = 6, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex items-center gap-6", className)} {...props}>
        {Array.from({ length: items }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-20" />
        ))}
      </div>
    )
  }
)
SkeletonNavigation.displayName = 'SkeletonNavigation'

export { 
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonGrid,
  SkeletonButton,
  SkeletonHeading,
  SkeletonList,
  SkeletonNavigation
}