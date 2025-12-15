'use client'

import React from 'react'
import { cn } from '../../utils/cn'

export interface ContentLoaderProps {
  /**
   * The type of content being loaded
   */
  variant?: 'card' | 'form' | 'detail' | 'list'
  /**
   * Number of items to show in the skeleton
   */
  items?: number
  /**
   * Show a title skeleton
   */
  showTitle?: boolean
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Container CSS classes
   */
  containerClassName?: string
}

/**
 * Unified content loader component that replaces duplicate loading patterns
 * Uses ODS design tokens for consistent theming
 */
export function ContentLoader({
  variant = 'card',
  items = 4,
  showTitle = true,
  className,
  containerClassName
}: ContentLoaderProps) {
  const renderCardSkeleton = () => (
    <div className="animate-pulse">
      {showTitle && (
        <div className="h-8 w-64 bg-bg-surface rounded mb-6" />
      )}
      <div className="bg-bg-card border border-border-primary rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i}>
              <div className="h-4 w-20 bg-bg-surface rounded mb-2" />
              <div className="h-6 w-32 bg-bg-surface rounded" />
            </div>
          ))}
        </div>
        <div className="border-t border-border-primary pt-4">
          <div className="h-4 w-64 bg-bg-surface rounded" />
        </div>
      </div>
    </div>
  )

  const renderFormSkeleton = () => (
    <div className="animate-pulse">
      {showTitle && (
        <div className="h-8 bg-bg-card rounded w-64 mb-6" />
      )}
      <div className="bg-bg-card rounded-lg p-6">
        <div className="space-y-4">
          {Array.from({ length: items }).map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-bg-surface rounded w-32 mb-2" />
              <div className="h-10 bg-bg-surface rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderDetailSkeleton = () => (
    <div className="animate-pulse">
      {showTitle && (
        <div className="h-8 w-64 bg-bg-surface rounded mb-6" />
      )}
      <div className="bg-bg-card border border-border-primary rounded-lg p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="h-64 bg-bg-surface rounded mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 bg-bg-surface rounded" />
              ))}
            </div>
          </div>
          <div>
            <div className="h-32 bg-bg-surface rounded mb-4" />
            <div className="space-y-2">
              {Array.from({ length: items }).map((_, i) => (
                <div key={i} className="h-3 bg-bg-surface rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderListSkeleton = () => (
    <div className="animate-pulse space-y-3">
      {showTitle && (
        <div className="h-8 w-64 bg-bg-surface rounded mb-6" />
      )}
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="bg-bg-card border border-border-primary rounded-lg p-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-bg-surface rounded" />
            <div className="flex-1">
              <div className="h-4 bg-bg-surface rounded w-3/4 mb-2" />
              <div className="h-3 bg-bg-surface rounded w-1/2" />
            </div>
            <div className="h-8 w-20 bg-bg-surface rounded" />
          </div>
        </div>
      ))}
    </div>
  )

  const renderSkeleton = () => {
    switch (variant) {
      case 'form':
        return renderFormSkeleton()
      case 'detail':
        return renderDetailSkeleton()
      case 'list':
        return renderListSkeleton()
      case 'card':
      default:
        return renderCardSkeleton()
    }
  }

  return (
    <div className={cn('p-6', containerClassName)}>
      <div className={cn(className)}>
        {renderSkeleton()}
      </div>
    </div>
  )
}

// Export individual skeleton variants for specific use cases
export const CardLoader = (props: Omit<ContentLoaderProps, 'variant'>) => 
  <ContentLoader {...props} variant="card" />

export const FormLoader = (props: Omit<ContentLoaderProps, 'variant'>) => 
  <ContentLoader {...props} variant="form" />

export const DetailLoader = (props: Omit<ContentLoaderProps, 'variant'>) => 
  <ContentLoader {...props} variant="detail" />

export const ListLoader = (props: Omit<ContentLoaderProps, 'variant'>) => 
  <ContentLoader {...props} variant="list" />
