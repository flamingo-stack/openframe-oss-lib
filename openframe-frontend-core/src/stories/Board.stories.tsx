import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import * as React from 'react'
import {
  Board,
  columnFromTicketStatus,
  groupTicketsByStatus,
  type BoardChange,
  type BoardColumnDef,
  type BoardTicket,
} from '../components/features/board'

const meta: Meta<typeof Board> = {
  title: 'Features/Board',
  component: Board,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof meta>

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const ASSIGNEES = [
  { id: 'u1', initials: 'RS', name: 'Rachel Santos' },
  { id: 'u2', initials: 'MP', name: 'Marcus Park' },
  { id: 'u3', initials: 'JD', name: 'Jamie Diaz' },
  { id: 'u4', initials: 'AK', name: 'Aiden Kim' },
] as const

const baseTicket = (i: number, status: string, overrides: Partial<BoardTicket> = {}): BoardTicket => ({
  id: `ticket-${status}-${i}`,
  title: TITLES[i % TITLES.length],
  ticketNumber: `#${1000 + i}`,
  status,
  deviceHostnames: i % 2 === 0 ? ['SRV-MAIL-01'] : ['MBP-15', 'WS-2024'],
  organizationName: i % 3 === 0 ? 'Digital Wave Media' : 'Acme Corp',
  priority: PRIORITIES[i % PRIORITIES.length],
  assignees: [ASSIGNEES[i % ASSIGNEES.length]],
  tags: i % 2 === 0 ? ['hardware-failure', 'software-bug', 'urgent'] : undefined,
  ...overrides,
})

const TITLES = [
  'How to install Teams',
  'Disk space critical',
  'VPN connection drops',
  'Two-factor reset',
  'New laptop onboarding',
  'Email rules sync issue',
]

const PRIORITIES: BoardTicket['priority'][] = ['low', 'medium', 'high', 'urgent']

function buildSeedColumns(): BoardColumnDef[] {
  return [
    columnFromTicketStatus('ACTIVE', Array.from({ length: 5 }, (_, i) => baseTicket(i, 'ACTIVE'))),
    columnFromTicketStatus('TECH_REQUIRED', Array.from({ length: 7 }, (_, i) => baseTicket(i, 'TECH_REQUIRED'))),
    columnFromTicketStatus('ON_HOLD', Array.from({ length: 3 }, (_, i) => baseTicket(i, 'ON_HOLD'))),
    columnFromTicketStatus('RESOLVED', Array.from({ length: 4 }, (_, i) => baseTicket(i, 'RESOLVED'))),
    columnFromTicketStatus('ARCHIVED', Array.from({ length: 2 }, (_, i) => baseTicket(i, 'ARCHIVED'))),
  ]
}

// ---------------------------------------------------------------------------
// Helpers — apply BoardChange immutably to columns
// ---------------------------------------------------------------------------

function applyChange(columns: BoardColumnDef[], change: BoardChange): BoardColumnDef[] {
  const next = columns.map(c => ({ ...c, tickets: [...c.tickets] }))
  const fromCol = next.find(c => c.id === change.fromColumnId)
  const toCol = next.find(c => c.id === change.toColumnId)
  if (!fromCol || !toCol) return columns

  const fromIndex = fromCol.tickets.findIndex(t => t.id === change.ticketId)
  if (fromIndex < 0) return columns
  const [moved] = fromCol.tickets.splice(fromIndex, 1)

  let insertAt: number
  if (change.afterTicketId) {
    insertAt = toCol.tickets.findIndex(t => t.id === change.afterTicketId) + 1
  } else if (change.beforeTicketId) {
    insertAt = toCol.tickets.findIndex(t => t.id === change.beforeTicketId)
  } else {
    insertAt = 0
  }
  toCol.tickets.splice(insertAt, 0, moved)
  return next
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Five canonical-status columns with seeded tickets and full DnD wired up. */
export const Default: Story = {
  render: function Render() {
    const [columns, setColumns] = React.useState(buildSeedColumns())
    return (
      <div className="h-[80vh] bg-ods-bg">
        <Board
          columns={columns}
          onChange={c => setColumns(prev => applyChange(prev, c))}
          onTicketClick={id => console.log('click', id)}
          onAddTicket={id => console.log('add to', id)}
        />
      </div>
    )
  },
}

/**
 * Mixed system + custom columns matching the OpenFrame Tickets layout:
 * AI-Assistance and Tech Required are system columns (default surface, joined
 * with no gap), middle columns are custom (tinted by color), Resolved is a
 * system column whose `RESOLVED` status gives the green-checkmark tag.
 *
 * DnD restrictions: AI-Assistance refuses drops (tickets enter via the AI
 * pipeline, not by dragging), but tickets in it can still be dragged out.
 * Resolved tickets are pinned (`dragDisabled`).
 */
export const SystemAndCustom: Story = {
  render: function Render() {
    const [columns, setColumns] = React.useState<BoardColumnDef[]>([
      {
        id: 'ai-assistance',
        label: 'AI-Assistance',
        color: '#f357bb',
        system: true,
        dropDisabled: true,
        tickets: Array.from({ length: 4 }, (_, i) => baseTicket(i, 'AI_ASSISTANCE')),
      },
      columnFromTicketStatus('TECH_REQUIRED', Array.from({ length: 5 }, (_, i) => baseTicket(i, 'TECH_REQUIRED')), {
        system: true,
      }),
      {
        id: 'todo',
        label: 'TODO',
        color: '#2890fa',
        tickets: Array.from({ length: 3 }, (_, i) => baseTicket(i, 'TODO')),
      },
      {
        id: 'working',
        label: 'Working',
        color: '#5ea62e',
        tickets: Array.from({ length: 4 }, (_, i) => baseTicket(i, 'WORKING')),
      },
      {
        id: 'for-review',
        label: 'For Review',
        color: '#e1832f',
        tickets: Array.from({ length: 2 }, (_, i) => baseTicket(i, 'FOR_REVIEW')),
      },
      {
        id: 'testing',
        label: 'Testing',
        color: '#c14de1',
        tickets: Array.from({ length: 3 }, (_, i) => baseTicket(i, 'TESTING')),
      },
      columnFromTicketStatus('RESOLVED', Array.from({ length: 6 }, (_, i) => baseTicket(i, 'RESOLVED')), {
        system: true,
        dragDisabled: true,
      }),
    ])
    return (
      <div className="h-[80vh] bg-ods-bg">
        <Board columns={columns} onChange={c => setColumns(prev => applyChange(prev, c))} />
      </div>
    )
  },
}

/** Custom columns ("Backlog", "In Review", "Blocked", "Done") proving column color is decoupled from TicketStatus. */
export const CustomColumns: Story = {
  render: function Render() {
    const [columns, setColumns] = React.useState<BoardColumnDef[]>([
      {
        id: 'backlog',
        label: 'Backlog',
        color: '#2890fa',
        tickets: Array.from({ length: 4 }, (_, i) => baseTicket(i, 'BACKLOG')),
      },
      {
        id: 'in-review',
        label: 'In Review',
        color: '#c14de1',
        tickets: Array.from({ length: 3 }, (_, i) => baseTicket(i, 'IN_REVIEW')),
      },
      {
        id: 'blocked',
        label: 'Blocked',
        color: '#f36666',
        tickets: Array.from({ length: 2 }, (_, i) => baseTicket(i, 'BLOCKED')),
      },
      {
        id: 'done',
        label: 'Done',
        color: '#888888',
        tickets: Array.from({ length: 5 }, (_, i) => baseTicket(i, 'DONE')),
      },
    ])
    return (
      <div className="h-[80vh] bg-ods-bg">
        <Board columns={columns} onChange={c => setColumns(prev => applyChange(prev, c))} />
      </div>
    )
  },
}

/** Third column starts collapsed; toggle persists via in-memory state. */
export const Collapsible: Story = {
  render: function Render() {
    const [columns, setColumns] = React.useState(buildSeedColumns())
    return (
      <div className="h-[80vh] bg-ods-bg">
        <Board
          columns={columns}
          collapseStorageKey="storybook-board-collapse-demo"
          onChange={c => setColumns(prev => applyChange(prev, c))}
        />
        <p className="px-4 pt-2 text-h6 text-ods-text-secondary">
          Click the chevron in any column header to collapse. State persists to localStorage.
        </p>
      </div>
    )
  },
}

/** One column starts with 10 of 50; onLoadMore appends 10 more after a 600ms delay. */
export const Pagination: Story = {
  render: function Render() {
    const TOTAL = 50
    const PAGE = 10
    const allTickets = Array.from({ length: TOTAL }, (_, i) => baseTicket(i, 'ACTIVE'))

    const [columns, setColumns] = React.useState<BoardColumnDef[]>([
      columnFromTicketStatus('ACTIVE', allTickets.slice(0, PAGE), { total: TOTAL, hasMore: true }),
      columnFromTicketStatus('TECH_REQUIRED', Array.from({ length: 4 }, (_, i) => baseTicket(i, 'TECH_REQUIRED'))),
      columnFromTicketStatus('RESOLVED', Array.from({ length: 2 }, (_, i) => baseTicket(i, 'RESOLVED'))),
    ])

    const handleLoadMore = (columnId: string) => {
      setColumns(prev => prev.map(c => (c.id === columnId ? { ...c, isLoadingMore: true } : c)))
      setTimeout(() => {
        setColumns(prev =>
          prev.map(c => {
            if (c.id !== columnId) return c
            const nextTickets = allTickets.slice(0, c.tickets.length + PAGE)
            const hasMore = nextTickets.length < TOTAL
            return { ...c, tickets: nextTickets, hasMore, isLoadingMore: false }
          }),
        )
      }, 600)
    }

    return (
      <div className="h-[80vh] bg-ods-bg">
        <Board
          columns={columns}
          onChange={c => setColumns(prev => applyChange(prev, c))}
          onLoadMore={handleLoadMore}
        />
      </div>
    )
  },
}

/** Empty columns to verify the drop placeholder. */
export const Empty: Story = {
  render: function Render() {
    const [columns, setColumns] = React.useState<BoardColumnDef[]>(
      groupTicketsByStatus([], ['ACTIVE', 'TECH_REQUIRED', 'RESOLVED']),
    )
    return (
      <div className="h-[80vh] bg-ods-bg">
        <Board columns={columns} onChange={c => setColumns(prev => applyChange(prev, c))} />
      </div>
    )
  },
}
