'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { ChevronRight } from 'lucide-react'
import { TicketStatusTag, resolveTicketStatus } from '../ui/ticket-status-tag'

export interface ChatTicketItemData {
  id: string
  title: string
  ticketNumber: string
  /** Accepts any known ticket status format (ACTIVE, active, ACTION_REQUIRED, etc.) */
  status: string
  category?: string
  timeAgo?: string
}

export interface ChatTicketItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  ticket: ChatTicketItemData
  onClick?: (ticketId: string) => void
}

const ChatTicketItem = React.forwardRef<HTMLButtonElement, ChatTicketItemProps>(
  ({ className, ticket, onClick, ...props }, ref) => {
    const isResolved = resolveTicketStatus(ticket.status) === 'RESOLVED'

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
          "focus:outline-none focus:bg-ods-bg-hover",
          className,
        )}
        {...props}
      >
        <div className="flex flex-col justify-center flex-1 min-w-0 text-left">
          <p
            className={cn(
              "text-h3 truncate",
              isResolved ? "text-ods-text-secondary" : "text-ods-text-primary",
            )}
          >
            {ticket.title}
          </p>
          {subtitle && (
            <p className="text-h6 text-ods-text-secondary truncate">
              {subtitle}
            </p>
          )}
        </div>

        <TicketStatusTag status={ticket.status} />

        <div className="flex items-center justify-center shrink-0 size-12 rounded-md bg-ods-card border border-ods-border">
          <ChevronRight className="size-6 text-ods-text-secondary" />
        </div>
      </button>
    )
  },
)

ChatTicketItem.displayName = 'ChatTicketItem'

export { ChatTicketItem }
