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
  // buttons: same target → still re-scroll).
  //
  // The tricky case is cross-row expansion: clicking row B while row
  // A above is currently expanded. A collapses (Radix 200ms animation,
  // ~400px of drawer height disappears) WHILE B expands (its own 200ms
  // drawer animation). During those ~200ms B's bounding-box Y position
  // shifts upward as A's drawer shrinks above it. A naive
  // `setTimeout(200, scrollIntoView)` measures B mid-shift and lands
  // the page scroll at a coordinate that's wrong by the time the
  // animations settle — B ends up above the viewport.
  //
  // Fix: poll `document.body.scrollHeight` on every animation frame
  // and only scroll once height has been stable for 3 frames (~50ms).
  // RAF-polling is preferable to a longer setTimeout because (a) it
  // adapts to whatever the animation duration actually is (theme
  // tweaks, slower devices), and (b) it lets the scroll fire AS SOON
  // as layout settles rather than always waiting a fixed amount.
  //
  // Safety bail-out at 600ms — if some other DOM mutation keeps the
  // body height changing forever (live-updating cards, etc.), we
  // still fire a scroll at the 600ms mark so the user isn't left
  // stranded.
  //
  // Native pattern: `scrollIntoView({ behavior:'smooth', block:'start' })`
  // + `scroll-mt-24` (Tailwind `scroll-margin-top: 6rem`) on the
  // row's outer div so the tile lands BELOW the sticky page chrome.
  // `behavior:'smooth'` is set explicitly so the animation works
  // even when the consumer hasn't applied the global
  // `html { scroll-behavior: smooth }` CSS rule.
  const rowRef = useRef<HTMLDivElement | null>(null)
  const scrollWhenStable = useCallback(() => {
    if (typeof window === 'undefined') return
    let lastHeight = document.body.scrollHeight
    let stableFrames = 0
    let cancelled = false
    const SAFETY_BAIL_MS = 600
    const STABLE_FRAMES_REQUIRED = 3
    const bail = setTimeout(() => {
      if (cancelled) return
      cancelled = true
      rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, SAFETY_BAIL_MS)
    const tick = () => {
      if (cancelled) return
      const currentHeight = document.body.scrollHeight
      if (currentHeight === lastHeight) {
        stableFrames++
        if (stableFrames >= STABLE_FRAMES_REQUIRED) {
          cancelled = true
          clearTimeout(bail)
          rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          return
        }
      } else {
        stableFrames = 0
        lastHeight = currentHeight
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  const handleClick = useCallback(() => {
    onToggle(ticket.id)
    scrollWhenStable()
  }, [onToggle, ticket.id, scrollWhenStable])

  // Cross-row expansion driven by NON-CLICK state changes (a future
  // URL-driven ticket id from a deep link, or a "next ticket"
  // keyboard shortcut). The click path covers user-initiated changes;
  // this effect covers programmatic state changes.
  useEffect(() => {
    if (!expanded || optimistic) return
    scrollWhenStable()
  }, [expanded, optimistic, scrollWhenStable])

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
