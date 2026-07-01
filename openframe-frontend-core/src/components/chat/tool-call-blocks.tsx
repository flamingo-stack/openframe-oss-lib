"use client"

import { cn } from "../../utils/cn"
import { formatToolArgValue, formatToolResult } from "./utils/tool-call-helpers"

/**
 * Monospace code body shared by ArgRow / ResultBlock.
 *
 * NOTE: ODS exposes no mono/code typography token (only the composite
 * `text-h1`–`text-h6` DM Sans / Azeret-Mono headings), so the 12px code size
 * stays as `text-xs` here. Flagged for a future `text-code` token rather than
 * forcing an h-class that would change the intended density.
 */
const CODE_PRE_CLASS =
  "bg-ods-bg border border-ods-border rounded-md p-[var(--spacing-system-sf)] w-full max-h-64 overflow-auto text-xs leading-5 text-ods-text-primary font-mono whitespace-pre"

/**
 * Single arg row: inline `key: value` or labeled `<pre>` block.
 * Shared between ApprovalBatchMessage and ToolExecutionDisplay so both
 * surfaces render long script bodies / JSON the same way.
 */
export function ArgRow({ argKey, value }: { argKey: string; value: unknown }) {
  const formatted = formatToolArgValue(value)

  if (formatted.kind === "inline") {
    return (
      <div className="flex gap-[var(--spacing-system-xxs)] items-start w-full">
        <span className="shrink-0 text-ods-text-secondary">{argKey}:</span>
        <span className="flex-1 min-w-0 text-ods-text-primary break-all">{formatted.text}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] items-start w-full">
      <span className="text-ods-text-secondary">{argKey}:</span>
      <pre className={CODE_PRE_CLASS}>
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
      <div className={cn("flex flex-col gap-[var(--spacing-system-xxs)] items-start w-full", className)}>
        <span className="text-ods-text-secondary">Result:</span>
        <span className="text-ods-text-primary break-all">{formatted.text}</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-[var(--spacing-system-xxs)] items-start w-full", className)}>
      <span className="text-ods-text-secondary">Result:</span>
      <pre className={CODE_PRE_CLASS}>
        <code>{formatted.text}</code>
      </pre>
    </div>
  )
}
