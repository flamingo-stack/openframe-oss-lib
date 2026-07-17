/**
 * Regression guard for `displayApprovalTypes` semantics in the history
 * processors. An OMITTED option must render EVERY approval type inline —
 * consumers (tickets/mingo admin surfaces) that pass a wider list to their
 * realtime processor but omit it on the history path relied on this, and a
 * silent `['CLIENT']` default made their pending ADMIN approval cards vanish
 * on every reload/reconnect refetch. Parity with realtime is opt-in via an
 * explicit list.
 */

import { describe, it, expect } from 'vitest'
import { processHistoricalMessagesWithErrors } from '../process-historical-messages'
import type { HistoricalMessage, MessageSegment } from '../../types'

const adminApprovalMessage = (id: string): HistoricalMessage => ({
  id,
  createdAt: '2026-07-17T12:00:00Z',
  owner: { type: 'ASSISTANT' },
  messageData: [
    {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: `req-${id}`,
      approvalType: 'ADMIN',
      command: 'systemctl restart nats',
    },
  ],
})

const approvalSegments = (segments: MessageSegment[] | string | undefined) =>
  Array.isArray(segments)
    ? segments.filter((s) => s.type === 'approval_request' || s.type === 'approval_batch')
    : []

describe('processHistoricalMessagesWithErrors — displayApprovalTypes', () => {
  it('renders non-CLIENT approvals inline when the option is OMITTED', () => {
    const { messages, escalatedApprovals } = processHistoricalMessagesWithErrors([
      adminApprovalMessage('m1'),
    ])
    const rendered = messages.flatMap((m) => approvalSegments(m.content))
    expect(rendered).toHaveLength(1)
    expect(escalatedApprovals.size).toBe(0)
  })

  it('escalates (does not render) approval types excluded by an explicit list', () => {
    const { messages, escalatedApprovals } = processHistoricalMessagesWithErrors(
      [adminApprovalMessage('m1')],
      { displayApprovalTypes: ['CLIENT'] },
    )
    const rendered = messages.flatMap((m) => approvalSegments(m.content))
    expect(rendered).toHaveLength(0)
    expect(escalatedApprovals.has('req-m1')).toBe(true)
  })

  it('renders approval types included by an explicit list', () => {
    const { messages } = processHistoricalMessagesWithErrors(
      [adminApprovalMessage('m1')],
      { displayApprovalTypes: ['CLIENT', 'ADMIN'] },
    )
    const rendered = messages.flatMap((m) => approvalSegments(m.content))
    expect(rendered).toHaveLength(1)
  })
})
