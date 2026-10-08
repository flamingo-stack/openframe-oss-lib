'use client';

import { useState } from 'react';
import { Autocomplete, type AutocompleteOption } from '../../ui/autocomplete';
import { Button } from '../../ui/button/button';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from '../../ui/modal-v2';

export interface AssignTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * The tickets that can be assigned: label = title, value = ticket id. Leave
   * out the ones already assigned to the recording.
   */
  options: AutocompleteOption<string>[];
  /** Server-side search: called with the typed text; the caller refreshes `options`. Client-side filtering otherwise. */
  onSearch?: (query: string) => void;
  /** The ticket search is in flight. */
  loading?: boolean;
  /** The assignment is in flight: the button spins and the dialog refuses to close. */
  isPending?: boolean;
  onConfirm: (ticketIds: string[]) => void;
}

/** Assign Ticket: links one or more tickets to a recording. */
export function AssignTicketModal({
  isOpen,
  onClose,
  options,
  onSearch,
  loading = false,
  isPending = false,
  onConfirm,
}: AssignTicketModalProps) {
  const [ticketIds, setTicketIds] = useState<string[]>([]);
  // Titles of the picked tickets: a server-side search replaces `options`, and
  // a picked ticket missing from the new results would otherwise show its id.
  const [titles, setTitles] = useState<Record<string, string>>({});

  // Every opening starts blank. Reset while rendering, not from an effect: the
  // modal stays mounted when it closes, so an effect would paint the opening
  // frame with the previous selection still in the field.
  const [seededOpen, setSeededOpen] = useState(isOpen);
  if (seededOpen !== isOpen) {
    setSeededOpen(isOpen);
    if (isOpen) {
      setTicketIds([]);
      setTitles({});
    }
  }

  const handleChange = (ids: string[]) => {
    setTicketIds(ids);
    setTitles(prev => {
      const next: Record<string, string> = {};
      for (const id of ids) next[id] = options.find(option => option.value === id)?.label ?? prev[id] ?? id;
      return next;
    });
  };

  const handleAssign = () => {
    if (ticketIds.length === 0 || isPending) return;
    onConfirm(ticketIds);
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Assign Ticket</ModalV2Title>
      </ModalV2Header>

      <Autocomplete
        multiple
        wrapTags
        label="Tickets"
        labelVariant="large"
        options={options}
        value={ticketIds}
        onChange={handleChange}
        renderTag={option => titles[option.value] ?? option.label}
        onInputChange={onSearch ? (value, reason) => reason === 'input' && onSearch(value) : undefined}
        disableClientFilter={Boolean(onSearch)}
        loading={loading}
        noOptionsText="No tickets found"
        disabled={isPending}
      />

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1 md:hidden">
          Cancel
        </Button>
        <div className="hidden flex-1 md:block" />
        <Button
          type="button"
          variant="accent"
          onClick={handleAssign}
          loading={isPending}
          disabled={ticketIds.length === 0}
          className="flex-1"
        >
          Assign
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}

export interface UnassignTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The unassignment is in flight: the button spins and the dialog refuses to close. */
  isPending?: boolean;
  onConfirm: () => void;
}

/** Unassign Ticket: unlinks a ticket from a recording; the ticket itself is unchanged. */
export function UnassignTicketModal({ isOpen, onClose, isPending = false, onConfirm }: UnassignTicketModalProps) {
  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Unassign Ticket</ModalV2Title>
      </ModalV2Header>

      <p className="w-full text-ods-text-primary text-h4">
        This Ticket will no longer be linked to this remote session. The ticket itself stays as it is, and you can
        assign it again anytime.
      </p>

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1 md:hidden">
          Cancel
        </Button>
        <div className="hidden flex-1 md:block" />
        <Button type="button" variant="destructive" onClick={onConfirm} loading={isPending} className="flex-1">
          Unassign
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}
