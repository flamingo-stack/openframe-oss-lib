"use client"

import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "../../utils/cn"

export interface FilterCheckboxItemProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  count?: number
  className?: string
}

export function FilterCheckboxItem({
  label,
  checked,
  onChange,
  count,
  className,
}: FilterCheckboxItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 bg-ods-card border-b border-ods-border last:border-b-0",
        "cursor-pointer transition-colors hover:bg-ods-bg-hover",
        count !== undefined ? "px-4 py-3" : "p-3",
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={(c) => onChange(c === true)}
        className={cn(
          "h-6 w-6 shrink-0 rounded-[6px] border-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent",
          checked
            ? "bg-ods-accent border-ods-accent"
            : "bg-ods-card border-ods-text-secondary",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-ods-bg" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <span className="flex-1 text-h4 text-ods-text-primary">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-h5 text-ods-text-secondary shrink-0">
          {count.toLocaleString()}
        </span>
      )}
    </div>
  )
}
