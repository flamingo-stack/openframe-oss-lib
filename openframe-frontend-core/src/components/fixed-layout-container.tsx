"use client"

import React from 'react'
import { cn } from "../utils/cn"

interface FixedLayoutContainerProps {
  children: React.ReactNode
  className?: string
  /**
   * The type of content being displayed - affects the fixed height calculation
   */
  contentType: 'blog' | 'vendor'
  /**
   * Whether to show the pagination area (always visible for stable layout)
   */
  showPagination?: boolean
}

/**
 * Fixed Layout Container Component
 * 
 * Provides stable, predictable layout sizing to prevent screen jumping during
 * filtering, searching, and pagination. The container maintains consistent
 * positioning for search, filters, and pagination while only reloading the card area.
 * 
 * SIMPLIFIED VERSION: Just provides basic structure without forced heights
 */
export function FixedLayoutContainer({ 
  children, 
  className,
  contentType,
  showPagination = true
}: FixedLayoutContainerProps) {
  
  return (
    <div 
      className={cn(
        // Just basic layout - let content determine height naturally
        "bg-[#161616]",
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * Fixed Content Area Component
 * 
 * Container specifically for the card grid area that will be replaced
 * during loading states. Simplified to prevent layout issues.
 */
export function FixedContentArea({ 
  children, 
  className,
  contentType,
  isLoading = false 
}: {
  children: React.ReactNode
  className?: string
  contentType: 'blog' | 'vendor'
  isLoading?: boolean
}) {
  
  return (
    <div 
      className={cn(
        // Just basic styling - let content determine height
        "w-full",
        // Only minimal loading styling
        isLoading && "transition-opacity duration-300",
        className
      )}
      role={isLoading ? "status" : undefined}
      aria-label={isLoading ? `Loading ${contentType} content` : undefined}
    >
      {children}
    </div>
  )
}

/**
 * Stable Search and Filter Container
 * 
 * Simple wrapper for search and filter controls (no forced positioning)
 */
export function StableControlsContainer({ 
  children, 
  className 
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn(className)}>
      {children}
    </div>
  )
}

/**
 * Stable Pagination Container
 * 
 * Simple wrapper for pagination (no forced positioning)
 */
export function StablePaginationContainer({ 
  children, 
  className,
  disabled = false 
}: {
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <div 
      className={cn(
        // Only basic disabled state styling
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {children}
    </div>
  )
} 