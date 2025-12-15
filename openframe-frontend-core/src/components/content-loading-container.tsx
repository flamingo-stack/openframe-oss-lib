"use client"

import { ReactNode } from "react"
import { cn } from "../utils/cn"

interface ContentLoadingContainerProps {
  /**
   * Whether the content is currently loading
   */
  isLoading: boolean
  /**
   * The actual content to display when not loading
   */
  children: ReactNode
  /**
   * The skeleton component to show during loading
   */
  skeletonComponent: ReactNode
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Minimum height to prevent layout jumps
   */
  minHeight?: string
  /**
   * Loading overlay opacity (0-1)
   */
  loadingOpacity?: number
  /**
   * Transition duration in milliseconds
   */
  transitionDuration?: number
}

/**
 * ContentLoadingContainer
 * 
 * A unified loading container that wraps card grids and manages loading states 
 * while keeping UI controls persistent. This component:
 * 
 * - Shows skeleton loading only in content area
 * - Maintains consistent layout dimensions during loading
 * - Provides smooth transitions between loading and loaded states
 * - Prevents layout jumps by preserving container height
 * - Supports customizable skeleton components for different content types
 * 
 * Usage:
 * ```tsx
 * <ContentLoadingContainer
 *   isLoading={isLoadingVendors}
 *   skeletonComponent={<CardSkeletonGrid variant="vendor" count={12} />}
 *   minHeight="min-h-[800px]"
 * >
 *   <VendorGrid vendors={vendors} />
 * </ContentLoadingContainer>
 * ```
 */
export function ContentLoadingContainer({
  isLoading,
  children,
  skeletonComponent,
  className,
  minHeight = "min-h-[300px] md:min-h-[800px]",
  loadingOpacity = 1,
  transitionDuration = 300,
}: ContentLoadingContainerProps) {
  return (
    <div 
      className={cn(
        "relative w-full transition-all ease-in-out",
        minHeight,
        className
      )}
      style={{
        transitionDuration: `${transitionDuration}ms`
      }}
      role="region"
      aria-label={isLoading ? "Loading content" : "Content loaded"}
      aria-live="polite"
    >
      {/* Loading Skeleton Overlay */}
      {isLoading && (
        <div 
          className="absolute inset-0 z-10 bg-[#161616]"
          style={{ 
            opacity: loadingOpacity,
            transition: `opacity ${transitionDuration}ms ease-in-out`
          }}
          role="status"
          aria-label="Loading content"
        >
          {skeletonComponent}
        </div>
      )}

      {/* Actual Content */}
      <div 
        className={cn(
          "relative transition-opacity ease-in-out",
          isLoading && "opacity-0"
        )}
        style={{
          transitionDuration: `${transitionDuration}ms`
        }}
        aria-hidden={isLoading}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Hook for managing content loading states with common patterns
 */
export function useContentLoading(isLoading: boolean) {
  const containerProps = {
    'aria-busy': isLoading,
    'data-loading': isLoading
  }

  const getSkeletonCount = (contentType: 'vendor' | 'blog') => {
    return contentType === 'vendor' ? 12 : 6
  }

  const getMinHeight = (contentType: 'vendor' | 'blog') => {
    // Vendor cards are typically taller, need more space
    return contentType === 'vendor' 
      ? "min-h-[400px] md:min-h-[900px]" 
      : "min-h-[300px] md:min-h-[800px]"
  }

  return {
    containerProps,
    getSkeletonCount,
    getMinHeight
  }
} 