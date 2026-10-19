'use client';

import * as ProgressPrimitive from '@radix-ui/react-progress';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';

import { cn } from '../../utils/cn';

/**
 * `default`: the original bar. `step`: a thin ODS bar (border-coloured track, accent fill)
 * for a step line ("Step 1 of 2").
 */
const PROGRESS_VARIANT = {
  default: { root: 'h-2 bg-secondary', indicator: 'bg-primary' },
  step: { root: 'h-1 bg-ods-border', indicator: 'bg-ods-accent' },
} as const;

const Progress = forwardRef<
  ElementRef<typeof ProgressPrimitive.Root>,
  ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    indicatorClassName?: string;
    variant?: keyof typeof PROGRESS_VARIANT;
  }
>(({ className, value, indicatorClassName, variant = 'default', ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn('relative w-full overflow-hidden rounded-full', PROGRESS_VARIANT[variant].root, className)}
    value={value}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn('h-full w-full flex-1 transition-all', PROGRESS_VARIANT[variant].indicator, indicatorClassName)}
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
