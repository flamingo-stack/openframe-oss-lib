import { describe, expect, it } from 'vitest'
import type { MessageSegment, ProcessedMessage } from '../../types'
import { extractIncompleteTailState } from '../extract-incomplete-message-state'

/**
 * `agentBusy` is the restore-time counterpart of a live `onAgentBusy`: after a
 * reload nothing on the wire re-establishes the activity indicator, so it has
 * to be derived from the persisted tail. The distinction it draws is the whole
 * point — an unfinished turn can be unfinished because the AGENT is working, or
 * because it is BLOCKED ON THE USER, and only the first should spin.
 */

const assistant = (content: MessageSegment[]): ProcessedMessage =>
  ({ id: 'a1', role: 'assistant', content }) as unknown as ProcessedMessage

const user = (): ProcessedMessage => ({ id: 'u1', role: 'user', content: 'go' }) as unknown as ProcessedMessage

const batch = (
  status: string | undefined,
  executions?: Record<string, { status: string }>,
): MessageSegment =>
  ({
    type: 'approval_batch',
    status,
    data: {
      approvalRequestId: 'req-1',
      toolCalls: [{ toolExecutionRequestId: 'exec-1' }, { toolExecutionRequestId: 'exec-2' }],
      executions,
    },
  }) as unknown as MessageSegment

const request = (status: string | undefined): MessageSegment =>
  ({
    type: 'approval_request',
    status,
    data: { requestId: 'req-2', command: 'rm -rf /tmp/cache', approvalType: 'CLIENT' },
  }) as unknown as MessageSegment

const executing = (): MessageSegment =>
  ({
    type: 'tool_execution',
    data: {
      type: 'EXECUTING_TOOL',
      integratedToolType: 'openframe',
      toolFunction: 'search_machines',
      toolExecutionRequestId: 'exec-9',
    },
  }) as unknown as MessageSegment

describe('extractIncompleteTailState → agentBusy', () => {
  it('is set for an APPROVED batch whose tool calls are still running', () => {
    // The reported case: the operator approves a batch, reloads, and the thread
    // renders as if nothing were happening. A batch records its runs INSIDE the
    // segment, so `executingTools` is empty here — gating the indicator on that
    // map missed the entire approval path.
    const extras = extractIncompleteTailState([user(), assistant([batch('approved')])])
    expect(extras?.agentBusy).toBe(true)
  })

  it('is NOT set while the batch is still awaiting the user', () => {
    const extras = extractIncompleteTailState([user(), assistant([batch('pending')])])
    expect(extras).toBeDefined()
    expect(extras?.agentBusy).toBeUndefined()
  })

  it('is NOT set once every call in the batch is done', () => {
    const extras = extractIncompleteTailState([
      user(),
      assistant([batch('approved', { 'exec-1': { status: 'done' }, 'exec-2': { status: 'done' } })]),
    ])
    expect(extras?.agentBusy).toBeUndefined()
  })

  it('is set for a trailing APPROVED single request (nothing produced since)', () => {
    const extras = extractIncompleteTailState([user(), assistant([request('approved')])])
    expect(extras?.agentBusy).toBe(true)
  })

  it('is NOT set when work already followed the approved request', () => {
    // Position is the only signal for a single request: work after it means the
    // agent came back. Here that work is itself finished.
    const extras = extractIncompleteTailState([
      user(),
      assistant([request('approved'), { type: 'text', text: 'done, 2 endpoints online' }]),
    ])
    expect(extras).toBeUndefined()
  })

  it('is set for a tool left mid-flight', () => {
    const extras = extractIncompleteTailState([user(), assistant([executing()])])
    expect(extras?.agentBusy).toBe(true)
  })

  it('is set for an open compaction (the agent’s own work)', () => {
    const extras = extractIncompleteTailState([
      user(),
      assistant([{ type: 'context_compaction', status: 'started' } as unknown as MessageSegment]),
    ])
    expect(extras?.agentBusy).toBe(true)
  })

  it('reports nothing for a finished tail', () => {
    const extras = extractIncompleteTailState([user(), assistant([{ type: 'text', text: 'all good' }])])
    expect(extras).toBeUndefined()
  })
})
