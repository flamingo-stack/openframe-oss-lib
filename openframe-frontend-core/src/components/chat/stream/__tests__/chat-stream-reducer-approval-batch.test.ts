/**
 * Wire-native approval batches on the SSE kernel.
 *
 * The SERVER groups a multi-proposal turn into ONE `approval_batch`
 * frame; the decoder surfaces it as an `approval-request` event
 * carrying `toolCalls` (one row per proposal, row id = proposal id).
 * These tests pin the reducer contracts:
 *
 *   - a batch event renders ONE `approval_batch` segment (no per-
 *     proposal cards, no adjacency heuristics);
 *   - batch onApprove flips status optimistically and resolves EVERY
 *     row sequentially through the per-proposal callback;
 *   - each `approval-resolved` (per proposal id) ticks that row's
 *     execution icon; the anchor row also carries the status flip;
 *   - a single-proposal event keeps the classic `approval_request`
 *     card (editable per-card flow).
 */

import { describe, it, expect, vi } from 'vitest'
import { createChatStreamReducer } from '../chat-stream-reducer'
import { createSseFrameDecoder } from '../../../../chat-protocol/decode'
import type { ApprovalBatchSegment } from '../../types'

const batchEvent = {
  type: 'approval-request' as const,
  requestId: 'prop-1',
  approvalType: 'chat',
  toolCalls: [
    {
      toolExecutionRequestId: 'prop-1',
      toolName: 'delete_clickup_task',
      toolTitle: 'Delete ClickUp task — Fix Website Header',
      requiresApproval: true,
      toolCallArguments: { Task: '86aaa', Title: 'Fix Website Header' },
    },
    {
      toolExecutionRequestId: 'prop-2',
      toolName: 'delete_clickup_task',
      toolTitle: 'Delete ClickUp task — Fix Website Header (2)',
      requiresApproval: true,
      toolCallArguments: { Task: '86bbb', Title: 'Fix Website Header' },
    },
  ],
}

function findBatch(r: ReturnType<typeof createChatStreamReducer>): ApprovalBatchSegment {
  const trailing = r.state.messages[r.state.messages.length - 1]
  const batch = trailing.segments?.find(
    (s): s is ApprovalBatchSegment => s.type === 'approval_batch',
  )
  expect(batch).toBeTruthy()
  return batch as ApprovalBatchSegment
}

describe('SSE kernel — wire-native approval batch', () => {
  it('renders ONE approval_batch segment for a toolCalls event', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: 'delete both', assistantName: 'Mingo AI' })
    r.apply(batchEvent)
    const trailing = r.state.messages[r.state.messages.length - 1]
    expect(
      trailing.segments?.filter((s) => s.type === 'approval_request').length ?? 0,
    ).toBe(0)
    const batch = findBatch(r)
    expect(batch.status).toBe('pending')
    expect(batch.data.approvalRequestId).toBe('prop-1')
    expect(batch.data.toolCalls.map((c) => c.toolExecutionRequestId)).toEqual([
      'prop-1',
      'prop-2',
    ])
  })

  it('onApprove flips status optimistically and resolves every row sequentially', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined)
    const r = createChatStreamReducer({ transport: 'sse', callbacks: { onApprove } })
    r.beginSseSend({ text: 'delete both', assistantName: 'Mingo AI' })
    r.apply(batchEvent)
    const batch = findBatch(r)
    await batch.onApprove?.(batch.data.approvalRequestId)
    expect(onApprove.mock.calls.map((c) => c[0])).toEqual(['prop-1', 'prop-2'])
    expect(findBatch(r).status).toBe('approved')
  })

  it('per-proposal approval-resolved events tick the matching row execution', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: 'delete both', assistantName: 'Mingo AI' })
    r.apply(batchEvent)
    r.apply({ type: 'approval-resolved', requestId: 'prop-2', status: 'approved', ok: true })
    let batch = findBatch(r)
    expect(batch.data.executions?.['prop-2']).toEqual({ status: 'done', success: true })
    expect(batch.data.executions?.['prop-1']).toBeUndefined()
    r.apply({ type: 'approval-resolved', requestId: 'prop-1', status: 'approved', ok: true })
    batch = findBatch(r)
    expect(batch.data.executions?.['prop-1']).toEqual({ status: 'done', success: true })
    // Anchor row also carries the status flip.
    expect(batch.status).toBe('approved')
  })

  it('a single proposal keeps the classic approval_request card', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: 'delete it', assistantName: 'Mingo AI' })
    r.apply({
      type: 'approval-request',
      requestId: 'prop-solo',
      approvalType: 'delete_clickup_task',
      command: 'Delete ClickUp task',
      fields: [{ label: 'Task', value: '86ccc' }],
    })
    const trailing = r.state.messages[r.state.messages.length - 1]
    expect(trailing.segments?.some((s) => s.type === 'approval_batch')).toBe(false)
    expect(trailing.segments?.some((s) => s.type === 'approval_request')).toBe(true)
  })
})

describe('decoder — approval_batch frame mapping', () => {
  it('maps the wire frame to ONE batched approval-request event', () => {
    const frame = {
      kind: 'approval_batch',
      batchId: 'prop-1',
      proposals: [
        {
          proposalId: 'prop-1',
          toolName: 'delete_clickup_task',
          title: 'Delete ClickUp task',
          fields: [
            { label: 'Task', value: '86aaa' },
            { label: 'Title', value: 'Fix Website Header' },
          ],
        },
        {
          proposalId: 'prop-2',
          toolName: 'delete_clickup_task',
          title: 'Delete ClickUp task',
          fields: [{ label: 'Task', value: '86bbb' }],
        },
      ],
    }
    const decoder = createSseFrameDecoder()
    const bytes = new TextEncoder().encode(JSON.stringify(frame) + '\0')
    const events = decoder.push(bytes)
    const approval = events.find((e) => e.type === 'approval-request') as
      | { requestId: string; toolCalls?: Array<Record<string, unknown>> }
      | undefined
    expect(approval).toBeTruthy()
    expect(approval!.requestId).toBe('prop-1')
    expect(approval!.toolCalls?.length).toBe(2)
    expect(approval!.toolCalls?.[0].toolExecutionRequestId).toBe('prop-1')
    // Title field drives the row's disambiguating toolTitle.
    expect(approval!.toolCalls?.[0].toolTitle).toContain('Fix Website Header')
    expect(approval!.toolCalls?.[1].toolExecutionRequestId).toBe('prop-2')
  })
})
