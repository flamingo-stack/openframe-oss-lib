'use client';

import { ChevronRight } from 'lucide-react';
import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../../utils/cn';
import { WrenchIcon } from '../../icons-v2-generated/household/wrench-icon';
import { Skeleton } from '../../ui/skeleton';
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
  /** When set, renders a "Linked work" chip with a wrench icon next to
   *  the status tag — tells the customer at a glance that an internal
   *  delivery task is in flight for this ticket, even before they
   *  expand the row. The label is the linked task's status (e.g.
   *  "Waiting on version release") so the chip carries the actual
   *  progress signal, not just a generic marker. */
  linkedTaskLabel?: string;
}

export interface ChatTicketItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Optional while `isLoading` — the skeleton placeholder needs no data. */
  ticket?: ChatTicketItemData;
  onClick?: (ticketId: string) => void;
  /** Render a non-interactive skeleton placeholder sized to a real row. */
  isLoading?: boolean;
}

const ChatTicketItem = forwardRef<HTMLButtonElement, ChatTicketItemProps>(
  ({ className, ticket, onClick, isLoading = false, ...props }, ref) => {
    if (isLoading) {
      return (
        <div
          aria-hidden
          className={cn(
            'flex h-20 w-full items-center gap-4 px-4',
            'border-b border-ods-border bg-ods-card',
            className,
          )}
        >
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
            {/* title line */}
            <Skeleton className="h-5 w-1/2" />
            {/* subtitle line */}
            <Skeleton className="h-4 w-1/3" />
          </div>
          {/* status tag */}
          <Skeleton className="h-8 w-20 shrink-0 rounded-r-md" />
          {/* chevron box */}
          <Skeleton className="size-12 shrink-0 rounded-md" />
        </div>
      );
    }

    if (!ticket) return null;

    const statusTagProps = resolveStatusTagProps({
      status: ticket.status,
      statusKind: ticket.statusKind,
      statusName: ticket.statusLabel,
      statusColor: ticket.statusColor,
    });
    const isResolved = ticket.statusKind === 'RESOLVED' || resolveTicketStatus(ticket.status) === 'RESOLVED';

    const subtitle = [ticket.ticketNumber, ticket.category, ticket.timeAgo].filter(Boolean).join(' \u2022 ');

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onClick?.(ticket.id)}
        className={cn(
          'flex h-20 w-full items-center gap-4 px-4',
          'border-b border-ods-border bg-ods-card',
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
        <div className="flex min-w-0 flex-1 flex-col justify-center text-left">
          <p
            className={cn('truncate text-h3', isResolved ? 'text-ods-text-secondary' : 'text-ods-text-primary')}
            title={ticket.title}
          >
            {ticket.title}
          </p>
          {subtitle && (
            <p className="truncate text-ods-text-secondary text-h6" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Linked-work chip — only renders when the ticket has a
            linked ClickUp delivery. Wrench icon + lowercase status
            from the linked task. Rendered to the LEFT of the status
            tag so the canonical ticket status still wins the
            right-aligned slot. Hidden on small screens (sm:flex) to
            avoid crowding the row when both badges are present. */}
        {ticket.linkedTaskLabel && (
          <Tag
            label={ticket.linkedTaskLabel}
            variant="outline"
            icon={<WrenchIcon size={14} color="var(--color-text-secondary)" />}
            className="hidden shrink-0 sm:inline-flex"
          />
        )}
        {(statusTagProps.status || statusTagProps.label) && <TicketStatusTag {...statusTagProps} />}

        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-card">
          <ChevronRight className="size-6 text-ods-text-secondary" />
        </div>
      </button>
    );
  },
);

ChatTicketItem.displayName = 'ChatTicketItem';

export { ChatTicketItem };
