"use client"

import { forwardRef, useState } from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { Tag } from "../ui/tag"
import { CheckCircle, XCircle } from "lucide-react"
import type { ApprovalRequestMessageProps } from "./types"
import type { ApprovalRequestField } from "./types/message.types"

/**
 * Stacked label/value rows for the approval card's structured field
 * list. Labels are tiny uppercase muted text; values render as primary
 * text with `whitespace-pre-wrap` so multi-line descriptions
 * (`content`, `resolution`, etc.) keep their structure. Mirrored across
 * the pending + resolved branches so an approved ticket reads the same
 * way it did at decision time.
 */
function ApprovalFieldList({ fields }: { fields: ApprovalRequestField[] }) {
  return (
    <dl className="flex flex-col gap-2.5 mt-1">
      {fields.map((f, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="font-['DM_Sans'] font-semibold text-[11px] uppercase tracking-wide text-ods-text-tertiary leading-4">
            {f.label}
          </dt>
          <dd className="font-['DM_Sans'] text-sm text-ods-text-primary leading-5 whitespace-pre-wrap break-words">
            {f.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Shared body for both pending and resolved branches of
 * `<ApprovalRequestMessage>`. The pending card adds Approve/Reject
 * buttons below; the resolved card adds an Approved/Rejected `<Tag>`.
 * Everything ABOVE the footer — command bar, icon, structured-fields
 * stack, explanation paragraph — is identical, so the body lives here
 * to prevent silent drift between the two render paths (a prior
 * version already had a `break-words` vs `break-all` mismatch on the
 * `<code>` element from an out-of-sync copy-paste edit).
 */
function ApprovalCardBody({
  data,
}: {
  data: ApprovalRequestMessageProps['data']
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="bg-ods-bg border border-ods-border rounded-md p-3 flex gap-2 items-start max-h-32 overflow-y-auto">
        <code className="font-['DM_Sans'] font-medium text-sm text-ods-text-primary flex-1 leading-5 whitespace-pre-wrap break-words">
          {data.command}
        </code>
        {data.icon && (
          <div className="w-4 h-4 shrink-0 text-ods-text-tertiary">
            {data.icon}
          </div>
        )}
      </div>
      {data.fields && data.fields.length > 0 ? (
        <ApprovalFieldList fields={data.fields} />
      ) : (
        data.explanation && (
          <p className="font-['DM_Sans'] font-medium text-sm text-ods-text-secondary leading-5 whitespace-pre-line break-words">
            {data.explanation}
          </p>
        )
      )}
    </div>
  )
}

const ApprovalRequestMessage = forwardRef<HTMLDivElement, ApprovalRequestMessageProps>(
  ({ className, data, onApprove, onReject, status = 'pending', ...props }, ref) => {
    const [isProcessing, setIsProcessing] = useState(false)

    const handleApprove = async () => {
      setIsProcessing(true)
      try {
        await onApprove?.(data.requestId)
      } finally {
        setIsProcessing(false)
      }
    }

    const handleReject = async () => {
      setIsProcessing(true)
      try {
        await onReject?.(data.requestId)
      } finally {
        setIsProcessing(false)
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border rounded-md p-4 mb-2 flex flex-col gap-4",
          className
        )}
        {...props}
      >
        <ApprovalCardBody data={data} />
        {status === 'pending' ? (
          <div className="flex gap-4 items-center">
            <Button
              size="small-legacy"
              variant="accent"
              onClick={handleApprove}
              disabled={isProcessing}
              className={cn(
                "bg-ods-accent hover:bg-ods-accent/90",
                "font-mono font-medium md:!text-sm text-ods-bg uppercase tracking-[-0.28px]",
                "px-2 py-1 h-auto"
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
                "hover:bg-ods-bg px-2 py-1 h-auto"
              )}
            >
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex">
            <Tag
              label={status === 'approved' ? 'Approved' : 'Rejected'}
              variant={status === 'approved' ? 'success' : 'error'}
              icon={status === 'approved' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            />
          </div>
        )}
      </div>
    )
  }
)

ApprovalRequestMessage.displayName = "ApprovalRequestMessage"

export { ApprovalRequestMessage }