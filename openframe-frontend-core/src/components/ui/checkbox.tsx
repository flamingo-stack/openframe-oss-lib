'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';

import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';

type CheckboxPrimitiveProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/**
 * Radix reports a change as `true`, `false` or `'indeterminate'`. Every checkbox
 * in the lib is a plain on/off control, so its callers take a boolean: this is
 * the one place the wider value is narrowed (anything but `true` is off).
 */
export function booleanCheckedChange(
  handler: ((checked: boolean) => void) | undefined,
): CheckboxPrimitiveProps['onCheckedChange'] {
  return handler ? checked => handler(checked === true) : undefined;
}

export interface CheckboxProps extends Omit<CheckboxPrimitiveProps, 'onCheckedChange'> {
  onCheckedChange?: (checked: boolean) => void;
}

/** The checkbox's box (its size and corners): read by the checkbox and by every skeleton that stands for one. */
export const CHECKBOX_BOX_CLASS = 'h-4 w-4 shrink-0 rounded-sm';

const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, ref) => (
    <CheckboxPrimitive.Root
      ref={ref}
      onCheckedChange={booleanCheckedChange(onCheckedChange)}
      className={cn(
        CHECKBOX_BOX_CLASS,
        'peer border border-ods-border bg-ods-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-ods-accent data-[state=checked]:bg-ods-accent',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-ods-text-on-accent')}>
        <CheckboxCheckmarkIcon size={10} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
