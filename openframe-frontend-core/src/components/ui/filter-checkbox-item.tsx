'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';

export interface FilterCheckboxItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
  className?: string;
}

export function FilterCheckboxItem({ label, checked, onChange, count, className }: FilterCheckboxItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-ods-border bg-ods-card last:border-b-0',
        'cursor-pointer transition-colors hover:bg-ods-bg-hover',
        count !== undefined ? 'px-4 py-3' : 'p-3',
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <CheckboxPrimitive.Root
        checked={checked}
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
      <span className="flex-1 text-ods-text-primary text-h4">{label}</span>
      {count !== undefined && (
        <span className="shrink-0 text-ods-text-secondary text-h5">{count.toLocaleString()}</span>
      )}
    </div>
  );
}
