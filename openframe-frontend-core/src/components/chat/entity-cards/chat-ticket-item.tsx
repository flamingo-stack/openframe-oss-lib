'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { ChevronRight } from 'lucide-react'
import { TicketStatusTag, resolveStatusTagProps, resolveTicketStatus } from '../../ui/ticket-status-tag'
import { Tag } from '../../ui/tag'
import { Skeleton } from '../../ui/skeleton'
import { WrenchIcon } from '../../icons-v2-generated/household/wrench-icon'

export interface ChatTicketItemData {
  id: string
  title: string
  ticketNumber: string
  /** Accepts any known ticket status format (ACTIVE, active, ACTION_REQUIRED, etc.) */
  status: string
  /** Optional badge label override. If set, the badge text reads this
   *  (e.g. HubSpot's `pipeline_stage_label` — "New" / "Closed" /
   *  "Waiting on contact" / "Waiting on version release") while the
   *  variant + check icon still come from the canonical `status`.
   *  When omitted, the canonical status's default label is used
   *  ("Resolved" for closed, "Active" for open, etc.). */
  statusLabel?: string
  /** Lifecycle (custom-status) kind — drives canonical-vs-color styling. */
  statusKind?: string
  /** Lifecycle (custom-status) hex color, used when the kind isn't canonical. */
  statusColor?: string
  category?: string
  timeAgo?: string
  /** When set, renders a "Linked work" chip with a wrench icon next to
   *  the status tag — tells the customer at a glance that an internal
   *  delivery task is in flight for this ticket, even before they
   *  expand the row. The label is the linked task's status (e.g.
   *  "Waiting on version release") so the chip carries the actual
   *  progress signal, not just a generic marker. */
  linkedTaskLabel?: string
}

export interface ChatTicketItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** Optional while `isLoading` — the skeleton placeholder needs no data. */
  ticket?: ChatTicketItemData
  onClick?: (ticketId: string) => void
  /** Render a non-interactive skeleton placeholder sized to a real row. */
  isLoading?: boolean
}

const ChatTicketItem = React.forwardRef<HTMLButtonElement, ChatTicketItemProps>(
  ({ className, ticket, onClick, isLoading = false, ...props }, ref) => {
    if (isLoading) {
      return (
        <div
          aria-hidden
          className={cn(
            "flex items-center gap-4 w-full h-20 px-4",
            "bg-ods-card border-b border-ods-border",
            className,
          )}
        >
          <div className="flex flex-col justify-center flex-1 min-w-0 gap-1">
            {/* title line */}
            <Skeleton className="h-5 w-1/2" />
            {/* subtitle line */}
            <Skeleton className="h-4 w-1/3" />
          </div>
          {/* status tag */}
          <Skeleton className="h-8 w-20 rounded-r-md shrink-0" />
          {/* chevron box */}
          <Skeleton className="size-12 rounded-md shrink-0" />
        </div>
      )
    }

    if (!ticket) return null

    const statusTagProps = resolveStatusTagProps({
      status: ticket.status,
      statusKind: ticket.statusKind,
      statusName: ticket.statusLabel,
      statusColor: ticket.statusColor,
    })
    const isResolved = ticket.statusKind === 'RESOLVED' || resolveTicketStatus(ticket.status) === 'RESOLVED'

    const subtitle = [ticket.ticketNumber, ticket.category, ticket.timeAgo]
      .filter(Boolean)
      .join(' \u2022 ')

    return (
      <button
        ref={ref}
        type="button"
        onClick={() => onClick?.(ticket.id)}
        className={cn(
          "flex items-center gap-4 w-full h-20 px-4",
          "bg-ods-card border-b border-ods-border",
          "cursor-pointer transition-colors duration-150",
          "hover:bg-ods-bg-hover",
          // `focus-visible:` covers keyboard nav AND the post-click state
          // jsdom/Chromium leave behind. Without it, the global focus
          // ring (1.5px white) renders as a stray "white border" after
          // clicking a row.
          "focus:outline-none focus:bg-ods-bg-hover",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-inset",
          className,
        )}
        {...props}
      >
        <div className="flex flex-col justify-center flex-1 min-w-0 text-left">
          <p
            className={cn(
              "text-h3 truncate",
              isResolved ? "text-ods-text-secondary" : "text-ods-text-primary",
            )} title={ticket.title}>
            {ticket.title}
          </p>
          {subtitle && (
            <p className="text-h6 text-ods-text-secondary truncate" title={subtitle}>
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
            className="shrink-0 hidden sm:inline-flex"
          />
        )}
        {(statusTagProps.status || statusTagProps.label) && <TicketStatusTag {...statusTagProps} />}

        <div className="flex items-center justify-center shrink-0 size-12 rounded-md bg-ods-card border border-ods-border">
          <ChevronRight className="size-6 text-ods-text-secondary" />
        </div>
      </button>
    )
  },
)

ChatTicketItem.displayName = 'ChatTicketItem'

export { ChatTicketItem }
