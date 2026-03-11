'use client';

import * as React from 'react';

import { cn } from '../../utils/cn';
import { FieldWrapper } from './field-wrapper';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** When true, renders red error border & ring */
  invalid?: boolean;
  /** Label text displayed above the textarea */
  label?: string;
  /** Error message displayed below the textarea */
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, label, error, ...props }, ref) => {
    const isInvalid = invalid || !!error;

    const content = (
      <textarea
        className={cn(
          // Layout & spacing - match Input
          'flex min-h-[96px] w-full rounded-[6px] border p-3',
          // Typography - match Input exactly
          'text-[18px] font-medium leading-6',
          // Focus states
          'focus-visible:outline-none focus:border-ods-accent',
          // Animations & touch UX
          'transition-colors duration-200 touch-manipulation',
          // Theme palette
          'bg-ods-card border-ods-border text-ods-text-primary placeholder:text-ods-text-secondary',
          // Hover & active (not disabled)
          !props.disabled &&
            'hover:bg-ods-bg-hover hover:border-ods-border-hover active:bg-ods-bg-active active:border-ods-border-active',
          // Disabled
          props.disabled && '!cursor-not-allowed bg-ods-bg disabled:placeholder:text-ods-border',
          // Ensure proper cursor/stacking
          'cursor-text relative z-10',
          // Textarea-specific
          'resize-y',
          // Invalid state
          isInvalid && 'border-ods-error hover:border-ods-error focus:border-ods-error',
          className,
        )}
        ref={ref}
        {...props}
      />
    );

    return (
      <FieldWrapper label={label} error={error}>
        {content}
      </FieldWrapper>
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
