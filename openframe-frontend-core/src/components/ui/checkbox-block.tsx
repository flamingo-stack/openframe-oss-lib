"use client"

import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import * as React from "react"
import { CheckIcon } from "../icons-v2-generated/signs-and-symbols/check-icon"

import { cn } from "../../utils/cn"

interface CheckboxBlockProps {
  id?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label: string
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
        "flex items-center gap-3 rounded-[6px] border w-full",
        "p-[var(--spacing-system-sf)]",
        "bg-ods-card border-ods-border",
        "cursor-pointer transition-colors duration-200",
        "hover:border-ods-accent/30",
        disabled && "opacity-50 cursor-not-allowed hover:border-ods-border",
        error && "border-ods-error",
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
          "h-6 w-6 shrink-0",
          "rounded-[6px] border-2",
          error ? "border-ods-error" : "border-[var(--color-border-strong)]",
          "bg-ods-card",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ods-card",
          "disabled:cursor-not-allowed",
          "data-[state=checked]:bg-[var(--color-accent-primary)] data-[state=checked]:border-[var(--color-accent-primary)]"
        )}
      >
        <CheckboxPrimitive.Indicator
          className="flex items-center justify-center text-ods-card"
        >
          <CheckIcon className="h-4 w-4" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="flex flex-1 flex-col justify-center min-w-0">
        <span className={cn(
          "font-[family-name:var(--font-h4-family)] font-[number:var(--font-h4-weight)] text-[length:var(--font-size-h4-body)] leading-[21.5px]",
          "text-ods-text-primary select-none"
        )}>
          {label}
        </span>
        {description && (
          <span className={cn(
            "font-[family-name:var(--font-h6-family)] font-[number:var(--font-h6-weight)] text-[length:var(--font-size-h6-caption)] leading-[16.5px]",
            "text-ods-text-secondary select-none"
          )}>
            {description}
          </span>
        )}
      </div>
    </label>
    {error && (
      <p className="absolute bottom-0 left-0 right-0 translate-y-full text-h6 truncate text-ods-error">
        {error}
      </p>
    )}
  </div>
))
CheckboxBlock.displayName = "CheckboxBlock"

export { CheckboxBlock }
export type { CheckboxBlockProps }
