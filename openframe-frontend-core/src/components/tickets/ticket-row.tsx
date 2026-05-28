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

import { useCallback, useEffect, useRef } from 'react'
import {
  Collapsible,
  CollapsibleContent,
} from '../collapsible'
import {
  ChatTicketItem,
  type ChatTicketItemData,
} from '../chat/entity-cards/chat-ticket-item'
import { formatRelativeTime } from '../../utils/date-utils'
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

  // Scroll-on-click — fires on EVERY click of the row tile, including
  // the click that re-targets an already-expanded row (the same UX
  // useUnifiedNav's same-URL re-scroll branch implements for nav
  // buttons: same target → still re-scroll). Without this, clicking
  // an already-expanded row was a silent no-op + the user had to
  // scroll up manually to see the drawer they just "opened".
  //
  // Native pattern: `scrollIntoView({ behavior:'smooth', block:'start' })`
  // paired with `scroll-mt-24` (Tailwind `scroll-margin-top: 6rem`)
  // on the row's outer div so the tile lands BELOW the sticky page
  // chrome. `behavior: 'smooth'` is set explicitly here so the
  // animation works even when the consumer hasn't set the global
  // `html { scroll-behavior: smooth }` CSS rule.
  //
  // The `setTimeout(200ms)` waits for the Radix Collapsible expand
  // animation to settle before measuring the target — otherwise the
  // browser would smooth-scroll to a moving destination as the row
  // grows in height. 200ms matches Radix's default duration.
  const rowRef = useRef<HTMLDivElement | null>(null)
  const handleClick = useCallback(() => {
    onToggle(ticket.id)
    // Schedule the scroll AFTER React commits the state change (so
    // the row's bounding box reflects the post-toggle layout). The
    // setTimeout's 200ms also covers the Radix expand animation.
    setTimeout(() => {
      rowRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 200)
  }, [onToggle, ticket.id])

  // Cross-row expansion: when another component (e.g. URL-driven
  // ticket id from a deep link, a future "next ticket" keyboard
  // shortcut) updates `expanded` WITHOUT a click on this row, still
  // pull this row into the viewport. The handleClick path covers the
  // click case; this effect covers the programmatic case.
  useEffect(() => {
    if (!expanded || optimistic) return
    const t = setTimeout(() => {
      rowRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 200)
    return () => clearTimeout(t)
  }, [expanded, optimistic])

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
