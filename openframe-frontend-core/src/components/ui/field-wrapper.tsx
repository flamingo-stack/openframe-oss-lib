"use client"

import * as React from "react"
import { cn } from "../../utils/cn"

export interface FieldWrapperProps {
  /** Label text displayed above the field */
  label?: string
  /**
   * Status message displayed below the field, on ONE line, ellipsized on
   * overflow (full text via the native `title`).
   *
   * It is positioned OUT OF FLOW (absolute, hanging below the wrapper), so it
   * never changes the field's height when it appears — the same treatment
   * `CheckboxBlock` uses. The trade is that it overlaps whatever sits directly
   * below: a form stacking fields needs at least ~20px of vertical gap (e.g.
   * `gap-[var(--spacing-system-lf)]`) for the message to land in clear space.
   */
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
      <div ref={ref} className={cn(hasChrome ? "relative flex w-full flex-col" : "contents", className)}>
        {label && (
          <label className="text-h4 text-ods-text-primary mb-1">
            {label}
          </label>
        )}
        {children}
        {error && (
          <p className={cn("absolute bottom-0 left-0 right-0 translate-y-full text-h6 truncate", errorVariantClasses[errorVariant])} title={error}>
            {error}
          </p>
        )}
      </div>
    )
  }
)
FieldWrapper.displayName = "FieldWrapper"

export { FieldWrapper }
