'use client'

import React from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, Home } from 'lucide-react'
import { cn } from '../../utils/cn'
import { Button } from './button'

export interface CursorPaginationProps {
  hasNextPage: boolean
  hasPreviousPage?: boolean
  isFirstPage?: boolean
  startCursor?: string | null
  endCursor?: string | null
  
  currentCount?: number
  totalCount?: number | null
  itemName?: string
  
  loading?: boolean
  
  onNext?: (cursor: string) => void
  onPrevious?: (cursor: string) => void
  onReset?: () => void
  
  className?: string
  showInfo?: boolean
  compact?: boolean
  resetButtonLabel?: string
  resetButtonIcon?: 'home' | 'rotate'
}

export function CursorPagination({
  hasNextPage,
  hasPreviousPage,
  isFirstPage = true,
  startCursor,
  endCursor,
  currentCount,
  totalCount,
  itemName = 'items',
  loading = false,
  onNext,
  onPrevious,
  onReset,
  className,
  showInfo = true,
  compact = false,
  resetButtonLabel = 'First',
  resetButtonIcon = 'home'
}: CursorPaginationProps) {
  const handleNext = () => {
    if (hasNextPage && endCursor && onNext) {
      onNext(endCursor)
    }
  }

  const handlePrevious = () => {
    if (hasPreviousPage && startCursor && onPrevious) {
      onPrevious(startCursor)
    }
  }
  
  const handleReset = () => {
    if (onReset) {
      onReset()
    }
  }
  
  const ResetIcon = resetButtonIcon === 'rotate' ? RotateCcw : Home

  const getDisplayText = () => {
    if (!showInfo || !currentCount) return null

    if (totalCount) {
      return `Showing ${currentCount} of ${totalCount} ${itemName}`
    } else if (hasNextPage) {
      return `Showing ${currentCount}+ ${itemName}`
    } else {
      return `Showing ${currentCount} ${itemName}`
    }
  }

  const displayText = getDisplayText()

  return (
    <div 
      className={cn(
        'flex items-center justify-between gap-4',
        compact ? 'py-2' : 'py-3',
        className
      )}
    >
      {/* Info text */}
      {showInfo && (
        <div className="text-sm text-[#888888]">
          {displayText || <span>&nbsp;</span>}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-2">
        {onReset ? (
          <Button
            variant="outline"
            size={compact ? 'sm' : 'default'}
            onClick={handleReset}
            disabled={isFirstPage || loading}
            className={cn(
              compact && 'h-8 px-3'
            )}
            leftIcon={<ResetIcon className="h-4 w-4" />}
            aria-label="Go to first page"
          >
            <span className={compact ? 'hidden sm:inline' : ''}>{resetButtonLabel}</span>
          </Button>
        ) : (
          hasPreviousPage !== undefined && onPrevious && (
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              onClick={handlePrevious}
              disabled={!hasPreviousPage || loading}
              className={cn(
                compact && 'h-8 px-3'
              )}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
              aria-label="Go to previous page"
            >
              <span className={compact ? 'hidden sm:inline' : ''}>Previous</span>
            </Button>
          )
        )}

        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={handleNext}
          disabled={!hasNextPage || loading}
          className={cn(
            compact && 'h-8 px-3'
          )}
          rightIcon={<ChevronRight className="h-4 w-4" />}
          aria-label="Go to next page"
        >
          <span className={compact ? 'hidden sm:inline' : ''}>Next</span>
        </Button>
      </div>
    </div>
  )
}

export function CursorPaginationSimple({
  hasNextPage,
  hasPreviousPage,
  isFirstPage = true,
  onNext,
  onPrevious,
  onReset,
  loading = false,
  className
}: Pick<CursorPaginationProps, 'hasNextPage' | 'hasPreviousPage' | 'isFirstPage' | 'onNext' | 'onPrevious' | 'onReset' | 'loading' | 'className'>) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {onReset ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onReset}
          disabled={isFirstPage || loading}
          className="h-8 w-8"
          leftIcon={<Home className="h-4 w-4" />}
          aria-label="First"
        />
      ) : (
        hasPreviousPage !== undefined && onPrevious && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onPrevious?.('')}
            disabled={!hasPreviousPage || loading}
            className="h-8 w-8"
            leftIcon={<ChevronLeft className="h-4 w-4" />}
            aria-label="Previous"
          />
        )
      )}
      
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onNext?.('')}
        disabled={!hasNextPage || loading}
        className="h-8 w-8"
        rightIcon={<ChevronRight className="h-4 w-4" />}
        aria-label="Next"
      />
    </div>
  )
}