"use client"

import { ReactNode } from "react"
import { cn } from "../utils/cn"

interface PersistentPaginationProps {
  /**
   * Whether pagination is currently in a loading state
   */
  isLoading: boolean
  /**
   * The pagination component
   */
  children: ReactNode
  /**
   * Current page number
   */
  currentPage: number
  /**
   * Total number of pages
   */
  totalPages: number
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
   * Whether to show loading state in pagination
   */
  showLoadingState?: boolean
}

/**
 * PersistentPagination
 * 
 * A wrapper component that keeps pagination visible during loading states
 * but provides visual feedback that it's temporarily disabled.
 * 
 * Features:
 * - Maintains pagination visibility during content loading
 * - Disables interaction but preserves layout
 * - Shows current page context even when loading
 * - Provides accessibility support for loading states
 * - Smooth transitions between enabled/disabled states
 * 
 * Usage:
 * ```tsx
 * <PersistentPagination
 *   isLoading={isLoadingVendors}
 *   currentPage={currentPage}
 *   totalPages={totalPages}
 * >
 *   <Pagination currentPage={currentPage} totalPages={totalPages} />
 * </PersistentPagination>
 * ```
 */
export function PersistentPagination({
  isLoading,
  children,
  currentPage,
  totalPages,
  className,
  disabledOpacity = 0.5,
  transitionDuration = 300,
  showLoadingState = true,
}: PersistentPaginationProps) {
  // ALWAYS show pagination for predictable layout - just gray it out when not needed
  // Removed condition that hides pagination completely

  return (
    <div 
      className={cn(
        "relative transition-all ease-in-out",
        "flex justify-center items-center",
        isLoading && "pointer-events-none",
        className
      )}
      style={{
        opacity: isLoading ? disabledOpacity : 1,
        transitionDuration: `${transitionDuration}ms`
      }}
      role="navigation"
      aria-label="Pagination"
      aria-busy={isLoading}
      data-loading={isLoading}
    >
      {/* Loading state announcement for screen readers */}
      {isLoading && (
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite"
        >
          Pagination temporarily disabled while loading page {currentPage} of {totalPages}
        </div>
      )}

      {/* Pagination controls with disabled state */}
      <div 
        className={cn(
          "relative transition-all ease-in-out",
          isLoading && "cursor-not-allowed"
        )}
        style={{
          transitionDuration: `${transitionDuration}ms`
        }}
        aria-hidden={isLoading}
      >
        {children}
      </div>

      {/* REMOVED: Loading overlay - only card skeletons should show during loading */}
    </div>
  )
}

/**
 * Hook for managing pagination loading states
 */
export function usePaginationLoading(
  isLoading: boolean,
  currentPage: number,
  totalPages: number
) {
  const shouldShowPagination = totalPages > 1 || isLoading
  
  const paginationProps = {
    'aria-busy': isLoading,
    'data-loading': isLoading,
    'data-current-page': currentPage,
    'data-total-pages': totalPages,
  }

  const getLoadingMessage = () => {
    if (isLoading) {
      return `Loading page ${currentPage} of ${totalPages}`
    }
    return `Page ${currentPage} of ${totalPages}`
  }

  return {
    shouldShowPagination,
    paginationProps,
    getLoadingMessage,
  }
}

/**
 * Enhanced pagination component that includes loading states
 */
interface PersistentPaginationWrapperProps {
  isLoading: boolean
  currentPage: number
  totalPages: number
  onPageChange?: (page: number) => void
  className?: string
  variant?: 'vendor' | 'blog'
}

export function PersistentPaginationWrapper({
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  className,
  variant = 'vendor'
}: PersistentPaginationWrapperProps) {
  const { getLoadingMessage } = usePaginationLoading(
    isLoading,
    currentPage,
    totalPages
  )

  // ALWAYS show pagination for predictable layout
  // For no results (totalPages = 0), show grayed out pagination
  const hasResults = totalPages > 0
  const displayTotalPages = hasResults ? totalPages : 1
  const displayCurrentPage = hasResults ? currentPage : 1
  // Only disable during loading, but still show when no results (just grayed out)
  const isPaginationDisabled = isLoading
  const hasNoResults = !hasResults && !isLoading

  // Use UnifiedPagination directly from ui-kit instead of importing from consuming apps
  // Both Pagination and BlogPagination in multi-platform-hub are just wrappers around UnifiedPagination
  const PaginationComponent = require('./unified-pagination').UnifiedPagination

  return (
    <div 
      className={cn(
        "relative transition-all ease-in-out flex justify-center items-center",
        (isPaginationDisabled || hasNoResults) && "pointer-events-none",
        className
      )}
      style={{
        opacity: isPaginationDisabled ? 0.3 : hasNoResults ? 0.5 : 1,
        transitionDuration: "300ms"
      }}
      role="navigation"
      aria-label="Pagination"
      aria-busy={isLoading}
      data-loading={isLoading}
      data-has-results={hasResults}
    >
      {/* Loading/no results state announcement for screen readers */}
      {(isLoading || !hasResults) && (
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite"
        >
          {isLoading 
            ? `Pagination temporarily disabled while loading page ${displayCurrentPage} of ${displayTotalPages}`
            : `No results available - pagination disabled`
          }
        </div>
      )}

      {/* Pagination controls with disabled state */}
      <div 
        className={cn(
          "relative transition-all ease-in-out",
          isPaginationDisabled && "cursor-not-allowed"
        )}
        style={{
          transitionDuration: "300ms"
        }}
        aria-hidden={isPaginationDisabled}
      >
        <PaginationComponent
          currentPage={displayCurrentPage}
          totalPages={displayTotalPages}
          onPageChange={hasResults ? onPageChange : () => {}} // Provide empty function instead of undefined
        />
      </div>

      {/* REMOVED: Loading overlays - only card skeletons should show during loading */}
    </div>
  )
} 