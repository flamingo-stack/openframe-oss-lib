"use client"

import { forwardRef, useState } from "react"

import { Chevron02DownIcon, Chevron02UpIcon } from "../icons-v2-generated"
import { PulseDots } from "../ui/pulse-dots"
import { SimpleMarkdownRenderer } from "../ui/simple-markdown-renderer"
import { cn } from "../../utils/cn"
import type { ContextCompactionDisplayProps } from "./types"

const ContextCompactionDisplay = forwardRef<HTMLDivElement, ContextCompactionDisplayProps>(
  ({ className, status, summary, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)

    const isStarted = status === 'started'
    const isCompleted = status === 'completed'
    const hasSummary = isCompleted && !!summary
    const isExpandable = hasSummary

    const handleToggle = () => {
      if (isExpandable) {
        setExpanded(!expanded)
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border p-1.5 rounded-[6px]",
          className
        )}
        {...props}
      >
        {isStarted && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <span className="text-sm font-medium text-ods-text-secondary">
                Compacting
              </span>
              <PulseDots size="sm" />
            </div>
            <Chevron02DownIcon className="w-4 h-4 text-ods-text-secondary shrink-0" />
          </div>
        )}

        {isCompleted && !hasSummary && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-ods-text-secondary flex-1 min-w-0">
              Context summarized
            </span>
          </div>
        )}

        {isCompleted && hasSummary && (
          <button
            type="button"
            className="w-full flex items-start gap-2 cursor-pointer text-left"
            onClick={handleToggle}
          >
            {!expanded ? (
              <>
                <span className="text-sm font-medium text-ods-text-secondary flex-1 min-w-0">
                  Context summarized
                </span>
                <Chevron02DownIcon className="w-4 h-4 text-ods-text-secondary shrink-0" />
              </>
            ) : (
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ods-text-secondary flex-1 min-w-0">
                    Context summarized
                  </span>
                  <Chevron02UpIcon className="w-4 h-4 text-ods-text-secondary shrink-0" />
                </div>
                {summary && (
                  <div className="text-sm font-medium text-ods-text-primary">
                    <SimpleMarkdownRenderer content={summary} />
                  </div>
                )}
              </div>
            )}
          </button>
        )}
      </div>
    )
  }
)

ContextCompactionDisplay.displayName = "ContextCompactionDisplay"

export { ContextCompactionDisplay }
