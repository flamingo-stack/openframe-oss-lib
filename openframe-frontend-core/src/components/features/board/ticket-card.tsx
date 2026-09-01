'use client';

import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { preserveOffsetOnSource } from '@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import Link from '../../../embed-shims/next-link';
import { cn } from '../../../utils/cn';
import { formatTicketRelativeTime, formatTicketFullTimestamp } from '../../../utils/date-utils';
import { holdMoveDragEffect } from '../../../utils/drag-effect';
import { getReadableTextColor } from '../../../utils/ods-color-utils';
import {
  ClockIcon,
  DotsLoaderIcon,
  LaptopIcon,
  Flag02Icon,
  MessagesIcon,
  UserCheckIcon,
} from '../../icons-v2-generated';
import { DeletedUserAvatar } from '../../ui/deleted-user-avatar';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { BoardTicketApproval } from './board-ticket-approval';
import { useBoardLift, useDropAim } from './drop-aim';
import { DROP_LINE_ATTRIBUTE } from './lane-geometry';
import { useIsLanding } from './pending-move';
import type { BoardPriority, BoardTicket, BoardTicketActivityKind } from './types';
import { TICKET_ID_ATTRIBUTE } from './use-lane-scroll-anchor';

const PRIORITY_COLOR_CLASS: Record<BoardPriority, string> = {
  low: 'text-ods-text-secondary',
  medium: 'text-ods-info',
  high: 'text-ods-warning',
  urgent: 'text-ods-error',
};

/** How faded the card is where it would land. Matches what dnd-kit left behind. */
const DRAGGED_CARD_OPACITY = 0.4;

/** How solid the card under the pointer is. Jira's look: carried, not lifted off
 *  the page entirely. */
export const DRAG_PREVIEW_OPACITY = 0.9;

const MAX_VISIBLE_TAGS = 2;
const MAX_VISIBLE_ASSIGNEES = 3;

const ACTIVITY_DEFAULT_LABEL: Record<BoardTicketActivityKind, string> = {
  'ai-working': 'AI assistant is working',
  'user-typing': 'User typing',
  'waiting-external': 'Waiting for client response',
  stale: 'No activity',
};

/** Shared card shell (border / padding / bg). Same footprint for the draggable
 *  board card and the static {@link TicketCardView}. */
const TICKET_CARD_SHELL =
  'relative flex flex-col gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)] select-none text-left';

// =============================================================================
// Presentational body — the ONE ticket-card design, no drag/link/board context.
// Reused by the draggable `TicketCard` AND the static `TicketCardView`.
// =============================================================================

export interface TicketCardBodyProps {
  ticket: BoardTicket;
  columnColor?: string;
  renderAssignSlot?: (ticket: BoardTicket) => ReactNode;
  /** Approval callbacks receive the request id directly (the draggable
   *  `TicketCard` adapts its own `(ticketId, requestId)` signature onto these). */
  onApprove?: (requestId?: string) => void | Promise<void>;
  onReject?: (requestId?: string) => void | Promise<void>;
}

/** The card's inner content: title + device/org, priority + assignees, tags,
 *  timestamp, "New Message", and the approval row. Pure — driven only by props. */
export function TicketCardBody({ ticket, columnColor, renderAssignSlot, onApprove, onReject }: TicketCardBodyProps) {
  const showNewMessage = !!ticket.hasNewMessage && !!columnColor;
  const newMessageTextColor = columnColor ? getReadableTextColor(columnColor) : undefined;

  const showDeviceRow = !!(ticket.deviceHostnames?.length || ticket.organizationName);
  const deviceText = [ticket.deviceHostnames?.join(', '), ticket.organizationName].filter(Boolean).join(', ');

  const hasRightSection = !!(ticket.priority || ticket.assignees?.length || renderAssignSlot);
  const rightSection = hasRightSection ? (
    <div className="pointer-events-auto flex shrink-0 items-center gap-[var(--spacing-system-xsf)]">
      {ticket.priority && (
        <Flag02Icon
          className={cn('size-4', PRIORITY_COLOR_CLASS[ticket.priority])}
          aria-label={`Priority: ${ticket.priority}`}
        />
      )}
      {renderAssignSlot ? (
        renderAssignSlot(ticket)
      ) : ticket.assignees?.length ? (
        <div className="flex -space-x-2">
          {ticket.assignees
            .slice(0, MAX_VISIBLE_ASSIGNEES)
            .map(a =>
              a.deleted ? (
                <DeletedUserAvatar
                  key={a.id}
                  size="sm"
                  accessibleLabel={`Deleted user: ${a.name ?? a.initials ?? a.id}`}
                />
              ) : (
                <SquareAvatar
                  key={a.id}
                  src={a.avatarUrl}
                  alt={a.name ?? a.initials ?? a.id}
                  fallback={a.name ?? a.initials}
                  size="sm"
                  variant="round"
                />
              ),
            )}
          {ticket.assignees.length > MAX_VISIBLE_ASSIGNEES && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-bg text-ods-text-secondary text-h6">
              +{ticket.assignees.length - MAX_VISIBLE_ASSIGNEES}
            </div>
          )}
        </div>
      ) : null}
    </div>
  ) : null;

  const timestampLabel = ticket.createdAt ? formatTicketRelativeTime(ticket.createdAt) : null;
  const tooltipLabel = ticket.createdAt ? formatTicketFullTimestamp(ticket.createdAt) : null;

  return (
    <>
      <div className="flex items-start gap-[var(--spacing-system-sf)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-zero)]" title={ticket.title}>
          <p className="truncate text-ods-text-primary text-h3">{ticket.title}</p>
          {showDeviceRow && (
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)] text-ods-text-secondary text-h6">
              <LaptopIcon className="size-4 shrink-0" />
              <span className="truncate" title={deviceText}>
                {deviceText}
              </span>
            </div>
          )}
        </div>
        {rightSection}
      </div>
      {ticket.tags?.length ? <TicketTagRow tags={ticket.tags} /> : null}
      {timestampLabel && tooltipLabel && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="pointer-events-auto truncate text-ods-text-secondary text-h6">{timestampLabel}</p>
            </TooltipTrigger>
            <TooltipContent>{tooltipLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {ticket.escalatedByUser && (
        <div className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-open-yellow text-h6">
          <UserCheckIcon className="size-4 shrink-0" />
          <span className="truncate">Escalated by User</span>
        </div>
      )}
      {ticket.activity && (
        <div
          className={cn(
            'flex items-center gap-[var(--spacing-system-xxs)] text-h6',
            ticket.activity.kind === 'stale' ? 'text-ods-open-yellow' : 'text-ods-text-secondary',
          )}
        >
          {ticket.activity.kind === 'stale' ? (
            <ClockIcon className="size-4 shrink-0" />
          ) : (
            <DotsLoaderIcon className="size-4 shrink-0" />
          )}
          <span className="truncate">{ticket.activity.label ?? ACTIVITY_DEFAULT_LABEL[ticket.activity.kind]}</span>
        </div>
      )}
      {showNewMessage && (
        <Tag
          label="New Message"
          icon={<MessagesIcon size={16} color={newMessageTextColor} />}
          className="w-fit shrink-0"
          style={{ backgroundColor: columnColor, color: newMessageTextColor }}
        />
      )}
      {ticket.pendingApproval && (
        <BoardTicketApproval pendingApproval={ticket.pendingApproval} onApprove={onApprove} onReject={onReject} />
      )}
    </>
  );
}

// =============================================================================
// Static card — the real board card design, rendered from props with NO
// drag-and-drop / board context (for embeds, marketing heroes, previews).
// =============================================================================

export interface TicketCardViewProps extends TicketCardBodyProps {
  className?: string;
  /** Merged over the shell's own — the board uses it to fade the copy it leaves
   *  behind and to place the one that follows the pointer. */
  style?: CSSProperties;
}

/**
 * The exact board `TicketCard` visual, standalone — same shell + `TicketCardBody`
 * as the draggable card, but registering no drag behaviour, so it renders
 * anywhere from static props. Use this outside a `<Board>`.
 */
export function TicketCardView({ className, style, ...bodyProps }: TicketCardViewProps) {
  const { ticket, columnColor } = bodyProps;
  const showNewMessage = !!ticket.hasNewMessage && !!columnColor;
  return (
    <div
      className={cn(TICKET_CARD_SHELL, className)}
      style={showNewMessage ? { borderColor: columnColor, ...style } : style}
    >
      <div className="relative z-10 flex flex-col gap-[var(--spacing-system-sf)]">
        <TicketCardBody {...bodyProps} />
      </div>
    </div>
  );
}

// =============================================================================
// Draggable board card
// =============================================================================

export interface TicketCardProps {
  ticket: BoardTicket;
  columnId: string;
  columnColor?: string;
  href?: string;
  dragDisabled?: boolean;
  /** The owning column's drop rules. A card is a drop target in its own right,
   *  and Pragmatic does not let a lane's `canDrop` veto its children — so the
   *  rules have to be answered here too, or a blocked lane still accepts a drop
   *  straight onto one of its cards. */
  dropDisabled?: boolean;
  allowedFromColumns?: string[];
  renderAssignSlot?: (ticket: BoardTicket) => ReactNode;
  onApprove?: (ticketId: string, requestId?: string) => void | Promise<void>;
  onReject?: (ticketId: string, requestId?: string) => void | Promise<void>;
}

/** Memoized: a drag moves one card, but it re-renders the column lists around
 *  it, and a board carries dozens of cards whose props did not change. Hosts
 *  must pass stable `renderAssignSlot` / `onApprove` / `onReject` (useCallback)
 *  for this to bite — an inline arrow re-renders every card on every keystroke
 *  anywhere in the page. */
export const TicketCard = memo(function TicketCardImpl({
  ticket,
  columnId,
  columnColor,
  href,
  dragDisabled,
  dropDisabled,
  allowedFromColumns,
  renderAssignSlot,
  onApprove,
  onReject,
}: TicketCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Read at drag start rather than captured: the registration below is keyed on
  // the ticket's id, so capturing the object would hand a renamed or re-tagged
  // ticket to the drag — and to the preview drawn from it — as it was when the
  // card first mounted.
  // Refreshed in an unconditional effect rather than in the render body: it is
  // only ever read at drag start, which is past a commit, and a render attempt
  // React discards must not be able to hand the drag a ticket nobody saw.
  const ticketRef = useRef(ticket);
  useEffect(() => {
    ticketRef.current = ticket;
  });
  const [isDragging, setIsDragging] = useState(false);
  // Set by the board for the moment after a drop in which this card is already
  // in its new slot and the drag preview is still gliding into it.
  const isLanding = useIsLanding(ticket.id);

  // Where the drop points, worked out once for the whole board — see
  // `drop-aim.ts` for why this stopped being each card's own business.
  const aim = useDropAim();
  // Matched on the LANE as well as the card, and both halves are load-bearing.
  // The board resolves one landing place, in one named lane; a ticket id is only
  // unique within a lane here, because each lane is its own query and a ticket
  // whose status just changed is listed by the new lane before the old one has
  // caught up. Matching on the id alone drew the line in both lanes at once —
  // including a lane that refuses the card altogether, since the aim it was
  // drawing came from the other one.
  const closestEdge = aim && aim.columnId === columnId && aim.ticketId === ticket.id ? aim.edge : null;
  // Not lane-scoped, and deliberately: `aim.columnId` is where the card is
  // GOING, while the card being carried is still sitting in the lane it came
  // from. True for a pointer drag and for a keyboard lift alike — the aim always
  // names the card being moved, whichever picked it up.
  const isSource = isDragging || aim?.ticket.id === ticket.id;

  const lift = useBoardLift();
  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Space lifts; Enter is left to the link, which opens the ticket.
    if (e.key !== ' ' || dragDisabled || !lift) return;
    e.preventDefault();
    lift(ticket.id);
  };
  // Advertised only where it works: the touch board provides no lift, and a
  // drag-disabled card cannot be lifted either.
  const keyShortcuts = dragDisabled || !lift ? undefined : 'Space';

  // Both roles live on the same element, and both keep their state HERE. That is
  // the point of the whole drag stack: hovering this card re-renders this card,
  // not the board — nothing subscribes upward, so cost does not grow with how
  // many cards are mounted.
  useEffect(() => {
    const element = ref.current;
    if (!element || dragDisabled) return undefined;

    const identity = { type: 'ticket' as const, ticketId: ticket.id, columnId };

    return combine(
      // Before anything else: the drag has to start as a "move", or its first
      // frame is drawn with the copy cursor — see `drag-effect.ts`.
      holdMoveDragEffect(element),
      draggable({
        element,
        // Read at drag start rather than captured, so a card renamed or re-tagged
        // since it mounted travels as it is now. No height: it was here for a
        // lane that opened room for the card, and nothing opens room any more —
        // it was costing a forced layout read at the start of every drag to
        // produce a field no one read.
        getInitialData: () => ({ ...identity, ticket: ticketRef.current }),
        /**
         * The card under the pointer is the browser's own drag image, styled by
         * us. Drawing it ourselves as a positioned element was tried and has one
         * unfixable flaw: an element in the page cannot leave the page. Carry a
         * card up towards the address bar and the pointer crosses into the
         * browser's own chrome, where no `dragover` reaches the document — so
         * the card freezes at the top edge and only catches up when the drag
         * ends. A native drag image is moved by the browser itself and floats
         * over everything, which is why Jira's card does not stick there.
         *
         * A clone rather than a second React tree: this is a photograph, taken
         * once, and a copy of the card's own DOM is a photograph of exactly what
         * is on screen — assignee slot and all — with no providers to re-supply
         * and no chance of it rendering a loading state into the picture.
         */
        onGenerateDragPreview: ({ nativeSetDragImage, location, source }) => {
          const { width } = source.element.getBoundingClientRect();
          setCustomNativeDragPreview({
            nativeSetDragImage,
            // Holds the card under the same part of itself it was grabbed by.
            getOffset: preserveOffsetOnSource({ element: source.element, input: location.current.input }),
            render: ({ container }) => {
              const clone = source.element.cloneNode(true) as HTMLElement;
              // The card is a flex item stretched by its lane; on its own it
              // would shrink to its contents.
              clone.style.width = `${width}px`;
              clone.style.opacity = String(DRAG_PREVIEW_OPACITY);
              clone.classList.add('shadow-card-hover');
              container.appendChild(clone);
            },
          });
        },
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => {
          if (source.data.type !== 'ticket' || source.data.ticketId === ticket.id) return false;
          const from = String(source.data.columnId);
          if (from === columnId) return true;
          if (dropDisabled) return false;
          return !allowedFromColumns || allowedFromColumns.includes(from);
        },
        // The edge rides along in the drop target's own data, so the board reads
        // "above or below this card" straight off the drop it receives.
        getData: ({ input, element: self }) =>
          attachClosestEdge({ ...identity }, { input, element: self, allowedEdges: ['top', 'bottom'] }),
        // Sticky, so crossing the gap between two cards — which is lane padding
        // and belongs to no card's box — keeps answering with the card just
        // left, rather than handing the question to the lane for those few
        // pixels and back again. Both answer with the same slot (the lane
        // resolves the nearest card and its edge), so this is about not
        // re-deriving it from a different target every few pixels, NOT about
        // reaching room a card has opened: nothing moves during a drag here.
        getIsSticky: () => true,
      }),
    );
  }, [ticket.id, columnId, dragDisabled, dropDisabled, allowedFromColumns]);

  const showNewMessage = !!ticket.hasNewMessage && !!columnColor;

  const style: CSSProperties = {};
  if (showNewMessage) style.borderColor = columnColor;

  const handleClick = (e: MouseEvent) => {
    if (isDragging) e.preventDefault();
  };

  // Held as one memoized element, not re-created per render. A card being
  // dragged over re-renders on every edge flip — it owns the hover state that
  // draws the preview — and the body is the expensive half: avatars, tags,
  // tooltips, a host's assignee picker with its own queries. Keeping the same
  // element object lets React bail out of that whole subtree, so only the thin
  // wrapper around it re-renders.
  const body = useMemo(
    () => (
      <TicketCardBody
        ticket={ticket}
        columnColor={columnColor}
        renderAssignSlot={renderAssignSlot}
        onApprove={onApprove ? requestId => onApprove(ticket.id, requestId) : undefined}
        onReject={onReject ? requestId => onReject(ticket.id, requestId) : undefined}
      />
    ),
    [ticket, columnColor, renderAssignSlot, onApprove, onReject],
  );

  // No transition on the margins below, and that is not a style choice: room is
  // opened at one card and given back at another, and a transition interrupted
  // part-way — which is every target change while the pointer keeps moving —
  // restarts from where it got to, so the two ends run at different rates and
  // the lane's height wanders. The rearrangement is instant instead.
  const cardClasses = cn(TICKET_CARD_SHELL, !dragDisabled && 'cursor-pointer');

  const outerProps = {
    ref,
    style,
    className: cardClasses,
    // Read by the lane's scroll anchor to keep the list still when tickets are
    // inserted above the viewport — see `use-lane-scroll-anchor.ts`.
    [TICKET_ID_ATTRIBUTE]: ticket.id,
  };

  const innerWrapperClass = 'relative z-10 flex flex-col gap-[var(--spacing-system-sf)]';

  if (isSource) {
    // Stays exactly where it is, faded. NOTHING about the lane moves during a
    // drag — no room opens, no slot closes — so there is no layout to keep
    // balanced and no height to wander. That is what makes the line below
    // affordable, and it is why this is also the cheap option.
    //
    // Safe to do from state: React commits this AFTER the `dragstart` handler
    // returns, and it is only removing the source synchronously inside that
    // handler that lets a browser abort the drag.
    style.opacity = DRAGGED_CARD_OPACITY;
  } else if (isLanding) {
    // Already here, and the preview is on its way to this exact box. Hidden and
    // not removed: the slot it holds is what the preview is aiming at, and it is
    // what keeps the lane from moving again the instant it settled.
    style.visibility = 'hidden';
  }

  /**
   * Where the card would land, drawn as a line rather than as an opened gap.
   *
   * Opening a card's worth of room and drawing a copy of the card in it costs a
   * lane relayout plus a whole card render — avatars, tags, tooltips, the host's
   * assignee slot — on every edge flip, and the flips come as fast as the
   * pointer moves. A line is one absolutely positioned span, changes no layout,
   * and says the same thing.
   */
  const insertionLine = closestEdge ? (
    <span
      aria-hidden
      {...{ [DROP_LINE_ATTRIBUTE]: '' }}
      className={cn(
        // Nothing sticks out sideways or beyond the line's own 2px: the lane
        // scrolls, and a scroll container clips whatever leaves its padding box
        // — an end cap or a knob on this would be cut off against the first and
        // last card in every lane.
        'pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full bg-ods-accent',
        // Centred in the lane's own gap, so it reads as sitting between two
        // cards rather than as belonging to one of them. The lane reserves the
        // matching sliver at its ends (see `board-column.tsx`).
        closestEdge === 'top' ? '-top-[5px]' : '-bottom-[5px]',
      )}
    />
  ) : null;

  if (href) {
    return (
      <div {...outerProps}>
        {insertionLine}
        <Link
          href={href}
          draggable={false}
          prefetch={false}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={ticket.title}
          aria-keyshortcuts={keyShortcuts}
          className="absolute inset-0 z-0 rounded-md focus-visible:outline-none"
        />
        <div className={cn('pointer-events-none', innerWrapperClass)}>{body}</div>
      </div>
    );
  }

  return (
    <div {...outerProps}>
      {insertionLine}
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        aria-label={ticket.title}
        aria-keyshortcuts={keyShortcuts}
        className="absolute inset-0 z-0 cursor-pointer rounded-md focus-visible:outline-none"
      />
      <div className={cn('pointer-events-none', innerWrapperClass)}>{body}</div>
    </div>
  );
});

function TicketTagRow({ tags }: { tags: string[] }) {
  const visible = tags.slice(0, MAX_VISIBLE_TAGS);
  const hidden = tags.length - visible.length;

  return (
    <div className="flex h-8 flex-wrap items-start gap-[var(--spacing-system-xxs)] overflow-clip">
      {visible.map(tag => (
        <Tag key={tag} variant="outline" label={tag} />
      ))}
      {hidden > 0 && <Tag variant="outline" label={`+${hidden}`} />}
    </div>
  );
}
