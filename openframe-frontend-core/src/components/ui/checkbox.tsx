'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react';

import { CONTROL_SIZE } from '../../styles/component-sizes';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

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
  /** The box's size, corners and placement over `CHECKBOX_BOX_CLASS`: read by the box and by its skeleton, so a host
   *  that sizes the box (`CheckboxBlock`, `CheckboxWithDescription`) gets its skeleton at the same size. */
  boxClassName?: string;
  /** The checkmark's classes (its size when the box is sized). */
  indicatorClassName?: string;
  /**
   * Whether the box is checked is still being read: the box is a skeleton of its own size (`boxClassName`). A loading
   * scope does the same.
   */
  loading?: boolean;
}

/** The checkbox's box (its size and corners): read by the checkbox and by every skeleton that stands for one. */
export const CHECKBOX_BOX_CLASS = `${CONTROL_SIZE.checkbox} shrink-0 rounded-sm`;

const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  ({ className, boxClassName, indicatorClassName, onCheckedChange, loading: loadingProp, ...props }, ref) => {
    // ONE switch: in a page's loading state (or while the host reads it) the box is a skeleton of its own size.
    const loading = useLoadingScope() || !!loadingProp;
    if (loading) return <UnifiedSkeleton className={cn(CHECKBOX_BOX_CLASS, boxClassName)} />;
    return (
      <CheckboxPrimitive.Root
        ref={ref}
        onCheckedChange={booleanCheckedChange(onCheckedChange)}
        className={cn(
          CHECKBOX_BOX_CLASS,
          boxClassName,
          'peer border border-ods-border bg-ods-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-ods-accent data-[state=checked]:bg-ods-accent',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-ods-text-on-accent')}>
          <CheckboxCheckmarkIcon size={10} className={indicatorClassName} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );
  },
);
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
