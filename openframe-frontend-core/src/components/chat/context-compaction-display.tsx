"use client"

import { forwardRef } from "react"

import { cn } from "../../utils/cn"
import { CheckCircleIcon } from "../icons-v2-generated"
import { PulseDots } from "../ui/pulse-dots"
import type { ContextCompactionDisplayProps } from "./types"


const ContextCompactionDisplay = forwardRef<HTMLDivElement, ContextCompactionDisplayProps>(
  ({ className, status, ...props }, ref) => {
    const isStarted = status === 'started'
    const label = isStarted
      ? "Context limit reached. Summarizing earlier messages."
      : "Earlier context summarized."

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border p-1.5 rounded-[6px] flex items-center gap-2",
          className
        )}
        {...props}
      >
        <span className="text-sm font-medium text-ods-text-secondary flex-1 min-w-0">
          {label}
        </span>
        {isStarted ? (
          <PulseDots size="sm" />
        ) : (
          <CheckCircleIcon className="w-4 h-4 text-ods-success shrink-0" />
        )}
      </div>
    )
  }
)

ContextCompactionDisplay.displayName = "ContextCompactionDisplay"

export { ContextCompactionDisplay }
