'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from '../../../embed-shims/next-link'
import * as React from 'react'
import { LaptopIcon, Flag02Icon, MessagesIcon } from '../../icons-v2-generated'
import { SquareAvatar } from '../../ui/square-avatar'
import { Tag } from '../../ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip'
import { cn } from '../../../utils/cn'
import { getReadableTextColor } from '../../../utils/ods-color-utils'
import { formatTicketRelativeTime, formatTicketFullTimestamp } from '../../../utils/date-utils'
import { BoardTicketApproval } from './board-ticket-approval'
import type { BoardPriority, BoardTicket } from './types'

const PRIORITY_COLOR_CLASS: Record<BoardPriority, string> = {
  low: 'text-ods-text-secondary',
  medium: 'text-ods-info',
  high: 'text-ods-warning',
  urgent: 'text-ods-error',
}

const MAX_VISIBLE_TAGS = 2
const MAX_VISIBLE_ASSIGNEES = 3

/** Shared card shell (border / padding / bg). Same footprint for the draggable
 *  board card and the static {@link TicketCardView}. */
const TICKET_CARD_SHELL =
  'relative flex flex-col gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)] select-none text-left'

// =============================================================================
// Presentational body — the ONE ticket-card design, no drag/link/board context.
// Reused by the draggable `TicketCard` AND the static `TicketCardView`.
// =============================================================================

export interface TicketCardBodyProps {
  ticket: BoardTicket
  columnColor?: string
  renderAssignSlot?: (ticket: BoardTicket) => React.ReactNode
  /** Approval callbacks receive the request id directly (the draggable
   *  `TicketCard` adapts its own `(ticketId, requestId)` signature onto these). */
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
}

/** The card's inner content: title + device/org, priority + assignees, tags,
 *  timestamp, "New Message", and the approval row. Pure — driven only by props. */
export function TicketCardBody({ ticket, columnColor, renderAssignSlot, onApprove, onReject }: TicketCardBodyProps) {
  const showNewMessage = !!ticket.hasNewMessage && !!columnColor
  const newMessageTextColor = columnColor ? getReadableTextColor(columnColor) : undefined

  const showDeviceRow = !!(ticket.deviceHostnames?.length || ticket.organizationName)
  const deviceText = [ticket.deviceHostnames?.join(', '), ticket.organizationName].filter(Boolean).join(', ')

  const hasRightSection = !!(ticket.priority || ticket.assignees?.length || renderAssignSlot)
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
          {ticket.assignees.slice(0, MAX_VISIBLE_ASSIGNEES).map(a => (
            <SquareAvatar
              key={a.id}
              src={a.avatarUrl}
              alt={a.name ?? a.initials ?? a.id}
              fallback={a.name ?? a.initials}
              size="sm"
              variant="round"
            />
          ))}
          {ticket.assignees.length > MAX_VISIBLE_ASSIGNEES && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-bg text-h6 text-ods-text-secondary">
              +{ticket.assignees.length - MAX_VISIBLE_ASSIGNEES}
            </div>
          )}
        </div>
      ) : null}
    </div>
  ) : null

  const timestampLabel = ticket.createdAt ? formatTicketRelativeTime(ticket.createdAt) : null
  const tooltipLabel = ticket.createdAt ? formatTicketFullTimestamp(ticket.createdAt) : null

  return (
    <>
      <div className="flex items-start gap-[var(--spacing-system-sf)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-zero)]" title={ticket.title}>
          <p className="text-h3 truncate text-ods-text-primary">{ticket.title}</p>
          {showDeviceRow && (
            <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)] text-h6 text-ods-text-secondary">
              <LaptopIcon className="size-4 shrink-0" />
              <span className="truncate" title={deviceText}>{deviceText}</span>
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
              <p className="pointer-events-auto text-h6 truncate text-ods-text-secondary">{timestampLabel}</p>
            </TooltipTrigger>
            <TooltipContent>{tooltipLabel}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
  )
}

// =============================================================================
// Static card — the real board card design, rendered from props with NO
// drag-and-drop / board context (for embeds, marketing heroes, previews).
// =============================================================================

export interface TicketCardViewProps extends TicketCardBodyProps {
  className?: string
}

/**
 * The exact board `TicketCard` visual, standalone — same shell + `TicketCardBody`
 * as the draggable card, but without the `useSortable` dnd-kit dependency, so it
 * renders anywhere from static props. Use this outside a `<Board>`.
 */
export function TicketCardView({ className, ...bodyProps }: TicketCardViewProps) {
  const { ticket, columnColor } = bodyProps
  const showNewMessage = !!ticket.hasNewMessage && !!columnColor
  return (
    <div
      className={cn(TICKET_CARD_SHELL, className)}
      style={showNewMessage ? { borderColor: columnColor } : undefined}
    >
      <div className="relative z-10 flex flex-col gap-[var(--spacing-system-sf)]">
        <TicketCardBody {...bodyProps} />
      </div>
    </div>
  )
}

// =============================================================================
// Draggable board card
// =============================================================================

export interface TicketCardProps {
  ticket: BoardTicket
  columnId: string
  columnColor?: string
  href?: string
  isOverlay?: boolean
  dragDisabled?: boolean
  renderAssignSlot?: (ticket: BoardTicket) => React.ReactNode
  onApprove?: (ticketId: string, requestId?: string) => void | Promise<void>
  onReject?: (ticketId: string, requestId?: string) => void | Promise<void>
}

export function TicketCard({
  ticket,
  columnId,
  columnColor,
  href,
  isOverlay = false,
  dragDisabled,
  renderAssignSlot,
  onApprove,
  onReject,
}: TicketCardProps) {
  const sortableData = React.useMemo(() => ({ columnId, type: 'ticket' as const }), [columnId])
  const sortable = useSortable({ id: ticket.id, data: sortableData, disabled: dragDisabled })

  const showNewMessage = !!ticket.hasNewMessage && !!columnColor

  const style: React.CSSProperties = isOverlay
    ? {}
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }
  if (showNewMessage) style.borderColor = columnColor

  const handleClick = (e: React.MouseEvent) => {
    if (sortable.isDragging) e.preventDefault()
  }

  const body = (
    <TicketCardBody
      ticket={ticket}
      columnColor={columnColor}
      renderAssignSlot={renderAssignSlot}
      onApprove={onApprove ? requestId => onApprove(ticket.id, requestId) : undefined}
      onReject={onReject ? requestId => onReject(ticket.id, requestId) : undefined}
    />
  )

  const cardClasses = cn(
    TICKET_CARD_SHELL,
    !dragDisabled && 'cursor-pointer',
    sortable.isDragging && !isOverlay && 'opacity-40',
    isOverlay && 'rotate-1 shadow-card-hover',
  )

  const outerProps = {
    ref: isOverlay ? undefined : sortable.setNodeRef,
    style,
    className: cardClasses,
    ...(isOverlay ? {} : sortable.attributes),
    ...(isOverlay ? {} : sortable.listeners),
  }

  const innerWrapperClass = 'relative z-10 flex flex-col gap-[var(--spacing-system-sf)]'

  if (isOverlay) {
    return (
      <div {...outerProps}>
        <div className={innerWrapperClass}>{body}</div>
      </div>
    )
  }

  if (href) {
    return (
      <div {...outerProps}>
        <Link
          href={href}
          draggable={false}
          prefetch={false}
          onClick={handleClick}
          aria-label={ticket.title}
          className="absolute inset-0 z-0 rounded-md focus-visible:outline-none"
        />
        <div className={cn('pointer-events-none', innerWrapperClass)}>{body}</div>
      </div>
    )
  }

  return (
    <div {...outerProps}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={ticket.title}
        className="absolute inset-0 z-0 cursor-pointer rounded-md focus-visible:outline-none"
      />
      <div className={cn('pointer-events-none', innerWrapperClass)}>{body}</div>
    </div>
  )
}

function TicketTagRow({ tags }: { tags: string[] }) {
  const visible = tags.slice(0, MAX_VISIBLE_TAGS)
  const hidden = tags.length - visible.length

  return (
    <div className="flex h-8 flex-wrap items-start gap-[var(--spacing-system-xxs)] overflow-clip">
      {visible.map(tag => (
        <Tag key={tag} variant="outline" label={tag} />
      ))}
      {hidden > 0 && <Tag variant="outline" label={`+${hidden}`} />}
    </div>
  )
}
