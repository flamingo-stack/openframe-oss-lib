"use client"

import { cloneElement, memo, type ReactElement, type ReactNode } from 'react'
import Link from '../../embed-shims/next-link'
import { NavigationSidebarItem } from '../../types/navigation'
import { cn } from '../../utils'
import { UnreadDot } from './unread-dot'

interface IconProps {
  color?: string
  className?: string
}

export interface NavigationSidebarItemButtonProps {
  item: NavigationSidebarItem
  /** "You are on this page" — pathname-derived, and the only thing that carries `aria-current`. */
  isActive: boolean
  /**
   * "You clicked this one and it has not arrived yet" — deliberately a separate,
   * weaker state. Never promoted to active: the accent belongs to the page you
   * are actually on.
   */
  isPending: boolean
  showLabel: boolean
  disabled: boolean
  onClick: (item: NavigationSidebarItem, event?: React.MouseEvent) => void
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
export const NavigationSidebarItemButton = memo(function NavigationSidebarItemButton({
  item,
  isActive,
  isPending,
  showLabel,
  disabled,
  onClick,
}: NavigationSidebarItemButtonProps) {
  const unreadCount = item.unreadCount ?? 0
  const hasUnread = unreadCount > 0

  const className = cn(
    "w-full flex items-center justify-start relative",
    "h-14 p-[var(--spacing-system-m)]",
    // 150ms, not 300: the outgoing and incoming entries cross-fade, so for the
    // whole duration TWO rows read as half-active. At 300ms that window is long
    // enough to look like a flicker rather than a transition.
    "transition-colors duration-150",
    "[&_svg]:transition-colors [&_svg]:duration-150",
    "before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
    "before:transition-colors before:duration-150",
    // Pending borrows the HOVER weight and nothing else — no accent bar, no
    // accent text, no `aria-current`. It says "this row is working", not "this
    // is where you are", and it reads as the row staying pressed under the
    // cursor, which is exactly what happened.
    !isActive && !disabled && "hover:bg-ods-bg-hover text-ods-text-primary [&_svg]:fill-ods-text-secondary",
    !isActive && !disabled && isPending && "bg-ods-bg-hover",
    !isActive && disabled && "text-ods-text-secondary [&_svg]:fill-ods-text-secondary",
    isActive && !disabled && [
      "bg-[var(--ods-open-yellow-light)] text-ods-accent",
      "[&_svg]:fill-ods-accent",
      "before:bg-ods-accent",
    ],
    isActive && disabled && "text-ods-text-secondary [&_svg]:fill-ods-text-secondary",
    disabled && "cursor-not-allowed opacity-50",
  )

  const content: ReactNode = (
    <>
      <div className="relative flex items-center justify-center flex-shrink-0">
        {cloneElement(item.icon as ReactElement<IconProps>, {
          color: isActive && !disabled ? "text-ods-accent" : "text-ods-text-secondary",
        })}
        {hasUnread && !showLabel && <UnreadDot size="fixed" />}
      </div>

      <span
        className={cn(
          "text-h4 flex-1 text-left truncate transition-[opacity,margin-left] duration-300",
          showLabel ? "opacity-100 ml-[var(--spacing-system-xs)]" : "opacity-0 ml-0",
        )}
        aria-hidden={!showLabel}
      >
        {item.label}
      </span>

      {hasUnread && showLabel && (
        <span className="bg-ods-accent flex items-center justify-center flex-shrink-0 p-2 rounded-md size-6">
          <span className="text-h5 text-ods-text-on-accent">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </>
  )

  const shared = {
    className,
    title: !showLabel ? item.label : undefined,
    'aria-label': item.label,
    'aria-current': isActive ? ('page' as const) : undefined,
  }

  // An entry with a custom onClick has no destination of its own, and a
  // disabled one must not be followable — both stay buttons.
  if (disabled || !item.path || item.onClick) {
    return (
      <button type="button" onClick={(event) => onClick(item, event)} disabled={disabled} {...shared}>
        {content}
      </button>
    )
  }

  return (
    <Link href={item.path} onClick={(event) => onClick(item, event)} {...shared}>
      {content}
    </Link>
  )
})

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
    <div className="w-full flex items-center justify-start h-14 p-[var(--spacing-system-m)]" aria-hidden="true">
      <div className="relative flex items-center justify-center flex-shrink-0">
        <div className="h-6 w-6 animate-pulse rounded bg-ods-border" />
      </div>
      {showLabel && <div className="h-4 flex-1 ml-[var(--spacing-system-xs)] animate-pulse rounded bg-ods-border" />}
    </div>
  )
}
