"use client"

import { forwardRef, useState } from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { Tag } from "../ui/tag"
import { ToolType } from "../platform"
import { ToolIcon } from "../tool-icon"
import { CheckCircleIcon, DotsLoaderIcon, XmarkCircleIcon, XmarkIcon } from "../icons-v2-generated"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import { ArgRow, ResultBlock } from "./tool-call-blocks"
import type {
  ApprovalBlockVariant,
  AssistantType,
  ApprovalBatchExecutionState,
  ApprovalBatchSegment,
  PendingToolCallData,
} from "./types"
import {
  COMMAND_BODY_ARG_KEYS,
  getCommandText,
} from "./utils/tool-call-helpers"

export interface ApprovalBatchMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  data: ApprovalBatchSegment["data"]
  status?: ApprovalBatchSegment["status"]
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  /**
   * Cap the tool-call list height so it scrolls internally while the footer
   * (explanations + Approve/Reject) stays pinned below. Omit for the default
   * chat behaviour where the whole batch grows with its content.
   */
  maxBodyHeight?: number | string
  /** Display name of the user who resolved the request; shown as "by {name}" beside the status tag. */
  resolvedByName?: string | null
  /**
   * Per-tool execution status icon (queued dots → check/cross). On in dialog messages where tool
   * execution is tracked live; turn off for notifications, which have no execution state and would
   * otherwise show the dots spinner forever after approval. Defaults to on.
   */
  showExecutionStatus?: boolean
  /**
   * Chat identity. Kept for prop parity with the message renderers; does NOT
   * drive the styling anymore — use `variant` instead. An admin can be
   * looking at a Fae dialog (tickets dialog client tab) and must still see
   * the full admin block.
   */
  assistantType?: AssistantType
  /**
   * Viewer variant. `'admin'` (default) = full block with command preview,
   * expandable args/result and tool icon. `'client'` = end-client (Fae
   * desktop app) card that shows ONLY the BE-generated title(s) plus the
   * Approve/Reject buttons or the full-text resolved pill ("Approved by
   * {name}") — commands and scripts are never rendered.
   */
  variant?: ApprovalBlockVariant
  /**
   * Render the footer Approve/Reject buttons (or the resolved-status tag).
   * Turn off when the host owns the actions row — e.g. the approval
   * notification tile. Explanation bullets still render.
   */
  showFooterActions?: boolean
}

const COMMAND_BODY_KEYS = new Set<string>(COMMAND_BODY_ARG_KEYS)

export interface ApprovalStatusTagProps {
  status: ApprovalBatchSegment["status"]
  resolvedByName?: string | null
  inlineResolver?: boolean
}

/**
 * Terminal-status badge for a resolved approval batch (approved / rejected /
 * cancelled); renders nothing while pending. With `inlineResolver` the
 * resolver's name is baked into the tag as a single full-text pill
 * ("Approved by {name}"); otherwise callers render "by {name}" as a separate
 * muted span. Also used by the approval notification tile, which hosts the
 * actions row itself (`showFooterActions={false}`).
 */
export function ApprovalStatusTag({ status, resolvedByName, inlineResolver = false }: ApprovalStatusTagProps) {
  const suffix = inlineResolver && resolvedByName ? ` by ${resolvedByName}` : ""
  if (status === "approved") {
    return <Tag label={`Approved${suffix}`} variant="success" icon={<CheckCircleIcon className="w-4 h-4" />} />
  }
  if (status === "cancelled") {
    return <Tag label={`Canceled${suffix}`} variant="grey" icon={<XmarkIcon className="w-4 h-4" />} />
  }
  if (status === "rejected") {
    return <Tag label={`Rejected${suffix}`} variant="error" icon={<XmarkCircleIcon className="w-4 h-4" />} />
  }
  return null
}

function getArgEntries(call: PendingToolCallData): Array<[string, unknown]> {
  const args = call.toolCallArguments
  if (!args || typeof args !== "object") return []
  return Object.entries(args).filter(([k, v]) => !COMMAND_BODY_KEYS.has(k) && v !== null && v !== undefined && v !== "")
}

/**
 * Status icon for one tool call inside an approved/done batch.
 *  - pending batch     → null (chevron-only row, no status icon)
 *  - approved, no exec → DotsLoaderIcon (queued / waiting for backend)
 *  - executing         → DotsLoaderIcon
 *  - done + success    → green check
 *  - done + failure    → red cross
 */
function ExecutionStatusIcon({
  batchStatus,
  execution,
}: {
  batchStatus: ApprovalBatchSegment["status"]
  execution: ApprovalBatchExecutionState | undefined
}) {
  if (batchStatus !== "approved") return null
  if (!execution || execution.status === "executing") return <DotsLoaderIcon size={16} className="text-ods-text-secondary" />
  if (execution.success === false) return <XmarkCircleIcon className="w-4 h-4 text-ods-error" />
  return <CheckCircleIcon className="w-4 h-4 text-ods-success" />
}

interface ToolCallRowProps {
  call: PendingToolCallData
  expanded: boolean
  onToggle: () => void
  batchStatus: ApprovalBatchSegment["status"]
  execution: ApprovalBatchExecutionState | undefined
  showExecutionStatus: boolean
}

// ADMIN-only row: command preview header, expandable args/result. The client
// variant never renders tool calls — see the `variant === 'client'` branch of
// `<ApprovalBatchMessage>`.
function ToolCallRow({ call, expanded, onToggle, batchStatus, execution, showExecutionStatus }: ToolCallRowProps) {
  const command = getCommandText(call)
  const args = getArgEntries(call)
  const toolType = (call.toolType as ToolType) || ("OPENFRAME" as ToolType)
  const { innerRef, containerStyle } = useCollapsible({ expanded })
  const result = execution?.status === "done" ? execution.result : undefined
  const hasExpandableBody = args.length > 0 || (typeof result === "string" && result.length > 0)

  return (
    <div className="bg-ods-card flex flex-col items-start w-full border-b border-ods-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex gap-[var(--spacing-system-xsf)] items-start w-full p-[var(--spacing-system-sf)] cursor-pointer text-left"
      >
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ToolIcon toolType={toolType} size={16} />
        </div>
        <div
          className={cn(
            "flex-1 min-w-0 text-h6",
            expanded
              ? "text-ods-text-primary whitespace-pre-wrap break-all"
              : "text-ods-text-secondary line-clamp-2 max-h-10 break-all",
          )}
        >
          {command}
        </div>
        {showExecutionStatus && (
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            <ExecutionStatusIcon batchStatus={batchStatus} execution={execution} />
          </div>
        )}
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ExpandChevron expanded={expanded} />
        </div>
      </button>

      <div className="w-full" style={containerStyle}>
        <div ref={innerRef}>
          {hasExpandableBody && (
            <div className="flex flex-col gap-0 items-start w-full text-h6 px-[var(--spacing-system-sf)] pb-[var(--spacing-system-sf)] bg-ods-card">
              {args.map(([key, value]) => (
                <ArgRow key={key} argKey={key} value={value} />
              ))}
              {result && (
                <ResultBlock
                  result={result}
                  className={args.length > 0 ? "mt-[var(--spacing-system-xsf)]" : undefined}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ApprovalBatchMessage = forwardRef<HTMLDivElement, ApprovalBatchMessageProps>(
  ({ className, data, onApprove, onReject, status = "pending", maxBodyHeight, resolvedByName, showExecutionStatus = true, assistantType: _assistantType, variant = "admin", showFooterActions = true, ...props }, ref) => {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const isClient = variant === "client"

    const explanations = data.toolCalls
      .map((c) => c.toolExplanation?.trim())
      .filter((s): s is string => !!s)

    const handleApprove = async () => {
      setIsProcessing(true)
      try {
        await onApprove?.(data.approvalRequestId)
      } finally {
        setIsProcessing(false)
      }
    }

    const handleReject = async () => {
      setIsProcessing(true)
      try {
        await onReject?.(data.approvalRequestId)
      } finally {
        setIsProcessing(false)
      }
    }

    const actionButtons = (
      <>
        <Button
          size="small-legacy"
          variant="accent"
          onClick={handleApprove}
          disabled={isProcessing}
          className={cn(
            "bg-ods-accent hover:bg-ods-accent/90",
            "text-h5 text-ods-bg",
            "px-[var(--spacing-system-xsf)] h-8",
          )}
        >
          Approve
        </Button>
        <Button
          size="small-legacy"
          variant="outline"
          onClick={handleReject}
          disabled={isProcessing}
          className={cn(
            "bg-ods-card border-ods-border",
            "text-h5 text-ods-text-primary",
            "hover:bg-ods-bg px-[var(--spacing-system-xsf)] h-8",
          )}
        >
          Reject
        </Button>
      </>
    )

    // CLIENT (Fae end-user) card — Figma 203-11947 "fae-approval-block".
    // One bordered card: BE-generated title(s) + Approve/Reject buttons or the
    // full-text resolved pill ("Approved by {name}"). No commands, scripts,
    // expansion or execution icons — the end client must not see them.
    if (isClient) {
      const titles = data.toolCalls
        .map((c) => c.toolExplanation?.trim() || c.toolTitle?.trim())
        .filter((s): s is string => !!s)
      return (
        <div
          ref={ref}
          className={cn(
            "bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-mf)] mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-mf)]",
            className,
          )}
          {...props}
        >
          {titles.length > 0 ? (
            titles.map((title, i) => (
              <p key={i} className="text-h4 text-ods-text-primary whitespace-pre-line break-words w-full">
                {title}
              </p>
            ))
          ) : (
            <p className="text-h4 text-ods-text-primary w-full">Approval required</p>
          )}
          {showFooterActions && (status === "pending" ? (
            <div className="flex gap-[var(--spacing-system-mf)] items-center w-full">
              {actionButtons}
            </div>
          ) : (
            <div className="flex w-full">
              <ApprovalStatusTag status={status} resolvedByName={resolvedByName} inlineResolver />
            </div>
          ))}
        </div>
      )
    }

    const showFooterBlock = explanations.length > 0 || showFooterActions

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col mb-[var(--spacing-system-xsf)]",
          "bg-ods-card border border-ods-border rounded-md overflow-hidden",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "flex flex-col",
            maxBodyHeight != null && "overflow-y-auto overscroll-contain",
          )}
          style={maxBodyHeight != null ? { maxHeight: maxBodyHeight } : undefined}
        >
          {data.toolCalls.map((call) => (
            <ToolCallRow
              key={call.toolExecutionRequestId}
              call={call}
              expanded={expandedId === call.toolExecutionRequestId}
              onToggle={() =>
                setExpandedId((prev) =>
                  prev === call.toolExecutionRequestId ? null : call.toolExecutionRequestId,
                )
              }
              batchStatus={status}
              execution={data.executions?.[call.toolExecutionRequestId]}
              showExecutionStatus={showExecutionStatus}
            />
          ))}
        </div>

        {showFooterBlock && (
          <div className="flex flex-col gap-[var(--spacing-system-xsf)] items-start justify-center bg-ods-card border-t border-ods-border p-[var(--spacing-system-sf)]">
            {explanations.length > 0 && (
              <ul className="list-disc pl-5 text-h6 text-ods-text-primary w-full">
                {explanations.map((expl, i) => (
                  <li key={i}>{expl}</li>
                ))}
              </ul>
            )}

            {showFooterActions && (status === "pending" ? (
              <div className="flex gap-[var(--spacing-system-xsf)] items-center">
                {actionButtons}
              </div>
            ) : (
              <div className="flex items-center gap-[var(--spacing-system-xsf)]">
                <ApprovalStatusTag status={status} resolvedByName={resolvedByName} />
                {resolvedByName && (
                  <span className="text-h6 text-ods-text-secondary">by {resolvedByName}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  },
)

ApprovalBatchMessage.displayName = "ApprovalBatchMessage"

export { ApprovalBatchMessage }
