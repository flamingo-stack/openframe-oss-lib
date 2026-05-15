"use client"

import { forwardRef, useMemo, useState } from "react"

import { cn } from "../../utils/cn"
import { CheckCircleIcon, XmarkCircleIcon } from "../icons-v2-generated"
import { ToolType } from "../platform"
import { ToolIcon } from "../tool-icon"
import { PulseDots } from "../ui/pulse-dots"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import { ArgRow, ResultBlock } from "./tool-call-blocks"
import { COMMAND_BODY_ARG_KEYS } from "./utils/tool-call-helpers"
import type { ToolExecutionDisplayProps } from "./types"

const COMMAND_BODY_KEYS = new Set<string>(COMMAND_BODY_ARG_KEYS)

const ToolExecutionDisplay = forwardRef<HTMLDivElement, ToolExecutionDisplayProps>(
  ({ className, message, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    const { innerRef, containerStyle } = useCollapsible({ expanded })

    const isExecuting = message.type === "EXECUTING_TOOL"
    const isExecuted = message.type === "EXECUTED_TOOL"
    const integratedToolType = (message.integratedToolType as ToolType) || ("OPENFRAME" as ToolType)

    const previewText = useMemo(() => {
      const command = message.parameters?.command ?? message.parameters?.query
      if (command) return String(command)
      return message.toolFunction ?? ""
    }, [message.toolFunction, message.parameters])

    const argEntries = useMemo<Array<[string, unknown]>>(() => {
      if (!message.parameters || typeof message.parameters !== "object") return []
      return Object.entries(message.parameters).filter(
        ([k, v]) => !COMMAND_BODY_KEYS.has(k) && v !== null && v !== undefined && v !== "",
      )
    }, [message.parameters])

    const hasResult = isExecuted && typeof message.result === "string" && message.result.length > 0
    const hasBody = argEntries.length > 0 || hasResult || isExecuting

    const renderStatusIcon = () => {
      if (isExecuting) return <PulseDots size="sm" />
      if (isExecuted && message.success === true) return <CheckCircleIcon className="w-4 h-4 text-ods-success" />
      if (isExecuted && message.success === false) return <XmarkCircleIcon className="w-4 h-4 text-ods-error" />
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full flex flex-col",
          className,
        )}
        {...props}
      >
        <button
          type="button"
          className="flex gap-[var(--spacing-system-xs)] items-start p-[var(--spacing-system-s)] cursor-pointer text-left w-full"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            <ToolIcon toolType={integratedToolType} size={16} />
          </div>
          <div
            className={cn(
              "flex-1 min-w-0 text-sm font-medium leading-5",
              expanded
                ? "text-ods-text-primary whitespace-pre-wrap break-all"
                : "text-ods-text-secondary line-clamp-2 max-h-10 break-all",
            )}
          >
            {expanded ? message.toolFunction || previewText : previewText}
          </div>
          <div className="flex items-center justify-center shrink-0 w-5 h-5">{renderStatusIcon()}</div>
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            <ExpandChevron expanded={expanded} />
          </div>
        </button>

        <div className="w-full" style={containerStyle}>
          <div ref={innerRef}>
            {hasBody && (
              <div className="flex flex-col gap-2 items-start w-full text-sm font-medium leading-5 p-3 bg-ods-card">
                {argEntries.map(([key, value]) => (
                  <ArgRow key={key} argKey={key} value={value} />
                ))}
                {hasResult && <ResultBlock result={message.result} />}
                {isExecuting && (
                  <div className="flex flex-col gap-1 items-start w-full">
                    <span className="text-ods-text-secondary">Result:</span>
                    <PulseDots size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
)

ToolExecutionDisplay.displayName = "ToolExecutionDisplay"

export { ToolExecutionDisplay }
