"use client"

import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"
import { useState, useEffect, forwardRef, useMemo } from "react"

import { ToolType } from "../platform"
import { ToolIcon } from "../tool-icon"
import { PulseDots } from "../ui/pulse-dots"
import { cn } from "../../utils/cn"
import type { ToolExecutionDisplayProps } from "./types"

const ToolExecutionDisplay = forwardRef<HTMLDivElement, ToolExecutionDisplayProps>(
  ({ className, message, isExpanded = false, onToggleExpand, ...props }, ref) => {
    const [localExpanded, setLocalExpanded] = useState(isExpanded)

    useEffect(() => {
      setLocalExpanded(isExpanded)
    }, [isExpanded])

    const handleToggle = () => {
      if (onToggleExpand) {
        onToggleExpand()
      } else {
        setLocalExpanded(!localExpanded)
      }
    }

    const isExecuting = message.type === "EXECUTING_TOOL"
    const isExecuted = message.type === "EXECUTED_TOOL"
    const expanded = onToggleExpand ? isExpanded : localExpanded
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

    const renderStatusIcon = () => {
      if (isExecuting) {
        return <PulseDots size="sm" />
      }
      if (isExecuted && message.success === true) {
        return <CheckCircle2 className="w-4 h-4 text-ods-success" />
      }
      if (isExecuted && message.success === false) {
        return <XCircle className="w-4 h-4 text-ods-error" />
      }
      return null
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        className={cn(
          "bg-ods-card border border-ods-border rounded-[6px] flex gap-2 items-start p-1.5 cursor-pointer text-left w-full",
          className
        )}
        onClick={handleToggle}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {/* Tool Icon */}
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ToolIcon toolType={integratedToolType as ToolType} size={16} />
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 min-h-px">
          {!expanded ? (
            <div className="h-5 overflow-hidden text-sm font-medium leading-5 text-ods-text-secondary truncate">
              {previewText}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-start w-full">
                <div className="flex-1 min-w-0 min-h-px text-sm font-medium leading-5 text-ods-text-primary whitespace-pre-wrap break-all">
                  {message.toolFunction}
                </div>
                {(isExecuting || isExecuted) && (
                  <>
                    <div className="flex items-center justify-center shrink-0 w-5 h-5">
                      {renderStatusIcon()}
                    </div>
                    <div className="flex items-center justify-center shrink-0 w-5 h-5">
                      <ChevronUp className="w-4 h-4 text-ods-text-secondary" />
                    </div>
                  </>
                )}
              </div>

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

              {/* Result Section */}
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
                  {isExecuting && (
                    <PulseDots size="sm" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!expanded && (
          <>
            {(isExecuting || isExecuted) && (
              <div className="flex items-center justify-center shrink-0 w-5 h-5">
                {renderStatusIcon()}
              </div>
            )}
            <div className="flex items-center justify-center shrink-0 w-5 h-5">
              <ChevronDown className="w-4 h-4 text-ods-text-secondary" />
            </div>
          </>
        )}

        {expanded && !isExecuting && !isExecuted && (
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            <ChevronUp className="w-4 h-4 text-ods-text-secondary" />
          </div>
        )}
      </button>
    )
  }
)

ToolExecutionDisplay.displayName = "ToolExecutionDisplay"

export { ToolExecutionDisplay }
