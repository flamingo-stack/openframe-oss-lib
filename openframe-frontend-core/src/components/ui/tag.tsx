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
          'bg-[var(--ods-open-yellow-base)] text-[var(--ods-system-greys-black)]',
          'hover:bg-[var(--ods-open-yellow-hover)] active:bg-[var(--ods-open-yellow-action)]',
        ],
        outline: [
          'bg-[var(--ods-system-greys-black)] text-[var(--ods-system-greys-white)] border border-[var(--ods-system-greys-soft-grey)]',
          'hover:bg-[var(--ods-system-greys-black-hover)] hover:border-[var(--ods-system-greys-soft-grey-hover)]',
          'active:bg-[var(--ods-system-greys-black-action)] active:border-[var(--ods-system-greys-soft-grey-action)]',
        ],
        success: [
          'bg-[var(--ods-attention-green-success-secondary)] text-[var(--ods-attention-green-success)]',
          'hover:bg-[var(--ods-attention-green-success-secondary-hover)] active:bg-[var(--ods-attention-green-success-secondary-action)]',
        ],
        warning: [
          'bg-[var(--ods-attention-yellow-warning-secondary)] text-[var(--ods-attention-yellow-warning)]',
          'hover:bg-[var(--ods-open-yellow-secondary)] active:bg-[var(--ods-open-yellow-secondary-action)]',
        ],
        error: [
          'bg-[var(--ods-attention-red-error-secondary)] text-[var(--ods-attention-red-error)]',
          'hover:bg-[var(--ods-attention-red-error-secondary-hover)] active:bg-[var(--ods-attention-red-error-secondary-action)]',
        ],
        critical: [
          'bg-[var(--ods-attention-red-error)] text-[var(--ods-attention-red-error-secondary)]',
          'hover:bg-[var(--ods-attention-red-error-hover)] active:bg-[var(--ods-attention-red-error-action)]',
        ],
        grey: [
          'bg-[var(--ods-system-greys-soft-grey)] text-[var(--ods-system-greys-grey)]',
          'hover:bg-[var(--ods-system-greys-soft-grey-hover)] active:bg-[var(--ods-system-greys-soft-grey-action)]',
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
