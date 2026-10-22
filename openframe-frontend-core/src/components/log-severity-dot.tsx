'use client';

import { forwardRef } from 'react';
import { type LogSeverityDotProps, LOG_SEVERITY_COLORS, LOG_SEVERITY_LABELS } from '../types/logs.types';
import { cn } from '../utils/cn';
import { UnifiedSkeleton } from './loading/unified-skeleton';
import { useLoadingScope } from './ui/loading-scope';

/** The dot's box and the dot inside it, per size, read by the dot and by its skeleton. */
const SEVERITY_BOX_CLASS = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' } as const;
const SEVERITY_DOT_CLASS = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' } as const;
const SEVERITY_FRAME_CLASS = 'relative flex shrink-0 items-center justify-center';

/** The dot while its log is read: the dot's own box, the dot a circle of the dot's size. */
function LogSeverityDotSkeleton({ size = 'md', className }: Pick<LogSeverityDotProps, 'size' | 'className'>) {
  return (
    <span className={cn(SEVERITY_FRAME_CLASS, SEVERITY_BOX_CLASS[size], className)} aria-hidden>
      <UnifiedSkeleton variant="circular" className={SEVERITY_DOT_CLASS[size]} />
    </span>
  );
}

export const LogSeverityDot = forwardRef<HTMLDivElement, LogSeverityDotProps>(
  ({ severity, size = 'md', className, loading }, ref) => {
    // ONE switch: while its log is read (`loading`, or a loading scope) the dot is its own loading form.
    if (useLoadingScope() || loading || !severity) return <LogSeverityDotSkeleton size={size} className={className} />;
    return (
      <div
        ref={ref}
        className={cn(SEVERITY_FRAME_CLASS, SEVERITY_BOX_CLASS[size], className)}
        aria-label={`${LOG_SEVERITY_LABELS[severity]} severity`}
      >
        <div
          className={cn('rounded-full', SEVERITY_DOT_CLASS[size])}
          style={{ backgroundColor: LOG_SEVERITY_COLORS[severity] }}
        />
      </div>
    );
  },
);

LogSeverityDot.displayName = 'LogSeverityDot';
