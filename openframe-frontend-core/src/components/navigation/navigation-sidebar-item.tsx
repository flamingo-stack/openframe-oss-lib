'use client';

import { cloneElement, memo, type ReactElement, type ReactNode, type MouseEvent } from 'react';
import Link from '../../embed-shims/next-link';
import type { NavigationSidebarItem } from '../../types/navigation';
import { cn } from '../../utils';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { BUTTON_KIND_CLASS, Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { NavigationItemBadge } from './navigation-item-badge';
import { UnreadDot } from './unread-dot';

/** A sidebar row's height: the loaded row (a `rail` button or link) and its loading form are one box. */
const NAV_SIDEBAR_ROW_LAYOUT_CLASS = 'h-14';

interface IconProps {
  color?: string;
  className?: string;
}

interface LoadedNavigationSidebarItemButtonProps {
  item: NavigationSidebarItem;
  /** "You are on this page" — pathname-derived, and the only thing that carries `aria-current`. */
  isActive: boolean;
  /**
   * "You clicked this one and it has not arrived yet" — deliberately a separate,
   * weaker state. Never promoted to active: the accent belongs to the page you
   * are actually on.
   */
  isPending: boolean;
  showLabel: boolean;
  disabled: boolean;
  onClick: (item: NavigationSidebarItem, event?: MouseEvent) => void;
}

/**
 * The entry and its handlers, or `loading` while the navigation is read (`NavigationSidebarConfig.loading`): the
 * row then draws its own loading form (also in a loading scope). `showLabel` is the sidebar's minimized state.
 */
export type NavigationSidebarItemButtonProps =
  | (LoadedNavigationSidebarItemButtonProps & { loading?: boolean })
  | (Partial<LoadedNavigationSidebarItemButtonProps> & { loading: true; showLabel: boolean });

/**
 * One sidebar entry.
 *
 * Rendered as a real anchor whenever it has a `path` — which is what buys the
 * two things a `<button>` + `router.push` cannot: Next prefetches links that
 * are in the viewport (so the section is usually already loaded by the time it
 * is clicked, instead of every first visit paying a cold segment fetch), and
 * the browser's own affordances work — middle-click, ⌘/Ctrl-click, "open in new
 * tab", copy link, and a status-bar URL on hover.
 *
 * Falls back to a `<button>` for entries that only carry an `onClick` (no
 * destination to link to) and for the disabled state, which an anchor cannot
 * express.
 */
export const NavigationSidebarItemButton = memo(function NavigationSidebarItemButtonSwitch(
  props: NavigationSidebarItemButtonProps,
) {
  // ONE switch: while the navigation is read (`loading`, or a loading scope) the row is its own loading form.
  if (useLoadingScope() || props.loading) return <NavigationSidebarItemSkeleton showLabel={props.showLabel} />;
  return <LoadedNavigationSidebarItemButton {...props} />;
});

function LoadedNavigationSidebarItemButton({
  item,
  isActive,
  isPending,
  showLabel,
  disabled,
  onClick,
}: LoadedNavigationSidebarItemButtonProps) {
  const unreadCount = item.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;
  // The accessible name carries the stamp — "Devices (Beta)" — because `aria-label`
  // replaces the content; the rail's tooltip is the same string.
  const name = item.badge ? `${item.label} (${item.badge})` : item.label;

  const content: ReactNode = (
    <>
      <div className="relative flex flex-shrink-0 items-center justify-center">
        {cloneElement(item.icon as ReactElement<IconProps>, {
          color: isActive && !disabled ? 'text-ods-accent' : 'text-ods-text-secondary',
        })}
        {hasUnread && !showLabel && <UnreadDot size="fixed" />}
      </div>

      {/* The label column: the label and its stamp, fading together on collapse.
          The wrapper clips — a `shrink-0` stamp beside a zero-width label would
          otherwise overflow the rail and hand the sidebar a horizontal scrollbar.
          The rail draws no stamp of its own: a word under one glyph read as a
          caption the other rows lack, so there the row's tooltip and accessible
          name carry it. */}
      <span
        className={cn(
          'flex min-w-0 flex-1 items-center overflow-hidden text-left transition-[opacity,margin-left] duration-300',
          showLabel ? 'ml-[var(--spacing-system-xs)] opacity-100' : 'ml-0 opacity-0',
        )}
        aria-hidden={!showLabel}
      >
        <span className="min-w-0 truncate text-h4">{item.label}</span>
        {item.badge && <NavigationItemBadge label={item.badge} className="ml-[var(--spacing-system-xs)] shrink-0" />}
      </span>

      {hasUnread && showLabel && (
        <span className="ml-[var(--spacing-system-xs)] flex h-6 min-w-6 flex-shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)]">
          <span className="text-ods-text-on-accent text-h5">{unreadCount > 99 ? '99+' : unreadCount}</span>
        </span>
      )}
    </>
  );

  const shared = {
    title: !showLabel ? name : undefined,
    'aria-label': name,
    'aria-current': isActive ? ('page' as const) : undefined,
    // A row whose route is still committing: announced, never drawn as the current page.
    'aria-busy': isPending || undefined,
  };
  // The current page's entry: the rail kind's accent fill, text and bar (`aria-busy` above holds its hover wash).
  const rowState = isActive && !disabled ? 'active' : undefined;

  // An entry with a custom onClick has no destination of its own, and a
  // disabled one must not be followable — both stay buttons.
  if (disabled || !item.path || item.onClick) {
    return (
      <Button
        variant="rail"
        type="button"
        onClick={event => onClick(item, event)}
        disabled={disabled}
        data-state={rowState}
        className={NAV_SIDEBAR_ROW_LAYOUT_CLASS}
        {...shared}
      >
        {content}
      </Button>
    );
  }

  return (
    <Button asChild variant="rail" data-state={rowState} className={NAV_SIDEBAR_ROW_LAYOUT_CLASS}>
      <Link href={item.path} onClick={event => onClick(item, event)} {...shared}>
        {content}
      </Link>
    </Button>
  );
}

/**
 * One entry's loading form (`NavigationSidebarItemButton loading`, for `NavigationSidebarConfig.loading`).
 *
 * Deliberately in this file, beside `NavigationSidebarItemButton`: the two must
 * agree on `h-14`, the `p-[var(--spacing-system-m)]` inset, the 24px icon box and
 * the label column, or the nav resizes on the handoff.
 *
 * `showLabel` is the sidebar's own minimized state, so the caller passes what it
 * already passes the real row — no separate width handling.
 */
function NavigationSidebarItemSkeleton({ showLabel }: { showLabel: boolean }) {
  return (
    <div className={cn(BUTTON_KIND_CLASS.rail, NAV_SIDEBAR_ROW_LAYOUT_CLASS)} aria-hidden="true">
      <div className="relative flex flex-shrink-0 items-center justify-center">
        <UnifiedSkeleton className="h-6 w-6 rounded" />
      </div>
      {showLabel && <UnifiedSkeleton className="ml-[var(--spacing-system-xs)] h-4 flex-1 rounded" />}
    </div>
  );
}
