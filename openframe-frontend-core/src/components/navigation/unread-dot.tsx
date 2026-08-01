'use client'

import React from 'react'
import { cn } from '../../utils/cn'

/**
 * The ONE unread-indicator dot (`bg-ods-warning`, top-right of an icon
 * inside a `relative` wrapper). Previously duplicated in
 * `NotificationsHeaderButton` and `NavigationSidebarItemButton` — both
 * now render THIS, as does `TicketAlertsButton`.
 *
 * Size variants preserve the two pre-existing renders exactly (neither
 * may silently change):
 *   - `responsive` — header cells: `w-1.5 h-1.5 md:w-2 md:h-2`
 *   - `fixed`      — sidebar collapsed icon: `w-2 h-2`
 */
export interface UnreadDotProps {
  size?: 'responsive' | 'fixed'
  className?: string
}

export function UnreadDot({ size = 'responsive', className }: UnreadDotProps) {
  return (
    <span
      className={cn(
        'absolute top-0 right-0 bg-ods-warning rounded-full',
        size === 'responsive' ? 'w-1.5 h-1.5 md:w-2 md:h-2' : 'w-2 h-2',
        className,
      )}
    />
  )
}

/**
 * Count variant of the unread indicator — a small accent pill anchored
 * top-right of an icon inside a `relative` wrapper, clamped at "9+".
 * Same family as `UnreadDot` (dot = "something new", count = "N new");
 * the sidebar's expanded-row pill stays its own larger treatment.
 */
export interface UnreadCountBadgeProps {
  count: number
  className?: string
}

export function UnreadCountBadge({ count, className }: UnreadCountBadgeProps) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'absolute -top-1.5 -right-1.5 flex items-center justify-center',
        'min-w-4 h-4 px-1 rounded-full bg-ods-accent',
        'text-badge text-ods-text-on-accent leading-none',
        className,
      )}
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

export default UnreadDot
