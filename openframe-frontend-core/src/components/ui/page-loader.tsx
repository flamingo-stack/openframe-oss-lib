'use client'

import React from 'react'
import { cn } from '../../utils/cn'
import { OpenFrameLogo } from '../icons/openframe-logo'

export interface PageLoaderProps {
  /**
   * Main loading text
   */
  title?: string
  /**
   * Secondary description text
   */
  description?: string
  /**
   * Additional CSS classes for the container
   */
  className?: string
  /**
   * Show the loader icon
   */
  showIcon?: boolean
}

/**
 * Full page loader component
 * Used for loading states that take up the full viewport
 */
export function PageLoader({
  title = 'Loading',
  description = 'Getting your data ready',
  className,
  showIcon = true
}: PageLoaderProps) {
  return (
    <div 
      className={cn(
        'bg-ods-bg flex flex-col items-center justify-center min-h-screen w-full',
        className
      )}
    >
      <div className="flex flex-col items-center gap-6 p-6">
        {showIcon && (
          <div className="relative w-6 h-6">
            <OpenFrameLogo 
              className="w-6 h-6 animate-pulse text-ods-accent"
              upperPathColor="currentColor"
              lowerPathColor="var(--ods-text-tertiary)"
            />
          </div>
        )}
        <div className="flex flex-col items-center text-center">
          <p className="text-lg font-medium text-ods-text-tertiary leading-6">
            {title}
          </p>
          <p className="text-sm font-medium text-ods-text-tertiary opacity-70 leading-5 mt-1">
            {description}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact version of the page loader for smaller containers
 */
export function CompactPageLoader({
  title = 'Loading',
  description,
  className,
  showIcon = true
}: PageLoaderProps) {
  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center p-12',
        className
      )}
    >
      <div className="flex flex-col items-center gap-4">
        {showIcon && (
          <div className="relative w-6 h-6">
            <OpenFrameLogo 
              className="w-6 h-6 animate-pulse text-ods-accent"
              upperPathColor="currentColor"
              lowerPathColor="var(--ods-text-tertiary)"
            />
          </div>
        )}
        <div className="flex flex-col items-center text-center">
          <p className="text-base font-medium text-ods-text-tertiary">
            {title}
          </p>
          {description && (
            <p className="text-sm text-ods-text-tertiary opacity-70 mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}