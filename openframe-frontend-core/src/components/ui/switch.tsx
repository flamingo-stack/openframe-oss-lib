'use client';

import * as SwitchPrimitives from '@radix-ui/react-switch';
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef, useState } from 'react';

import { cn } from '../../utils/cn';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

/** The switch's box (its track), read by the switch and by its skeleton. */
export const SWITCH_SIZE_CLASS = 'h-4 w-6';

/** A switch while its value is read: one box of the switch's own size and shape. */
export function SwitchSkeleton({ className }: { className?: string }) {
  return <UnifiedSkeleton as="span" className={cn(SWITCH_SIZE_CLASS, 'shrink-0 rounded-full', className)} />;
}

const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitives.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    /** The value is still being read: the switch draws its skeleton (`SwitchSkeleton`). A loading scope does the
     *  same. */
    loading?: boolean;
  }
>(({ className, checked, onCheckedChange, loading: loadingProp, ...props }, ref) => {
  // ONE switch: in a page's loading state (or while the host reads the value) the switch is its skeleton.
  const loading = useLoadingScope() || !!loadingProp;
  // Local state when uncontrolled; a controlled `checked` always wins (derived, never copied in an effect).
  const [localChecked, setLocalChecked] = useState(false);
  const isChecked = checked ?? localChecked;

  const handleCheckedChange = (newChecked: boolean) => {
    setLocalChecked(newChecked);
    onCheckedChange?.(newChecked);
  };

  if (loading) return <SwitchSkeleton className={className} />;

  return (
    <SwitchPrimitives.Root
      className={cn(
        SWITCH_SIZE_CLASS,
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 bg-ods-card px-0.5 transition-colors hover:bg-ods-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-ods-bg-active disabled:cursor-not-allowed disabled:opacity-50',
        isChecked ? 'border-ods-accent hover:border-ods-accent-hover' : 'border-ods-text-secondary',
        className,
      )}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          'pointer-events-none block size-2 rounded-full transition-transform duration-200',
          isChecked ? 'bg-ods-accent' : 'bg-ods-text-secondary',
        )}
        style={{
          transform: isChecked ? 'translateX(8px)' : 'translateX(0px)',
        }}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
