'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { type ComponentRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';

interface CheckboxBlockProps {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Primary label (supports rich text / ReactNode for inline links) */
  label: ReactNode;
  /** Optional secondary description below the label (supports rich text / ReactNode) */
  description?: ReactNode;
  /** Keep the label on one line and ellipsize on overflow instead of wrapping */
  truncateLabel?: boolean;
  /**
   * Optional trailing slot rendered at the end of the row (e.g. an action
   * button). Interactive content must call `preventDefault` on click to stop
   * the wrapping label from toggling the checkbox.
   */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Error message displayed below the block (also triggers red border) */
  error?: string;
  className?: string;
}

const CheckboxBlock = forwardRef<ComponentRef<typeof CheckboxPrimitive.Root>, CheckboxBlockProps>(
  (
    {
      id,
      checked,
      defaultChecked,
      onCheckedChange,
      label,
      description,
      truncateLabel,
      trailing,
      disabled,
      error,
      className,
    },
    ref,
  ) => (
    <div className={cn('relative flex w-full flex-col', className)}>
      <label
        htmlFor={id}
        // Same marker every field exposes — it is how a form finds (and scrolls
        // to) the first control that failed validation.
        data-invalid={error ? true : undefined}
        className={cn(
          'flex w-full items-center gap-[var(--spacing-system-s)] rounded-md ring-1 ring-inset',
          // Trailing content stacks full-width below the text on mobile.
          trailing && 'flex-wrap md:flex-nowrap',
          'p-[var(--spacing-system-sf)]',
          !description && 'min-h-[44px] md:min-h-[48px]',
          description && 'min-h-[60px] md:min-h-[64px]',
          'bg-ods-card ring-ods-border',
          'cursor-pointer transition-colors duration-200',
          // States mirror Input: hover / active move the BACKGROUND, the ring
          // stays put. Disabled swaps to the flat `ods-bg` fill and greys the
          // text + the box instead of fading the whole block, so a disabled block
          // reads the same as a disabled field. The greying itself lives on the
          // TEXT COLUMN below, not here: as a descendant rule on the label it also
          // repainted the checked INDICATOR (Radix renders it as a `span`, and the
          // checkmark svg inherits `currentColor`) and whatever `trailing` renders
          // — a `Tag`'s label is a span too, and it went invisible against its own
          // fill in the light theme.
          !disabled && 'hover:bg-ods-bg-hover active:bg-ods-bg-active',
          disabled && 'cursor-not-allowed bg-ods-bg',
          error && 'ring-ods-error',
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
            'h-4 w-4 shrink-0 md:h-6 md:w-6',
            'rounded-[6px] border-2',
            error ? 'border-ods-error' : 'border-[var(--color-border-strong)]',
            'bg-ods-card',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card',
            // Disabled: the EMPTY box dims with the text instead of the whole
            // block fading. A checked box keeps its accent fill — greying it too
            // would bury the checkmark, and "on but locked" has to stay readable.
            'disabled:cursor-not-allowed',
            'disabled:data-[state=unchecked]:border-ods-border disabled:data-[state=unchecked]:bg-ods-bg',
            'data-[state=checked]:border-[var(--color-accent-primary)] data-[state=checked]:bg-[var(--color-accent-primary)]',
          )}
        >
          <CheckboxPrimitive.Indicator className="flex items-center justify-center text-ods-text-on-accent">
            <CheckboxCheckmarkIcon className="h-2 w-2 md:h-2.5 md:w-2.5" />
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col justify-center',
            // Direct children only — these are the two component-owned wrappers.
            // `label` and `description` are ReactNode (rich text, inline links),
            // so a descendant rule would repaint content the caller styled itself.
            disabled && '[&>span]:text-ods-text-disabled',
          )}
        >
          <span
            className={cn(
              '!leading-5 text-h4 md:!leading-6',
              'select-none text-ods-text-primary',
              truncateLabel ? 'block truncate' : 'break-words',
            )}
          >
            {label}
          </span>
          {description && (
            <span className={cn('!leading-4 text-h6', 'select-none break-words text-ods-text-secondary')}>
              {description}
            </span>
          )}
        </div>
        {trailing && <div className="flex w-full shrink-0 items-center md:ml-auto md:w-auto">{trailing}</div>}
      </label>
      {error && (
        <p className="absolute bottom-0 left-0 right-0 translate-y-full truncate text-ods-error text-h6" title={error}>
          {error}
        </p>
      )}
    </div>
  ),
);
CheckboxBlock.displayName = 'CheckboxBlock';

export { CheckboxBlock };
export type { CheckboxBlockProps };
