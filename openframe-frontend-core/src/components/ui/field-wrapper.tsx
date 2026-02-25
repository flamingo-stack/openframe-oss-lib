"use client"

import * as React from "react"
import { cn } from "../../utils/cn"

export interface FieldWrapperProps {
  /** Label text displayed above the field */
  label?: string
  /** Error message displayed below the field. Space is always reserved to prevent layout shifts. */
  error?: string
  /** Additional className for the outer wrapper */
  className?: string
  children: React.ReactNode
}

const FieldWrapper = React.forwardRef<HTMLDivElement, FieldWrapperProps>(
  ({ label, error, className, children }, ref) => {
    return (
      <div ref={ref} className={cn("flex flex-col gap-1", className)}>
        {label && (
          <div className="text-[18px] font-medium leading-6 text-ods-text-primary">
            {label}
          </div>
        )}
        {children}
        <div className="min-h-[20px]">
          {error && (
            <p className="text-[14px] font-medium leading-5 text-ods-error">
              {error}
            </p>
          )}
        </div>
      </div>
    )
  }
)
FieldWrapper.displayName = "FieldWrapper"

export { FieldWrapper }
