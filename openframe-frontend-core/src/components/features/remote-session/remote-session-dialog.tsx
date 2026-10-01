'use client';

import type { ReactNode } from 'react';
import { Button } from '../../ui/button/button';
import type { RemoteSessionDialogVariant } from './types';

export interface RemoteSessionDialogProps {
  variant: RemoteSessionDialogVariant;
  /** Named in the "ended" and "connection lost" notices. */
  organizationName: string;
  /** End confirm: the end call is in flight. */
  ending?: boolean;
  /** End confirm: the user confirmed. */
  onEndSession?: () => void;
  /** Cancel (end confirm) or Close (the notices). */
  onClose: () => void;
}

const NOTICE_COPY: Record<Exclude<RemoteSessionDialogVariant, 'end-confirm'>, { title: string; suffix: string }> = {
  'session-ended': { title: 'Remote session ended', suffix: 'has disconnected from your device.' },
  'connection-lost': { title: 'Connection lost', suffix: 'lost the connection to your device.' },
};

/** The session's terminal dialogs: the end confirm and the "it is over" notices. */
export function RemoteSessionDialog({
  variant,
  organizationName,
  ending = false,
  onEndSession,
  onClose,
}: RemoteSessionDialogProps) {
  if (variant === 'end-confirm') {
    return (
      <DialogCard>
        <div className="flex w-full flex-col gap-[var(--spacing-system-xs)]">
          <h1 className="w-full text-ods-text-primary text-h2">End remote session?</h1>
          <p className="w-full text-ods-text-primary text-h4">
            The technician will lose access to your device immediately.
          </p>
        </div>
        <div className="flex w-full items-stretch gap-[var(--spacing-system-l)]">
          <Button variant="outline" fullWidth disabled={ending} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" fullWidth loading={ending} onClick={onEndSession}>
            End Session
          </Button>
        </div>
      </DialogCard>
    );
  }

  const copy = NOTICE_COPY[variant];
  return (
    <DialogCard>
      <div className="flex w-full flex-col gap-[var(--spacing-system-xs)]">
        <h1 className="w-full text-ods-text-primary text-h2">{copy.title}</h1>
        <p className="w-full text-ods-text-primary text-h4">
          <span className="text-ods-accent">{organizationName}</span> {copy.suffix}
        </p>
      </div>
      <div className="flex w-full justify-end">
        <Button variant="outline" className="w-1/2" onClick={onClose}>
          Close
        </Button>
      </div>
    </DialogCard>
  );
}

function DialogCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
      {children}
    </div>
  );
}
