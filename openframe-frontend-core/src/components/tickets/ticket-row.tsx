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

import { useEffect, useRef } from 'react'
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

  // Scroll the row's summary tile to the top of the viewport when the
  // user expands it. Without this, expanding a row near the bottom of
  // the viewport leaves most of the drawer (timeline + composer)
  // hidden — the user has to scroll manually to see what they just
  // opened.
  //
  // Uses the canonical project scroll pattern (matches `scrollToContent`
  // in `hooks/use-document-tree.ts` + the comparison page + pagination):
  //
  //     const top = el.getBoundingClientRect().top + window.scrollY - headerOffset
  //     window.scrollTo({ top, behavior: 'smooth' })
  //
  // Two reasons we use `window.scrollTo` + a pre-computed target
  // instead of `scrollIntoView({ block: 'start' })`:
  //
  //   1. SETTLED ANIMATION. `scrollIntoView` re-targets continuously as
  //      the page layout shifts (the previous card is mid-collapse, the
  //      new drawer is mid-expand). The smooth animation visibly jitters
  //      because its destination keeps moving. Committing to a single
  //      pixel value with `window.scrollTo` lets the browser run a clean,
  //      undisturbed animation to that exact spot.
  //
  //   2. STICKY-HEADER OFFSET. `scrollIntoView({block:'start'})` puts
  //      the element flush against the viewport top — but the page has
  //      a sticky nav header above it. The card lands hidden behind the
  //      header. The canonical project pattern subtracts a header offset
  //      so the tile lands just BELOW the chrome.
  //
  // Timing: wait ~200ms for the Radix Collapsible animation to settle
  // before measuring, otherwise we'd capture B's position while A is
  // still collapsing above it and land too far down. 200ms is the
  // Collapsible default + a tight safety margin. The cleanup timer
  // prevents a leaked scroll firing after rapid open→close→open.
  const rowRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!expanded || optimistic) return
    const t = setTimeout(() => {
      const el = rowRef.current
      if (!el) return
      // 80px matches `hooks/use-document-tree.ts:15` — the canonical
      // sticky-header offset across the hub. If the /tickets page ever
      // grows a different chrome height, this is the one knob to tune.
      const HEADER_OFFSET = 80
      const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET
      window.scrollTo({ top, behavior: 'smooth' })
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
    <div ref={rowRef} className="scroll-mt-4">
      <Collapsible
        open={expanded && !optimistic}
        className="border-b border-ods-border last:border-b-0"
      >
      <ChatTicketItem
        ticket={tileData}
        onClick={optimistic ? undefined : onToggle}
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
