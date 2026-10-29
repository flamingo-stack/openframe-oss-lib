'use client';

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Button } from './button';
import { FieldValueSkeleton } from './field-value-skeleton';
import { useLoadingScope } from './loading-scope';

export interface InputTriggerProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  selectedLabel?: ReactNode;
  placeholder?: string;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  invalid?: boolean;
}

/**
 * Input-styled button used to open a non-`<Select>` popup — `ActionsMenuDropdown`,
 * `Popover`, custom calendars, etc.
 *
 * Use `InputTrigger` when:
 *   - You need a select-shaped trigger that opens something other than `<Select>`.
 *   - You want consistent Input-field visuals next to other form fields.
 *
 * Don't use `InputTrigger` for:
 *   - Single-value selection from a flat list — use `<Select>` / `<Autocomplete>`.
 *   - Page-level CTAs / action buttons — use `<Button>` (bold, centered, hierarchical).
 *
 * The component is `forwardRef`'d so it works as the `asChild` child of any Radix
 * trigger (DropdownMenu, Popover, etc.). For form labels & error messages, compose
 * with `<FieldWrapper>`.
 *
 * Loading: in a loading scope the trigger draws its box and its icons for real and its value (or placeholder) as the
 * field's value bar, like `SelectTrigger`.
 */
export const InputTrigger = forwardRef<HTMLButtonElement, InputTriggerProps>(
  ({ selectedLabel, placeholder, startIcon, endIcon, invalid, className, disabled, ...props }, ref) => {
    const isPlaceholder = selectedLabel === undefined || selectedLabel === null || selectedLabel === '';
    // ONE switch: in a page's loading state the value is a bar; the box and the icons are the field's own.
    const inScope = useLoadingScope();

    return (
      <Button
        variant="field"
        ref={ref}
        type="button"
        disabled={disabled}
        aria-busy={inScope || undefined}
        data-invalid={invalid || undefined}
        {...props}
        className={className}
      >
        {startIcon && <span className="flex shrink-0 items-center text-ods-text-secondary">{startIcon}</span>}
        {inScope ? (
          <FieldValueSkeleton />
        ) : (
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-left',
              disabled ? 'text-ods-text-disabled' : isPlaceholder && 'text-ods-text-secondary',
            )}
            title={isPlaceholder ? placeholder : typeof selectedLabel === 'string' ? selectedLabel : undefined}
          >
            {isPlaceholder ? placeholder : selectedLabel}
          </span>
        )}
        {endIcon && <span className="flex shrink-0 items-center text-ods-text-secondary">{endIcon}</span>}
      </Button>
    );
  },
);
InputTrigger.displayName = 'InputTrigger';
