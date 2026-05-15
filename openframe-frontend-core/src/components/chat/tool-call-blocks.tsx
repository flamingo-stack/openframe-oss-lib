"use client"

import { cn } from "../../utils/cn"
import { formatToolArgValue, formatToolResult } from "./utils/tool-call-helpers"

/**
 * Single arg row: inline `key: value` or labeled `<pre>` block.
 * Shared between ApprovalBatchMessage and ToolExecutionDisplay so both
 * surfaces render long script bodies / JSON the same way.
 */
export function ArgRow({ argKey, value }: { argKey: string; value: unknown }) {
  const formatted = formatToolArgValue(value)

  if (formatted.kind === "inline") {
    return (
      <div className="flex gap-1 items-start w-full">
        <span className="shrink-0 text-ods-text-secondary">{argKey}:</span>
        <span className="flex-1 min-w-0 text-ods-text-primary break-all">{formatted.text}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 items-start w-full">
      <span className="text-ods-text-secondary">{argKey}:</span>
      <pre className="bg-ods-bg border border-ods-border rounded-md p-3 w-full max-h-64 overflow-auto text-xs leading-5 text-ods-text-primary font-mono whitespace-pre">
        <code>{formatted.text}</code>
      </pre>
    </div>
  )
}

/**
 * Result block for a tool execution. Renders inline for short single-line
 * output and as a scrollable `<pre>` for code / JSON / multiline output.
 */
export function ResultBlock({ result, className }: { result: string | undefined | null; className?: string }) {
  const formatted = formatToolResult(result)
  if (!formatted.text) return null

  if (formatted.kind === "inline") {
    return (
      <div className={cn("flex flex-col gap-1 items-start w-full", className)}>
        <span className="text-ods-text-secondary">Result:</span>
        <span className="text-ods-text-primary break-all">{formatted.text}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-1 items-start w-full", className)}>
      <span className="text-ods-text-secondary">Result:</span>
      <pre className="bg-ods-bg border border-ods-border rounded-md p-3 w-full max-h-64 overflow-auto text-xs leading-5 text-ods-text-primary font-mono whitespace-pre">
        <code>{formatted.text}</code>
      </pre>
    </div>
  )
}
