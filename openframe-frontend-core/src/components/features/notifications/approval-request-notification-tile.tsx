'use client';

import { useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import { ApprovalBatchMessage, ApprovalStatusTag } from '../../chat/approval-batch-message';
import { ExpandChevron } from '../../chat/expand-chevron';
import { useCollapsible } from '../../chat/hooks/use-collapsible';
import { PolicyEscalationAlert, isPolicyEscalated } from '../../chat/policy-review';
import type { ChatApprovalStatus } from '../../chat/types';
import { AlertCircleIcon } from '../../icons-v2-generated';
import { InteractiveSkeleton, TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button';
import { useLoadingScope } from '../../ui/loading-scope';
import {
  APPROVAL_BUTTON_CLASS,
  APPROVAL_TOGGLE_BUTTON_CLASS,
  LOCKSCREEN_APPROVAL_BUTTON_CLASS,
  NotificationTile,
} from './notification-tile';
import { approvalMetaToBatchData, getApprovalMeta, resolutionToStatus } from './types';
import type { Notification } from './types';

export interface ApprovalRequestNotificationTileProps {
  notification: Notification;
  onApprove: (approvalRequestId: string) => void | Promise<void>;
  onReject: (approvalRequestId: string) => void | Promise<void>;
  /**
   * Marks the notification complete: the tile's ✓, and after a successful
   * Approve / Reject. Omit it for a card with no notification behind it (built
   * from a chat's or a ticket's pending approval): no ✓ is drawn, and a
   * decision completes nothing.
   */
  onComplete?: (id: string) => void;
  onSettle?: (id: string) => void;
  liveDurationMs?: number;
  defaultExpanded?: boolean;
  className?: string;
  /** Title lines before the ellipsis — see `NotificationTileProps.titleLines`. */
  titleLines?: 1 | 2;
  /**
   * `lockscreen`: the approval as a phone shows it (see `NotificationTile`):
   * two compact buttons and no command drawer.
   * `row`: the lockscreen look in ONE line, for a surface too small for a tile (a scene in a page's margin): the
   * agent's mark (its `type`, "Mingo asks", is the mark's accessible name), the title, then Approve and Reject, or
   * once resolved the status. The row keeps its left edge, so the title never moves when its buttons become the
   * status. No description, no time, no command drawer.
   */
  presentation?: 'card' | 'lockscreen' | 'row';
  /**
   * Show Approve as being pressed (a scripted demo's "the tap lands" beat):
   * the button dims for as long as this is true. No effect once resolved.
   */
  approvePressed?: boolean;
  /** See `NotificationTileProps.timeLabel`. */
  timeLabel?: string;
}

export function ApprovalRequestNotificationTile({
  notification,
  onApprove,
  onReject,
  onComplete,
  onSettle,
  liveDurationMs,
  defaultExpanded = false,
  className,
  titleLines,
  presentation = 'card',
  approvePressed = false,
  timeLabel,
}: ApprovalRequestNotificationTileProps) {
  if (presentation === 'row') {
    return (
      <ApprovalRequestRow
        notification={notification}
        onApprove={onApprove}
        onReject={onReject}
        onComplete={onComplete}
        approvePressed={approvePressed}
        className={className}
      />
    );
  }
  return (
    <ApprovalRequestTile
      notification={notification}
      onApprove={onApprove}
      onReject={onReject}
      onComplete={onComplete}
      onSettle={onSettle}
      liveDurationMs={liveDurationMs}
      defaultExpanded={defaultExpanded}
      className={className}
      titleLines={titleLines}
      presentation={presentation}
      approvePressed={approvePressed}
      timeLabel={timeLabel}
    />
  );
}

/** The row's frame: the lockscreen tile's corners, border and surface, around one line. Shared with its skeleton. */
export const APPROVAL_ROW_CLASS =
  'inline-flex max-w-full items-center gap-[var(--spacing-system-xs)] whitespace-nowrap rounded-2xl border border-ods-border bg-ods-card py-[var(--spacing-system-xs)] pl-[var(--spacing-system-s)] pr-[var(--spacing-system-xs)] text-h6';

/** The row's two buttons: compact, their own width. */
const APPROVAL_ROW_BUTTON_CLASS = 'shrink-0';

type ApprovalRowProps = Pick<
  ApprovalRequestNotificationTileProps,
  'notification' | 'onApprove' | 'onReject' | 'onComplete' | 'approvePressed' | 'className'
>;

/** `presentation="row"`: ONE switch, in a loading scope its own loading form. */
function ApprovalRequestRow(props: ApprovalRowProps) {
  if (useLoadingScope()) return <ApprovalRequestRowSkeleton className={props.className} />;
  return <LoadedApprovalRequestRow {...props} />;
}

function LoadedApprovalRequestRow({
  notification,
  onApprove,
  onReject,
  onComplete,
  approvePressed = false,
  className,
}: ApprovalRowProps) {
  const [processing, setProcessing] = useState(false);
  const [localStatus, setLocalStatus] = useState<ChatApprovalStatus | null>(null);
  const approval = getApprovalMeta(notification);
  if (!approval) return null;
  const resolvedStatus = resolutionToStatus(approval.resolution);
  const status: ChatApprovalStatus = resolvedStatus !== 'pending' ? resolvedStatus : (localStatus ?? 'pending');
  const label = notification.type ?? 'Approval Required';

  const resolve = async (
    nextStatus: 'approved' | 'rejected',
    action: (approvalRequestId: string) => void | Promise<void>,
  ) => {
    setProcessing(true);
    setLocalStatus(nextStatus);
    try {
      await action(approval.approvalRequestId);
    } catch {
      setLocalStatus(null);
      return;
    } finally {
      setProcessing(false);
    }
    onComplete?.(notification.id);
  };

  return (
    <output className={cn(APPROVAL_ROW_CLASS, className)} aria-label={label}>
      <span role="img" aria-label={label} className="flex size-4 shrink-0 items-center justify-center">
        {notification.icon ?? <span className="size-1.5 rounded-full bg-ods-accent" />}
      </span>
      {notification.title ? <span className="min-w-0 truncate text-ods-text-primary text-h6">{notification.title}</span> : null}
      {status === 'pending' ? (
        <span className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)]">
          <Button
            variant="accent"
            size="small"
            onClick={() => resolve('approved', onApprove)}
            disabled={processing}
            data-pressed={approvePressed || undefined}
            className={cn(
              APPROVAL_ROW_BUTTON_CLASS,
              // The press, by transform and opacity only (compositor properties; a filter repaints every frame).
              'transition-[opacity,transform] duration-200 motion-reduce:transition-none',
              approvePressed && 'scale-[0.98] opacity-75',
            )}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            size="small"
            onClick={() => resolve('rejected', onReject)}
            disabled={processing}
            className={APPROVAL_ROW_BUTTON_CLASS}
          >
            Reject
          </Button>
        </span>
      ) : (
        <span className="shrink-0 pr-[var(--spacing-system-xxs)]">
          <ApprovalStatusTag status={status} />
        </span>
      )}
    </output>
  );
}

/** The row while it is read, box for box: the frame, the mark, a title's line and the two buttons. */
export function ApprovalRequestRowSkeleton({ className }: { className?: string }) {
  return (
    <output aria-hidden className={cn(APPROVAL_ROW_CLASS, className)}>
      <UnifiedSkeleton as="span" width="1rem" className="h-4 shrink-0 rounded-full" />
      <TextLineSkeleton as="span" type="h6" className="w-32" />
      <InteractiveSkeleton.Button size="small" className="w-20" />
      <InteractiveSkeleton.Button size="small" className="w-16" />
    </output>
  );
}

type ApprovalTileProps = Omit<ApprovalRequestNotificationTileProps, 'presentation'> & {
  presentation: 'card' | 'lockscreen';
};

function ApprovalRequestTile({
  notification,
  onApprove,
  onReject,
  onComplete,
  onSettle,
  liveDurationMs,
  defaultExpanded = false,
  className,
  titleLines,
  presentation,
  approvePressed = false,
  timeLabel,
}: ApprovalTileProps) {
  const lockscreen = presentation === 'lockscreen';
  const [expanded, setExpanded] = useState(defaultExpanded);
  // Toggling the command section pins the tile so a live pop-up doesn't
  // auto-dismiss out from under the user mid-read.
  const [pinned, setPinned] = useState(defaultExpanded);
  const [processing, setProcessing] = useState(false);
  // Optimistic status for this user's own click; backend resolution (below) wins once it arrives.
  const [localStatus, setLocalStatus] = useState<ChatApprovalStatus | null>(null);

  const approval = getApprovalMeta(notification);
  const resolvedStatus = resolutionToStatus(approval?.resolution);
  const status: ChatApprovalStatus = resolvedStatus !== 'pending' ? resolvedStatus : (localStatus ?? 'pending');

  const batchData = useMemo(() => (approval ? approvalMetaToBatchData(approval) : null), [approval]);

  const { innerRef, containerStyle } = useCollapsible({ expanded });

  if (!approval || !batchData) return null;

  const tileNotification: Notification = {
    ...notification,
    type: notification.type ?? 'Approval Required',
  };

  // What Mingo escalated is read with the commands folded away, in the chat block's order (Figma 1375-114530): the
  // "!" beside the chevron, the "Mingo Escalated" band before the buttons, Approve in the warning colour.
  const escalatedCalls = batchData.toolCalls.filter(call => isPolicyEscalated(call.policyReview));
  const escalated = escalatedCalls.length > 0;
  const commandWord = batchData.toolCalls.length > 1 ? 'commands' : 'command';
  const toggleLabel = `${expanded ? 'Hide' : 'Show'} ${commandWord} section`;

  const resolve = async (
    nextStatus: 'approved' | 'rejected',
    action: (approvalRequestId: string) => void | Promise<void>,
  ) => {
    setProcessing(true);
    setLocalStatus(nextStatus);
    try {
      await action(batchData.approvalRequestId);
    } catch {
      setLocalStatus(null); // roll back the optimistic flip; the request failed
      return;
    } finally {
      setProcessing(false);
    }
    // Outside the try: a throwing consumer callback must not roll back a request
    // that already succeeded server-side.
    onComplete?.(notification.id);
  };

  return (
    <NotificationTile
      notification={tileNotification}
      liveDurationMs={liveDurationMs}
      onComplete={onComplete}
      onSettle={onSettle}
      className={className}
      titleLines={titleLines}
      presentation={presentation}
      timeLabel={timeLabel}
      paused={pinned || processing}
      actions={
        <>
          {!lockscreen &&
            escalatedCalls.map(call => (
              // Edge to edge, as under the chat's command row: the tile's padding cancelled (`w-auto`, so the stretched
              // flex item grows into it instead of keeping the Alert's `w-full`), a rule above and below.
              <PolicyEscalationAlert
                key={call.toolExecutionRequestId}
                review={call.policyReview}
                className="-mx-[var(--spacing-system-s)] w-auto border-y border-ods-border"
              />
            ))}
          <div className="flex w-full items-center gap-[var(--spacing-system-xs)]">
            {status === 'pending' ? (
              <>
                <Button
                  variant={escalated ? 'warning' : 'accent'}
                  size="small"
                  onClick={() => resolve('approved', onApprove)}
                  disabled={processing}
                  data-pressed={approvePressed || undefined}
                  className={cn(
                    'transition-[filter,transform] duration-200 motion-reduce:transition-none',
                    lockscreen ? LOCKSCREEN_APPROVAL_BUTTON_CLASS : APPROVAL_BUTTON_CLASS,
                    approvePressed && 'scale-[0.98] brightness-75',
                  )}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => resolve('rejected', onReject)}
                  disabled={processing}
                  className={lockscreen ? LOCKSCREEN_APPROVAL_BUTTON_CLASS : APPROVAL_BUTTON_CLASS}
                >
                  Reject
                </Button>
              </>
            ) : (
              <span className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
                <ApprovalStatusTag status={status} />
                {approval.resolvedByName ? (
                  <span className="truncate text-ods-text-secondary text-h6">by {approval.resolvedByName}</span>
                ) : null}
              </span>
            )}
            {!lockscreen && (
              <span className="ml-auto flex shrink-0 items-center gap-[var(--spacing-system-xs)]">
                {escalated && !expanded && (
                  // Decorative: the band above says it in words. Open, each command row draws its own.
                  <AlertCircleIcon className="size-4 text-ods-warning" aria-hidden data-escalation-mark />
                )}
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => {
                    setExpanded(prev => !prev);
                    setPinned(true);
                  }}
                  aria-expanded={expanded}
                  aria-label={toggleLabel}
                  className={APPROVAL_TOGGLE_BUTTON_CLASS}
                >
                  <ExpandChevron expanded={expanded} />
                </Button>
              </span>
            )}
          </div>
        </>
      }
    >
      {!lockscreen && (
        <div style={containerStyle}>
          {/* Divider lives inside the measured element — useCollapsible caps the
              container at the inner scrollHeight, which excludes the inner's own borders. */}
          <div ref={innerRef}>
            <div className="border-t border-ods-border">
              <ApprovalBatchMessage
                data={batchData}
                showExecutionStatus={false}
                showFooterActions={false}
                showEscalationAlerts={false}
                maxBodyHeight="50vh"
                className="mb-0 rounded-none border-0"
              />
            </div>
          </div>
        </div>
      )}
    </NotificationTile>
  );
}
