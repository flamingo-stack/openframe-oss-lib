"use client"

import { forwardRef, useMemo, useState } from "react"

import { cn } from "../../utils/cn"
import { CheckCircleIcon, XmarkCircleIcon } from "../icons-v2-generated"
import { ToolType } from "../platform"
import { ToolIcon } from "../tool-icon"
import { PulseDots } from "../ui/pulse-dots"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import type { ToolExecutionDisplayProps } from "./types"

const ToolExecutionDisplay = forwardRef<HTMLButtonElement, ToolExecutionDisplayProps>(
  ({ className, message, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    const { innerRef, containerStyle } = useCollapsible({ expanded })

    const isExecuting = message.type === "EXECUTING_TOOL"
    const isExecuted = message.type === "EXECUTED_TOOL"
    const integratedToolType = message.integratedToolType || 'OPENFRAME'

    const previewText = useMemo(() => {
      const command = message.parameters?.command ?? message.parameters?.query
      if (command) return String(command)
      return message.toolFunction ?? ''
    }, [message.toolFunction, message.parameters])

    const formatValue = (value: unknown): string => {
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value)
      }
      return String(value)
    }

    const hasParams = message.parameters && Object.keys(message.parameters).length > 0
    const hasStatus = isExecuting || isExecuted

    const renderStatusIcon = () => {
      if (isExecuting) {
        return <PulseDots size="sm" />
      }
      if (isExecuted && message.success === true) {
        return <CheckCircleIcon className="w-4 h-4 text-ods-success" />
      }
      if (isExecuted && message.success === false) {
        return <XmarkCircleIcon className="w-4 h-4 text-ods-error" />
      }
      return null
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "bg-ods-card border border-ods-border rounded-[6px] flex gap-[var(--spacing-system-xs)] items-start p-[var(--spacing-system-s)] cursor-pointer text-left w-full",
          className
        )}
        onClick={() => setExpanded(!expanded)}
        {...props}
      >
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ToolIcon toolType={integratedToolType as ToolType} size={16} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex gap-2 items-start w-full">
            <div
              className={cn(
                "flex-1 min-w-0 text-sm font-medium leading-5",
                expanded
                  ? "text-ods-text-primary whitespace-pre-wrap break-all"
                  : "text-ods-text-secondary line-clamp-2 max-h-10 break-all"
              )}
            >
              {expanded ? message.toolFunction : previewText}
            </div>
            {hasStatus && (
              <div className="flex items-center justify-center shrink-0 w-5 h-5">
                {renderStatusIcon()}
              </div>
            )}
            <div className="flex items-center justify-center shrink-0 w-5 h-5">
              <ExpandChevron expanded={expanded} />
            </div>
          </div>

          <div className="w-full" style={containerStyle}>
            <div ref={innerRef} className="flex flex-col gap-2 pt-2">
              {hasParams && (
                <div className="flex flex-col items-start w-full text-sm font-medium leading-5">
                  {Object.entries(message.parameters ?? {}).map(([key, value]) => (
                    <div key={key} className="flex gap-1 items-start w-full">
                      <span className="shrink-0 text-ods-text-secondary overflow-hidden text-ellipsis">
                        {key}:
                      </span>
                      <span className="flex-1 min-w-0 text-ods-text-primary break-all">
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(isExecuting || (isExecuted && message.result)) && (
                <div className="flex flex-col items-start w-full">
                  <p className="text-sm font-medium leading-5 text-ods-text-secondary">
                    Result:
                  </p>
                  {isExecuted && message.result && (
                    <div className="text-sm font-medium leading-5 text-ods-text-primary whitespace-pre-wrap break-all">
                      {message.result}
                    </div>
                  )}
                  {isExecuting && <PulseDots size="sm" />}
                </div>
              )}
            </div>
          </div>
        </div>
      </button>
    )
  }
)

ToolExecutionDisplay.displayName = "ToolExecutionDisplay"

export { ToolExecutionDisplay }
