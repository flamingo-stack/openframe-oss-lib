"use client"

import { forwardRef, useState } from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { Tag } from "../ui/tag"
import { Ban, CheckCircle, XCircle } from "lucide-react"
import { ApprovalStatusTag } from "./approval-batch-message"
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
    <dl className="flex flex-col gap-2.5 mt-[var(--spacing-system-xxs)]">
      {fields.map((f, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="text-h6 font-semibold uppercase text-ods-text-tertiary">
            {f.label}
          </dt>
          <dd className="text-h6 text-ods-text-primary whitespace-pre-wrap break-words">
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
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div className="bg-ods-bg border border-ods-border rounded-md p-[var(--spacing-system-sf)] flex gap-[var(--spacing-system-xsf)] items-start max-h-32 overflow-y-auto overscroll-contain">
        <code className="text-code text-ods-text-primary flex-1 whitespace-pre-wrap break-words">
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
          <p className="text-h6 text-ods-text-secondary whitespace-pre-line break-words">
            {data.explanation}
          </p>
        )
      )}
    </div>
  )
}

const ApprovalRequestMessage = forwardRef<HTMLDivElement, ApprovalRequestMessageProps>(
  // `assistantType` is accepted for prop-parity with the batch card (so hosts
  // can forward it uniformly); the viewer variant is driven by `variant`.
  ({ className, data, onApprove, onReject, status = 'pending', assistantType: _assistantType, variant = 'admin', resolvedByName, ...props }, ref) => {
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

    // CLIENT (Fae end-user) card — Figma 203-11947 "fae-approval-block".
    // Shows ONLY the BE-generated title (`explanation`) plus the actions row
    // or the full-text resolved pill; the raw command is never rendered.
    if (variant === 'client') {
      return (
        <div
          ref={ref}
          className={cn(
            "bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-mf)] mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-mf)]",
            className
          )}
          {...props}
        >
          <p className="text-h4 text-ods-text-primary whitespace-pre-line break-words w-full">
            {data.explanation?.trim() || "Approval required"}
          </p>
          {status === 'pending' ? (
            <div className="flex gap-[var(--spacing-system-mf)] items-center w-full">
              <Button
                size="small-legacy"
                variant="accent"
                onClick={handleApprove}
                disabled={isProcessing}
                className={cn(
                  "bg-ods-accent hover:bg-ods-accent/90",
                  "text-h5 text-ods-bg",
                  "px-[var(--spacing-system-xsf)] h-8"
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
                  "hover:bg-ods-bg px-[var(--spacing-system-xsf)] h-8"
                )}
              >
                Reject
              </Button>
            </div>
          ) : (
            <div className="flex w-full">
              <ApprovalStatusTag status={status} resolvedByName={resolvedByName} inlineResolver />
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-mf)] mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-mf)]",
          className
        )}
        {...props}
      >
        <ApprovalCardBody data={data} />
        {status === 'pending' ? (
          <div className="flex gap-[var(--spacing-system-mf)] items-center">
            <Button
              size="small-legacy"
              variant="accent"
              onClick={handleApprove}
              disabled={isProcessing}
              className={cn(
                "bg-ods-accent hover:bg-ods-accent/90",
                "text-h5 text-ods-bg",
                "px-[var(--spacing-system-xsf)] h-8"
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
                "hover:bg-ods-bg px-[var(--spacing-system-xsf)] h-8"
              )}
            >
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex">
            {status === 'approved' ? (
              <Tag label="Approved" variant="success" icon={<CheckCircle className="w-4 h-4" />} />
            ) : status === 'cancelled' ? (
              <Tag label="Canceled" variant="grey" icon={<Ban className="w-4 h-4" />} />
            ) : (
              <Tag label="Rejected" variant="error" icon={<XCircle className="w-4 h-4" />} />
            )}
          </div>
        )}
      </div>
    )
  }
)

ApprovalRequestMessage.displayName = "ApprovalRequestMessage"

export { ApprovalRequestMessage }