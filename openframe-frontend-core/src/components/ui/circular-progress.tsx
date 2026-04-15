'use client'

import { cn } from '../../utils/cn'

export type CircularProgressVariant = 'success' | 'warning' | 'error' | 'info'

interface CircularProgressProps {
  percentage: number                    // 0-100
  variant?: CircularProgressVariant     // Default: 'success'
  size?: number                         // Default: 56
  strokeWidth?: number                  // Default: 10
  showLabel?: boolean                   // Show percentage text in center (default: true)
  className?: string
}

const variantColors: Record<CircularProgressVariant, { progress: string; track: string }> = {
  success: {
    progress: 'var(--color-success)',
    track: 'var(--color-success-secondary)',
  },
  warning: {
    progress: 'var(--color-warning)',
    track: 'var(--color-warning-secondary)',
  },
  error: {
    progress: 'var(--color-error)',
    track: 'var(--color-error-secondary)',
  },
  info: {
    progress: 'var(--ods-system-greys-white)',
    track: 'var(--ods-system-greys-soft-grey)',
  },
}

export function CircularProgress({
  percentage,
  variant = 'success',
  size = 56,
  strokeWidth = 10,
  showLabel = true,
  className
}: CircularProgressProps) {
  const normalizedPercentage = Math.min(100, Math.max(0, percentage))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (normalizedPercentage / 100) * circumference
  const { progress, track } = variantColors[variant]

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progress}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="butt"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-ods-text-secondary">
            {Math.round(normalizedPercentage)}%
          </span>
        </div>
      )}
    </div>
  )
}
