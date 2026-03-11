'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';
import { cn } from '../../utils/cn';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';

const tagVariants = cva(
  ['text-h5 inline-flex items-center justify-center gap-2 h-8 px-2 rounded-[6px]', 'transition-colors duration-150'],
  {
    variants: {
      variant: {
        primary: [
          'bg-ods-open-yellow text-ods-card',
          'hover:bg-ods-open-yellow-hover active:bg-ods-open-yellow-active',
        ],
        outline: [
          'bg-ods-card text-ods-text-primary border border-ods-border',
          'hover:bg-ods-bg-hover hover:border-ods-border-hover',
          'active:bg-ods-bg-active active:border-ods-border-active',
        ],
        success: [
          'bg-ods-success-secondary text-ods-success',
          'hover:bg-ods-success-secondary-hover active:bg-ods-success-secondary-active',
        ],
        warning: [
          'bg-ods-warning-secondary text-ods-warning',
          'hover:bg-ods-open-yellow-secondary active:bg-ods-open-yellow-secondary-action',
        ],
        error: [
          'bg-ods-error-secondary text-ods-error',
          'hover:bg-ods-error-secondary-hover active:bg-ods-error-secondary-active',
        ],
        critical: [
          'bg-ods-error text-ods-error-secondary',
          'hover:bg-ods-error-hover active:bg-ods-error-active',
        ],
        grey: [
          'bg-ods-bg-surface text-ods-text-secondary',
          'hover:bg-ods-bg-surface-hover active:bg-ods-bg-surface-active',
        ],
      },
    },
    defaultVariants: {
      variant: 'primary',
    },
  },
);

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>,
    VariantProps<typeof tagVariants> {
  label: React.ReactNode;
  labelClassName?: string;
  icon?: React.ReactNode;
  onClose?: () => void;
}

function Tag({ label, variant, icon, onClose, className, labelClassName, ...props }: TagProps) {
  return (
    <div className={cn(tagVariants({ variant }), className)} {...props}>
      {icon && <span className="flex items-center justify-center size-5 shrink-0">{icon}</span>}
      <span className={cn('shrink-0', labelClassName)}>{label}</span>
      {onClose && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
          className="flex items-center justify-center size-5 shrink-0 rounded-full opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Remove"
        >
          <XmarkCircleIcon className="size-4" />
        </button>
      )}
    </div>
  );
}

export { Tag, tagVariants };
