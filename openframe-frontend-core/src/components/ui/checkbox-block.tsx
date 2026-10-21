'use client';

import type * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { type ComponentRef, type ReactNode, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Checkbox } from './checkbox';
import { loadingItemProps, useLoadingScope } from './loading-scope';
import { RequiredMark } from './required-mark';

interface CheckboxBlockProps {
  id?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Primary label (supports rich text / ReactNode for inline links). `null` is a label still being read: while the
   *  block loads it draws an `h4` bar in the label's own line. */
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
  /** Marks the box `aria-required` AND draws the `RequiredMark` after the label — the
   *  same pairing every required field carries, so neither signal stands alone. */
  required?: boolean;
  /** Error message displayed below the block (also triggers red border) */
  error?: string;
  /**
   * Whether the box is checked is still being read: the label and description are drawn for real and the box is a
   * skeleton of the box's own size. A loading scope does the same.
   */
  loading?: boolean;
  className?: string;
  /** `data-*` markers (`data-loading-item` on a read list's block), on the block's root in both forms. */
  [key: `data-${string}`]: unknown;
}

/** The label's bar while a `null` label is read. */
const CHECKBOX_BLOCK_LABEL_BAR_CLASS = 'w-40 max-w-full';

/** The block's box over the checkbox's own (`CHECKBOX_BOX_CLASS`): grown at `md`. `Checkbox` reads it for the box and
 *  for its skeleton. */
const CHECKBOX_BLOCK_BOX_CLASS = 'rounded-[6px] content-md:size-6';

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
      required,
      error,
      loading: loadingProp,
      className,
      ...props
    },
    ref,
  ) => {
    // ONE switch for the block's own read part: the box is its skeleton through `Checkbox`; a `null` label is a bar.
    const loading = useLoadingScope() || !!loadingProp;
    return (
      <div className={cn('relative flex w-full flex-col', className)} {...loadingItemProps(props)}>
        <label
          htmlFor={id}
          // Same marker every field exposes — it is how a form finds (and scrolls
          // to) the first control that failed validation.
          data-invalid={error ? true : undefined}
          className={cn(
            'flex w-full items-center gap-[var(--spacing-system-s)] rounded-md ring-1 ring-inset',
            // Trailing content stacks full-width below the text on mobile.
            trailing && 'flex-wrap content-md:flex-nowrap',
            'p-[var(--spacing-system-sf)]',
            !description && 'min-h-[44px] content-md:min-h-[48px]',
            description && 'min-h-[60px] content-md:min-h-[64px]',
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
          {/* The box switches itself: in a loading scope (or `loading`) it is its skeleton; the copy stays real. */}
          <Checkbox
            ref={ref}
            id={id}
            checked={checked}
            defaultChecked={defaultChecked}
            onCheckedChange={onCheckedChange}
            disabled={disabled}
            loading={loadingProp}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            boxClassName={CHECKBOX_BLOCK_BOX_CLASS}
            indicatorClassName="h-2 w-2 content-md:h-2.5 content-md:w-2.5"
            className={cn(
              'border-2',
              error ? 'border-ods-error' : 'border-[var(--color-border-strong)]',
              'bg-ods-card',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card',
              // Disabled: the EMPTY box dims with the text instead of the whole
              // block fading. A checked box keeps its accent fill — greying it too
              // would bury the checkmark, and "on but locked" has to stay readable.
              'disabled:cursor-not-allowed disabled:opacity-100',
              'disabled:data-[state=unchecked]:border-ods-border disabled:data-[state=unchecked]:bg-ods-bg',
              'data-[state=checked]:border-[var(--color-accent-primary)] data-[state=checked]:bg-[var(--color-accent-primary)]',
            )}
          />
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
                '!leading-5 text-h4 content-md:!leading-6',
                'select-none text-ods-text-primary',
                truncateLabel ? 'block truncate' : 'break-words',
              )}
            >
              {loading && label === null ? (
                <TextLineSkeleton type="inherit" as="span" className={CHECKBOX_BLOCK_LABEL_BAR_CLASS} />
              ) : (
                label
              )}
              {required && <RequiredMark />}
            </span>
            {description && (
              <span className={cn('!leading-4 text-h6', 'select-none break-words text-ods-text-secondary')}>
                {description}
              </span>
            )}
          </div>
          {trailing && (
            <div className="flex w-full shrink-0 items-center content-md:ml-auto content-md:w-auto">{trailing}</div>
          )}
        </label>
        {error && (
          <p
            className="absolute bottom-0 left-0 right-0 translate-y-full truncate text-ods-error text-h6"
            title={error}
          >
            {error}
          </p>
        )}
      </div>
    );
  },
);
CheckboxBlock.displayName = 'CheckboxBlock';

export { CheckboxBlock };
export type { CheckboxBlockProps };
