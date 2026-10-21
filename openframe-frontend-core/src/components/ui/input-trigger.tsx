'use client';

import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { FIELD_VALUE_SKELETON_CLASS } from './input-styles';
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
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        aria-busy={inScope || undefined}
        data-invalid={invalid || undefined}
        {...props}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-[6px] border px-3 outline-none md:h-12',
          'text-h4',
          'border-ods-border bg-ods-card text-ods-text-primary',
          'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
          !invalid && 'data-[state=open]:border-ods-accent data-[state=open]:hover:border-ods-accent',
          invalid && 'border-ods-error enabled:hover:border-ods-error data-[state=open]:border-ods-error',
          // Disabled - match Input / SelectTrigger: grey the TEXT, don't fade the
          // whole control (a blanket opacity also washes out the border and the
          // adornment icons, which no other field does). The child rule catches
          // the label span, which sets its own placeholder colour. Scoped to
          // DIRECT children: `selectedLabel` is a ReactNode the caller owns, so
          // anything inside it that sets its own colour keeps it.
          'disabled:cursor-not-allowed disabled:bg-ods-bg',
          'disabled:text-ods-text-disabled disabled:[&>span]:text-ods-text-disabled disabled:[&_svg]:text-ods-text-disabled',
          'transition-colors duration-200',
          className,
        )}
      >
        {startIcon && <span className="flex shrink-0 items-center text-ods-text-secondary">{startIcon}</span>}
        {inScope ? (
          <TextLineSkeleton type="h4" className={FIELD_VALUE_SKELETON_CLASS} />
        ) : (
          <span
            className={cn('min-w-0 flex-1 truncate text-left', isPlaceholder && 'text-ods-text-secondary')}
            title={isPlaceholder ? placeholder : typeof selectedLabel === 'string' ? selectedLabel : undefined}
          >
            {isPlaceholder ? placeholder : selectedLabel}
          </span>
        )}
        {endIcon && <span className="flex shrink-0 items-center text-ods-text-secondary">{endIcon}</span>}
      </button>
    );
  },
);
InputTrigger.displayName = 'InputTrigger';
