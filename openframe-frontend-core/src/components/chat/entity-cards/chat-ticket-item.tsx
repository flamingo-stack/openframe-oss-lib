'use client';

import { ChevronRight } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { TILE_SIZE } from '../../../styles/component-sizes';
import { cn } from '../../../utils/cn';
import { WrenchIcon } from '../../icons-v2-generated/household/wrench-icon';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from '../../ui/loading-scope';
import { Tag } from '../../ui/tag';
import { TicketStatusTag, resolveStatusTagProps, resolveTicketStatus } from '../../ui/ticket-status-tag';

export interface ChatTicketItemData {
  id: string;
  title: string;
  ticketNumber: string;
  /** Accepts any known ticket status format (ACTIVE, active, ACTION_REQUIRED, etc.) */
  status: string;
  /** Optional badge label override. If set, the badge text reads this
   *  (e.g. HubSpot's `pipeline_stage_label` — "New" / "Closed" /
   *  "Waiting on contact" / "Waiting on version release") while the
   *  variant + check icon still come from the canonical `status`.
   *  When omitted, the canonical status's default label is used
   *  ("Resolved" for closed, "Active" for open, etc.). */
  statusLabel?: string;
  /** Lifecycle (custom-status) kind — drives canonical-vs-color styling. */
  statusKind?: string;
  /** Lifecycle (custom-status) hex color, used when the kind isn't canonical. */
  statusColor?: string;
  category?: string;
  timeAgo?: string;
  /** Explicit secondary line under the title. When set, it replaces the
   *  default `ticketNumber • category • timeAgo` composition verbatim, so
   *  the host decides how the reference reads - the Fae client passes
   *  `Ticket Number: 165 • 6m ago` (reference labelled but visually
   *  secondary). An empty string hides the line. */
  subtitle?: string;
  /** The ticket has activity the customer has not opened yet
   *  (Figma fae-chat 1-5592): the secondary line and the chevron switch to
   *  the brand yellow, and the line reads the unread notice unless
   *  `subtitle` overrides it. The host clears it once the ticket is
   *  opened, and the reference line comes back. */
  unread?: boolean;
  /** When set, renders a "Linked work" chip with a wrench icon next to
   *  the status tag — tells the customer at a glance that an internal
   *  delivery task is in flight for this ticket, even before they
   *  expand the row. The label is the linked task's status (e.g.
   *  "Waiting on version release") so the chip carries the actual
   *  progress signal, not just a generic marker. */
  linkedTaskLabel?: string;
}

export interface ChatTicketItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Optional while `loading`: the loading row needs no data. */
  ticket?: ChatTicketItemData;
  onClick?: (ticketId: string) => void;
  /** The ticket is still being read: the row draws its loading form (same box, its own text slots as bars). */
  loading?: boolean;
}

const UNREAD_NOTICE = 'You have a new unread message';

const TICKET_ROW = cn('flex h-20 w-full items-center gap-4 px-4', 'border-b border-ods-border bg-ods-card');
const TICKET_ROW_TEXT = 'flex min-w-0 flex-1 flex-col justify-center';
const TICKET_ROW_CHEVRON = `flex ${TILE_SIZE.xl} shrink-0 items-center justify-center rounded-md border`;

/**
 * A ticket row. ONE switch (`useLoadingScope() || loading`): while the ticket is read the SAME row (an inert `div`, not
 * a button) draws its title and reference line as `text-h3` / `text-h6` bars, its status tag in the tag's own loading
 * form, and the chevron (static) for real.
 */
const ChatTicketItem = forwardRef<HTMLButtonElement, ChatTicketItemProps>(
  ({ className, ticket, onClick, loading: loadingProp = false, ...props }, ref) => {
    const loading = useLoadingScope() || loadingProp;
    if (!loading && !ticket) return null;

    const statusTagProps = ticket
      ? resolveStatusTagProps({
          status: ticket.status,
          statusKind: ticket.statusKind,
          statusName: ticket.statusLabel,
          statusColor: ticket.statusColor,
        })
      : null;
    const isResolved =
      !!ticket && (ticket.statusKind === 'RESOLVED' || resolveTicketStatus(ticket.status) === 'RESOLVED');
    const composedSubtitle = ticket
      ? [ticket.ticketNumber, ticket.category, ticket.timeAgo].filter(Boolean).join(' \u2022 ')
      : '';
    const subtitle = ticket?.subtitle ?? (ticket?.unread ? UNREAD_NOTICE : composedSubtitle);
    const unread = !!ticket?.unread;

    const content = (
      <>
        <div className={cn(TICKET_ROW_TEXT, 'text-left')}>
          {loading || !ticket ? (
            <>
              <TextLineSkeleton type="h3" className="w-1/2" />
              <TextLineSkeleton type="h6" className="w-1/3" />
            </>
          ) : (
            <>
              <p
                className={cn('truncate text-h3', isResolved ? 'text-ods-text-secondary' : 'text-ods-text-primary')}
                title={ticket.title}
              >
                {ticket.title}
              </p>
              {subtitle && (
                <p
                  className={cn('truncate text-h6', unread ? 'text-ods-open-yellow' : 'text-ods-text-secondary')}
                  title={subtitle}
                >
                  {subtitle}
                </p>
              )}
            </>
          )}
        </div>

        {/* Linked-work chip — only renders when the ticket has a
            linked ClickUp delivery. Wrench icon + lowercase status
            from the linked task. Rendered to the LEFT of the status
            tag so the canonical ticket status still wins the
            right-aligned slot. Hidden on small screens (sm:flex) to
            avoid crowding the row when both badges are present. */}
        {ticket?.linkedTaskLabel && (
          <Tag
            label={ticket.linkedTaskLabel}
            variant="outline"
            icon={<WrenchIcon size={14} color="var(--color-text-secondary)" />}
            className="hidden shrink-0 sm:inline-flex"
          />
        )}
        {loading ? (
          <TicketStatusTag status="" loading className="w-20" />
        ) : (
          statusTagProps && (statusTagProps.status || statusTagProps.label) && <TicketStatusTag {...statusTagProps} />
        )}

        <div
          data-testid="chat-ticket-item-chevron"
          className={cn(
            TICKET_ROW_CHEVRON,
            unread ? 'border-ods-open-yellow bg-ods-open-yellow' : 'border-ods-border bg-ods-card',
          )}
        >
          <ChevronRight className={cn('size-6', unread ? 'text-ods-text-on-accent' : 'text-ods-text-secondary')} />
        </div>
      </>
    );

    if (loading || !ticket) {
      return (
        <div aria-hidden className={cn(TICKET_ROW, className)} {...loadingItemProps(props)}>
          {content}
        </div>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onClick?.(ticket.id)}
        className={cn(
          TICKET_ROW,
          'cursor-pointer transition-colors duration-150',
          'hover:bg-ods-bg-hover',
          // `focus-visible:` covers keyboard nav AND the post-click state
          // jsdom/Chromium leave behind. Without it, the global focus
          // ring (1.5px white) renders as a stray "white border" after
          // clicking a row.
          'focus:bg-ods-bg-hover focus:outline-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent',
          className,
        )}
        {...props}
      >
        {content}
      </button>
    );
  },
);

ChatTicketItem.displayName = 'ChatTicketItem';

export { ChatTicketItem };
