'use client'

import { cn } from '../../utils/cn'

export type CircularProgressVariant = 'success' | 'warning' | 'error' | 'info' | 'accent'

/**
 * How to treat a `percentage` over 100.
 * - `clamp` (default): value is clamped to 0–100 for both the ring and the label.
 * - `wrap`: the ring wraps around once per 100. The label shows the actual
 *   (unclamped) percentage, while the ring fills to `percentage % 100` — e.g.
 *   130 → 30%, 230 → 30%, 200 → 100% (exact laps render as full). Use together
 *   with `variant="warning"` / `"error"` to communicate overage semantically.
 */
export type CircularProgressOverflow = 'clamp' | 'wrap'

interface CircularProgressProps {
  percentage: number                    // 0-100 in clamp mode; may exceed 100 in wrap mode
  variant?: CircularProgressVariant     // Default: 'success'
  size?: number                         // Default: 56
  strokeWidth?: number                  // Default: 10
  showLabel?: boolean                   // Show percentage text in center (default: true)
  labelFormat?: 'percent' | 'value'    // 'percent' = "70%", 'value' = "70" (default: 'percent')
  overflow?: CircularProgressOverflow  // Default: 'clamp'
  className?: string
}

// Fallback track for variants that don't have a designed secondary color
// (info, accent). success/warning/error use their ODS `*-secondary` token.
const SUBTLE_TRACK = 'rgba(255, 255, 255, 0.06)'

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
    track: SUBTLE_TRACK,
  },
  accent: {
    progress: 'var(--ods-flamingo-cyan-base)',
    track: SUBTLE_TRACK,
  },
}

export function CircularProgress({
  percentage,
  variant = 'success',
  size = 56,
  strokeWidth = 10,
  showLabel = true,
  labelFormat = 'percent',
  overflow = 'clamp',
  className
}: CircularProgressProps) {
  const safePercentage = Math.max(0, percentage)
  const isWrap = overflow === 'wrap'

  // In wrap mode the ring shows `percentage % 100`. Exact laps (200, 300, …)
  // would otherwise render empty, so collapse them to a full 100% ring.
  let ringPercentage: number
  if (isWrap && safePercentage > 100) {
    const mod = safePercentage % 100
    ringPercentage = mod === 0 ? 100 : mod
  } else {
    ringPercentage = Math.min(100, safePercentage)
  }

  const labelPercentage = isWrap ? safePercentage : Math.min(100, safePercentage)

  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const ringOffset = circumference - (ringPercentage / 100) * circumference

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
          strokeDashoffset={ringOffset}
          strokeLinecap="butt"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-medium text-ods-text-primary" style={{ fontSize: size <= 40 ? 10 : 12 }}>
            {Math.round(labelPercentage)}{labelFormat === 'percent' ? '%' : ''}
          </span>
        </div>
      )}
    </div>
  )
}
