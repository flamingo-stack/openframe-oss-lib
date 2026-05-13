'use client'

import { Button } from '../../ui/button/button'
import { TicketStatusTag, getTicketStatusConfig } from '../../ui/ticket-status-tag'
import { Arrow02LeftIcon, Arrow02RightIcon, PlusIcon } from '../../icons-v2-generated'
import type { BoardColumnDef } from './types'

export interface BoardColumnHeaderProps {
  column: BoardColumnDef
  collapsed?: boolean
  onToggleCollapse: () => void
  onAddTicket?: () => void
}

export function BoardColumnHeader({
  column,
  collapsed = false,
  onToggleCollapse,
  onAddTicket,
}: BoardColumnHeaderProps) {
  const count = column.total ?? column.tickets.length
  const useStatusVariant = !!getTicketStatusConfig(column.id).icon

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-[var(--spacing-system-xsf)]">
        <Button
          variant="transparent"
          size="icon"
          className="h-8 w-8 md:h-8 md:w-8 p-0"
          onClick={onToggleCollapse}
          aria-label="Expand column"
        >
          <Arrow02RightIcon className="h-6 w-6 text-ods-text-secondary" />
        </Button>
        <TicketStatusTag
          status={column.id}
          label={column.label}
          color={useStatusVariant ? undefined : column.color}
          className="h-auto [writing-mode:vertical-rl]"
        />
        <span className="text-h5" style={{ color: column.color }}>
          {count}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-[var(--spacing-system-xsf)]">
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]">
        <TicketStatusTag
          status={column.id}
          label={column.label}
          color={useStatusVariant ? undefined : column.color}
        />
        <span
          className="text-h5"
          style={useStatusVariant ? undefined : { color: column.color }}
        >
          {count}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)]">
        <Button
          variant="transparent"
          size="icon"
          className="h-8 w-8 md:h-8 md:w-8 p-0"
          onClick={onToggleCollapse}
          aria-label="Collapse column"
        >
          <Arrow02LeftIcon className="h-6 w-6 text-ods-text-secondary" />
        </Button>
        {onAddTicket && (
          <Button
            variant="transparent"
            size="icon"
            className="h-8 w-8 md:h-8 md:w-8 p-0"
            onClick={onAddTicket}
            aria-label="Add ticket"
          >
            <PlusIcon className="h-6 w-6 text-ods-text-secondary" />
          </Button>
        )}
      </div>
    </div>
  )
}
