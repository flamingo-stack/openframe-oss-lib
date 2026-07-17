"use client"

import * as React from "react"
import { cn } from "../../utils/cn"

export interface FieldWrapperProps {
  /** Label text displayed above the field */
  label?: string
  /** Status message displayed below the field. Wraps up to two lines, then ellipsizes. */
  error?: string
  /** Color variant for the message: "error" (red), "warning" (yellow), "success" (green) or "muted" (grey) */
  errorVariant?: "error" | "warning" | "success" | "muted"
  /** Additional className for the outer wrapper */
  className?: string
  children: React.ReactNode
}

const errorVariantClasses = {
  error: "text-ods-error",
  warning: "text-ods-warning",
  success: "text-ods-success",
  muted: "text-ods-text-secondary",
} as const

const FieldWrapper = React.forwardRef<HTMLDivElement, FieldWrapperProps>(
  ({ label, error, errorVariant = "error", className, children }, ref) => {
    const hasChrome = label != null || error != null

    return (
      <div ref={ref} className={cn(hasChrome ? "flex w-full flex-col" : "contents", className)}>
        {label && (
          <label className="text-h4 text-ods-text-primary mb-1">
            {label}
          </label>
        )}
        {children}
        {error && (
          <p
            className={cn("mt-1 text-h6 break-words line-clamp-2", errorVariantClasses[errorVariant])}
            title={error}
          >
            {error}
          </p>
        )}
      </div>
    )
  }
)
FieldWrapper.displayName = "FieldWrapper"

export { FieldWrapper }
