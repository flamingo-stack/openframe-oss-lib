"use client"

import { ReactNode } from "react"
import { cn } from "../utils/cn"

interface PersistentFilterControlsProps {
  /**
   * Whether the filters are currently in a loading state
   */
  isLoading: boolean
  /**
   * The filter control components (search, sidebar, mobile dropdown)
   */
  children: ReactNode
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Disabled opacity (0-1)
   */
  disabledOpacity?: number
  /**
   * Transition duration in milliseconds
   */
  transitionDuration?: number
  /**
   * Whether to prevent pointer events during loading
   */
  preventInteraction?: boolean
}

/**
 * PersistentFilterControls
 * 
 * A wrapper component that keeps filter controls visible during loading states
 * but provides visual feedback that they are temporarily disabled.
 * 
 * Features:
 * - Reduces opacity and disables pointer events during loading
 * - Maintains layout and accessibility during loading states
 * - Provides smooth transitions between enabled/disabled states
 * - Preserves keyboard navigation and screen reader functionality
 * - Applies consistent disabled styling across all filter types
 * 
 * Usage:
 * ```tsx
 * <PersistentFilterControls isLoading={isLoadingVendors}>
 *   <SearchContainer />
 *   <CategoryFilterSidebar />
 *   <MobileDropdown />
 * </PersistentFilterControls>
 * ```
 */
export function PersistentFilterControls({
  isLoading,
  children,
  className,
  disabledOpacity = 0.6,
  transitionDuration = 300,
  preventInteraction = true,
}: PersistentFilterControlsProps) {
  return (
    <div 
      className={cn(
        "relative transition-all ease-in-out",
        isLoading && preventInteraction && "pointer-events-none",
        className
      )}
      style={{
        opacity: isLoading ? disabledOpacity : 1,
        transitionDuration: `${transitionDuration}ms`
      }}
      role="region"
      aria-label="Filter controls"
      aria-busy={isLoading}
      data-loading={isLoading}
    >
      {/* Loading indicator overlay for screen readers */}
      {isLoading && (
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite"
        >
          Filters temporarily disabled while loading content
        </div>
      )}

      {/* Filter controls with disabled state styling */}
      <div 
        className={cn(
          "transition-all ease-in-out",
          isLoading && "cursor-not-allowed"
        )}
        style={{
          transitionDuration: `${transitionDuration}ms`
        }}
      >
        {children}
      </div>

      {/* Visual loading indicator */}
      {isLoading && (
        <div 
          className="absolute top-2 right-2 z-10"
          role="status"
          aria-label="Loading filters"
        >
          <div className="w-4 h-4 border-2 border-ods-border border-t-[#FFC008] rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}

/**
 * Enhanced SearchContainer wrapper that integrates with persistent loading
 */
interface PersistentSearchContainerProps {
  isLoading: boolean
  children: ReactNode
  className?: string
}

export function PersistentSearchContainer({
  isLoading,
  children,
  className
}: PersistentSearchContainerProps) {
  return (
    <PersistentFilterControls 
      isLoading={isLoading}
      preventInteraction={false} // Keep search interactive during loading
      className={className}
    >
      {children}
    </PersistentFilterControls>
  )
}

/**
 * Enhanced sidebar wrapper for desktop filter controls
 */
interface PersistentSidebarProps {
  isLoading: boolean
  children: ReactNode
  className?: string
}

export function PersistentSidebar({
  isLoading,
  children,
  className
}: PersistentSidebarProps) {
  return (
    <PersistentFilterControls 
      isLoading={isLoading}
      disabledOpacity={0.5}
      className={cn("lg:sticky lg:top-20", className)}
    >
      {children}
    </PersistentFilterControls>
  )
}

/**
 * Enhanced mobile dropdown wrapper
 */
interface PersistentMobileDropdownProps {
  isLoading: boolean
  children: ReactNode
  className?: string
}

export function PersistentMobileDropdown({
  isLoading,
  children,
  className
}: PersistentMobileDropdownProps) {
  return (
    <PersistentFilterControls 
      isLoading={isLoading}
      disabledOpacity={0.7}
      className={cn("lg:hidden", className)}
    >
      {children}
    </PersistentFilterControls>
  )
} 