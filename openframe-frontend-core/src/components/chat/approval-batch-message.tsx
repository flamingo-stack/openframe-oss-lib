'use client';

import { forwardRef, useState } from 'react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { CheckCircleIcon, DotsLoaderIcon, XmarkCircleIcon } from '../icons-v2-generated';
import { MediaSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import type { ToolType } from '../platform';
import { ToolIcon } from '../tool-icon';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { StatusLine } from '../ui/status-line';
import { CHAT_BLOCK_CLASS, CHAT_BLOCK_FRAME_CLASS } from './chat-block-frame';
import { ExpandChevron } from './expand-chevron';
import { useCollapsible } from './hooks/use-collapsible';
import { ArgRow, ResultBlock } from './tool-call-blocks';
import type {
  ApprovalBatchData,
  ApprovalBlockVariant,
  AssistantType,
  ApprovalBatchExecutionState,
  ChatApprovalPartStatus,
  PendingToolCallData,
} from './types';
import { COMMAND_BODY_ARG_KEYS, getCommandText } from './utils/tool-call-helpers';

/**
 * THE approval card: every approval a chat, a board or a notification draws. A single gated call is a batch of one, and a
 * ticket-escalation offer is a client card of one row (`EscalationOfferMessage`).
 */
export interface ApprovalBatchMessageProps extends HTMLAttributes<HTMLDivElement> {
  /** The batch. `null` is a batch still being read (a list's loading row): the block draws its own loading form, as
   *  it does in a loading scope. */
  data: ApprovalBatchData | null;
  status?: ChatApprovalPartStatus;
  /** A row's answer was sent and the server has not said how it went: the buttons stay, inert, so the click moves nothing. */
  answerPending?: boolean;
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
  status?: ChatApprovalPartStatus;
  resolvedByName?: string | null;
  inlineResolver?: boolean;
}

/**
 * Status badge for an answered approval batch (approving / approved / rejected /
 * cancelled / failed / unknown); renders nothing while pending. With `inlineResolver` the
 * resolver's name is baked into the tag as a single full-text pill
 * ("Approved by {name}"); otherwise callers render "by {name}" as a separate
 * muted span. `approving`, `failed` and `unknown` name nobody: whoever approved it did not fail it. Also
 * used by the approval notification tile, which hosts the actions row itself
 * (`showFooterActions={false}`).
 */
export function ApprovalStatusTag({ status, resolvedByName, inlineResolver = false }: ApprovalStatusTagProps) {
  const suffix = inlineResolver && resolvedByName ? ` by ${resolvedByName}` : '';
  if (status === 'approving') return <StatusLine tone="working" label="Approving" />;
  if (status === 'approved') return <StatusLine tone="success" label={`Approved${suffix}`} />;
  if (status === 'cancelled') return <StatusLine tone="muted" label={`Canceled${suffix}`} />;
  if (status === 'rejected') return <StatusLine tone="error" label={`Rejected${suffix}`} />;
  if (status === 'failed') return <StatusLine tone="error" label="Failed" />;
  if (status === 'unknown') return <StatusLine tone="muted" label="Outcome unknown" />;
  return null;
}

/** What a pending approval says while it waits: the one place the wording lives. */
export function ApprovalWaitingLine() {
  return <StatusLine tone="waiting" label="Waiting for you" />;
}

/**
 * A card's status and why, as ONE live region, read whole when it changes. It is mounted from the first render, while the
 * card waits too: a screen reader says nothing of a region that appears with its words already in it, and a click on Approve
 * has nothing else to say. `inlineResolver` as on {@link ApprovalStatusTag}; without it the name stands beside the tag.
 */
export function ApprovalFootStatus({
  status,
  resolvedByName,
  inlineResolver = false,
  notices,
}: ApprovalStatusTagProps & { notices: readonly string[] }) {
  return (
    <div role="status" aria-atomic="true" className="flex w-full flex-col items-start gap-[var(--spacing-system-xxs)]">
      {status === 'pending' ? (
        <ApprovalWaitingLine />
      ) : (
        <div className="flex items-center gap-[var(--spacing-system-xsf)]">
          <ApprovalStatusTag status={status} resolvedByName={resolvedByName} inlineResolver={inlineResolver} />
          {!inlineResolver &&
            resolvedByName &&
            status !== 'approving' &&
            status !== 'failed' &&
            status !== 'unknown' && <span className="text-ods-text-secondary text-h6">by {resolvedByName}</span>}
        </div>
      )}
      {notices.map(notice => (
        <p key={notice} className="break-words text-ods-text-secondary text-h6">
          {notice}
        </p>
      ))}
    </div>
  );
}

/** What a row is called on a batch's foot: the words its card shows a person, never a command. */
function footTitleOf(call: PendingToolCallData): string | undefined {
  return call.toolTitle?.trim() || call.toolExplanation?.trim() || undefined;
}

/**
 * What a card's foot says with no row opened, once however many rows it is about. A tool's own output stays in its row: it
 * can be long, and an end client must not see it. Two different sentences each name their rows, or "this one" has no referent
 * and "ask again" reads as being about the row that may have run.
 */
function batchFootNotices(data: ApprovalBatchData): string[] {
  const rowsByNotice = new Map<string, string[]>();
  for (const call of data.toolCalls) {
    const row = data.executions?.[call.toolExecutionRequestId];
    if (!row || !(row.outcomeUnknown || row.refused) || !row.result) continue;
    const title = footTitleOf(call);
    rowsByNotice.set(row.result, [...(rowsByNotice.get(row.result) ?? []), ...(title ? [title] : [])]);
  }
  if (rowsByNotice.size < 2) return [...rowsByNotice.keys()];
  return [...rowsByNotice].map(([notice, titles]) => (titles.length > 0 ? `${titles.join(', ')}: ${notice}` : notice));
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
 *  - approving         → as approved: no row can have its check yet, and one refused has its cross
 *  - executing         → DotsLoaderIcon
 *  - done + success    → green check
 *  - done + failure    → red cross, in a failed batch and one nobody knows the end of too
 *  - nobody knows       → null: a cross would say it failed, and it may have gone through
 *  - failed, no exec   → null (a row with no gate of its own that never started: nothing runs it now)
 */
function ExecutionStatusIcon({
  batchStatus,
  execution,
}: {
  batchStatus?: ChatApprovalPartStatus;
  execution: ApprovalBatchExecutionState | undefined;
}) {
  const cross = <XmarkCircleIcon role="img" aria-label="Failed" className="h-4 w-4 text-ods-error" />;
  if (batchStatus === 'unknown') return execution?.success === false ? cross : null;
  if (batchStatus !== 'approved' && batchStatus !== 'approving' && batchStatus !== 'failed') return null;
  if (!execution && batchStatus === 'failed') return null;
  if (execution?.outcomeUnknown) return null;
  if (!execution || execution.status === 'executing')
    return <DotsLoaderIcon size={16} className="text-ods-text-secondary" />;
  if (execution.success === false) return cross;
  return <CheckCircleIcon role="img" aria-label="Done" className="h-4 w-4 text-ods-success" />;
}

interface ToolCallRowProps {
  call: PendingToolCallData;
  expanded: boolean;
  onToggle: () => void;
  batchStatus?: ChatApprovalPartStatus;
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
      {/* Square, as the tool card's header: the frame clips the corners and the rows meet flat. */}
      <Button variant="row" type="button" onClick={onToggle} aria-expanded={expanded} className="rounded-none">
        {/* The tool mark is the grey `currentColor` cut, so the wrapper sets the colour it takes; without it
            the icon inherits the message text's primary (white). Same treatment as ToolBadge. */}
        <div className="flex h-5 w-5 shrink-0 items-center justify-center text-ods-text-secondary">
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
      </Button>

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

/**
 * The block while its batch is read. Admin: the frame, ONE command row (a typical batch holds one; its command a
 * two-line clamp, so two bars), and the footer with one explanation line, the waiting line and the Approve / Reject
 * buttons (real and inert: static copy). Client (the Fae card): one title line, the waiting line and the buttons.
 */
const ApprovalBatchLoading = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { showFooterActions: boolean; variant: ApprovalBlockVariant }
>(({ className, showFooterActions, variant, ...props }, ref) =>
  variant === 'client' ? (
    <div ref={ref} aria-hidden className={cn('mb-[var(--spacing-system-xsf)]', CHAT_BLOCK_CLASS, className)} {...props}>
      <p className="w-full text-h4">
        <TextLineSkeleton type="inherit" as="span" className="inline-block w-3/4 align-middle" />
      </p>
      {showFooterActions && <ApprovalWaitingLine />}
      {showFooterActions && (
        <div className="flex w-full items-center gap-[var(--spacing-system-xsf)]">
          <Button
            size="small-legacy"
            variant="accent"
            tabIndex={-1}
            className="h-8 px-[var(--spacing-system-xsf)] text-h5"
          >
            Approve
          </Button>
          <Button
            size="small-legacy"
            variant="outline"
            tabIndex={-1}
            className="h-8 px-[var(--spacing-system-xsf)] text-h5"
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  ) : (
    <div
      ref={ref}
      aria-hidden
      className={cn('mb-[var(--spacing-system-xsf)] flex flex-col overflow-hidden', CHAT_BLOCK_FRAME_CLASS, className)}
      {...props}
    >
      <div className="flex w-full flex-col items-start bg-ods-card">
        <Button variant="row" type="button" tabIndex={-1} className="rounded-none">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <MediaSkeleton.Icon size="sm" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col text-h6">
            <TextLineSkeleton type="inherit" className="w-full" />
            <TextLineSkeleton type="inherit" className="w-2/3" />
          </div>
          <div className="flex h-5 w-5 shrink-0 items-center justify-center">
            <ExpandChevron expanded={false} />
          </div>
        </Button>
      </div>
      <div className="flex flex-col items-start justify-center gap-[var(--spacing-system-xsf)] border-t border-ods-border p-[var(--spacing-system-sf)]">
        <ul className="w-full list-disc pl-5 text-ods-text-primary text-h6">
          <li>
            <TextLineSkeleton type="inherit" as="span" className="inline-block w-3/4 align-middle" />
          </li>
        </ul>
        {showFooterActions && <ApprovalWaitingLine />}
        {showFooterActions && (
          <div className="flex items-center gap-[var(--spacing-system-xsf)]">
            <Button
              size="small-legacy"
              variant="accent"
              tabIndex={-1}
              className="h-8 px-[var(--spacing-system-xsf)] text-h5"
            >
              Approve
            </Button>
            <Button
              size="small-legacy"
              variant="outline"
              tabIndex={-1}
              className="h-8 px-[var(--spacing-system-xsf)] text-h5"
            >
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  ),
);
ApprovalBatchLoading.displayName = 'ApprovalBatchLoading';

const ApprovalBatchMessage = forwardRef<HTMLDivElement, ApprovalBatchMessageProps>(
  (
    {
      className,
      data,
      onApprove,
      onReject,
      status = 'pending',
      answerPending = false,
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
    // ONE switch: in a loading scope, or with no batch yet, the block is its own loading form (the null check sits in
    // the condition itself, so `data` is narrowed below it).
    const inLoadingScope = useLoadingScope();
    if (inLoadingScope || data === null) {
      return (
        <ApprovalBatchLoading
          ref={ref}
          className={className}
          variant={variant}
          showFooterActions={showFooterActions}
          {...props}
        />
      );
    }

    const explanations = data.toolCalls.map(c => c.toolExplanation?.trim()).filter((s): s is string => !!s);
    // Said with no row opened: the rows of an answered batch stay collapsed.
    const notices = batchFootNotices(data);
    // A click moves nothing: the foot keeps its height until the server has said how every row went.
    const keepsButtons = status === 'pending' || answerPending;

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
          disabled={isProcessing || answerPending || !onApprove}
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
          disabled={isProcessing || answerPending || !onReject}
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
        <div ref={ref} className={cn('mb-[var(--spacing-system-xsf)]', CHAT_BLOCK_CLASS, className)} {...props}>
          {titles.length > 0 ? (
            titles.map((title, i) => (
              <p key={i} className="w-full whitespace-pre-line break-words text-ods-text-primary text-h4">
                {title}
              </p>
            ))
          ) : (
            <p className="w-full text-ods-text-primary text-h4">Approval required</p>
          )}
          {showFooterActions && (
            <ApprovalFootStatus status={status} resolvedByName={resolvedByName} inlineResolver notices={notices} />
          )}
          {showFooterActions && keepsButtons && (
            <div className="flex w-full items-center gap-[var(--spacing-system-xsf)]">{actionButtons}</div>
          )}
        </div>
      );
    }

    const showFooterBlock = explanations.length > 0 || showFooterActions;

    return (
      <div
        ref={ref}
        className={cn(
          'mb-[var(--spacing-system-xsf)] flex flex-col overflow-hidden',
          CHAT_BLOCK_FRAME_CLASS,
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
          <div className="flex flex-col items-start justify-center gap-[var(--spacing-system-xsf)] border-t border-ods-border p-[var(--spacing-system-sf)]">
            {explanations.length > 0 && (
              <ul className="w-full list-disc pl-5 text-ods-text-primary text-h6">
                {explanations.map((expl, i) => (
                  <li key={i}>{expl}</li>
                ))}
              </ul>
            )}

            {showFooterActions && (
              <ApprovalFootStatus status={status} resolvedByName={resolvedByName} notices={notices} />
            )}
            {showFooterActions && keepsButtons && (
              <div className="flex items-center gap-[var(--spacing-system-xsf)]">{actionButtons}</div>
            )}
          </div>
        )}
      </div>
    );
  },
);

ApprovalBatchMessage.displayName = 'ApprovalBatchMessage';

export { ApprovalBatchMessage };
