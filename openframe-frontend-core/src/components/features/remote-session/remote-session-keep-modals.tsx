'use client';

import { type ReactNode, useState } from 'react';
import { HourglassIcon, InfoCircleIcon } from '../../icons-v2-generated';
import { Button } from '../../ui/button/button';
import { Input } from '../../ui/input';
import { ModalV2, ModalV2Footer, ModalV2Header, ModalV2Title } from '../../ui/modal-v2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import type { RemoteSessionKeepReason } from './types';

/** How each Keep reason reads in the dialog, the session list and the release notice. */
export const REMOTE_SESSION_KEEP_REASON_LABELS: Record<RemoteSessionKeepReason, string> = {
  CLIENT_DISPUTE: 'Client dispute',
  INTERNAL_REVIEW: 'Internal review',
  LEGAL_OR_COMPLIANCE: 'Legal or compliance request',
  OTHER: 'Other',
};

const KEEP_REASONS = Object.keys(REMOTE_SESSION_KEEP_REASON_LABELS) as RemoteSessionKeepReason[];

const DESCRIPTION_MAX_LENGTH = 500;

/** A notice inside the Keep dialogs: an icon, a bold line and the explanation under it. */
function KeepNotice({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]">
      <span className="flex shrink-0 text-ods-text-secondary">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-ods-text-primary text-h3">{title}</p>
        <p className="text-ods-text-secondary text-h4">{children}</p>
      </div>
    </div>
  );
}

export interface KeepRecordingSelection {
  reason: RemoteSessionKeepReason;
  /** Trimmed; set for `OTHER` only. */
  description: string | null;
}

export interface KeepRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What kept recordings take of the tenant's allowance, e.g. "612 MB of 50 GB". */
  keptUsage: string;
  /** The Keep is in flight: the button spins and the dialog refuses to close. */
  isPending?: boolean;
  onConfirm: (selection: KeepRecordingSelection) => void;
}

/** Keep this recording: exempts it from automatic deletion until someone releases it. */
export function KeepRecordingModal({
  isOpen,
  onClose,
  keptUsage,
  isPending = false,
  onConfirm,
}: KeepRecordingModalProps) {
  const [reason, setReason] = useState<RemoteSessionKeepReason | ''>('');
  const [description, setDescription] = useState('');

  // Every opening starts blank. Reset while rendering, not from an effect: the
  // modal stays mounted when it closes, so an effect would paint the opening
  // frame with the previous answer still filled in.
  const [seededOpen, setSeededOpen] = useState(isOpen);
  if (seededOpen !== isOpen) {
    setSeededOpen(isOpen);
    if (isOpen) {
      setReason('');
      setDescription('');
    }
  }

  const trimmed = description.trim();
  const canKeep = reason !== '' && (reason !== 'OTHER' || trimmed !== '');

  const handleKeep = () => {
    if (!canKeep || isPending) return;
    onConfirm({ reason, description: reason === 'OTHER' ? trimmed : null });
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Keep this recording</ModalV2Title>
      </ModalV2Header>

      <KeepNotice
        icon={<InfoCircleIcon size={24} color="currentColor" />}
        title="This recording won't be deleted automatically"
      >
        It stays until you stop keeping it. Kept recordings use {keptUsage}.
      </KeepNotice>

      <div className="flex w-full flex-col gap-[var(--spacing-system-xs)]">
        <Select
          value={reason}
          onValueChange={value => setReason(value as RemoteSessionKeepReason)}
          disabled={isPending}
        >
          <SelectTrigger label="Reason" labelVariant="large">
            <SelectValue placeholder="Select Reason" />
          </SelectTrigger>
          <SelectContent>
            {KEEP_REASONS.map(value => (
              <SelectItem key={value} value={value}>
                {REMOTE_SESSION_KEEP_REASON_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {reason === 'OTHER' && (
          <Input
            aria-label="Reason description"
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Briefly describe what's going on"
            maxLength={DESCRIPTION_MAX_LENGTH}
            disabled={isPending}
          />
        )}
      </div>

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1 md:hidden">
          Cancel
        </Button>
        <div className="hidden flex-1 md:block" />
        <Button
          type="button"
          variant="accent"
          onClick={handleKeep}
          loading={isPending}
          disabled={!canKeep}
          className="flex-1"
        >
          Keep
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}

export interface ReleaseKeepingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Who placed the Keep. */
  keptBy: string;
  /** When the Keep was placed, formatted, e.g. "27 Jul 2026". */
  keptOn: string;
  /** The reason as it reads in the sentence, e.g. "Client dispute". */
  reason: string;
  /** The ticket or reference the Keep was placed for. */
  ticket?: string | null;
  /** When the recording will be deleted once released, formatted. */
  expiresOn: string;
  /** The original expiry date when it has already passed, so the release adds the grace period. */
  dueOn?: string | null;
  /** The release is in flight: the button spins and the dialog refuses to close. */
  isPending?: boolean;
  onConfirm: () => void;
}

/** Release Keeping: hands the recording back to the normal expiry, nothing is deleted on the spot. */
export function ReleaseKeepingModal({
  isOpen,
  onClose,
  keptBy,
  keptOn,
  reason,
  ticket,
  expiresOn,
  dueOn,
  isPending = false,
  onConfirm,
}: ReleaseKeepingModalProps) {
  return (
    <ModalV2 isOpen={isOpen} onClose={isPending ? () => {} : onClose} className="text-left md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Release Keeping</ModalV2Title>
      </ModalV2Header>

      <div className="flex w-full flex-col gap-[var(--spacing-system-xsf)] text-ods-text-primary text-h4">
        <p>
          Kept by {keptBy} on {keptOn} for {reason}.
        </p>
        {ticket && <p>Ticket: {ticket}</p>}
      </div>

      <KeepNotice icon={<HourglassIcon size={24} color="currentColor" />} title={`It will expire on ${expiresOn}`}>
        {dueOn
          ? `It was due to expire on ${dueOn}. Releasing gives it 3 days' grace, and it shows amber until then. Whoever placed the Keep is reminded the day before it goes. Nothing is deleted now.`
          : 'Nothing is deleted now.'}
      </KeepNotice>

      <ModalV2Footer>
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending} className="flex-1 md:hidden">
          Cancel
        </Button>
        <div className="hidden flex-1 md:block" />
        <Button type="button" variant="accent" onClick={onConfirm} loading={isPending} className="flex-1">
          Release Keeping
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}
