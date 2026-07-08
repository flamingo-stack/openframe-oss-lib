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
import { ArgRow, CommandBlock, ResultBlock } from "./tool-call-blocks"
import type {
  AssistantType,
  ApprovalBatchExecutionState,
  ApprovalBatchSegment,
  PendingToolCallData,
} from "./types"
import {
  COMMAND_BODY_ARG_KEYS,
  getCommandBody,
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
   * Chat identity, which drives the styling variant. `'fae'` = client
   * (frameless outer, bordered command box, no tool icon, no divider,
   * full-text status pill); `'mingo'`/undefined = admin (original layout).
   */
  assistantType?: AssistantType
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
  isClient: boolean
}

function ToolCallRow({ call, expanded, onToggle, batchStatus, execution, showExecutionStatus, isClient }: ToolCallRowProps) {
  const command = getCommandText(call)
  const args = getArgEntries(call)
  const toolType = (call.toolType as ToolType) || ("OPENFRAME" as ToolType)
  const { innerRef, containerStyle } = useCollapsible({ expanded })
  const result = execution?.status === "done" ? execution.result : undefined
  // CLIENT (Fae): the collapsed line shows the human-readable `toolExplanation`
  // and the raw command moves into the expanded body (Figma 1972-6100). Falls
  // back to the command when no explanation is present. ADMIN is unchanged.
  const explanation = call.toolExplanation?.trim()
  const headerText = isClient && explanation ? explanation : command
  const commandBody = isClient ? getCommandBody(call.toolCallArguments) : undefined
  const hasExpandableBody = !!commandBody || args.length > 0 || (typeof result === "string" && result.length > 0)

  return (
    <div
      className={cn(
        "bg-ods-card flex flex-col items-start w-full",
        // ADMIN: rows share one outer card, separated by a bottom border.
        // CLIENT (Fae): each command is its own self-contained bordered box
        // (Figma 1092-2804 / 1972-7925) — the outer component is frameless.
        isClient
          ? "border border-ods-border rounded-[6px] overflow-hidden"
          : "border-b border-ods-border last:border-b-0",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex gap-[var(--spacing-system-xsf)] items-start w-full p-[var(--spacing-system-sf)] cursor-pointer text-left"
      >
        {!isClient && (
          <div className="flex items-center justify-center shrink-0 w-5 h-5">
            <ToolIcon toolType={toolType} size={16} />
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
          {headerText}
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
              {commandBody && (
                <CommandBlock
                  command={commandBody}
                  className={args.length > 0 || result ? "mb-[var(--spacing-system-xsf)]" : undefined}
                />
              )}
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
  ({ className, data, onApprove, onReject, status = "pending", maxBodyHeight, resolvedByName, showExecutionStatus = true, assistantType, showFooterActions = true, ...props }, ref) => {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const isClient = assistantType === "fae"

    // CLIENT (Fae) promotes each tool's `toolExplanation` to the command row's
    // header, so the footer must NOT repeat it as bullets. ADMIN keeps the
    // explanation bullets in the footer.
    const explanations = isClient
      ? []
      : data.toolCalls.map((c) => c.toolExplanation?.trim()).filter((s): s is string => !!s)

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

    const showFooterBlock = explanations.length > 0 || showFooterActions

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col mb-[var(--spacing-system-xsf)]",
          // ADMIN: one framed card. CLIENT (Fae): frameless container — the
          // bordered command box(es) + button/status row stacked 16px apart.
          isClient
            ? "gap-[var(--spacing-system-mf)]"
            : "bg-ods-card border border-ods-border rounded-md overflow-hidden",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "flex flex-col",
            isClient && "gap-[var(--spacing-system-mf)]",
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
              isClient={isClient}
            />
          ))}
        </div>

        {showFooterBlock && (
          <div
            className={cn(
              "flex flex-col gap-[var(--spacing-system-xsf)] items-start justify-center",
              // ADMIN: padded footer inside the card, divided from the list.
              // CLIENT (Fae): buttons/status sit flush outside the box.
              !isClient && "bg-ods-card border-t border-ods-border p-[var(--spacing-system-sf)]",
            )}
          >
            {explanations.length > 0 && (
              <ul className="list-disc pl-5 text-h6 text-ods-text-primary w-full">
                {explanations.map((expl, i) => (
                  <li key={i}>{expl}</li>
                ))}
              </ul>
            )}

            {showFooterActions && (status === "pending" ? (
              <div className="flex gap-[var(--spacing-system-xsf)] items-center">
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
              </div>
            ) : (
              <div className="flex items-center gap-[var(--spacing-system-xsf)]">
                <ApprovalStatusTag status={status} resolvedByName={resolvedByName} inlineResolver={isClient} />
                {!isClient && resolvedByName && (
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
