'use client';

import { forwardRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { CheckCircleIcon, DotsLoaderIcon, XmarkCircleIcon, XmarkIcon } from '../icons-v2-generated';
import type { ToolType } from '../platform';
import { ToolIcon } from '../tool-icon';
import { Button } from '../ui/button';
import { Tag } from '../ui/tag';
import { ExpandChevron } from './expand-chevron';
import { useCollapsible } from './hooks/use-collapsible';
import { ArgRow, ResultBlock } from './tool-call-blocks';
import type {
  ApprovalBlockVariant,
  AssistantType,
  ApprovalBatchExecutionState,
  ApprovalBatchSegment,
  PendingToolCallData,
} from './types';
import { COMMAND_BODY_ARG_KEYS, getCommandText } from './utils/tool-call-helpers';

export interface ApprovalBatchMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: ApprovalBatchSegment['data'];
  status?: ApprovalBatchSegment['status'];
  onApprove?: (requestId?: string) => void | boolean | Promise<void | boolean>;
  onReject?: (requestId?: string) => void | boolean | Promise<void | boolean>;
  /**
   * Cap the tool-call list height so it scrolls internally while the footer
   * (explanations + Approve/Reject) stays pinned below. Omit for the default
   * chat behaviour where the whole batch grows with its content.
   */
  maxBodyHeight?: number | string;
  /** Display name of the user who resolved the request; shown as "by {name}" beside the status tag. */
  resolvedByName?: string | null;
  /**
   * Per-tool execution status icon (queued dots → check/cross). On in dialog messages where tool
   * execution is tracked live; turn off for notifications, which have no execution state and would
   * otherwise show the dots spinner forever after approval. Defaults to on.
   */
  showExecutionStatus?: boolean;
  /**
   * Chat identity. Kept for prop parity with the message renderers; does NOT
   * drive the styling anymore — use `variant` instead. An admin can be
   * looking at a Fae dialog (tickets dialog client tab) and must still see
   * the full admin block.
   */
  assistantType?: AssistantType;
  /**
   * Viewer variant. `'admin'` (default) = full block with command preview,
   * expandable args/result and tool icon. `'client'` = end-client (Fae
   * desktop app) card that shows ONLY the BE-generated title(s) plus the
   * Approve/Reject buttons or the full-text resolved pill ("Approved by
   * {name}") — commands and scripts are never rendered.
   */
  variant?: ApprovalBlockVariant;
  /**
   * Render the footer Approve/Reject buttons (or the resolved-status tag).
   * Turn off when the host owns the actions row — e.g. the approval
   * notification tile. Explanation bullets still render.
   */
  showFooterActions?: boolean;
}

const COMMAND_BODY_KEYS = new Set<string>(COMMAND_BODY_ARG_KEYS);

export interface ApprovalStatusTagProps {
  status: ApprovalBatchSegment['status'];
  resolvedByName?: string | null;
  inlineResolver?: boolean;
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
  const suffix = inlineResolver && resolvedByName ? ` by ${resolvedByName}` : '';
  if (status === 'approved') {
    return <Tag label={`Approved${suffix}`} variant="success" icon={<CheckCircleIcon className="h-4 w-4" />} />;
  }
  if (status === 'cancelled') {
    return <Tag label={`Canceled${suffix}`} variant="grey" icon={<XmarkIcon className="h-4 w-4" />} />;
  }
  if (status === 'rejected') {
    return <Tag label={`Rejected${suffix}`} variant="error" icon={<XmarkCircleIcon className="h-4 w-4" />} />;
  }
  return null;
}

function getArgEntries(call: PendingToolCallData): Array<[string, unknown]> {
  const args = call.toolCallArguments;
  if (!args || typeof args !== 'object') return [];
  return Object.entries(args).filter(
    ([k, v]) => !COMMAND_BODY_KEYS.has(k) && v !== null && v !== undefined && v !== '',
  );
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
  batchStatus: ApprovalBatchSegment['status'];
  execution: ApprovalBatchExecutionState | undefined;
}) {
  if (batchStatus !== 'approved') return null;
  if (!execution || execution.status === 'executing')
    return <DotsLoaderIcon size={16} className="text-ods-text-secondary" />;
  if (execution.success === false) return <XmarkCircleIcon className="h-4 w-4 text-ods-error" />;
  return <CheckCircleIcon className="h-4 w-4 text-ods-success" />;
}

interface ToolCallRowProps {
  call: PendingToolCallData;
  expanded: boolean;
  onToggle: () => void;
  batchStatus: ApprovalBatchSegment['status'];
  execution: ApprovalBatchExecutionState | undefined;
  showExecutionStatus: boolean;
}

// ADMIN-only row: command preview header, expandable args/result. The client
// variant never renders tool calls — see the `variant === 'client'` branch of
// `<ApprovalBatchMessage>`.
function ToolCallRow({ call, expanded, onToggle, batchStatus, execution, showExecutionStatus }: ToolCallRowProps) {
  const command = getCommandText(call);
  const args = getArgEntries(call);
  const toolType = (call.toolType as ToolType) || 'OPENFRAME';
  const { innerRef, containerStyle } = useCollapsible({ expanded });
  const result = execution?.status === 'done' ? execution.result : undefined;
  const hasExpandableBody = args.length > 0 || (typeof result === 'string' && result.length > 0);

  return (
    <div className="flex w-full flex-col items-start border-b border-ods-border bg-ods-card last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-sf)] text-left"
      >
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <ToolIcon toolType={toolType} size={16} />
        </div>
        <div
          className={cn(
            'min-w-0 flex-1 text-h6',
            expanded
              ? 'whitespace-pre-wrap break-all text-ods-text-primary'
              : 'line-clamp-2 max-h-10 break-all text-ods-text-secondary',
          )}
        >
          {command}
        </div>
        {showExecutionStatus && (
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ExecutionStatusIcon batchStatus={batchStatus} execution={execution} />
          </div>
        )}
        <div className="flex h-5 w-5 shrink-0 items-center justify-center">
          <ExpandChevron expanded={expanded} />
        </div>
      </button>

      <div className="w-full" style={containerStyle}>
        <div ref={innerRef}>
          {hasExpandableBody && (
            <div className="flex w-full flex-col items-start gap-0 bg-ods-card px-[var(--spacing-system-sf)] pb-[var(--spacing-system-sf)] text-h6">
              {args.map(([key, value]) => (
                <ArgRow key={key} argKey={key} value={value} />
              ))}
              {result && (
                <ResultBlock
                  result={result}
                  className={args.length > 0 ? 'mt-[var(--spacing-system-xsf)]' : undefined}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ApprovalBatchMessage = forwardRef<HTMLDivElement, ApprovalBatchMessageProps>(
  (
    {
      className,
      data,
      onApprove,
      onReject,
      status = 'pending',
      maxBodyHeight,
      resolvedByName,
      showExecutionStatus = true,
      assistantType: _assistantType,
      variant = 'admin',
      showFooterActions = true,
      ...props
    },
    ref,
  ) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const isClient = variant === 'client';

    const explanations = data.toolCalls.map(c => c.toolExplanation?.trim()).filter((s): s is string => !!s);

    const handleApprove = async () => {
      setIsProcessing(true);
      try {
        await onApprove?.(data.approvalRequestId);
      } finally {
        setIsProcessing(false);
      }
    };

    const handleReject = async () => {
      setIsProcessing(true);
      try {
        await onReject?.(data.approvalRequestId);
      } finally {
        setIsProcessing(false);
      }
    };

    const actionButtons = (
      <>
        <Button
          size="small-legacy"
          variant="accent"
          onClick={handleApprove}
          disabled={isProcessing}
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
          disabled={isProcessing}
          className={cn(
            'border-ods-border bg-ods-card',
            'text-ods-text-primary text-h5',
            'h-8 px-[var(--spacing-system-xsf)] hover:bg-ods-bg',
          )}
        >
          Reject
        </Button>
      </>
    );

    // CLIENT (Fae end-user) card — Figma 203-11947 "fae-approval-block".
    // One bordered card: BE-generated title(s) + Approve/Reject buttons or the
    // full-text resolved pill ("Approved by {name}"). No commands, scripts,
    // expansion or execution icons — the end client must not see them.
    if (isClient) {
      const titles = data.toolCalls
        .map(c => c.toolExplanation?.trim() || c.toolTitle?.trim())
        .filter((s): s is string => !!s);
      return (
        <div
          ref={ref}
          className={cn(
            'mb-[var(--spacing-system-xsf)] flex flex-col gap-[var(--spacing-system-mf)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
            className,
          )}
          {...props}
        >
          {titles.length > 0 ? (
            titles.map((title, i) => (
              <p key={i} className="w-full whitespace-pre-line break-words text-ods-text-primary text-h4">
                {title}
              </p>
            ))
          ) : (
            <p className="w-full text-ods-text-primary text-h4">Approval required</p>
          )}
          {showFooterActions &&
            (status === 'pending' ? (
              <div className="flex w-full items-center gap-[var(--spacing-system-mf)]">{actionButtons}</div>
            ) : (
              <div className="flex w-full">
                <ApprovalStatusTag status={status} resolvedByName={resolvedByName} inlineResolver />
              </div>
            ))}
        </div>
      );
    }

    const showFooterBlock = explanations.length > 0 || showFooterActions;

    return (
      <div
        ref={ref}
        className={cn(
          'mb-[var(--spacing-system-xsf)] flex flex-col',
          'overflow-hidden rounded-md border border-ods-border bg-ods-card',
          className,
        )}
        {...props}
      >
        <div
          className={cn('flex flex-col', maxBodyHeight != null && 'overflow-y-auto overscroll-contain')}
          style={maxBodyHeight != null ? { maxHeight: maxBodyHeight } : undefined}
        >
          {data.toolCalls.map(call => (
            <ToolCallRow
              key={call.toolExecutionRequestId}
              call={call}
              expanded={expandedId === call.toolExecutionRequestId}
              onToggle={() =>
                setExpandedId(prev => (prev === call.toolExecutionRequestId ? null : call.toolExecutionRequestId))
              }
              batchStatus={status}
              execution={data.executions?.[call.toolExecutionRequestId]}
              showExecutionStatus={showExecutionStatus}
            />
          ))}
        </div>

        {showFooterBlock && (
          <div className="flex flex-col items-start justify-center gap-[var(--spacing-system-xsf)] border-t border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
            {explanations.length > 0 && (
              <ul className="w-full list-disc pl-5 text-ods-text-primary text-h6">
                {explanations.map((expl, i) => (
                  <li key={i}>{expl}</li>
                ))}
              </ul>
            )}

            {showFooterActions &&
              (status === 'pending' ? (
                <div className="flex items-center gap-[var(--spacing-system-xsf)]">{actionButtons}</div>
              ) : (
                <div className="flex items-center gap-[var(--spacing-system-xsf)]">
                  <ApprovalStatusTag status={status} resolvedByName={resolvedByName} />
                  {resolvedByName && <span className="text-ods-text-secondary text-h6">by {resolvedByName}</span>}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  },
);

ApprovalBatchMessage.displayName = 'ApprovalBatchMessage';

export { ApprovalBatchMessage };
