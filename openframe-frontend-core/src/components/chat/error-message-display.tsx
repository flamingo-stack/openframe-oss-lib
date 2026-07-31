"use client"

import { forwardRef, useState } from "react"
import { cn } from "../../utils/cn"
import { AlertCircleIcon } from "../icons-v2-generated"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import type { ErrorMessageDisplayProps } from "./types"

const iconTint = {
  error: "text-ods-error",
  warning: "text-ods-warning",
  info: "text-ods-text-secondary",
} as const

const ErrorMessageDisplay = forwardRef<HTMLDivElement, ErrorMessageDisplayProps>(
  ({ className, title, details, type = "error", ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    const { innerRef, containerStyle } = useCollapsible({ expanded })
    const hasDetails = Boolean(details)

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card rounded-md p-[var(--spacing-system-xsf)] mb-[var(--spacing-system-xsf)]",
          className
        )}
        {...props}
      >
        <button
          type="button"
          onClick={hasDetails ? () => setExpanded(prev => !prev) : undefined}
          aria-expanded={hasDetails ? expanded : undefined}
          aria-label={
            hasDetails ? (expanded ? "Collapse details" : "Expand details") : undefined
          }
          disabled={!hasDetails}
          className={cn(
            "flex w-full items-center gap-[var(--spacing-system-xsf)] text-left",
            hasDetails ? "cursor-pointer" : "cursor-default"
          )}
        >
          <AlertCircleIcon size={16} className={cn("shrink-0", iconTint[type])} />
          <span
            className={cn(
              "min-w-0 flex-1 text-h5",
              expanded ? "text-ods-text-primary" : "truncate text-ods-text-secondary"
            )}
          >
            {title}
          </span>
          {hasDetails && <ExpandChevron expanded={expanded} />}
        </button>

        {hasDetails && (
          <div style={containerStyle}>
            <div
              ref={innerRef}
              className="px-[var(--spacing-system-lf)] pt-[var(--spacing-system-xsf)]"
            >
              <p className="text-h6 text-ods-text-primary">
                {details}
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }
)

ErrorMessageDisplay.displayName = "ErrorMessageDisplay"

export { ErrorMessageDisplay }
