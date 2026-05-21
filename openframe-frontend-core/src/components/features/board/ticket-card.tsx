'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import * as React from 'react'
import { LaptopIcon, Flag02Icon } from '../../icons-v2-generated'
import { SquareAvatar } from '../../ui/square-avatar'
import { Tag } from '../../ui/tag'
import { cn } from '../../../utils/cn'
import type { BoardPriority, BoardTicket } from './types'

const PRIORITY_COLOR_CLASS: Record<BoardPriority, string> = {
  low: 'text-ods-text-secondary',
  medium: 'text-ods-info',
  high: 'text-ods-warning',
  urgent: 'text-ods-error',
}

const MAX_VISIBLE_TAGS = 2
const MAX_VISIBLE_ASSIGNEES = 3

export interface TicketCardProps {
  ticket: BoardTicket
  columnId: string
  href?: string
  isOverlay?: boolean
  dragDisabled?: boolean
  renderAssignSlot?: (ticket: BoardTicket) => React.ReactNode
}

export function TicketCard({
  ticket,
  columnId,
  href,
  isOverlay = false,
  dragDisabled,
  renderAssignSlot,
}: TicketCardProps) {
  const sortableData = React.useMemo(
    () => ({ columnId, type: 'ticket' as const }),
    [columnId],
  )
  const sortable = useSortable({
    id: ticket.id,
    data: sortableData,
    disabled: dragDisabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  }

  const showDeviceRow = !!(ticket.deviceHostnames?.length || ticket.organizationName)
  const deviceText = [
    ticket.deviceHostnames?.join(', '),
    ticket.organizationName,
  ].filter(Boolean).join(', ')

  const handleClick = (e: React.MouseEvent) => {
    if (sortable.isDragging) e.preventDefault()
  }

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
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ods-border bg-ods-bg text-xs font-medium text-ods-text-secondary">
              +{ticket.assignees.length - MAX_VISIBLE_ASSIGNEES}
            </div>
          )}
        </div>
      ) : null}
    </div>
  ) : null

  const body = (
    <>
      <div className="flex items-start gap-[var(--spacing-system-sf)]">
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-h3 truncate text-ods-text-primary" title={ticket.title}>{ticket.title}</p>
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
    </>
  )

  const cardClasses = cn(
    'relative flex flex-col gap-[var(--spacing-system-sf)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-sf)] select-none text-left',
    !dragDisabled && 'cursor-pointer',
    sortable.isDragging && !isOverlay && 'opacity-40',
    isOverlay && 'rotate-1 shadow-card-hover',
  )

  const outerProps = {
    ref: isOverlay ? undefined : sortable.setNodeRef,
    style: isOverlay ? undefined : style,
    className: cardClasses,
    ...(isOverlay ? {} : sortable.attributes),
    ...(isOverlay ? {} : sortable.listeners),
  }

  if (isOverlay) {
    return (
      <div {...outerProps}>
        <div className="relative z-10">{body}</div>
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
        <div className="pointer-events-none relative z-10">{body}</div>
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
      <div className="pointer-events-none relative z-10">{body}</div>
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
