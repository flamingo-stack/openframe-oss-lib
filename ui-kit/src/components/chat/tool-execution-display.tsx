"use client"

import { useState, useEffect, forwardRef, HTMLAttributes } from "react"
import { cn } from "../../utils/cn"
import { ToolIcon } from "../tool-icon"
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, ArrowRightIcon } from "lucide-react"
import { ToolType } from "../platform"

export interface ToolExecutionMessage {
  type: "EXECUTING_TOOL" | "EXECUTED_TOOL"
  integratedToolType: string
  toolFunction: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
}

export interface ToolExecutionDisplayProps extends HTMLAttributes<HTMLDivElement> {
  message: ToolExecutionMessage
  isExpanded?: boolean
  onToggleExpand?: () => void
}

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

    const formatToolName = (toolType: string) => {
      return toolType.replace(/_/g, ' ')
    }

    const formatParameters = (params: Record<string, any>) => {
      return Object.entries(params).map(([key, value]) => {
        let displayValue = value
        if (typeof value === 'object' && value !== null) {
          displayValue = JSON.stringify(value, null, 2)
        } else if (typeof value === 'string' && value.length > 100) {
          displayValue = value.substring(0, 100) + '...'
        }
        return { key, value: displayValue }
      })
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg bg-ods-bg-card overflow-hidden transition-all duration-200",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div
          className="flex flex-col gap-2 px-4 py-3 cursor-pointer hover:bg-ods-bg-secondary/80 transition-colors"
          onClick={handleToggle}
        >
          {/* First Row: Expand Icon + Tool Icon + Tool Name + Status */}
          <div className="flex items-center gap-3">
            {/* Expand/Collapse Icon */}
            <button className="p-0 w-5 h-5 flex items-center justify-center text-ods-text-secondary hover:text-ods-text-primary transition-colors flex-shrink-0">
              {expanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Tool Icon */}
            <div className="flex-shrink-0">
              <ToolIcon toolType={message.integratedToolType as ToolType} size={20} />
            </div>

            {/* Tool Name */}
            <span className="text-sm font-medium text-ods-text-primary flex-1">
              {formatToolName(message.integratedToolType)}
            </span>

            {/* Status Indicator */}
            <div className="flex-shrink-0">
              {isExecuting && (
                <Loader2 className="w-4 h-4 text-ods-info animate-spin" />
              )}
              {isExecuted && message.success === true && (
                <CheckCircle2 className="w-4 h-4 text-ods-success" />
              )}
              {isExecuted && message.success === false && (
                <XCircle className="w-4 h-4 text-ods-error" />
              )}
            </div>
          </div>

          {/* Second Row: Tool Function (aligned to start) */}
          <div className="flex items-center gap-1 text-sm text-ods-text-secondary ml-0">
            <ArrowRightIcon className="w-4 h-4 flex-shrink-0" />
            <span className="break-all">{message.toolFunction}</span>
          </div>
        </div>

        {/* Expanded Content */}
        {expanded && (
          <div className="px-4 pb-3 border-t border-ods-border/50">
            {/* Parameters Section (for executing) */}
            {isExecuting && message.parameters && Object.keys(message.parameters).length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-medium text-ods-text-secondary mb-2 uppercase tracking-wider">
                  Parameters
                </h4>
                <div className="bg-ods-bg/50 rounded-md p-3 space-y-2">
                  {formatParameters(message.parameters).map(({ key, value }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className="text-xs text-ods-text-secondary">{key}:</span>
                      <pre className="text-xs text-ods-text-primary font-mono whitespace-pre-wrap break-all">
                        {value}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parameters Used section */}
            {isExecuted && message.parameters && Object.keys(message.parameters).length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-medium text-ods-text-secondary mb-2 uppercase tracking-wider">
                  Parameters Used
                </h4>
                <div className="bg-ods-bg/50 rounded-md p-3 space-y-2">
                  {formatParameters(message.parameters).map(({ key, value }) => (
                    <div key={key} className="flex flex-col gap-1">
                      <span className="text-xs text-ods-text-secondary">{key}:</span>
                      <pre className="text-xs text-ods-text-primary font-mono whitespace-pre-wrap break-all">
                        {value}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result Section */}
            {isExecuted && message.result && (
              <div className="mt-3">
                <h4 className="text-xs font-medium text-ods-text-secondary mb-2 uppercase tracking-wider">
                  Result
                </h4>
                <div className={cn(
                  "rounded-md p-3",
                  message.success
                    ? "bg-green-500/10 border border-green-500/20"
                    : "bg-red-500/10 border border-red-500/20"
                )}>
                  <pre className="text-xs text-ods-text-primary font-mono whitespace-pre-wrap break-all">
                    {message.result}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
)

ToolExecutionDisplay.displayName = "ToolExecutionDisplay"

export { ToolExecutionDisplay }