'use client';

import { type ReactNode, useState } from 'react';
import { CheckIcon } from '../icons-v2-generated';
import { Autocomplete, type AutocompleteOption } from './autocomplete';
import { Button } from './button';
import { ColorSwatch } from './color-swatch';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from './modal-v2';
import { SquareAvatar } from './square-avatar';
import { TruncateText } from './truncate-text';

export interface TakeOverStatusOption extends AutocompleteOption {
  color: string;
}

export interface TakeOverAssigneeOption extends AutocompleteOption {
  /** Full (already resolved) avatar URL. */
  imageUrl?: string;
}

export interface TakeOverTicketSelection {
  statusId: string;
  assigneeId: string;
}

export interface TakeOverTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Highlighted ticket reference in the description, e.g. "1003: Email client synchronization issues". */
  ticketRef: string;
  /** Allowed target statuses, in display order (consumer decides grouping, e.g. custom statuses first). */
  statusOptions: TakeOverStatusOption[];
  /** Assignable users, in display order (consumer decides ordering, e.g. signed-in user first). */
  assigneeOptions: TakeOverAssigneeOption[];
  assigneesLoading?: boolean;
  /** Pre-selected status; falls back to the first status option. */
  initialStatusId?: string | null;
  /** Pre-selected assignee; no fallback — pass the signed-in user id for the design default. */
  initialAssigneeId?: string | null;
  /** Confirm in-flight: buttons lock and the modal refuses to close. */
  isPending?: boolean;
  onConfirm: (selection: TakeOverTicketSelection) => void;
}

/** Status row with color swatch — shared by the ticket lifecycle modals
 *  (Take Over / Reopen), which present the same Status + Assigned pair. */
export function renderTicketStatusOption(option: AutocompleteOption, isSelected: boolean): ReactNode {
  const { label, color } = option as TakeOverStatusOption;
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
        <ColorSwatch color={color} />
        <div className="min-w-0">
          <TruncateText className="text-inherit">{label}</TruncateText>
        </div>
      </div>
      {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
    </div>
  );
}

/** Assignee row with round avatar — shared by the ticket lifecycle modals. */
export function renderTicketAssigneeOption(option: AutocompleteOption, isSelected: boolean): ReactNode {
  const { label, imageUrl } = option as TakeOverAssigneeOption;
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-[var(--spacing-system-xs)]">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xs)]">
        <SquareAvatar src={imageUrl} alt={label} fallback={label} size="sm" variant="round" />
        <div className="min-w-0">
          <TruncateText className="text-inherit">{label}</TruncateText>
        </div>
      </div>
      {isSelected && <CheckIcon className="text-ods-accent" size={20} />}
    </div>
  );
}

/**
 * Take Over Ticket confirmation dialog (Figma openframe---tickets 8482-112154 /
 * 8482-112169): shown when a technician takes a ticket over from the AI
 * assistant. Presentational — the consumer supplies the option lists, their
 * ordering and default selections, and performs the actual take-over in
 * `onConfirm` (status transition + assignment + switching the dialog to direct
 * mode, or an atomic backend mutation once available).
 *
 * Desktop footer shows only the accent Take Over button (X closes); mobile
 * bottom-sheet adds a Cancel button, per design.
 */
export function TakeOverTicketModal({
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
}: TakeOverTicketModalProps) {
  const [statusId, setStatusId] = useState<string | null>(initialStatusId ?? null);
  const [assigneeId, setAssigneeId] = useState<string | null>(initialAssigneeId ?? null);

  // Re-seed the selections every time the modal opens. Adjusted while
  // rendering, not from an effect: the modal does not unmount when it closes,
  // so an effect painted the OPENING frame with the previous session's status
  // and assignee still selected before replacing them. The mount case is
  // covered by the initialisers above, exactly as the effect's first run was.
  const [seededWith, setSeededWith] = useState({ isOpen, initialStatusId, initialAssigneeId });
  if (
    seededWith.isOpen !== isOpen ||
    seededWith.initialStatusId !== initialStatusId ||
    seededWith.initialAssigneeId !== initialAssigneeId
  ) {
    setSeededWith({ isOpen, initialStatusId, initialAssigneeId });
    if (isOpen) {
      setStatusId(initialStatusId ?? null);
      setAssigneeId(initialAssigneeId ?? null);
    }
  }

  const selectedStatusId = statusId ?? statusOptions[0]?.value ?? null;
  const selectedStatus = statusOptions.find(o => o.value === selectedStatusId);
  const selectedAssignee = assigneeOptions.find(o => o.value === assigneeId);

  const handleConfirm = () => {
    if (!selectedStatusId || !assigneeId || isPending) return;
    onConfirm({ statusId: selectedStatusId, assigneeId });
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Take Over Ticket</ModalV2Title>
      </ModalV2Header>

      <p className="text-ods-text-primary text-h4">
        The ticket <span className="text-ods-accent">{ticketRef}</span> will move to the selected status and be assigned
        to the technician. A direct chat with the user will start, and the AI assistant will stop working on this
        ticket.
      </p>

      <div className="flex w-full flex-col gap-[var(--spacing-system-l)] md:flex-row">
        <div className="min-w-0 flex-1">
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
        <div className="min-w-0 flex-1">
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

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1 md:hidden">
          Cancel
        </Button>
        <div className="hidden flex-1 md:block" />
        <Button
          type="button"
          variant="accent"
          onClick={handleConfirm}
          loading={isPending}
          disabled={!selectedStatusId || !assigneeId}
          className="flex-1"
        >
          Take Over
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}
