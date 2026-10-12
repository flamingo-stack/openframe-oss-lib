'use client';

import { cn } from '../../../utils/cn';
import { formatTime } from '../../../utils/format-date';
import { SquareAvatar } from '../../ui/square-avatar';

export interface RemoteDesktopChatMessageRowProps {
  authorName: string;
  /** The technician's rows carry the avatar and the accent-colored name. */
  isTechnician: boolean;
  avatarUrl?: string;
  /** When the message was sent: an ISO timestamp or a `Date`. */
  sentAt: string | Date;
  body: string;
}

/**
 * One session-chat message on the technician's side, shared by the recording
 * transcript and the live panel: the technician's rows carry a 24px avatar and
 * an accent-colored name, the end user's rows a plain grey name; the timestamp
 * sits right-aligned on the name row and the message body follows below.
 *
 * Names are Azeret Mono 18/24 medium in the mockup - a combination the ODS
 * composite utilities don't carry (`text-h5` is the 14px uppercase caption),
 * so the heading family is applied over `text-h4` via the ODS font variable.
 */
export function RemoteDesktopChatMessageRow({
  authorName,
  isTechnician,
  avatarUrl,
  sentAt,
  body,
}: RemoteDesktopChatMessageRowProps) {
  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-xxs)]">
      <div className="flex items-center gap-[var(--spacing-system-xxs)]">
        {isTechnician && (
          <SquareAvatar variant="round" sizePx={24} src={avatarUrl} alt={authorName} className="shrink-0" />
        )}
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-h4 [font-family:var(--font-family-heading)]',
            isTechnician ? 'text-ods-accent' : 'text-ods-text-secondary',
          )}
        >
          {authorName}
        </span>
        {/* The time is in the viewer's zone, which a server render cannot know. */}
        <span suppressHydrationWarning className="shrink-0 text-ods-text-secondary text-h6">
          {formatTime(sentAt)}
        </span>
      </div>
      <p className="whitespace-pre-wrap text-ods-text-primary text-h4">{body}</p>
    </div>
  );
}
