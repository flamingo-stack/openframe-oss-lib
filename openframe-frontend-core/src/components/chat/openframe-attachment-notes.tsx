'use client';

/** The notes under the OpenFrame (Mingo, Fae) composer's tray: refused files, the Send wait, the files left out. */

import { cn } from '../../utils/cn';
import type { OpenFrameTraySummary } from './utils/openframe-attachment-view';

export interface OpenFrameAttachmentNotesProps {
  summary: OpenFrameTraySummary;
  className?: string;
}

/**
 * One note per refused file ("Larger than 20 MB"), "Send is available when 2 files finish uploading and scanning."
 * while any is on its way, and "1 file won't be sent" while refused files remain. Nothing when there is nothing to say.
 */
export function OpenFrameAttachmentNotes({ summary, className }: OpenFrameAttachmentNotesProps) {
  const { errorNotes, pendingNote, leftOutNote } = summary;
  if (errorNotes.length === 0 && !pendingNote && !leftOutNote) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="openframe-attachment-notes"
      className={cn('flex flex-col gap-[var(--spacing-system-xxs)] text-h6', className)}
    >
      {errorNotes.map(note => (
        <p key={note.id} className="m-0 min-w-0 break-words text-ods-error">
          <span className="text-ods-text-primary">{note.name}</span> {note.text}
        </p>
      ))}
      {pendingNote && <p className="m-0 text-ods-text-secondary">{pendingNote}</p>}
      {leftOutNote && <p className="m-0 text-ods-text-secondary">{leftOutNote}</p>}
    </div>
  );
}
