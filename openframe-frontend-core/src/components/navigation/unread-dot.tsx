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

export default UnreadDot
