'use client';

import { forwardRef } from 'react';

import { cn } from '../../utils/cn';
import { CheckCircleIcon, DotsLoaderIcon } from '../icons-v2-generated';
import type { ContextCompactionDisplayProps } from './types';

const ContextCompactionDisplay = forwardRef<HTMLDivElement, ContextCompactionDisplayProps>(
  ({ className, status, ...props }, ref) => {
    const isStarted = status === 'started';
    const label = isStarted ? 'Context limit reached. Summarizing earlier messages.' : 'Earlier context summarized.';

    return (
      <div
        ref={ref}
        className={cn('flex items-center gap-2 rounded-[6px] border border-ods-border bg-ods-card p-1.5', className)}
        {...props}
      >
        <span className="min-w-0 flex-1 text-ods-text-secondary text-h6">{label}</span>
        {isStarted ? (
          <DotsLoaderIcon size={16} className="text-ods-text-secondary" />
        ) : (
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-ods-success" />
        )}
      </div>
    );
  },
);

ContextCompactionDisplay.displayName = 'ContextCompactionDisplay';

export { ContextCompactionDisplay };
