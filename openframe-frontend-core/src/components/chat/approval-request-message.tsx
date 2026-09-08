'use client';

import { Ban, CheckCircle, XCircle } from 'lucide-react';
import { forwardRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';
import { Tag } from '../ui/tag';
import { ApprovalStatusTag } from './approval-batch-message';
import type { ApprovalRequestMessageProps } from './types';
import type { ApprovalRequestField } from './types/message.types';

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
    <dl className="mt-[var(--spacing-system-xxs)] flex flex-col gap-2.5">
      {fields.map((f, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="font-semibold uppercase text-ods-text-tertiary text-h6">{f.label}</dt>
          <dd className="whitespace-pre-wrap break-words text-ods-text-primary text-h6">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
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
function ApprovalCardBody({ data }: { data: ApprovalRequestMessageProps['data'] }) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex max-h-32 items-start gap-[var(--spacing-system-xsf)] overflow-y-auto overscroll-contain rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)]">
        <code className="flex-1 whitespace-pre-wrap break-words text-ods-text-primary text-code">{data.command}</code>
        {data.icon && <div className="h-4 w-4 shrink-0 text-ods-text-tertiary">{data.icon}</div>}
      </div>
      {data.fields && data.fields.length > 0 ? (
        <ApprovalFieldList fields={data.fields} />
      ) : (
        data.explanation && (
          <p className="whitespace-pre-line break-words text-ods-text-secondary text-h6">{data.explanation}</p>
        )
      )}
    </div>
  );
}

const ApprovalRequestMessage = forwardRef<HTMLDivElement, ApprovalRequestMessageProps>(
  // `assistantType` is accepted for prop-parity with the batch card (so hosts
  // can forward it uniformly); the viewer variant is driven by `variant`.
  (
    {
      className,
      data,
      onApprove,
      onReject,
      status = 'pending',
      assistantType: _assistantType,
      variant = 'admin',
      resolvedByName,
      showFooterActions = true,
      ...props
    },
    ref,
  ) => {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = async () => {
      setIsProcessing(true);
      try {
        await onApprove?.(data.requestId);
      } finally {
        setIsProcessing(false);
      }
    };

    const handleReject = async () => {
      setIsProcessing(true);
      try {
        await onReject?.(data.requestId);
      } finally {
        setIsProcessing(false);
      }
    };

    // CLIENT (Fae end-user) card — Figma 203-11947 "fae-approval-block".
    // Shows ONLY the BE-generated title (`explanation`) plus the actions row
    // or the full-text resolved pill; the raw command is never rendered.
    if (variant === 'client') {
      return (
        <div
          ref={ref}
          className={cn(
            'mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
            className,
          )}
          {...props}
        >
          <p className="w-full whitespace-pre-line break-words text-ods-text-primary text-h4">
            {data.explanation?.trim() || 'Approval required'}
          </p>
          {!showFooterActions ? null : status === 'pending' ? (
            <div className="flex w-full items-center gap-[var(--spacing-system-mf)]">
              <Button
                size="small-legacy"
                variant="accent"
                onClick={handleApprove}
                disabled={isProcessing || !onApprove}
                className={cn(
                  'bg-ods-accent hover:bg-ods-accent/90',
                  'text-ods-bg text-h5',
                  'h-8 px-[var(--spacing-system-xsf)]',
                )}
              >
                Approve
              </Button>
              <Button
                size="small-legacy"
                variant="outline"
                onClick={handleReject}
                disabled={isProcessing || !onReject}
                className={cn(
                  'border-ods-border bg-ods-card',
                  'text-ods-text-primary text-h5',
                  'h-8 px-[var(--spacing-system-xsf)] hover:bg-ods-bg',
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
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          'mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
          className,
        )}
        {...props}
      >
        <ApprovalCardBody data={data} />
        {!showFooterActions ? null : status === 'pending' ? (
          <div className="flex items-center gap-[var(--spacing-system-mf)]">
            <Button
              size="small-legacy"
              variant="accent"
              onClick={handleApprove}
              disabled={isProcessing || !onApprove}
              className={cn(
                'bg-ods-accent hover:bg-ods-accent/90',
                'text-ods-bg text-h5',
                'h-8 px-[var(--spacing-system-xsf)]',
              )}
            >
              Approve
            </Button>
            <Button
              size="small-legacy"
              variant="outline"
              onClick={handleReject}
              disabled={isProcessing || !onReject}
              className={cn(
                'border-ods-border bg-ods-card',
                'text-ods-text-primary text-h5',
                'h-8 px-[var(--spacing-system-xsf)] hover:bg-ods-bg',
              )}
            >
              Reject
            </Button>
          </div>
        ) : (
          <div className="flex">
            {status === 'approved' ? (
              <Tag label="Approved" variant="success" icon={<CheckCircle className="h-4 w-4" />} />
            ) : status === 'cancelled' ? (
              <Tag label="Canceled" variant="grey" icon={<Ban className="h-4 w-4" />} />
            ) : (
              <Tag label="Rejected" variant="error" icon={<XCircle className="h-4 w-4" />} />
            )}
          </div>
        )}
      </div>
    );
  },
);

ApprovalRequestMessage.displayName = 'ApprovalRequestMessage';

export { ApprovalRequestMessage };
