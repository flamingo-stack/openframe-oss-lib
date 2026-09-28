'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { forwardRef } from 'react';

import { cn } from '../../utils/cn';
import { CheckboxCheckmarkIcon } from '../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon';
import { Label } from './label';

interface CheckboxWithDescriptionProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
  className?: string;
}

const CheckboxWithDescription = forwardRef<HTMLDivElement, CheckboxWithDescriptionProps>(
  ({ id, checked, onCheckedChange, title, description, disabled, className }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-ods-border bg-ods-card p-4',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          'peer mt-0.5 h-5 w-5 shrink-0 rounded-sm border border-ods-border bg-ods-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-ods-accent data-[state=checked]:bg-ods-accent',
        )}
      >
        <CheckboxPrimitive.Indicator className={cn('flex items-center justify-center text-ods-text-on-accent')}>
          <CheckboxCheckmarkIcon size={10} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
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
  ),
);
CheckboxWithDescription.displayName = 'CheckboxWithDescription';

export { CheckboxWithDescription };
export type { CheckboxWithDescriptionProps };
