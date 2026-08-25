'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ComponentPropsWithoutRef, type ComponentRef, type ElementRef, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { Chevron02DownIcon } from '../icons-v2-generated/arrows/chevron-02-down-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { FieldWrapper } from './field-wrapper';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef<
  ComponentRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & {
    invalid?: boolean;
    label?: string;
    error?: string;
  }
>(({ className, children, invalid, label, error, ...props }, ref) => {
  const isInvalid = invalid || !!error;

  const trigger = (
    <SelectPrimitive.Trigger
      ref={ref}
      data-invalid={isInvalid || undefined}
      className={cn(
        // Layout & spacing - match Input
        // text-left resets the <button> UA default text-align:center, which the
        // SelectValue span inherits and would otherwise center short values,
        // reading as spurious left indentation on the selected value.
        'flex h-11 w-full items-center justify-between gap-2 rounded-[6px] border px-3 text-left outline-none md:h-12',
        // Typography - match Input exactly
        'text-h4',
        // Theme palette - match Input exactly
        'border-ods-border bg-ods-card text-ods-text-primary data-[placeholder]:text-ods-text-secondary',
        'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
        !isInvalid && 'data-[state=open]:border-ods-accent data-[state=open]:hover:border-ods-accent',
        'group',
        // Disabled - match Input exactly: value greys out, placeholder dims
        // further. The `data-[placeholder]` rule above is a class+attribute
        // selector, so the disabled placeholder rule stacks `:disabled` on top
        // of it to win on specificity rather than on source order.
        'disabled:!cursor-not-allowed disabled:bg-ods-bg',
        'disabled:text-ods-text-disabled disabled:data-[placeholder]:text-ods-border',
        // The chevron sets its own colour — grey it with the value.
        'disabled:[&_svg]:text-ods-text-disabled',
        'cursor-pointer transition-colors duration-200',
        '[&>span]:line-clamp-1',
        isInvalid &&
          'border-ods-error enabled:hover:border-ods-error enabled:active:border-ods-error data-[state=open]:border-ods-error',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Chevron02DownIcon
          className={cn(
            'shrink-0 text-ods-text-secondary transition-all duration-200 group-data-[state=open]:rotate-180',
            isInvalid ? 'text-ods-error' : 'group-data-[state=open]:text-ods-accent',
          )}
          size={24}
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );

  return (
    <FieldWrapper label={label} error={error}>
      {trigger}
    </FieldWrapper>
  );
});
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = forwardRef<
  ComponentRef<typeof SelectPrimitive.ScrollUpButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = forwardRef<
  ComponentRef<typeof SelectPrimitive.ScrollDownButton>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-default items-center justify-center py-1', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

const SelectContent = forwardRef<
  ComponentRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'relative z-[9999] max-h-96 overflow-hidden rounded-[4px] border border-ods-border bg-ods-card text-ods-text-primary',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className,
      )}
      position={position}
      style={{
        width: 'var(--radix-select-trigger-width)',
        minWidth: 'var(--radix-select-trigger-width)',
      }}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport className="w-full">{children}</SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn('py-1.5 pl-8 pr-2 font-semibold text-h6', className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = forwardRef<
  ComponentRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'flex h-11 w-full cursor-pointer select-none items-center justify-between border-b border-ods-border px-4 last:border-b-0 md:h-12',
      // Typography - match trigger
      'whitespace-nowrap text-h4',
      // Hover state with visible background change
      'outline-none hover:bg-ods-bg-hover data-[highlighted]:bg-ods-bg-surface',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'transition-colors duration-150',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator>
      <CheckIcon className="text-ods-accent" size={20} />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = forwardRef<
  ComponentRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn('-mx-1 my-1 h-px bg-ods-border', className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
