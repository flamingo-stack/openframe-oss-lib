'use client';

import type { MouseEvent } from 'react';
import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { cn } from '../../utils/cn';
import { isModifierClick } from '../chat/utils/chat-nav-resolution';
import { executeNavigationImperative, executeNewTabNavigation } from '../chat/utils/execute-navigation';
import { CountPill } from './count-pill';

/** What the indicator says to a screen reader: the count, in words. */
export function unreadNotificationsLabel(count: number): string {
  return `${count} unread ${count === 1 ? 'notification' : 'notifications'}`;
}

export interface UnreadNotificationsIndicatorProps {
  /** The viewer's unread notifications about one item. Nothing is drawn at 0. */
  count: number;
  /** Where those notifications are listed. Absent: the count alone, not a button. */
  href?: string;
  className?: string;
}

/**
 * The viewer's unread notifications about one item of a list (a device, an incident), drawn with the sidebar's own
 * count pill so a row and its section's badge read alike.
 *
 * A button, not a link: the row or card it sits in is usually a link itself, and a link cannot hold another
 * (`data-no-row-click` keeps a table row from following its own). It goes through the lib's navigation executor,
 * so the host decides how `href` opens, and a modifier click asks for a new tab as it would on a link.
 */
export function UnreadNotificationsIndicator({ count, href, className }: UnreadNotificationsIndicatorProps) {
  const runtime = useChatRuntime();
  if (count <= 0) return null;

  const label = unreadNotificationsLabel(count);

  if (!href) {
    return (
      <span data-loading-optional role="img" aria-label={label} className={cn('inline-flex shrink-0', className)}>
        <CountPill count={count} />
      </span>
    );
  }

  const open = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (isModifierClick(event)) executeNewTabNavigation({ runtime, href });
    else executeNavigationImperative({ runtime, href });
  };

  return (
    <button
      type="button"
      data-loading-optional
      data-no-row-click
      onClick={open}
      aria-label={label}
      title={label}
      className={cn(
        'pointer-events-auto inline-flex shrink-0 rounded-md transition-opacity hover:opacity-80',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus',
        className,
      )}
    >
      <CountPill count={count} />
    </button>
  );
}
