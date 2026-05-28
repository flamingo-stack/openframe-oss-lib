'use client'

/**
 * `<HelpCenterCard />` — single ticket row inside the Help Center list.
 *
 * Visual chrome is 1:1 with the delivery list (`<DeliveryTable>`) via
 * the shared `<DevCardRowContent>` primitive. The differentiator: the
 * entire summary row is a `<button>` that toggles an expanded drawer
 * beneath it (`<TicketDetailDrawer />` — same composer + timeline +
 * close/reopen affordances as the embedded `<TicketCenter />`).
 *
 * Click target: the summary row only. Clicks inside the expanded
 * drawer (composer textarea, attachment chips, close-dialog button)
 * don't propagate up to the row's toggle handler because the drawer
 * is a SIBLING of the toggle button, not nested inside it.
 */

import { useCallback, useRef } from 'react'
import { StatusBadge, type StatusBadgeProps } from '../ui'
import { formatRelativeTime } from '../../utils/date-utils'
import { scrollElementIntoView } from '../../utils/scroll-into-view'
import { getStatusColorScheme } from '../chat/utils/agent-status-message'
import { DevCardRowContent } from '../shared/dev-section/dev-card-row'
import {
  TicketDetailDrawer,
  type TicketDetailDrawerProps,
} from './ticket-detail-drawer'
import type { AnyTicket } from './types'
import { isOptimistic } from './types'

/** `scroll-mt-24` (Tailwind `scroll-margin-top: 6rem`) on the outer
 *  wrapper offsets for the sticky page chrome. The 96px below matches
 *  it for the explicit `window.scrollTo` path. */
const STICKY_HEADER_OFFSET_PX = 96

export interface HelpCenterCardProps {
  ticket: AnyTicket
  expanded: boolean
  onToggle: (id: string) => void
  busy: boolean
  supportSystemDown: boolean
  onSendMessage: TicketDetailDrawerProps['onSendMessage']
  onClose: TicketDetailDrawerProps['onClose']
  onReopen: TicketDetailDrawerProps['onReopen']
  onActionCollapsed: () => void
}

export function HelpCenterCard({
  ticket,
  expanded,
  onToggle,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
  onReopen,
  onActionCollapsed,
}: HelpCenterCardProps) {
  const optimistic = isOptimistic(ticket)
  const rawStatus = (ticket.status ?? 'OPEN').toUpperCase()
  const priority = (ticket.priority ?? '').toUpperCase()

  const relativeUpdated = ticket.hubspot_updated_at
    ? formatRelativeTime(ticket.hubspot_updated_at)
    : 'recently'

  // Use `||` not `??` so an EMPTY-STRING subject (legacy rows, partial
  // server data) falls through to the placeholder instead of rendering
  // a blank h3.
  const title = (ticket.subject || '').trim() || '(untitled)'
  const subtitle = `UPDATED ${relativeUpdated}, #${ticket.external_id || '—'}${
    ticket.pipeline_stage_label ? `, ${ticket.pipeline_stage_label}` : ''
  }`
  const description = ticket.preview ?? ticket.body ?? ''

  // Optimistic placeholders show as a row but aren't expandable — the
  // real external_id hasn't landed so the drawer's `useTicketEngagements`
  // would have nothing to fetch, and action targets would be undefined.
  const isExpandable = !optimistic
  const isExpanded = expanded && isExpandable

  // Scroll-on-click — delegates to the canonical `scrollElementIntoView`
  // helper with a cross-row layout-shift `adjustTargetY` callback. The
  // helper owns the smooth-scroll mechanics + sticky-chrome offset; we
  // pass the consumer-specific knowledge ("a sibling drawer above me
  // is about to collapse — subtract its height from the target Y").
  //
  // Cross-row gotcha: if ANOTHER row above this one is currently
  // expanded, its drawer collapses simultaneously with our toggle.
  // The collapse shrinks the page above our row → our final Y is
  // HIGHER than the current `rect.top`. By pre-subtracting the
  // collapsing drawer's height we land at the post-shift position
  // cleanly, without scrollIntoView's mid-animation drift.
  const rowRef = useRef<HTMLDivElement | null>(null)
  const handleClick = useCallback(() => {
    onToggle(ticket.id)
    scrollElementIntoView(rowRef.current, {
      headerOffset: STICKY_HEADER_OFFSET_PX,
      adjustTargetY: (raw) => {
        if (!rowRef.current) return raw
        const expandedDrawer = document.querySelector(
          'div[id^="help-center-drawer-"]',
        )
        if (!(expandedDrawer instanceof HTMLElement)) return raw
        const drawerRect = expandedDrawer.getBoundingClientRect()
        const myRect = rowRef.current.getBoundingClientRect()
        // Only adjust when the drawer is ABOVE us. Drawers below us
        // don't shift our position when they collapse.
        if (drawerRect.bottom > myRect.top) return raw
        return raw - drawerRect.height
      },
    })
  }, [onToggle, ticket.id])

  const rightBadges = (
    <>
      <StatusBadge
        text={rawStatus}
        colorScheme={getStatusColorScheme(rawStatus)}
        variant="card"
        className="border border-ods-border"
      />
      {priority && (
        <StatusBadge
          text={priority}
          colorScheme={mapPriorityScheme(priority)}
          variant="card"
          className="border border-ods-border"
        />
      )}
    </>
  )

  return (
    <div
      ref={rowRef}
      className={`scroll-mt-24 border-b border-ods-border last:border-b-0 ${optimistic ? 'opacity-60' : ''}`}
      aria-busy={optimistic || undefined}
    >
      <button
        type="button"
        onClick={isExpandable ? handleClick : undefined}
        disabled={!isExpandable}
        aria-expanded={isExpandable ? isExpanded : undefined}
        aria-controls={isExpanded ? `help-center-drawer-${ticket.id}` : undefined}
        className="w-full text-left p-[12px] md:p-[16px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-inset disabled:cursor-default"
      >
        <DevCardRowContent
          title={title}
          subtitle={subtitle}
          description={description}
          emptyDescription="No description provided"
          rightBadges={rightBadges}
        />
      </button>

      {isExpanded && (
        <div id={`help-center-drawer-${ticket.id}`}>
          <TicketDetailDrawer
            ticket={ticket}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onSendMessage={onSendMessage}
            onClose={onClose}
            onReopen={onReopen}
            onActionCollapsed={onActionCollapsed}
          />
        </div>
      )}
    </div>
  )
}

/** Ticket priority → StatusBadge colorScheme. HIGH / URGENT → red,
 *  MEDIUM → yellow, LOW / unknown → default-muted. Kept local because
 *  the central `getStatusColorScheme` is keyed on workflow status, not
 *  severity, and conflating them would mis-render an "OPEN" status as
 *  a low-priority badge or vice-versa. */
function mapPriorityScheme(priority: string): NonNullable<StatusBadgeProps['colorScheme']> {
  if (priority === 'HIGH' || priority === 'URGENT') return 'error'
  if (priority === 'MEDIUM') return 'warning'
  return 'default'
}
