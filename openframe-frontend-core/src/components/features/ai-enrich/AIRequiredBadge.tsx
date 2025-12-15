'use client'

import React from 'react'
import { SparklesIcon } from '../../icons/sparkles-icon'
import { cn } from '../../../utils/cn'

export interface AIRequiredBadgeProps {
  className?: string
  /** Show a smaller inline variant */
  size?: 'sm' | 'md'
}

/**
 * Badge component to indicate a field is required for AI enrichment.
 * Uses ODS cyan color with sparkles icon.
 */
export const AIRequiredBadge: React.FC<AIRequiredBadgeProps> = ({
  className,
  size = 'sm'
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-full',
        'bg-[--ods-flamingo-cyan-base]/10 text-[--ods-flamingo-cyan-base]',
        size === 'sm' && 'ml-2 px-2 py-0.5 text-xs',
        size === 'md' && 'ml-2 px-2.5 py-1 text-sm',
        className
      )}
    >
      <SparklesIcon size={size === 'sm' ? 12 : 14} color="var(--ods-flamingo-cyan-base)" />
      <span className="font-['DM_Sans']">AI-required</span>
    </span>
  )
}
