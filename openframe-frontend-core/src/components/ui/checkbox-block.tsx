'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as React from 'react';
import { cn } from '../../utils/cn';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';

interface CheckboxBlockProps {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
  /** Optional secondary description text below the label */
  description?: string;
  disabled?: boolean;
  className?: string;
}

const CheckboxBlock = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, CheckboxBlockProps>(
  ({ id, checked, defaultChecked, onCheckedChange, label, description, disabled, className }, ref) => (
    <label
      htmlFor={id}
      className={cn(
        // Layout & spacing
        'flex items-center gap-3 rounded-[6px] border px-3 w-full',
        description ? 'h-16' : 'h-11 md:h-12',
        // Theme palette
        'bg-[var(--ods-system-greys-black)] border-[var(--ods-system-greys-soft-grey)]',
        // Interactive states
        'cursor-pointer transition-colors duration-200',
        'hover:border-ods-accent/30',
        // Disabled state
        disabled && 'opacity-50 cursor-not-allowed hover:border-[var(--ods-system-greys-soft-grey)]',
        className,
      )}
    >
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          // Size
          'h-6 w-6 shrink-0',
          // Shape & border
          'rounded-[6px] border-2 border-[var(--ods-system-greys-grey)]',
          // Background
          'bg-[var(--ods-system-greys-black)]',
          // Focus states
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ods-system-greys-black)]',
          // Disabled state
          'disabled:cursor-not-allowed',
          // Checked state
          'data-[state=checked]:bg-ods-accent data-[state=checked]:border-ods-accent',
        )}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-[var(--ods-system-greys-black)]">
          <CheckIcon className="h-4 w-4" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="flex flex-1 flex-col justify-center min-w-0">
        <span className={cn('font-medium text-[18px] leading-6 text-ods-text-primary', 'select-none truncate')}>
          {label}
        </span>
        {description && (
          <span className="font-medium text-[14px] leading-5 text-ods-text-secondary select-none truncate">
            {description}
          </span>
        )}
      </div>
    </label>
  ),
);
CheckboxBlock.displayName = 'CheckboxBlock';

export { CheckboxBlock };
export type { CheckboxBlockProps };
