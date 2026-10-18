'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/** The item's row, box and text, read by the item and by its skeleton, so the skeleton is the item's size. */
const ITEM_ROW_CLASS = 'flex items-center gap-3 border-b border-ods-border bg-ods-card last:border-b-0';
const ITEM_BOX_CLASS = 'h-6 w-6 shrink-0 rounded-[6px] border-2';
const ITEM_LABEL_CLASS = 'min-w-0 flex-1 text-ods-text-primary text-h4';
const ITEM_COUNT_CLASS = 'shrink-0 text-ods-text-secondary text-h5';
const itemPaddingClass = (hasCount: boolean) => (hasCount ? 'px-4 py-3' : 'p-3');

export interface FilterCheckboxItemProps {
  /** Text, or a richer label (an icon with a word and a tooltip). */
  label: ReactNode;
  /** The accessible name when `label` is not plain text. */
  ariaLabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
  /** Ignore clicks (e.g. while a navigation started by this filter is pending). */
  disabled?: boolean;
  className?: string;
}

export function FilterCheckboxItem({
  label,
  ariaLabel,
  checked,
  onChange,
  count,
  disabled,
  className,
}: FilterCheckboxItemProps) {
  // In a page's loading state the item is its skeleton: a label the page states is drawn for real, a read one
  // ('' there) and the count are bars.
  if (useLoadingScope()) {
    return (
      <FilterCheckboxItemSkeleton
        label={typeof label === 'string' ? label || undefined : label}
        count={count !== undefined}
        className={className}
      />
    );
  }
  return (
    <div
      className={cn(
        ITEM_ROW_CLASS,
        disabled ? 'cursor-wait opacity-70' : 'cursor-pointer transition-colors hover:bg-ods-bg-hover',
        itemPaddingClass(count !== undefined),
        className,
      )}
      onClick={() => !disabled && onChange(!checked)}
    >
      <CheckboxPrimitive.Root
        checked={checked}
        disabled={disabled}
        aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
        onCheckedChange={c => onChange(c === true)}
        className={cn(
          ITEM_BOX_CLASS,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
          checked ? 'border-ods-accent bg-ods-accent' : 'border-ods-text-secondary bg-ods-card',
        )}
        onClick={e => e.stopPropagation()}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-ods-text-on-accent">
          <CheckboxCheckmarkIcon size={10} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className={ITEM_LABEL_CLASS}>{label}</span>
      {count !== undefined && <span className={ITEM_COUNT_CLASS}>{count.toLocaleString()}</span>}
    </div>
  );
}

/**
 * A filter checkbox while its facet is read: the same row and an unchecked box, the label for real when given (else
 * a bar), and with `count` the count as a bar.
 */
export function FilterCheckboxItemSkeleton({
  label,
  count = false,
  className,
}: {
  label?: ReactNode;
  count?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(ITEM_ROW_CLASS, itemPaddingClass(count), className)} aria-hidden>
      <span className={cn(ITEM_BOX_CLASS, 'border-ods-text-secondary bg-ods-card')} />
      {label ? (
        <span className={ITEM_LABEL_CLASS}>{label}</span>
      ) : (
        <span className="min-w-0 flex-1">
          <TextLineSkeleton type="h4" className="w-32" />
        </span>
      )}
      {count && (
        <span className={ITEM_COUNT_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className="inline-block align-top w-6" />
        </span>
      )}
    </div>
  );
}
