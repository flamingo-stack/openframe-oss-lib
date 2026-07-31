"use client"

import { cn } from "../../utils/cn"
import { formatToolArgValue, formatToolResult } from "./utils/tool-call-helpers"

/**
 * Monospace code body shared by ArgRow / ResultBlock.
 *
 * Uses the ODS `text-code` composite token (Azeret Mono 500, h6 responsive
 * scale, no transform) — the token this file was originally flagged for.
 */
const CODE_PRE_CLASS =
  "bg-ods-bg border border-ods-border rounded-md p-[var(--spacing-system-sf)] w-full max-h-64 overflow-auto overscroll-contain text-code text-ods-text-primary whitespace-pre"

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

/**
 * Raw command/script body as an unlabeled code block. Used by the CLIENT (Fae)
 * card in the expanded state, where the collapsed line shows the human-readable
 * `toolExplanation` and the actual command moves into the body (Figma 1972-6100).
 */
export function CommandBlock({ command, className }: { command: string; className?: string }) {
  if (!command) return null
  return (
    <pre className={cn(CODE_PRE_CLASS, className)}>
      <code>{command}</code>
    </pre>
  )
}
