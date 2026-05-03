"use client"

import { forwardRef, useState } from "react"

import { cn } from "../../utils/cn"
import { PulseDots } from "../ui/pulse-dots"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import type { ThinkingDisplayProps } from "./types"

const ThinkingDisplay = forwardRef<HTMLDivElement, ThinkingDisplayProps>(
  ({ className, text, isStreaming = false, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    const { innerRef, isOverflowing, containerStyle } = useCollapsible({
      expanded,
      collapsedHeight: "1lh",
      disableTransition: isStreaming,
    })
    const label = isStreaming ? "Thinking" : "Thought"
    const canToggle = isOverflowing || expanded

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border p-1.5 rounded-[6px]",
          className
        )}
        {...props}
      >
        <button
          type="button"
          className={cn(
            "w-full flex items-start gap-3 text-left",
            canToggle ? "cursor-pointer" : "cursor-default"
          )}
          onClick={() => canToggle && setExpanded(!expanded)}
        >
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <span className="text-sm font-medium text-ods-text-secondary">
              {label}
            </span>
            {isStreaming && <PulseDots size="sm" />}
          </div>

          <div className="flex-1 min-w-0 pt-0.5" style={containerStyle}>
            <div ref={innerRef} className="text-sm text-ods-text-secondary whitespace-pre-wrap">
              {text}
            </div>
          </div>

          {canToggle && <ExpandChevron expanded={expanded} className="mt-1" />}
        </button>
      </div>
    )
  }
)

ThinkingDisplay.displayName = "ThinkingDisplay"

export { ThinkingDisplay }
