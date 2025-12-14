'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import { SparklesIcon } from '../../icons/sparkles-icon'
import { getConfidenceBorderClass, getConfidenceTextClass, getConfidenceLabel } from '../../../utils/confidence-helpers'

export type AIStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AIStatusIndicatorProps {
  status: AIStatus
  confidence?: number
  message?: string
  showConfidence?: boolean
  className?: string
}

const statusConfig = {
  idle: {
    color: 'text-ods-text-secondary',
    bgColor: 'bg-transparent',
    label: 'Ready',
  },
  loading: {
    color: 'text-[var(--ods-flamingo-cyan-base)]',
    bgColor: 'bg-[var(--ods-flamingo-cyan-base)]/10',
    label: 'Processing...',
  },
  success: {
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Enriched',
  },
  error: {
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Failed',
  },
}

export const AIStatusIndicator: React.FC<AIStatusIndicatorProps> = ({
  status,
  confidence,
  message,
  showConfidence = true,
  className,
}) => {
  const config = statusConfig[status]

  const displayText = message || config.label
  const confidenceLabel = showConfidence && confidence !== undefined
    ? `${getConfidenceLabel(confidence)} (${confidence}%)`
    : null

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg',
        config.bgColor,
        className
      )}
    >
      <SparklesIcon
        size={16}
        className={cn(
          status === 'loading' && 'animate-pulse',
          confidence !== undefined && status === 'success'
            ? getConfidenceTextClass(confidence)
            : config.color
        )}
      />
      <span
        className={cn(
          'text-sm font-medium',
          confidence !== undefined && status === 'success'
            ? getConfidenceTextClass(confidence)
            : config.color
        )}
      >
        {displayText}
      </span>
      {confidenceLabel && status === 'success' && (
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full border',
            getConfidenceBorderClass(confidence),
            getConfidenceTextClass(confidence)
          )}
        >
          {confidenceLabel}
        </span>
      )}
    </div>
  )
}
