'use client'

import React from 'react'
import { cn } from '../../../utils/cn'
import {
  getConfidenceLevel,
  getConfidenceLabel,
  getConfidenceBorderClass,
  getConfidenceTextClass,
  getConfidenceBgClass,
} from '../../../utils/confidence-helpers'

export interface ConfidenceBadgeProps {
  confidence?: number
  showLabel?: boolean
  showPercentage?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeStyles = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  showLabel = true,
  showPercentage = true,
  size = 'sm',
  className,
}) => {
  const level = getConfidenceLevel(confidence)

  if (level === 'none') {
    return null
  }

  const label = getConfidenceLabel(confidence)
  const borderClass = getConfidenceBorderClass(confidence)
  const textClass = getConfidenceTextClass(confidence)
  const bgClass = getConfidenceBgClass(confidence)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        sizeStyles[size],
        borderClass,
        textClass,
        bgClass,
        className
      )}
    >
      {showLabel && <span>{label}</span>}
      {showPercentage && confidence !== undefined && (
        <span className="opacity-75">({confidence}%)</span>
      )}
    </span>
  )
}
