'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { ApprovalBatchMessage } from './approval-batch-message';
import type { ChatApprovalStatus } from './types/chat.types';
import type { ApprovalBatchData, ApprovalResolutionHandler, EscalationOfferData } from './types/message.types';

export interface EscalationOfferMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: EscalationOfferData;
  status?: ChatApprovalStatus;
  resolvedByName?: string | null;
  onApprove?: ApprovalResolutionHandler;
  onReject?: ApprovalResolutionHandler;
}

/**
 * Ticket-escalation offer block.
 *
 * Renders THROUGH the one approval card, as a client card of one row, rather than reimplementing it:
 * per Figma (fae chat › "escalation to admin") the offer is that exact
 * component, down to the Approve/Reject labels and the resolved
 * "Approved by {name}" pill. Only the wiring differs — approve/reject call
 * the ticket-escalation mutations, never the tool-approval endpoint — which
 * is why this is a distinct part with its own actions.
 *
 * The handoff receipt that follows an approval is NOT rendered here: it is its
 * own `TICKET_ESCALATED` block on the wire, which also covers the inactivity
 * auto-escalation — a path that raises no offer to infer from.
 */
function offerBatchOf(data: EscalationOfferData): ApprovalBatchData {
  return {
    approvalRequestId: data.offerId,
    approvalType: '',
    toolCalls: [
      {
        toolExecutionRequestId: data.offerId,
        toolName: 'escalate_ticket',
        requiresApproval: true,
        ...(data.text ? { toolExplanation: data.text } : {}),
      },
    ],
  };
}

const EscalationOfferMessage = forwardRef<HTMLDivElement, EscalationOfferMessageProps>(
  ({ className, data, status = 'pending', resolvedByName, onApprove, onReject, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col', className)} {...props}>
      <ApprovalBatchMessage
        variant="client"
        // Only the client may resolve an offer — the backend rejects every
        // other actor — so a viewer without BOTH handlers wired (the admin
        // ticket view) sees the prompt read-only rather than dead buttons. The
        // card renders Approve and Reject as a pair, so one handler is not a
        // usable state. A resolved offer still shows its pill for everyone.
        showFooterActions={(!!onApprove && !!onReject) || status !== 'pending'}
        showExecutionStatus={false}
        data={offerBatchOf(data)}
        status={status}
        resolvedByName={resolvedByName}
        onApprove={onApprove}
        onReject={onReject}
      />
    </div>
  ),
);

EscalationOfferMessage.displayName = 'EscalationOfferMessage';

export { EscalationOfferMessage };
