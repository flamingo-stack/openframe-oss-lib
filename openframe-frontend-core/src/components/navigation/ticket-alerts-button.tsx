'use client'

/**
 * TicketAlertsButton — the unified header affordance for support-ticket
 * unread indication. Mounted by BOTH header shells (hub `Header` via
 * `HeaderConfig.tickets`, console `AppHeader` via `showTicketAlerts`).
 *
 * Design note: the console's NATS-backed notifications bell covers
 * OpenFrame-internal events; Help Center replies come from the HubSpot
 * mirror domain and must ALSO surface on the hub, which mounts no
 * notifications system — so the affordance both hosts can share is this
 * dedicated cell, not the bell. (Optional follow-up, out of scope:
 * bridge ticket events into the console bell as well.)
 *
 * Renders nothing when no `TicketLiveProvider` is mounted (host didn't
 * opt into ticket realtime) — the cell can be composed unconditionally.
 * Unread state comes exclusively from the provider's single summary map.
 */

import React from 'react'
import { cn } from '../../utils/cn'
import { LifeBuoyIcon } from '../icons-v2-generated/interface/life-buoy-icon'
import { useOptionalTicketLive } from '../tickets/ticket-live-provider'
import { HeaderButton } from './header-button'

export interface TicketAlertsButtonProps {
  /** Navigation target for the host's tickets surface (hub `/tickets`,
   *  console `/help-center/tickets`). Used when `onClick` is absent. */
  href?: string
  /** Host-provided navigation (e.g. router push). Wins over `href`. */
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export function TicketAlertsButton({ href, onClick, disabled, className }: TicketAlertsButtonProps) {
  const live = useOptionalTicketLive()
  // No provider (host didn't opt in) or signed-out viewer → no cell.
  if (!live || !live.authed) return null

  const handleClick =
    onClick ??
    (href
      ? () => {
          window.location.assign(href)
        }
      : undefined)

  return (
    <HeaderButton
      icon={<LifeBuoyIcon className="w-6 h-6" />}
      showUnreadDot={live.unreadTotal > 0}
      aria-label={live.unreadTotal > 0 ? `Support tickets (${live.unreadTotal} unread)` : 'Support tickets'}
      onClick={handleClick}
      disabled={disabled || !handleClick}
      className={cn(className)}
    />
  )
}

export default TicketAlertsButton
