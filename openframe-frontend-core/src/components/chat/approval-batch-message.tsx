"use client"

import { forwardRef, useState } from "react"
import { CheckCircle, XCircle } from "lucide-react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { Tag } from "../ui/tag"
import { ToolType } from "../platform"
import { ToolIcon } from "../tool-icon"
import { CheckCircleIcon, DotsLoaderIcon, XmarkCircleIcon } from "../icons-v2-generated"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import { ArgRow, ResultBlock } from "./tool-call-blocks"
import type {
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
}

const COMMAND_BODY_KEYS = new Set<string>(COMMAND_BODY_ARG_KEYS)

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
}

function ToolCallRow({ call, expanded, onToggle, batchStatus, execution }: ToolCallRowProps) {
  const command = getCommandText(call)
  const args = getArgEntries(call)
  const toolType = (call.toolType as ToolType) || ("OPENFRAME" as ToolType)
  const { innerRef, containerStyle } = useCollapsible({ expanded })
  const result = execution?.status === "done" ? execution.result : undefined
  const hasExpandableBody = args.length > 0 || (typeof result === "string" && result.length > 0)

  return (
    <div className="bg-ods-card border-b border-ods-border last:border-b-0 flex flex-col items-start w-full">
      <button
        type="button"
        onClick={onToggle}
        className="flex gap-2 items-start w-full p-3 cursor-pointer text-left"
      >
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ToolIcon toolType={toolType} size={16} />
        </div>
        <div
          className={cn(
            "flex-1 min-w-0 font-medium text-sm leading-5",
            expanded
              ? "text-ods-text-primary whitespace-pre-wrap break-all"
              : "text-ods-text-secondary line-clamp-2 max-h-10 break-all",
          )}
        >
          {command}
        </div>
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ExecutionStatusIcon batchStatus={batchStatus} execution={execution} />
        </div>
        <div className="flex items-center justify-center shrink-0 w-5 h-5">
          <ExpandChevron expanded={expanded} />
        </div>
      </button>

      <div className="w-full" style={containerStyle}>
        <div ref={innerRef}>
          {hasExpandableBody && (
            <div className="flex flex-col gap-2 items-start w-full text-sm font-medium leading-5 p-3 bg-ods-card">
              {args.map(([key, value]) => (
                <ArgRow key={key} argKey={key} value={value} />
              ))}
              {result && <ResultBlock result={result} />}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ApprovalBatchMessage = forwardRef<HTMLDivElement, ApprovalBatchMessageProps>(
  ({ className, data, onApprove, onReject, status = "pending", ...props }, ref) => {
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

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

    const showFooterBlock = explanations.length > 0 || status !== undefined

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border rounded-md overflow-hidden flex flex-col mb-2",
          className,
        )}
        {...props}
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
          />
        ))}

        {showFooterBlock && (
          <div className="bg-ods-card flex flex-col gap-2 items-start justify-center p-3">
            {explanations.length > 0 && (
              <ul className="list-disc pl-5 text-sm font-medium text-ods-text-primary leading-5 w-full">
                {explanations.map((expl, i) => (
                  <li key={i}>{expl}</li>
                ))}
              </ul>
            )}

            {status === "pending" ? (
              <div className="flex gap-2 items-center">
                <Button
                  size="small-legacy"
                  variant="accent"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className={cn(
                    "bg-ods-accent hover:bg-ods-accent/90",
                    "font-mono font-medium md:!text-sm text-ods-bg uppercase tracking-[-0.28px]",
                    "px-2 py-1 h-auto",
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
                    "font-mono font-medium md:!text-sm text-ods-text-primary uppercase tracking-[-0.28px]",
                    "hover:bg-ods-bg px-2 py-1 h-auto",
                  )}
                >
                  Reject
                </Button>
              </div>
            ) : (
              <div className="flex">
                <Tag
                  label={status === "approved" ? "Approved" : "Rejected"}
                  variant={status === "approved" ? "success" : "error"}
                  icon={
                    status === "approved" ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )
                  }
                />
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
)

ApprovalBatchMessage.displayName = "ApprovalBatchMessage"

export { ApprovalBatchMessage }
