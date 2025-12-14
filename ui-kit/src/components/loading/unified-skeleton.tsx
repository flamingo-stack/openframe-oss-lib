import type React from "react"
import { cn } from "../../utils/cn"

interface UnifiedSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
  variant?: 'default' | 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  /**
   * Disable animation for users who prefer reduced motion
   */
  animate?: boolean
  /**
   * Accessibility label for screen readers
   */
  'aria-label'?: string
}

/**
 * UnifiedSkeleton Component
 * 
 * Base skeleton component with consistent styling across the application.
 * 
 * Design Specifications:
 * - Color: #2A2A2A base with #3A3A3A pulse highlight
 * - Animation: 1.5s pulse duration, ease-in-out timing
 * - Responsive: Mobile-first approach with proper scaling
 * - Accessibility: ARIA labels and reduced motion support
 * 
 * @param variant - Shape variant: default (rounded), text (rounded-sm), circular, rectangular
 * @param width - Custom width (defaults to full width)
 * @param height - Custom height (defaults to auto based on variant)
 * @param animate - Enable/disable animation (respects prefers-reduced-motion)
 * @param aria-label - Accessibility label for screen readers
 */
export function UnifiedSkeleton({
  className,
  variant = 'default',
  width,
  height,
  animate = true,
  'aria-label': ariaLabel,
  ...props
}: UnifiedSkeletonProps) {
  const baseClasses = "bg-[#2A2A2A]"
  
  const variantClasses = {
    default: "rounded-md",
    text: "rounded-sm",
    circular: "rounded-full",
    rectangular: "rounded-none"
  }
  
  const defaultHeights = {
    default: "h-4",
    text: "h-4", 
    circular: "h-12 w-12",
    rectangular: "h-4"
  }
  
  const animationClasses = animate 
    ? "animate-pulse motion-reduce:animate-none" 
    : ""
  
  const style: React.CSSProperties = {
    width: width,
    height: height,
  }
  
  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        !height && !style.height && defaultHeights[variant],
        !width && !style.width && variant !== 'circular' && "w-full",
        animationClasses,
        className
      )}
      style={style}
      role="status"
      aria-label={ariaLabel || "Loading content"}
      {...props}
    />
  )
}

/**
 * Text skeleton variants for consistent typography loading
 */
export const TextSkeleton = {
  /**
   * Large heading skeleton (h1, h2)
   */
  Heading: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="text" 
      className={cn("h-8 md:h-10 lg:h-12", className)} 
      aria-label="Loading heading"
      {...props} 
    />
  ),
  
  /**
   * Medium heading skeleton (h3, h4)
   */
  Subheading: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="text" 
      className={cn("h-6 md:h-7 lg:h-8", className)} 
      aria-label="Loading subheading"
      {...props} 
    />
  ),
  
  /**
   * Body text skeleton
   */
  Body: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="text" 
      className={cn("h-4 md:h-5", className)} 
      aria-label="Loading text"
      {...props} 
    />
  ),
  
  /**
   * Small text skeleton (captions, metadata)
   */
  Caption: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="text" 
      className={cn("h-3 md:h-4", className)} 
      aria-label="Loading caption"
      {...props} 
    />
  ),
}

/**
 * Interactive element skeletons
 */
export const InteractiveSkeleton = {
  /**
   * Button skeleton with proper touch targets
   */
  Button: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="default" 
      className={cn("h-10 md:h-12 w-32 md:w-40", className)} 
      aria-label="Loading button"
      {...props} 
    />
  ),
  
  /**
   * Input field skeleton
   */
  Input: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="default" 
      className={cn("h-10 md:h-12 w-full", className)} 
      aria-label="Loading input field"
      {...props} 
    />
  ),
  
  /**
   * Filter chip skeleton
   */
  Chip: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="default" 
      className={cn("h-8 w-20 rounded-full", className)} 
      aria-label="Loading filter"
      {...props} 
    />
  ),
}

/**
 * Media skeletons for images and icons
 */
export const MediaSkeleton = {
  /**
   * Avatar/profile image skeleton
   */
  Avatar: ({ size = 'md', className, ...props }: Omit<UnifiedSkeletonProps, 'variant'> & { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: "h-8 w-8",
      md: "h-12 w-12", 
      lg: "h-16 w-16"
    }
    
    return (
      <UnifiedSkeleton 
        variant="circular" 
        className={cn(sizeClasses[size], className)} 
        aria-label="Loading profile image"
        {...props} 
      />
    )
  },
  
  /**
   * Card image skeleton (16:9 aspect ratio)
   */
  CardImage: ({ className, ...props }: Omit<UnifiedSkeletonProps, 'variant'>) => (
    <UnifiedSkeleton 
      variant="default" 
      className={cn("aspect-[16/9] w-full", className)} 
      aria-label="Loading image"
      {...props} 
    />
  ),
  
  /**
   * Icon skeleton
   */
  Icon: ({ size = 'md', className, ...props }: Omit<UnifiedSkeletonProps, 'variant'> & { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-6 w-6",
      lg: "h-8 w-8"
    }
    
    return (
      <UnifiedSkeleton 
        variant="default" 
        className={cn(sizeClasses[size], className)} 
        aria-label="Loading icon"
        {...props} 
    />
    )
  },
} 