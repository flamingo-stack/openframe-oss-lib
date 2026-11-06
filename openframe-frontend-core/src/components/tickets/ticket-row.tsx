'use client';

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

import { useCallback, useRef } from 'react';
import { formatRelativeTime } from '../../utils/date-utils';
import { scrollElementIntoView } from '../../utils/scroll-into-view';
import { ChatTicketItem, type ChatTicketItemData } from '../chat/entity-cards/chat-ticket-item';
import { Collapsible, CollapsibleContent } from '../collapsible';
import { loadingItemProps, useLoadingScope } from '../ui/loading-scope';
import { TicketDetailDrawer, type TicketDetailDrawerProps } from './ticket-detail-drawer';
import type { AnyTicket } from './types';
import { isOptimistic } from './types';

/** The row's frame (its bottom rule), read by the loaded row and its loading form. */
const TICKET_ROW_FRAME_CLASS = 'border-b border-ods-border last:border-b-0';
/** The row's outer element: the deep-link target, offset under a sticky header. */
const TICKET_ROW_OUTER_CLASS = 'scroll-mt-24';

/** A read ticket's row. */
export interface TicketRowLoadedProps {
  ticket: AnyTicket;
  expanded: boolean;
  onToggle: (ticketId: string) => void;
  busy: boolean;
  supportSystemDown: boolean;
  onSendMessage: TicketDetailDrawerProps['onSendMessage'];
  onClose: TicketDetailDrawerProps['onClose'];
  onReopen: TicketDetailDrawerProps['onReopen'];
  /** Called after a successful close/reopen so the parent can collapse
   *  the drawer (status flipped — current action set is now stale). */
  onActionCollapsed: TicketDetailDrawerProps['onActionCollapsed'];
  /** DOM `id` applied to the row's outer element. Parents that surface
   *  a deep-link target set `ticket-<external_id>` so `useScrollToHash`
   *  resolves it. `scroll-mt-24` is already baked into the outer
   *  element regardless. */
  id?: string;
  loading?: false;
}

/** A row while its ticket is read: the same frame with the summary tile's loading form, and no drawer. */
export interface TicketRowLoadingProps {
  loading: true;
  id?: string;
}

/** A ticket row, or (`loading`) its loading form. List markers (`data-loading-item`) are forwarded in both forms. */
export type TicketRowProps = (TicketRowLoadedProps | TicketRowLoadingProps) & {
  [key: `data-${string}`]: unknown;
};

/**
 * A ticket row. ONE switch (`useLoadingScope() || loading`): while the ticket is read the row draws the same frame
 * with `ChatTicketItem loading` (its own loading form), else the summary tile and its drawer.
 */
export function TicketRow(props: TicketRowProps) {
  if (useLoadingScope() || props.loading) {
    return (
      <div id={props.id} className={TICKET_ROW_OUTER_CLASS} {...loadingItemProps(props)}>
        <div className={TICKET_ROW_FRAME_CLASS}>
          <ChatTicketItem loading />
        </div>
      </div>
    );
  }
  return <TicketRowLoaded {...props} />;
}

function TicketRowLoaded({
  ticket,
  expanded,
  onToggle,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
  onReopen,
  onActionCollapsed,
  id,
  ...markers
}: TicketRowLoadedProps & { [key: `data-${string}`]: unknown }) {
  // Optimistic placeholders have no drawer — the real id hasn't
  // arrived yet, so action targets would be undefined.
  const optimistic = isOptimistic(ticket);

  // Scroll the clicked card to the top of the viewport. Every click
  // scrolls — first-click expansion, same-row re-click, cross-row
  // switch. The clicked card lands at the top.
  //
  // Cross-row gotcha: if ANOTHER row above this one is currently
  // expanded, its drawer is about to collapse simultaneously with our
  // toggle. We pre-subtract its height from the target Y so the
  // smooth-scroll lands at the FINAL post-collapse position cleanly.
  // Same pattern as `<HelpCenterCard>` — the only diff is the drawer
  // id prefix (`ticket-drawer-` vs `help-center-drawer-`).
  const rowRef = useRef<HTMLDivElement | null>(null);
  const handleClick = useCallback(() => {
    onToggle(ticket.id);
    scrollElementIntoView(rowRef.current, {
      adjustTargetY: raw => {
        if (!rowRef.current) return raw;
        const expandedDrawer = document.querySelector('div[id^="ticket-drawer-"]');
        if (!(expandedDrawer instanceof HTMLElement)) return raw;
        const drawerRect = expandedDrawer.getBoundingClientRect();
        const myRect = rowRef.current.getBoundingClientRect();
        // Only adjust when the drawer is ABOVE us. Drawers below
        // don't shift our position when they collapse.
        if (drawerRect.bottom > myRect.top) return raw;
        return raw - drawerRect.height;
      },
    });
  }, [onToggle, ticket.id]);

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
    timeAgo: ticket.hubspot_updated_at ? formatRelativeTime(ticket.hubspot_updated_at) : undefined,
    // Linked-work chip: surfaced whenever the ticket has a linked
    // ClickUp task. Uses the linked task's own status so the chip text
    // reads "Working" / "Waiting on version release" / etc. — useful
    // signal pre-expand. Falls back to a generic "Linked work" label
    // when the task exists but its status hasn't synced yet.
    linkedTaskLabel: ticket.clickup
      ? ticket.clickup.status
        ? ticket.clickup.status.replace(/\b\w/g, c => c.toUpperCase())
        : 'Linked work'
      : undefined,
  };

  return (
    <div ref={rowRef} id={id} className={TICKET_ROW_OUTER_CLASS} {...loadingItemProps(markers)}>
      <Collapsible open={expanded && !optimistic} className={TICKET_ROW_FRAME_CLASS}>
        <ChatTicketItem
          ticket={tileData}
          onClick={optimistic ? undefined : handleClick}
          aria-expanded={expanded && !optimistic}
          aria-controls={`ticket-drawer-${ticket.id}`}
        />
        <CollapsibleContent id={`ticket-drawer-${ticket.id}`} className="overflow-hidden">
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
  );
}
