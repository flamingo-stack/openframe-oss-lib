'use client'

import React from 'react'
import { cn } from '../../utils/cn'

interface CircularProgressProps {
  percentage: number      // 0-100
  size?: number          // Default: 56
  strokeWidth?: number   // Default: 6
  color?: string         // Progress arc color (default: #5ea62e)
  trackColor?: string    // Background track color (default: #3a3a3a)
  className?: string
}

export function CircularProgress({
  percentage,
  size = 56,
  strokeWidth = 6,
  color = '#5ea62e',
  trackColor = '#3a3a3a',
  className
}: CircularProgressProps) {
  const normalizedPercentage = Math.min(100, Math.max(0, percentage))
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDashoffset = circumference - (normalizedPercentage / 100) * circumference

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      {/* Optional: Display percentage text in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-medium text-ods-text-secondary">
          {Math.round(normalizedPercentage)}%
        </span>
      </div>
    </div>
  )
}