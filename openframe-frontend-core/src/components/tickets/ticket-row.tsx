'use client'

/**
 * Single ticket row + expanded details drawer.
 *
 * The COMPACT summary tile (`<ChatTicketItem>`) is the row chrome
 * specific to this composition — used by the lib's `<TicketCenter />`
 * embed. The drawer body itself is extracted into
 * `<TicketDetailDrawer />` so the hub's DevSection-style ticket card
 * (different chrome, same drawer) can drop it in too.
 *
 * Layout:
 *   1. `<ChatTicketItem>` summary tile. Clicking it toggles the
 *      `expandedTicketId` state owned by the parent `<TicketCenter>` —
 *      we use the item's existing `onClick` prop rather than nesting a
 *      `<CollapsibleTrigger>` (button-in-button is invalid).
 *   2. `<CollapsibleContent>` wrapping `<TicketDetailDrawer />`,
 *      rendered only when this row is the expanded one.
 */

import { useCallback, useRef } from 'react'
import {
  Collapsible,
  CollapsibleContent,
} from '../collapsible'
import {
  ChatTicketItem,
  type ChatTicketItemData,
} from '../chat/entity-cards/chat-ticket-item'
import { formatRelativeTime } from '../../utils/date-utils'
import { scrollElementIntoView } from '../../utils/scroll-into-view'
import {
  TicketDetailDrawer,
  type TicketDetailDrawerProps,
} from './ticket-detail-drawer'
import type { AnyTicket } from './types'
import { isOptimistic } from './types'

export interface TicketRowProps {
  ticket: AnyTicket
  expanded: boolean
  onToggle: (ticketId: string) => void
  busy: boolean
  supportSystemDown: boolean
  onSendMessage: TicketDetailDrawerProps['onSendMessage']
  onClose: TicketDetailDrawerProps['onClose']
  onReopen: TicketDetailDrawerProps['onReopen']
  /** Called after a successful close/reopen so the parent can collapse
   *  the drawer (status flipped — current action set is now stale). */
  onActionCollapsed: TicketDetailDrawerProps['onActionCollapsed']
}

export function TicketRow({
  ticket,
  expanded,
  onToggle,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
  onReopen,
  onActionCollapsed,
}: TicketRowProps) {
  // Optimistic placeholders have no drawer — the real id hasn't
  // arrived yet, so action targets would be undefined.
  const optimistic = isOptimistic(ticket)

  // Scroll the clicked card to the top of the viewport. Every click
  // scrolls — first-click expansion, same-row re-click, cross-row
  // switch. The clicked card lands at the top. Period.
  //
  // `behavior: 'smooth'` + `scroll-mt-24` on the row's outer div
  // (Tailwind `scroll-margin-top: 6rem`) keep the tile just below
  // the sticky chrome. The browser's smooth-scroll engine handles
  // the animation natively.
  const rowRef = useRef<HTMLDivElement | null>(null)
  const handleClick = useCallback(() => {
    onToggle(ticket.id)
    // Canonical scroll helper — same path the unified-nav + help-center-card
    // use. `scroll-mt-24` on the outer div provides the chrome offset.
    scrollElementIntoView(rowRef.current)
  }, [onToggle, ticket.id])

  const tileData: ChatTicketItemData = {
    id: ticket.id,
    title: ticket.subject ?? '(untitled)',
    ticketNumber: `#${ticket.external_id}`,
    status: ticket.status ?? 'OPEN',
    // Surface the HubSpot pipeline stage label ("New" / "Closed" /
    // "Waiting on contact" / "Waiting on version release") instead of
    // the canonical "Active"/"Resolved" default. The variant + check
    // icon still come from `status` (CLOSED → check; OPEN → no check),
    // so the badge accurately reflects "Closed" with a checkmark.
    statusLabel: ticket.pipeline_stage_label ?? undefined,
    category: ticket.customer_company ?? undefined,
    timeAgo: ticket.hubspot_updated_at
      ? formatRelativeTime(ticket.hubspot_updated_at)
      : undefined,
    // Linked-work chip: surfaced whenever the ticket has a linked
    // ClickUp task. Uses the linked task's own status so the chip text
    // reads "Working" / "Waiting on version release" / etc. — useful
    // signal pre-expand. Falls back to a generic "Linked work" label
    // when the task exists but its status hasn't synced yet.
    linkedTaskLabel: ticket.clickup
      ? ticket.clickup.status
        ? ticket.clickup.status.replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Linked work'
      : undefined,
  }

  return (
    <div ref={rowRef} className="scroll-mt-24">
      <Collapsible
        open={expanded && !optimistic}
        className="border-b border-ods-border last:border-b-0"
      >
      <ChatTicketItem
        ticket={tileData}
        onClick={optimistic ? undefined : handleClick}
        aria-expanded={expanded && !optimistic}
        aria-controls={`ticket-drawer-${ticket.id}`}
      />
      <CollapsibleContent
        id={`ticket-drawer-${ticket.id}`}
        className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
      >
        <TicketDetailDrawer
          ticket={ticket}
          busy={busy}
          supportSystemDown={supportSystemDown}
          onSendMessage={onSendMessage}
          onClose={onClose}
          onReopen={onReopen}
          onActionCollapsed={onActionCollapsed}
        />
      </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
