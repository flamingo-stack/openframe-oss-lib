'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { formatTime } from '../../utils/format-date';

export interface AiAssistantInfoProps extends HTMLAttributes<HTMLDivElement> {
  /** Rendered inside the standard 48px framed box (typically a 24px icon). */
  icon?: ReactNode;
  /** Replaces the framed icon box entirely (e.g. a round 48px avatar for the
   *  `direct-chat` variant). Wins over `icon` when both are set. */
  leading?: ReactNode;
  title: string;
  /** Secondary line under the title. Omitted → the row is title-only. */
  body?: ReactNode;
  /** Timestamp of the message row this block came in on. */
  timestamp?: Date;
}

/**
 * Figma `ai-assistant-info` — the shared in-thread status card: a framed
 * icon (or avatar), a title with a right-aligned time, and a secondary line.
 * One presentational shell for every lifecycle receipt in a chat thread
 * (handoff, technician joined, ticket resolved/reopened, …); the per-event
 * components (`TicketEscalatedMessage`, `TicketEventMessage`) own the copy
 * and icon choice and delegate the chrome here.
 *
 * The body WRAPS, deliberately diverging from the mock's single-line
 * ellipsis: the mock's 72px comes from its placeholder copy fitting one
 * line, while real wire text is a full sentence, and clipping the only
 * explanation of a lifecycle change is not recoverable on touch. The title
 * still truncates — it holds one line so the timestamp is never pushed out
 * of the row at narrow widths.
 */
const AiAssistantInfo = forwardRef<HTMLDivElement, AiAssistantInfoProps>(
  ({ className, icon, leading, title, body, timestamp, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'mb-[var(--spacing-system-xsf)] flex items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]',
          className,
        )}
        {...props}
      >
        {leading ?? (
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg">
            {icon}
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex w-full items-start">
            <p className="min-w-0 flex-1 truncate text-ods-text-primary text-h4" title={title}>
              {title}
            </p>
            {timestamp && (
              <span className="shrink-0 text-right text-ods-text-secondary text-h6">{formatTime(timestamp)}</span>
            )}
          </div>
          {body != null && body !== '' && <p className="w-full break-words text-ods-text-secondary text-h4">{body}</p>}
        </div>
      </div>
    );
  },
);

AiAssistantInfo.displayName = 'AiAssistantInfo';

export { AiAssistantInfo };
