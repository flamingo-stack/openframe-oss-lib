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
  disabled?: boolean
  className?: string
}

const CheckboxBlock = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxBlockProps
>(({ id, checked, defaultChecked, onCheckedChange, label, disabled, className }, ref) => (
  <label
    htmlFor={id}
    className={cn(
      // Layout & spacing
      "flex items-center gap-3 rounded-[6px] border px-3 h-11 sm:h-12 w-full",
      // Theme palette
      "bg-[#212121] border-[#3a3a3a]",
      // Interactive states
      "cursor-pointer transition-colors duration-200",
      "hover:border-ods-accent/30",
      // Disabled state
      disabled && "opacity-50 cursor-not-allowed hover:border-[#3a3a3a]",
      className
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
        // Size
        "h-6 w-6 shrink-0",
        // Shape & border
        "rounded-[6px] border-2 border-[#888]",
        // Background
        "bg-[#212121]",
        // Focus states
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#212121]",
        // Disabled state
        "disabled:cursor-not-allowed",
        // Checked state
        "data-[state=checked]:bg-ods-accent data-[state=checked]:border-ods-accent"
      )}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-[#212121]"
      >
        <CheckIcon className="h-4 w-4" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    <span
      className={cn(
        // Typography matching Figma design
        "font-medium text-[18px] leading-6 text-ods-text-primary",
        // Prevent text selection when clicking
        "select-none"
      )}
    >
      {label}
    </span>
  </label>
))
CheckboxBlock.displayName = "CheckboxBlock"

export { CheckboxBlock }
export type { CheckboxBlockProps }

