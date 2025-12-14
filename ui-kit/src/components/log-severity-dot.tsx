import * as React from 'react'
import { cn } from '../utils/cn'
import { LogSeverityDotProps, LOG_SEVERITY_COLORS, LOG_SEVERITY_LABELS } from '../types/logs.types'

export const LogSeverityDot = React.forwardRef<
  HTMLDivElement,
  LogSeverityDotProps
>(({ severity, size = 'md', className }, ref) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const dotSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div
      ref={ref}
      className={cn(
        'relative flex items-center justify-center shrink-0',
        sizeClasses[size],
        className
      )}
      aria-label={`${LOG_SEVERITY_LABELS[severity]} severity`}
    >
      <div
        className={cn(
          'rounded-full',
          dotSizeClasses[size]
        )}
        style={{ backgroundColor: LOG_SEVERITY_COLORS[severity] }}
      />
    </div>
  )
})

LogSeverityDot.displayName = 'LogSeverityDot'