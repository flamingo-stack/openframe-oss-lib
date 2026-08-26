"use client"

import { Label } from './label'
import * as React from "react"
import { cn } from "../../utils/cn"

export interface FieldWrapperProps {
  /** Label text displayed above the field */
  label?: string
  /**
   * `id` of the control the label names. Without it the label is decoration:
   * clicking it focuses nothing and assistive tech reads the field unnamed,
   * which is why every caller that cared was rendering its own <Label> instead
   * of using `label` here.
   */
  htmlFor?: string
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
  /**
   * Label scale. Default is the standard form-label scale (text-h6).
   * "large" (text-h4) is for screens whose design specifies body-scale field
   * titles (e.g. the devices New Device page) — opt in per call site, the
   * default stays the converged small scale.
   */
  labelVariant?: "default" | "large"
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
  ({ label, htmlFor, error, errorVariant = "error", labelVariant = "default", className, children }, ref) => {
    const hasChrome = label != null || error != null

    return (
      <div ref={ref} className={cn(hasChrome ? "relative flex w-full flex-col" : "contents", className)}>
        {label && (
          // Default is text-h6, NOT text-h4: `Field` (ui/field.tsx) renders its
          // label via `Label variant="small"` = text-h6, and every form that
          // mixes Field-wrapped controls with `label=`-prop controls showed two
          // label sizes side by side — the exact inconsistency the admin
          // editors kept reporting. One label scale, owned here and in Field
          // together; `labelVariant` is the per-design opt-out.
          <Label className="mb-1" htmlFor={htmlFor} variant={labelVariant}>
            {label}
          </Label>
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
