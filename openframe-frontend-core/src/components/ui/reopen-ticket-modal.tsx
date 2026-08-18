'use client';

import * as React from 'react';
import { Autocomplete } from './autocomplete';
import { Button } from './button';
import { ColorSwatch } from './color-swatch';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';
import { SquareAvatar } from './square-avatar';
import {
  renderTicketAssigneeOption,
  renderTicketStatusOption,
  type TakeOverAssigneeOption,
  type TakeOverStatusOption,
} from './take-over-ticket-modal';
import { Textarea } from './textarea';

/** Backend trims and caps the reason at 1000 chars; cap it client-side too. */
const REASON_MAX_LENGTH = 1000;

export interface ReopenTicketSelection {
  statusId: string;
  assigneeId: string;
  /** Trimmed; `null` when the field was left blank. */
  reason: string | null;
}

export interface ReopenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Highlighted ticket reference in the description, e.g. "1003: Email client synchronization issues". */
  ticketRef: string;
  /** Allowed target statuses, in display order. Per design, the consumer
   *  pre-selects Tech Required by default (annotation on the mock: "tech
   *  required by default, but may be changed to custom status"). */
  statusOptions: TakeOverStatusOption[];
  /** Assignable users, in display order (consumer decides ordering, e.g. signed-in user first). */
  assigneeOptions: TakeOverAssigneeOption[];
  assigneesLoading?: boolean;
  /** Pre-selected status; falls back to the first status option. */
  initialStatusId?: string | null;
  /** Pre-selected assignee (the design default restores the ticket's previous
   *  assignee). No fallback — with none selected the CTA stays locked, same
   *  as Take Over: both Status and Assigned are required to confirm. */
  initialAssigneeId?: string | null;
  /** Confirm in-flight: buttons lock and the modal refuses to close. */
  isPending?: boolean;
  onConfirm: (selection: ReopenTicketSelection) => void;
}

/**
 * Reopen Ticket dialog (Figma openframe---tickets 8456-17581): shown when a
 * technician reopens a Resolved/Archived ticket. Same Status + Assigned pair
 * as {@link TakeOverTicketModal} — both REQUIRED before the CTA unlocks —
 * plus an optional free-text reason.
 * Presentational — the consumer supplies the option lists, their ordering and
 * default selections, and performs the actual reopen in `onConfirm`.
 *
 * Desktop footer shows only the accent Reopen button (X closes); mobile
 * bottom-sheet adds a Cancel button, matching Take Over.
 */
export function ReopenTicketModal({
  isOpen,
  onClose,
  ticketRef,
  statusOptions,
  assigneeOptions,
  assigneesLoading,
  initialStatusId,
  initialAssigneeId,
  isPending = false,
  onConfirm,
}: ReopenTicketModalProps) {
  const [statusId, setStatusId] = React.useState<string | null>(null);
  const [assigneeId, setAssigneeId] = React.useState<string | null>(null);
  const [reason, setReason] = React.useState('');

  // Re-seed the selections every time the modal opens.
  React.useEffect(() => {
    if (!isOpen) return;
    setStatusId(initialStatusId ?? null);
    setAssigneeId(initialAssigneeId ?? null);
    setReason('');
  }, [isOpen, initialStatusId, initialAssigneeId]);

  const selectedStatusId = statusId ?? statusOptions[0]?.value ?? null;
  const selectedStatus = statusOptions.find(o => o.value === selectedStatusId);
  const selectedAssignee = assigneeOptions.find(o => o.value === assigneeId);

  const handleConfirm = () => {
    if (!selectedStatusId || !assigneeId || isPending) return;
    const trimmedReason = reason.trim();
    onConfirm({
      statusId: selectedStatusId,
      assigneeId,
      reason: trimmedReason ? trimmedReason.slice(0, REASON_MAX_LENGTH) : null,
    });
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Reopen Ticket</ModalV2Title>
      </ModalV2Header>

      <p className="text-h4 text-ods-text-primary">
        The ticket <span className="text-ods-accent">{ticketRef}</span> will return to the selected status and appear on
        the board. Assigned admins and the user will be notified.
      </p>

      <div className="flex flex-col md:flex-row gap-[var(--spacing-system-l)] w-full">
        <div className="flex-1 min-w-0">
          <Autocomplete
            label="Status"
            options={statusOptions}
            value={selectedStatusId}
            onChange={setStatusId}
            placeholder="Select Status"
            startAdornment={selectedStatus ? <ColorSwatch color={selectedStatus.color} /> : undefined}
            renderOption={renderTicketStatusOption}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Autocomplete
            label="Assigned"
            options={assigneeOptions}
            value={assigneeId}
            onChange={setAssigneeId}
            placeholder="Select Technician"
            loading={assigneesLoading}
            startAdornment={
              selectedAssignee ? (
                <SquareAvatar
                  src={selectedAssignee.imageUrl}
                  alt={selectedAssignee.label}
                  fallback={selectedAssignee.label}
                  size="sm"
                  variant="round"
                />
              ) : undefined
            }
            renderOption={renderTicketAssigneeOption}
          />
        </div>
      </div>

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

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1 md:hidden">
          Cancel
        </Button>
        <div className="hidden md:block flex-1" />
        <Button
          type="button"
          variant="accent"
          onClick={handleConfirm}
          loading={isPending}
          disabled={!selectedStatusId || !assigneeId}
          className="flex-1"
        >
          Reopen Ticket
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}
