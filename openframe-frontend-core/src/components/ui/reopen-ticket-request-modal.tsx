'use client';

import * as React from 'react';
import { Button } from './button';
import { CheckboxBlock } from './checkbox-block';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';
import { Textarea } from './textarea';

/** Backend trims and caps the reason at 1000 chars; cap it client-side too. */
const REASON_MAX_LENGTH = 1000;

export interface ReopenTicketRequestSelection {
  /** Trimmed; `null` when the field was left blank. */
  reason: string | null;
  /** Present ONLY when the handoff option was shown — the tech-closed
   *  variant omits the field entirely (mirrors `TicketReopenInput`). */
  handoffToTechnician?: boolean;
}

export interface ReopenTicketRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fae resolved the ticket (`Ticket.resolvedBy === END_USER`): reopening
   * resumes the AI conversation, and the checkbox lets the user route to a
   * technician instead. When a technician closed the ticket the option is
   * hidden — reopening goes to a technician regardless, and the selection
   * omits `handoffToTechnician`.
   */
  showHandoffOption?: boolean;
  /** Confirm in-flight: buttons lock and the modal refuses to close. */
  isPending?: boolean;
  onConfirm: (selection: ReopenTicketRequestSelection) => void;
}

/**
 * Client-side Reopen Ticket dialog (Figma openframe---fae-chat 346-10518):
 * the end user reopening their own resolved ticket from the closed chat.
 * Unlike the admin `ReopenTicketModal` there is no status/assignee pair —
 * the backend picks the target via `requestTicketReopen`; the user only
 * supplies an optional reason and (for Fae-closed tickets) the handoff
 * choice. Presentational — the consumer performs the reopen in `onConfirm`.
 */
export function ReopenTicketRequestModal({
  isOpen,
  onClose,
  showHandoffOption = false,
  isPending = false,
  onConfirm,
}: ReopenTicketRequestModalProps) {
  const [reason, setReason] = React.useState('');
  const [handoff, setHandoff] = React.useState(false);

  // Re-seed the inputs every time the modal opens.
  React.useEffect(() => {
    if (!isOpen) return;
    setReason('');
    setHandoff(false);
  }, [isOpen]);

  const handleConfirm = () => {
    if (isPending) return;
    const trimmedReason = reason.trim();
    onConfirm({
      reason: trimmedReason ? trimmedReason.slice(0, REASON_MAX_LENGTH) : null,
      ...(showHandoffOption ? { handoffToTechnician: handoff } : {}),
    });
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Reopen Ticket</ModalV2Title>
      </ModalV2Header>

      <p className="text-h4 text-ods-text-primary">
        This ticket will be reopened and the AI assistant will continue helping you.
      </p>

      <div className="w-full">
        <Textarea
          label="Reason"
          value={reason}
          onChange={event => setReason(event.target.value)}
          placeholder="Describe what's still not working (optional)"
          maxLength={REASON_MAX_LENGTH}
          disabled={isPending}
        />
      </div>

      {showHandoffOption && (
        <CheckboxBlock
          id="reopen-handoff-to-technician"
          checked={handoff}
          onCheckedChange={setHandoff}
          label="Hand off to a Technician"
          description="A technician will review the ticket and reply when available."
          disabled={isPending}
        />
      )}

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
          Cancel
        </Button>
        <Button type="button" variant="accent" onClick={handleConfirm} loading={isPending} className="flex-1">
          Reopen Ticket
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}
