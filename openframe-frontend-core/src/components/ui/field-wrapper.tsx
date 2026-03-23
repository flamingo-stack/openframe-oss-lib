"use client"

import * as React from "react"
import { cn } from "../../utils/cn"

export interface FieldWrapperProps {
  /** Label text displayed above the field */
  label?: string
  /** Error message displayed below the field. Space is always reserved to prevent layout shifts. */
  error?: string
  /** Color variant for the error message: "error" (red) or "warning" (yellow) */
  errorVariant?: "error" | "warning"
  /** Additional className for the outer wrapper */
  className?: string
  children: React.ReactNode
}

const errorVariantClasses = {
  error: "text-ods-error",
  warning: "text-[var(--ods-attention-yellow-warning)]",
} as const

const FieldWrapper = React.forwardRef<HTMLDivElement, FieldWrapperProps>(
  ({ label, error, errorVariant = "error", className, children }, ref) => {
    const hasChrome = label != null || error != null

    return (
      <div ref={ref} className={cn(hasChrome ? "relative flex w-full flex-col" : "contents", className)}>
        {label && (
          <label className="text-[14px] md:text-[18px] font-medium leading-5 md:leading-6 text-ods-text-primary mb-1">
            {label}
          </label>
        )}
        {children}
        {error && (
          <p className={cn("absolute bottom-0 left-0 right-0 translate-y-full text-h6 truncate", errorVariantClasses[errorVariant])}>
            {error}
          </p>
        )}
      </div>
    )
  }
)
FieldWrapper.displayName = "FieldWrapper"

export { FieldWrapper }
