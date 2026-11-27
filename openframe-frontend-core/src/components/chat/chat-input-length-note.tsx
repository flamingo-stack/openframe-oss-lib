'use client';

import { cn } from '../../utils/cn';

/** The note shows once the draft passes this share of the limit (9,000 of 10,000). */
export const LENGTH_NOTE_FROM = 0.9;

const formatCount = (n: number) => n.toLocaleString('en-US');

/** Whether a draft of `length` characters is past the point where its length is shown. */
export function showsLengthNote(length: number, maxLength: number | undefined): maxLength is number {
  return maxLength !== undefined && length > maxLength * LENGTH_NOTE_FROM;
}

interface ChatInputLengthNoteProps {
  /** The draft's length as it would be sent (trimmed). */
  length: number;
  maxLength: number;
  className?: string;
}

/**
 * Under the composer: the draft's length against the limit once it nears it, and the limit in words once the
 * draft is over it (Send is refused then). The count is not a live region — it changes on every keystroke; the
 * over-limit sentence is, and it is announced once, when it appears.
 */
export function ChatInputLengthNote({ length, maxLength, className }: ChatInputLengthNoteProps) {
  const over = length > maxLength;
  return (
    <div
      data-testid="chat-input-length-note"
      className={cn('flex items-start justify-end gap-[var(--spacing-system-xs)] text-h6', className)}
    >
      {over && (
        <p role="status" className="m-0 min-w-0 flex-1 break-words text-ods-error">
          Messages can be up to {formatCount(maxLength)} characters
        </p>
      )}
      <p className={cn('m-0 shrink-0 tabular-nums', over ? 'text-ods-error' : 'text-ods-text-secondary')}>
        {formatCount(length)} / {formatCount(maxLength)}
      </p>
    </div>
  );
}
