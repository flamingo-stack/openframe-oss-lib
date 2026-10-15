'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';

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
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-ods-border bg-ods-card last:border-b-0',
        disabled ? 'cursor-wait opacity-70' : 'cursor-pointer transition-colors hover:bg-ods-bg-hover',
        count !== undefined ? 'px-4 py-3' : 'p-3',
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
          'h-6 w-6 shrink-0 rounded-[6px] border-2',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
          checked ? 'border-ods-accent bg-ods-accent' : 'border-ods-text-secondary bg-ods-card',
        )}
        onClick={e => e.stopPropagation()}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-ods-text-on-accent">
          <CheckboxCheckmarkIcon size={10} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className="min-w-0 flex-1 text-ods-text-primary text-h4">{label}</span>
      {count !== undefined && (
        <span className="shrink-0 text-ods-text-secondary text-h5">{count.toLocaleString()}</span>
      )}
    </div>
  );
}
