'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';

const badgeVariants = cva(
  // Weight from the ODS token. Scale stays at 12px rather than the `text-h6`
  // composite: a badge is a stamp, and that composite is 14/20 on desktop —
  // moving badges onto it grew every one of them.
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-[number:var(--font-weight-semibold)] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/80',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
        outline: 'text-foreground',
        success: 'border-transparent bg-ods-success text-ods-text-on-accent hover:bg-ods-success-hover',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * A badge while its text is read: one skeleton box with the badge's own frame, padding and type step, its content
 * one line of that step (`box-content`: the padding adds to the line, as it does around the badge's text). The
 * width stands for the text (`className` overrides it).
 */
function BadgeSkeleton({ className }: { className?: string }) {
  return (
    <UnifiedSkeleton
      as="span"
      className={cn(badgeVariants({ variant: null }), 'box-content h-[1lh] w-10 border-transparent', className)}
    />
  );
}

export { Badge, BadgeSkeleton, badgeVariants };
