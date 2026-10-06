import { cn } from '../../utils/cn';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { XmarkCircleIcon } from '../icons-v2-generated/signs-and-symbols/xmark-circle-icon';

/**
 * What a status line says about the thing above it:
 *  - `working`: in progress (a live dot);
 *  - `waiting`: it needs a person. The warning colour means this and nothing else;
 *  - `success`: done (a check);
 *  - `error`: it failed or was refused;
 *  - `muted`: it ended without a result (cancelled).
 */
export type StatusLineTone = 'working' | 'waiting' | 'success' | 'error' | 'muted';

export interface StatusLineProps {
  tone: StatusLineTone;
  label: string;
  className?: string;
}

/**
 * THE one-line status of a card in a feed or a chat thread: an icon for the
 * tone and a short label, as plain text (never a pill). Every in-thread box
 * (an incident, a tool run, an approval) ends in one of these, so "waiting on
 * you" and "done" read the same wherever they appear.
 */
export function StatusLine({ tone, label, className }: StatusLineProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap text-h6',
        tone === 'waiting'
          ? 'text-ods-warning'
          : tone === 'error'
            ? 'text-ods-error'
            : tone === 'muted'
              ? 'text-ods-text-secondary'
              : 'text-ods-text-primary',
        className,
      )}
    >
      {tone === 'working' && (
        <span
          className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ods-flamingo-cyan motion-reduce:animate-none"
          aria-hidden
        />
      )}
      {tone === 'success' && <CheckCircleIcon size={16} className="shrink-0 text-ods-success" aria-hidden />}
      {tone === 'error' && <XmarkCircleIcon size={16} className="shrink-0 text-ods-error" aria-hidden />}
      {label}
    </span>
  );
}
