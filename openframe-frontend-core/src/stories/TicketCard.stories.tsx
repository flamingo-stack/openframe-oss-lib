import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import * as React from 'react'
import {
  TicketCard,
  type TicketCardProps,
  type BoardTicket,
} from '../components/features/board'
import type { PendingToolCallData } from '../components/chat/types'

// =============================================================================
// Harness — `TicketCard` calls `useSortable`, which reads from a `DndContext` +
// `SortableContext`. In the app the Board provides these; the story supplies a
// minimal pair (with the card's own id registered) so drag bookkeeping resolves
// without a full board. The card renders on `bg-ods-bg`, so we pad it on the
// darker `bg-ods-card` column surface to keep the border readable.
// =============================================================================

function Harness(args: TicketCardProps) {
  return (
    <DndContext>
      <SortableContext items={[args.ticket.id]}>
        <div className="w-[320px] rounded-lg bg-ods-card p-[var(--spacing-system-sf)]">
          <TicketCard {...args} />
        </div>
      </SortableContext>
    </DndContext>
  )
}

// =============================================================================
// Seed data
// =============================================================================

// ~2h ago so the relative timestamp ("2h ago") reads naturally. Assignees carry
// no `avatarUrl`, so `SquareAvatar` renders initials fallbacks — no external
// image dependency in the story.
const CREATED_AT = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

const ASSIGNEES = [
  { id: 'u1', initials: 'RS', name: 'Rachel Santos' },
  { id: 'u2', initials: 'MP', name: 'Marcus Park' },
  { id: 'u3', initials: 'JD', name: 'Jamie Diaz' },
  { id: 'u4', initials: 'AK', name: 'Aiden Kim' },
  { id: 'u5', initials: 'LN', name: 'Lena Novak' },
]

const BASE_TICKET: BoardTicket = {
  id: 'ticket-1',
  title: 'VPN connection drops every few minutes',
  ticketNumber: '#1042',
  status: 'TECH_REQUIRED',
  deviceHostnames: ['MBP-15'],
  organizationName: 'Acme Corp',
  priority: 'high',
  assignees: [ASSIGNEES[0]],
  tags: ['network', 'vpn'],
  createdAt: CREATED_AT,
}

const APPROVAL_TOOL_CALLS: PendingToolCallData[] = [
  {
    toolExecutionRequestId: 'req-1',
    toolName: 'run_script',
    toolTitle: 'Reset local admin password policy',
    toolExplanation:
      'Runs a PowerShell remediation on SRV-MAIL-01 to enforce the password policy.',
    toolType: 'TACTICAL',
    requiresApproval: true,
    approvalType: 'CLIENT',
    toolCallArguments: {
      script:
        'Get-LocalUser | Where-Object { $_.PasswordRequired -eq $false } | Set-LocalUser -PasswordNeverExpires $false',
    },
  },
]

// =============================================================================
// Meta
// =============================================================================

const meta: Meta<typeof TicketCard> = {
  title: 'Features/Board/TicketCard',
  component: TicketCard,
  parameters: { layout: 'centered' },
  render: (args) => <Harness {...args} />,
  args: {
    ticket: BASE_TICKET,
    columnId: 'TECH_REQUIRED',
  },
}

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// Stories
// =============================================================================

/** Full card: title, device/org row, priority flag, one assignee, tags, timestamp. */
export const Default: Story = {}

/** Bare minimum — only the required fields, so every optional row is absent. */
export const Minimal: Story = {
  args: {
    ticket: {
      id: 'ticket-min',
      title: 'How to install Teams',
      ticketNumber: '#1001',
      status: 'ACTIVE',
    },
  },
}

/** Long title truncates to one line; long device/org row truncates too. */
export const LongContent: Story = {
  args: {
    ticket: {
      ...BASE_TICKET,
      id: 'ticket-long',
      title:
        'Outlook keeps prompting for credentials after the latest Microsoft 365 update rollout across the whole org',
      deviceHostnames: ['WS-2024-FINANCE-07', 'MBP-15-DESIGN', 'SRV-MAIL-01'],
      organizationName: 'Digital Wave Media Group International',
    },
  },
}

/** Assignee overflow (+N badge) and tag overflow (+N pill). */
export const ManyAssigneesAndTags: Story = {
  args: {
    ticket: {
      ...BASE_TICKET,
      id: 'ticket-many',
      assignees: ASSIGNEES,
      tags: ['hardware-failure', 'software-bug', 'urgent', 'escalated'],
    },
  },
}

/**
 * `hasNewMessage` + `columnColor` renders the colored "New Message" tag and
 * tints the card border with the column color (readable text auto-derived).
 */
export const WithNewMessage: Story = {
  args: {
    ticket: { ...BASE_TICKET, id: 'ticket-new-msg', hasNewMessage: true },
    columnColor: '#2890fa',
  },
}

/**
 * Pending CLIENT approval — collapsed grey "Pending client approval" row with a
 * loader glyph. Expand it to reach the shared approve/reject affordance.
 */
export const PendingClientApproval: Story = {
  args: {
    ticket: {
      ...BASE_TICKET,
      id: 'ticket-approval-client',
      pendingApproval: {
        id: 'appr-1',
        approvalType: 'CLIENT',
        toolCalls: APPROVAL_TOOL_CALLS,
      },
    },
    onApprove: (ticketId, requestId) =>
      console.log('[story] approve', { ticketId, requestId }),
    onReject: (ticketId, requestId) =>
      console.log('[story] reject', { ticketId, requestId }),
  },
}

/** Pending ADMIN approval — yellow shield "Technician approval required" header. */
export const PendingTechApproval: Story = {
  args: {
    ticket: {
      ...BASE_TICKET,
      id: 'ticket-approval-admin',
      pendingApproval: {
        id: 'appr-2',
        approvalType: 'ADMIN',
        toolCalls: APPROVAL_TOOL_CALLS,
      },
    },
    onApprove: (ticketId, requestId) =>
      console.log('[story] approve', { ticketId, requestId }),
    onReject: (ticketId, requestId) =>
      console.log('[story] reject', { ticketId, requestId }),
  },
}

/** `href` set — the whole card is a link (Link anchor overlays the surface). */
export const AsLink: Story = {
  args: {
    ticket: { ...BASE_TICKET, id: 'ticket-link' },
    href: '#ticket-1042',
  },
}

/** `dragDisabled` — the card is pinned (no grab cursor, sortable listeners off). */
export const DragDisabled: Story = {
  args: {
    ticket: { ...BASE_TICKET, id: 'ticket-pinned' },
    dragDisabled: true,
  },
}

/** `isOverlay` — the drag-overlay presentation (tilted + elevated shadow). */
export const DragOverlay: Story = {
  args: {
    ticket: { ...BASE_TICKET, id: 'ticket-overlay' },
    isOverlay: true,
  },
}

/** All four priority flag colors side by side. */
export const Priorities: Story = {
  render: () => {
    const priorities: BoardTicket['priority'][] = ['low', 'medium', 'high', 'urgent']
    return (
      <DndContext>
        <SortableContext items={priorities.map((p) => `ticket-prio-${p}`)}>
          <div className="flex w-[320px] flex-col gap-[var(--spacing-system-sf)] rounded-lg bg-ods-card p-[var(--spacing-system-sf)]">
            {priorities.map((p) => (
              <TicketCard
                key={p}
                columnId="ACTIVE"
                ticket={{
                  ...BASE_TICKET,
                  id: `ticket-prio-${p}`,
                  title: `${p![0].toUpperCase()}${p!.slice(1)} priority ticket`,
                  priority: p,
                  tags: undefined,
                  assignees: undefined,
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    )
  },
}
