'use client';

import { cn } from '../../utils/cn';
import { useOptionalNotifications } from '../features/notifications/notifications-context';
import { XmarkIcon } from '../icons-v2-generated';
import { BellIcon } from '../icons-v2-generated/interface/bell-icon';
import { HeaderButton } from './header-button';

export interface NotificationsBellButtonProps {
  /** Unread count to show the dot for when no `NotificationsProvider` is mounted. */
  fallbackUnreadCount?: number;
  disabled?: boolean;
  /**
   * - `cell` (default): a cell of the top bar, as `AppHeader` draws it.
   * - `floating`: a 36px bordered square for a place with no bar around it —
   *   `AppLayout`'s `contentCorner`.
   * - `compact`: `HeaderButton`'s compact cell (20px glyph, pressed while the
   *   drawer is open) for the navigation sidebar's foot
   *   (beside the account row, `NavigationSidebarConfig.footerSlot`).
   */
  variant?: 'cell' | 'floating' | 'compact';
  className?: string;
}

/**
 * The notifications bell: toggles the `NotificationDrawer` through the
 * `NotificationsProvider` it reads, shows the shared unread dot, and turns into
 * a close "X" while the drawer is open. Disabled with no provider above it.
 *
 * `AppHeader` renders it under `showNotifications`. Without a header (the
 * `AppLayout` `desktopHeader={false}` shell), render it in `contentCorner`
 * (`floating`) or at the sidebar's foot (`compact`); the drawer
 * `AppLayout` mounts follows the same provider either way.
 */
export function NotificationsBellButton({
  fallbackUnreadCount = 0,
  disabled = false,
  variant = 'cell',
  className,
}: NotificationsBellButtonProps) {
  const ctx = useOptionalNotifications();
  const hasUnread = (ctx?.unreadCount ?? fallbackUnreadCount) > 0;
  const isActive = ctx?.isOpen ?? false;
  const onClick = ctx?.toggle;
  const floating = variant === 'floating';
  const iconClassName = variant === 'cell' ? 'h-6 w-6' : 'h-5 w-5';

  return (
    <HeaderButton
      icon={isActive ? <XmarkIcon className={iconClassName} /> : <BellIcon className={iconClassName} />}
      // Shared dot primitive on the cell — same markup every indicator
      // cell renders (see HeaderButton.showUnreadDot / <UnreadDot>).
      showUnreadDot={!isActive && hasUnread}
      aria-label={isActive ? 'Close notifications' : 'Notifications'}
      onClick={onClick}
      isActive={isActive}
      disabled={disabled || !onClick}
      size={variant === 'compact' ? 'compact' : 'cell'}
      className={cn(
        // Overrides the cell's bar-driven `h-full w-[--top-nav-cell]` box.
        floating && 'h-9 w-9 rounded-md border border-ods-border',
        // An opaque face over the page; the cell's own active colour wins while open.
        floating && !isActive && 'bg-ods-card',
        className,
      )}
    />
  );
}

export default NotificationsBellButton;
