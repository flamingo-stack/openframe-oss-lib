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

import { useCallback, useEffect, useRef } from 'react'
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

/** Sticky page-chrome offset, applied two ways from this ONE constant:
 *
 *   1. As `scrollMarginTop` inline style on the wrapper — so any
 *      anchor-driven or `scrollIntoView()`-driven scroll (browser
 *      `#hash` navigation, Tab-focus into the card) lands BELOW the
 *      sticky header.
 *   2. As `headerOffset` passed to `scrollElementIntoView(...)` — for
 *      the click-to-expand `window.scrollTo` path, which pre-computes
 *      its target pixel and ignores CSS `scroll-margin-top`.
 *
 *  Single source of truth: change 96 here and BOTH paths follow. The
 *  previous code combined a `scroll-mt-24` (=96px) Tailwind class
 *  with this constant — two declarations, one comment binding them,
 *  drift hazard. Now there's nothing to keep in sync.
 */
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
  /** Persisted reply-failure banner — forwarded to the drawer. Parent
   *  (`HelpCenterList`) reads via `actions.replyErrorFor(external_id)`. */
  replyError?: TicketDetailDrawerProps['replyError']
  onClearReplyError?: TicketDetailDrawerProps['onClearReplyError']
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
  replyError,
  onClearReplyError,
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

  const rowRef = useRef<HTMLDivElement | null>(null)
  // Click only toggles — the scroll-to-top is deferred to the effect below.
  const handleClick = useCallback(() => {
    onToggle(ticket.id)
  }, [onToggle, ticket.id])

  // Smooth-scroll the row to the top once the drawer has expanded — in an
  // effect keyed on `isExpanded` (NOT the click handler, which runs before
  // React commits the drawer, when the page isn't yet tall enough to scroll).
  //
  // The cancellation-proof motion lives in the shared `scrollElementIntoView`
  // helper (self-driven rAF tween, instant per-frame writes, target recomputed
  // each frame). It is immune to the browser SCROLL ANCHORING that cancelled the
  // old native `window.scrollTo({behavior:'smooth'})` on every open after the
  // first — the bug where smooth "only worked once" because anchoring is
  // suppressed at scrollY=0 (first open) but aborts the native smooth scroll
  // from any non-zero offset (every later open). See that util for the full
  // mechanics. One leading rAF so the expanded drawer has committed its height
  // before the first measurement; the tween then tracks the row to its resting
  // position as the page finishes growing. Cleanup cancels on collapse/unmount.
  useEffect(() => {
    if (!isExpanded) return
    const raf = requestAnimationFrame(() => {
      scrollElementIntoView(rowRef.current, {
        headerOffset: STICKY_HEADER_OFFSET_PX,
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [isExpanded])

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
      style={{ scrollMarginTop: STICKY_HEADER_OFFSET_PX }}
      className={`border-b border-ods-border last:border-b-0 ${optimistic ? 'opacity-60' : ''}`}
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
            replyError={replyError}
            onClearReplyError={onClearReplyError}
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
