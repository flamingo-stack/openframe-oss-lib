"use client"

import { forwardRef, useMemo, useState } from "react"

import { cn } from "../../utils/cn"
import { CheckCircleIcon, DotsLoaderIcon, XmarkCircleIcon } from "../icons-v2-generated"
import { ToolType } from "../platform"
import { ToolIcon } from "../tool-icon"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import { ArgRow, ResultBlock } from "./tool-call-blocks"
import { COMMAND_BODY_ARG_KEYS, getToolCallTitle } from "./utils/tool-call-helpers"
import type { ToolExecutionDisplayProps } from "./types"

const COMMAND_BODY_KEYS = new Set<string>(COMMAND_BODY_ARG_KEYS)

const ToolExecutionDisplay = forwardRef<HTMLDivElement, ToolExecutionDisplayProps>(
  ({ className, message, assistantType, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    const { innerRef, containerStyle } = useCollapsible({ expanded })
    const isClient = assistantType === "fae"

    const isExecuting = message.type === "EXECUTING_TOOL"
    const isExecuted = message.type === "EXECUTED_TOOL"
    const integratedToolType = (message.integratedToolType as ToolType) || ("OPENFRAME" as ToolType)

    const previewText = useMemo(
      () =>
        getToolCallTitle({
          args: message.parameters,
          title: message.toolTitle,
          name: message.toolFunction,
        }),
      [message.parameters, message.toolTitle, message.toolFunction],
    )

    const argEntries = useMemo<Array<[string, unknown]>>(() => {
      if (!message.parameters || typeof message.parameters !== "object") return []
      return Object.entries(message.parameters).filter(
        ([k, v]) => !COMMAND_BODY_KEYS.has(k) && v !== null && v !== undefined && v !== "",
      )
    }, [message.parameters])

    const hasResult = isExecuted && typeof message.result === "string" && message.result.length > 0
    const hasBody = argEntries.length > 0 || hasResult || isExecuting

    const renderStatusIcon = () => {
      if (isExecuting) return <DotsLoaderIcon size={16} className="text-ods-text-secondary" />
      if (isExecuted && message.success === true) return <CheckCircleIcon className="w-4 h-4 text-ods-success" />
      if (isExecuted && message.success === false) return <XmarkCircleIcon className="w-4 h-4 text-ods-error" />
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          // The command running block keeps its bordered box in both chats
          // (Figma 1972-6109). CLIENT (Fae) only drops the tool icon below.
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
          {!isClient && (
            <div className="flex items-center justify-center shrink-0 w-5 h-5">
              <ToolIcon toolType={integratedToolType} size={16} />
            </div>
          )}
          <div
            className={cn(
              "flex-1 min-w-0 text-h6",
              expanded
                ? "text-ods-text-primary whitespace-pre-wrap break-all"
                : "text-ods-text-secondary line-clamp-2 max-h-10 break-all",
            )}
          >
            {previewText}
          </div>
          <div className="flex items-center justify-center shrink-0 w-5 h-5">{renderStatusIcon()}</div>
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            <ExpandChevron expanded={expanded} />
          </div>
        </button>

        <div className="w-full" style={containerStyle}>
          <div ref={innerRef}>
            {hasBody && (
              <div className="flex flex-col gap-0 items-start w-full text-h6 p-[var(--spacing-system-sf)] bg-ods-card">
                {argEntries.map(([key, value]) => (
                  <ArgRow key={key} argKey={key} value={value} />
                ))}
                {hasResult && (
                  <ResultBlock
                    result={message.result}
                    className={argEntries.length > 0 ? "mt-[var(--spacing-system-xsf)]" : undefined}
                  />
                )}
                {isExecuting && (
                  <div
                    className={cn(
                      "flex flex-col gap-[var(--spacing-system-xxs)] items-start w-full",
                      argEntries.length > 0 && "mt-[var(--spacing-system-xsf)]",
                    )}
                  >
                    <span className="text-ods-text-secondary">Result:</span>
                    <DotsLoaderIcon size={16} className="text-ods-text-secondary" />
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
