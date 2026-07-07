"use client"

import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import * as React from "react"
import { CheckboxCheckmarkIcon } from "../icons-v2-generated/signs-and-symbols/checkbox-checkmark-icon"

import { cn } from "../../utils/cn"

interface CheckboxBlockProps {
  id?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Primary label (supports rich text / ReactNode for inline links) */
  label: React.ReactNode
  /** Optional secondary description below the label (supports rich text / ReactNode) */
  description?: React.ReactNode
  disabled?: boolean
  /** Error message displayed below the block (also triggers red border) */
  error?: string
  className?: string
}

const CheckboxBlock = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxBlockProps
>(({ id, checked, defaultChecked, onCheckedChange, label, description, disabled, error, className }, ref) => (
  <div className={cn("relative flex w-full flex-col", className)}>
    <label
      htmlFor={id}
      className={cn(
        "flex items-center gap-[var(--spacing-system-s)] rounded-md ring-1 ring-inset w-full",
        "p-[var(--spacing-system-sf)]",
        !description && "min-h-[44px] md:min-h-[48px]",
        description && "min-h-[60px] md:min-h-[64px]",
        "bg-ods-card ring-ods-border",
        "cursor-pointer transition-colors duration-200",
        "hover:ring-ods-accent/30",
        disabled && "opacity-50 cursor-not-allowed hover:ring-ods-border",
        error && "ring-ods-error",
      )}
    >
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        checked={checked}
        defaultChecked={defaultChecked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={cn(
          "h-4 w-4 md:h-6 md:w-6 shrink-0",
          "rounded-[6px] border-2",
          error ? "border-ods-error" : "border-[var(--color-border-strong)]",
          "bg-ods-card",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card",
          "disabled:cursor-not-allowed",
          "data-[state=checked]:bg-[var(--color-accent-primary)] data-[state=checked]:border-[var(--color-accent-primary)]"
        )}
      >
        <CheckboxPrimitive.Indicator
          className="flex items-center justify-center text-ods-text-on-accent"
        >
          <CheckboxCheckmarkIcon className="w-2 h-2 md:w-2.5 md:h-2.5" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="flex flex-1 flex-col justify-center min-w-0">
        <span className={cn(
          "text-h4 !leading-5 md:!leading-6",
          "text-ods-text-primary select-none break-words"
        )}>
          {label}
        </span>
        {description && (
          <span className={cn(
            "text-h6 !leading-4",
            "text-ods-text-secondary select-none break-words"
          )}>
            {description}
          </span>
        )}
      </div>
    </label>
    {error && (
      <p className="absolute bottom-0 left-0 right-0 translate-y-full text-h6 truncate text-ods-error" title={error}>
        {error}
      </p>
    )}
  </div>
))
CheckboxBlock.displayName = "CheckboxBlock"

export { CheckboxBlock }
export type { CheckboxBlockProps }
