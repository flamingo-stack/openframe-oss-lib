import type { PendingToolCallData } from '../../chat/types'
import type { TicketStatus } from '../../ui/ticket-status-tag'

export type BoardPriority = 'low' | 'medium' | 'high' | 'urgent'

/** Latest pending tool-approval request attached to a board ticket (from `Ticket.pendingApproval`). */
export interface BoardTicketPendingApproval {
  id: string
  approvalType?: string
  command?: string
  explanation?: string
  createdAt?: string
  toolCalls?: PendingToolCallData[]
}

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
  createdAt?: string
  hasNewMessage?: boolean
  pendingApproval?: BoardTicketPendingApproval
}

export interface BoardColumnDef {
  id: string
  /**
   * Canonical status key for header styling (e.g. 'ACTIVE', 'RESOLVED'), when the
   * column `id` is not itself a known status (e.g. a custom-status UUID). The
   * header resolves its TicketStatusTag variant/icon from this, falling back to
   * `id`. Leave undefined for custom statuses so they render from `color`.
   */
  statusKey?: string
  label: string
  color: string
  tickets: BoardTicket[]

  total?: number
  hasMore?: boolean
  isLoading?: boolean
  isLoadingMore?: boolean

  system?: boolean
  dropDisabled?: boolean
  dragDisabled?: boolean
  allowedFromColumns?: string[]
  archivable?: boolean
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
  AI_ASSISTANCE: { label: 'AI Assistance', color: '#888888' },
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
    isLoading: overrides.isLoading,
    isLoadingMore: overrides.isLoadingMore,
    system: overrides.system,
    dropDisabled: overrides.dropDisabled,
    dragDisabled: overrides.dragDisabled,
    allowedFromColumns: overrides.allowedFromColumns,
    archivable: overrides.archivable,
  }
}

export function groupTicketsByStatus(
  tickets: BoardTicket[],
  statuses: TicketStatus[],
): BoardColumnDef[] {
  const buckets: Record<TicketStatus, BoardTicket[]> = {
    ACTIVE: [],
    AI_ASSISTANCE: [],
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
    upper === 'AI_ASSISTANCE' ||
    upper === 'TECH_REQUIRED' ||
    upper === 'ON_HOLD' ||
    upper === 'RESOLVED' ||
    upper === 'ARCHIVED'
  ) {
    return upper
  }
  return null
}
