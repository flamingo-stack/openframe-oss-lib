import type { TicketStatus } from '../../ui/ticket-status-tag'

export type BoardPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface BoardTicketAssignee {
  id: string
  initials?: string
  avatarUrl?: string
  name?: string
}

export interface BoardTicket {
  id: string
  title: string
  ticketNumber: string
  status: string

  deviceHostnames?: string[]
  organizationName?: string
  priority?: BoardPriority
  assignees?: BoardTicketAssignee[]
  tags?: string[]
}

export interface BoardColumnDef {
  id: string
  label: string
  color: string
  tickets: BoardTicket[]

  total?: number
  hasMore?: boolean
  isLoadingMore?: boolean

  system?: boolean
  dropDisabled?: boolean
  dragDisabled?: boolean
  allowedFromColumns?: string[]
}

export interface BoardChange {
  ticketId: string
  fromColumnId: string
  toColumnId: string
  afterTicketId: string | null
  beforeTicketId: string | null
}

const STATUS_DEFAULTS: Record<TicketStatus, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: '#5ea62e' },
  TECH_REQUIRED: { label: 'Tech Required', color: '#e1b32f' },
  ON_HOLD: { label: 'On Hold', color: '#f36666' },
  RESOLVED: { label: 'Resolved', color: '#888888' },
  ARCHIVED: { label: 'Archived', color: '#3a3a3a' },
}

export function columnFromTicketStatus(
  status: TicketStatus,
  tickets: BoardTicket[],
  overrides: Partial<Omit<BoardColumnDef, 'id' | 'tickets'>> = {},
): BoardColumnDef {
  const defaults = STATUS_DEFAULTS[status]
  return {
    id: status,
    label: overrides.label ?? defaults.label,
    color: overrides.color ?? defaults.color,
    tickets,
    total: overrides.total,
    hasMore: overrides.hasMore,
    isLoadingMore: overrides.isLoadingMore,
    system: overrides.system,
    dropDisabled: overrides.dropDisabled,
    dragDisabled: overrides.dragDisabled,
    allowedFromColumns: overrides.allowedFromColumns,
  }
}

export function groupTicketsByStatus(
  tickets: BoardTicket[],
  statuses: TicketStatus[],
): BoardColumnDef[] {
  const buckets: Record<TicketStatus, BoardTicket[]> = {
    ACTIVE: [],
    TECH_REQUIRED: [],
    ON_HOLD: [],
    RESOLVED: [],
    ARCHIVED: [],
  }
  for (const t of tickets) {
    const canonical = canonicalize(t.status)
    if (canonical) buckets[canonical].push(t)
  }
  return statuses.map(s => columnFromTicketStatus(s, buckets[s]))
}

function canonicalize(status: string): TicketStatus | null {
  const upper = status.toUpperCase().replace(/\s+/g, '_')
  if (upper === 'ACTION_REQUIRED') return 'TECH_REQUIRED'
  if (
    upper === 'ACTIVE' ||
    upper === 'TECH_REQUIRED' ||
    upper === 'ON_HOLD' ||
    upper === 'RESOLVED' ||
    upper === 'ARCHIVED'
  ) {
    return upper
  }
  return null
}
