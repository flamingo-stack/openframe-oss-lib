"use client"

import { forwardRef, useState } from "react"
import { cn } from "../../utils/cn"
import { AlertCircle, ChevronDown } from "lucide-react"
import type { ErrorMessageDisplayProps } from "./types"

const ErrorMessageDisplay = forwardRef<HTMLDivElement, ErrorMessageDisplayProps>(
  ({ className, title, details, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = useState(false)

    return (
      <div
        ref={ref}
        className={cn(
          "bg-[var(--ods-attention-red-error-secondary)] border border-ods-error rounded-[6px] p-3 mb-2 flex items-start gap-3",
          className
        )}
        {...props}
      >
        <AlertCircle className="w-6 h-6 text-white flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg leading-6 text-white font-['DM_Sans'] font-medium">
              {title}
            </span>
            {details && (
              <button
                type="button"
                onClick={() => setIsExpanded(prev => !prev)}
                className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse error details" : "Expand error details"}
              >
                <ChevronDown
                  className={cn(
                    "w-5 h-5 text-white transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>
            )}
          </div>
          {details && isExpanded && (
            <span className="text-sm leading-5 text-white font-['DM_Sans'] font-medium mt-1">
              {details}
            </span>
          )}
        </div>
      </div>
    )
  }
)

ErrorMessageDisplay.displayName = "ErrorMessageDisplay"

export { ErrorMessageDisplay }
