'use client';

import { cn } from '../../../utils/cn';
import { formatTime } from '../../../utils/format-date';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { SquareAvatar, SquareAvatarSkeleton } from '../../ui/square-avatar';

/** The row's layout, read by the row and by its skeleton, so the skeleton is the row's size. */
const MESSAGE_ROW_CLASS = 'grid grid-cols-1 gap-[var(--spacing-system-xxs)]';
const MESSAGE_HEAD_CLASS = 'flex items-center gap-[var(--spacing-system-xxs)]';
/** The technician's avatar, in px. */
const TECHNICIAN_AVATAR_PX = 24;
const MESSAGE_NAME_CLASS = 'min-w-0 flex-1 truncate text-h4 [font-family:var(--font-family-heading)]';

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
    <div className={MESSAGE_ROW_CLASS} data-loading-item>
      <div className={MESSAGE_HEAD_CLASS}>
        {isTechnician && (
          <SquareAvatar
            variant="round"
            sizePx={TECHNICIAN_AVATAR_PX}
            src={avatarUrl}
            alt={authorName}
            className="shrink-0"
          />
        )}
        <span className={cn(MESSAGE_NAME_CLASS, isTechnician ? 'text-ods-accent' : 'text-ods-text-secondary')}>
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

/**
 * A message row while the chat is read: the technician's avatar box on a technician's row, the name and the time as
 * bars on the name row, one line of the body.
 */
export function RemoteDesktopChatMessageRowSkeleton({ isTechnician = false }: { isTechnician?: boolean }) {
  return (
    <div className={MESSAGE_ROW_CLASS} aria-hidden data-loading-item>
      <div className={MESSAGE_HEAD_CLASS}>
        {isTechnician && <SquareAvatarSkeleton variant="round" sizePx={TECHNICIAN_AVATAR_PX} />}
        <span className={MESSAGE_NAME_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className="w-24" />
        </span>
        <TextLineSkeleton type="h6" as="span" className="w-12 shrink-0" />
      </div>
      <TextLineSkeleton type="h4" className="w-3/4" />
    </div>
  );
}
