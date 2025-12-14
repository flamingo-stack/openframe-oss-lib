"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "../../utils/cn"
import { Label } from "./label"

interface CheckboxWithDescriptionProps {
  id: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  title: string
  description: string
  disabled?: boolean
  className?: string
}

const CheckboxWithDescription = React.forwardRef<
  HTMLDivElement,
  CheckboxWithDescriptionProps
>(({ id, checked, onCheckedChange, title, description, disabled, className }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-start gap-3 rounded-lg border border-ods-border bg-ods-card p-4",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}
  >
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        "peer h-5 w-5 shrink-0 rounded-sm border border-ods-border bg-ods-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-ods-accent data-[state=checked]:border-ods-accent mt-0.5"
      )}
    >
      <CheckboxPrimitive.Indicator
        className={cn("flex items-center justify-center text-ods-bg")}
      >
        <Check className="h-3.5 w-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={id}
        variant="small"
        spacing="tight"
        className={cn(
          "leading-none cursor-pointer",
          disabled && "cursor-not-allowed"
        )}
      >
        {title}
      </Label>
      <span className="text-sm text-ods-text-secondary leading-relaxed">
        {description}
      </span>
    </div>
  </div>
))
CheckboxWithDescription.displayName = "CheckboxWithDescription"

export { CheckboxWithDescription }
export type { CheckboxWithDescriptionProps }
