'use client';

import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Checkbox } from './checkbox';
import { Label } from './label';

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

/** The box over the checkbox's own (`CHECKBOX_BOX_CLASS`) at this block's size. `Checkbox` reads it for the box and
 *  for its skeleton. */
const CHECKBOX_WITH_DESCRIPTION_BOX_CLASS = 'mt-0.5 size-5';

const CheckboxWithDescription = forwardRef<HTMLDivElement, CheckboxWithDescriptionProps>(
  ({ id, checked, onCheckedChange, title, description, disabled, loading: loadingProp, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start gap-3 rounded-lg border border-ods-border bg-ods-card p-4',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        {/* The box switches itself: in a loading scope (or `loading`) it is its skeleton; the copy stays real. */}
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          loading={loadingProp}
          boxClassName={CHECKBOX_WITH_DESCRIPTION_BOX_CLASS}
          className="bg-ods-bg"
        />
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
