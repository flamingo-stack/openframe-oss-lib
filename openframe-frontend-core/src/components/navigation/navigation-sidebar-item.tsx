'use client';

import { cloneElement, memo, type ReactElement, type ReactNode, type MouseEvent } from 'react';
import Link from '../../embed-shims/next-link';
import type { NavigationSidebarItem } from '../../types/navigation';
import { cn } from '../../utils';
import { UnreadDot } from './unread-dot';

interface IconProps {
  color?: string;
  className?: string;
}

export interface NavigationSidebarItemButtonProps {
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
export const NavigationSidebarItemButton = memo(function NavigationSidebarItemButtonImpl({
  item,
  isActive,
  isPending,
  showLabel,
  disabled,
  onClick,
}: NavigationSidebarItemButtonProps) {
  const unreadCount = item.unreadCount ?? 0;
  const hasUnread = unreadCount > 0;

  const className = cn(
    // `isolate` scopes the hover layer's negative z-index to this row, so it
    // paints over the row's own background and under its content instead of
    // sliding behind the sidebar.
    'relative isolate flex w-full items-center justify-start',
    'h-14 p-[var(--spacing-system-m)]',
    // The hover/pending wash is its own LAYER, and that separation is the whole
    // point. Hover and active both want the row's background-color, so a
    // `transition-colors` that smooths hover necessarily smooths the accent too
    // — and it runs on the OUTGOING row as well as the incoming one. Measured on
    // a real navigation: for 150ms two rows carried the accent background AND
    // the accent bar, mid-fade, with nothing to say which one was the page you
    // were actually on. Shortening it (300ms -> 150ms) only shortened the lie.
    //
    // Split apart, each gets the timing its meaning calls for: the wash fades,
    // because it is decoration reacting to a cursor; the accent switches in a
    // single frame, because it is a statement of fact — exactly one row is the
    // current page, at every instant, including the instant the route commits.
    "after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:bg-ods-bg-hover after:opacity-0 after:transition-opacity after:duration-150 after:content-['']",
    "before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:content-['']",
    // Pending borrows the HOVER weight and nothing else — no accent bar, no
    // accent text, no `aria-current`. It says "this row is working", not "this
    // is where you are", and it reads as the row staying pressed under the
    // cursor, which is exactly what happened.
    !isActive && !disabled && 'text-ods-text-primary hover:after:opacity-100 [&_svg]:fill-ods-text-secondary',
    !isActive && !disabled && isPending && 'after:opacity-100',
    !isActive && disabled && 'text-ods-text-secondary [&_svg]:fill-ods-text-secondary',
    isActive &&
      !disabled && [
        'bg-[var(--ods-open-yellow-light)] text-ods-accent',
        '[&_svg]:fill-ods-accent',
        'before:bg-ods-accent',
      ],
    isActive && disabled && 'text-ods-text-secondary [&_svg]:fill-ods-text-secondary',
    disabled && 'cursor-not-allowed opacity-50',
  );

  const content: ReactNode = (
    <>
      <div className="relative flex flex-shrink-0 items-center justify-center">
        {cloneElement(item.icon as ReactElement<IconProps>, {
          color: isActive && !disabled ? 'text-ods-accent' : 'text-ods-text-secondary',
        })}
        {hasUnread && !showLabel && <UnreadDot size="fixed" />}
      </div>

      <span
        className={cn(
          'flex-1 truncate text-left transition-[opacity,margin-left] duration-300 text-h4',
          showLabel ? 'ml-[var(--spacing-system-xs)] opacity-100' : 'ml-0 opacity-0',
        )}
        aria-hidden={!showLabel}
      >
        {item.label}
      </span>

      {hasUnread && showLabel && (
        <span className="flex size-6 flex-shrink-0 items-center justify-center rounded-md bg-ods-accent p-2">
          <span className="text-ods-text-on-accent text-h5">{unreadCount > 99 ? '99+' : unreadCount}</span>
        </span>
      )}
    </>
  );

  const shared = {
    className,
    title: !showLabel ? item.label : undefined,
    'aria-label': item.label,
    'aria-current': isActive ? ('page' as const) : undefined,
  };

  // An entry with a custom onClick has no destination of its own, and a
  // disabled one must not be followable — both stay buttons.
  if (disabled || !item.path || item.onClick) {
    return (
      <button type="button" onClick={event => onClick(item, event)} disabled={disabled} {...shared}>
        {content}
      </button>
    );
  }

  return (
    <Link href={item.path} onClick={event => onClick(item, event)} {...shared}>
      {content}
    </Link>
  );
});

/**
 * One placeholder entry, for `NavigationSidebarConfig.loading`.
 *
 * Deliberately in this file, beside `NavigationSidebarItemButton`: the two must
 * agree on `h-14`, the `p-[var(--spacing-system-m)]` inset, the 24px icon box and
 * the label column, or the nav resizes on the handoff. Same reason
 * `header-skeleton.tsx` sits beside `header.tsx`.
 *
 * `showLabel` is the sidebar's own minimized state, so the caller passes what it
 * already passes the real row — no separate width handling.
 */
export function NavigationSidebarItemSkeleton({ showLabel }: { showLabel: boolean }) {
  return (
    <div className="flex h-14 w-full items-center justify-start p-[var(--spacing-system-m)]" aria-hidden="true">
      <div className="relative flex flex-shrink-0 items-center justify-center">
        <div className="h-6 w-6 animate-pulse rounded bg-ods-border" />
      </div>
      {showLabel && <div className="ml-[var(--spacing-system-xs)] h-4 flex-1 animate-pulse rounded bg-ods-border" />}
    </div>
  );
}
