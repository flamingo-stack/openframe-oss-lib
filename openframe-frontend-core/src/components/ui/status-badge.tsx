'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { cn } from '../../utils/cn';

const statusBadgeVariants = cva(
  'inline-flex items-center justify-center rounded font-mono font-medium uppercase tracking-wide',
  {
    variants: {
      variant: {
        card: 'px-3 py-1.5 text-sm',
        button: 'px-2 py-0.5 text-[10px] leading-none',
      },
      colorScheme: {
        cyan: 'bg-ods-flamingo-cyan text-ods-text-on-accent',
        pink: 'bg-ods-flamingo-pink text-ods-text-on-accent',
        yellow:
          'bg-ods-open-yellow text-ods-text-on-accent border border-ods-card',
        green: 'bg-ods-success text-ods-text-on-accent',
        purple: 'bg-ods-link-visited text-ods-text-on-accent',
        success: 'bg-ods-success-secondary text-ods-success',
        error: 'bg-ods-error-secondary text-ods-error',
        warning: 'bg-ods-warning-secondary text-ods-warning',
        default: 'bg-ods-bg-secondary text-ods-text-primary',
        // Border-only variants (no background) - for task type badges
        accentBorder: 'bg-transparent border-2 text-ods-accent border-ods-accent',
        errorBorder:
          'bg-transparent border-2 text-ods-error border-ods-error',
        whiteBorder: 'bg-transparent border-2 text-ods-text-primary border-ods-text-primary',
      },
    },
    defaultVariants: {
      variant: 'card',
      colorScheme: 'default',
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  text: string;
}

function StatusBadge({ text, variant, colorScheme, className, ...props }: StatusBadgeProps) {
  // For button variant, split text into multiple lines for narrow badges
  const renderText = () => {
    if (variant === 'button' && text.includes(' ')) {
      const words = text.split(' ');
      return (
        <div className="flex flex-col items-center justify-center text-center gap-0">
          {words.map((word, index) => (
            <div key={index}>{word}</div>
          ))}
        </div>
      );
    }
    return text;
  };

  return (
    <div className={cn(statusBadgeVariants({ variant, colorScheme }), className)} {...props}>
      {renderText()}
    </div>
  );
}

export { StatusBadge, statusBadgeVariants };
