'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';
import { ApprovalRequestMessage } from './approval-request-message';
import type { EscalationOfferSegment } from './types/message.types';

export interface EscalationOfferMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: EscalationOfferSegment['data'];
  status?: EscalationOfferSegment['status'];
  resolvedByName?: string | null;
  onApprove?: EscalationOfferSegment['onApprove'];
  onReject?: EscalationOfferSegment['onReject'];
}

/**
 * Ticket-escalation offer block.
 *
 * Renders THROUGH the client approval card rather than reimplementing it:
 * per Figma (fae chat › "escalation to admin") the offer is that exact
 * component, down to the Approve/Reject labels and the resolved
 * "Approved by {name}" pill. Only the wiring differs — approve/reject call
 * the ticket-escalation mutations, never the tool-approval endpoint — which
 * is why this is a distinct segment type with its own handlers.
 *
 * The handoff receipt that follows an approval is NOT rendered here: it is its
 * own `TICKET_ESCALATED` block on the wire, which also covers the inactivity
 * auto-escalation — a path that raises no offer to infer from.
 */
const EscalationOfferMessage = forwardRef<HTMLDivElement, EscalationOfferMessageProps>(
  ({ className, data, status = 'pending', resolvedByName, onApprove, onReject, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col', className)} {...props}>
      <ApprovalRequestMessage
        variant="client"
        // Only the client may resolve an offer — the backend rejects every
        // other actor — so a viewer without BOTH handlers wired (the admin
        // ticket view) sees the prompt read-only rather than dead buttons. The
        // card renders Approve and Reject as a pair, so one handler is not a
        // usable state. A resolved offer still shows its pill for everyone.
        showFooterActions={(!!onApprove && !!onReject) || status !== 'pending'}
        // The client card renders `explanation` as its body and never shows
        // `command`; the offer's whole payload is that one backend-fixed line.
        data={{ command: '', explanation: data.text, requestId: data.offerId }}
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
