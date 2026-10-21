'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { booleanCheckedChange, CHECKBOX_BOX_CLASS } from './checkbox';
import { Label } from './label';
import { useLoadingScope } from './loading-scope';

interface CheckboxWithDescriptionProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
  /**
   * Whether the box is checked is still being read: the title and description are drawn for real and the box is a
   * skeleton of the box's own size. A loading scope does the same.
   */
  loading?: boolean;
  className?: string;
}

/** The box: the checkbox's own box (`CHECKBOX_BOX_CLASS`) at this block's size. Read by the box and its skeleton. */
const CHECKBOX_WITH_DESCRIPTION_BOX_CLASS = cn(CHECKBOX_BOX_CLASS, 'mt-0.5 size-5');

const CheckboxWithDescription = forwardRef<HTMLDivElement, CheckboxWithDescriptionProps>(
  ({ id, checked, onCheckedChange, title, description, disabled, loading: loadingProp, className }, ref) => {
    // ONE switch: in a page's loading state (or while the host reads it) the box is a skeleton; the copy is real.
    const loading = useLoadingScope() || !!loadingProp;
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-3 rounded-lg border border-ods-border bg-ods-card p-4',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {loading ? (
          <UnifiedSkeleton className={CHECKBOX_WITH_DESCRIPTION_BOX_CLASS} />
        ) : (
          <CheckboxPrimitive.Root
            id={id}
            checked={checked}
            onCheckedChange={booleanCheckedChange(onCheckedChange)}
            disabled={disabled}
            className={cn(
              CHECKBOX_WITH_DESCRIPTION_BOX_CLASS,
              'peer border border-ods-border bg-ods-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-ods-accent data-[state=checked]:bg-ods-accent',
            )}
          >
            <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-ods-text-on-accent')}>
              <CheckboxCheckmarkIcon size={10} />
            </CheckboxPrimitive.Indicator>
          </CheckboxPrimitive.Root>
        )}
        <div className="flex flex-col gap-1">
          <Label
            htmlFor={id}
            spacing="tight"
            className={cn('cursor-pointer leading-none', disabled && 'cursor-not-allowed')}
          >
            {title}
          </Label>
          <span className="text-ods-text-secondary text-h6">{description}</span>
        </div>
      </div>
    );
  },
);
CheckboxWithDescription.displayName = 'CheckboxWithDescription';

export { CheckboxWithDescription };
export type { CheckboxWithDescriptionProps };
