/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS — `MessageSegmentAccumulator`.
 *
 * Pins the CURRENT segment-accumulation semantics before the stream-reader
 * unification. Each test drives the accumulator through a recorded event
 * sequence and snapshots the final segment array. Behaviors captured here
 * (including the implicit approval-flip on tool execution and the batch
 * no-downgrade rule) are the recorded baseline the future reducer must match.
 */

import { describe, it, expect } from 'vitest'
import { createMessageSegmentAccumulator } from '../message-segment-accumulator'
import type { ToolExecutionSegment, PendingToolCallData } from '../../types'

const executing = (
  execId: string | undefined,
  overrides: Partial<ToolExecutionSegment['data']> = {},
): ToolExecutionSegment => ({
  type: 'tool_execution',
  data: {
    type: 'EXECUTING_TOOL',
    integratedToolType: 'TACTICAL_RMM',
    toolFunction: 'run_script',
    toolTitle: 'Run cleanup script',
    parameters: { script: 'cleanup.sh' },
    ...(execId ? { toolExecutionRequestId: execId } : {}),
    ...overrides,
  },
})

const executed = (
  execId: string | undefined,
  overrides: Partial<ToolExecutionSegment['data']> = {},
): ToolExecutionSegment => ({
  type: 'tool_execution',
  data: {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'TACTICAL_RMM',
    toolFunction: 'run_script',
    // Backend omits toolTitle on EXECUTED_TOOL — the accumulator restores it.
    result: 'Freed 2.3 GB',
    success: true,
    ...(execId ? { toolExecutionRequestId: execId } : {}),
    ...overrides,
  },
})

const batchToolCalls: PendingToolCallData[] = [
  {
    toolExecutionRequestId: 'exec-a',
    toolName: 'create_ticket',
    toolTitle: 'Create ticket',
    toolExplanation: 'Opens a support ticket',
    requiresApproval: true,
    approvalType: 'CLIENT',
    toolCallArguments: { subject: 'Printer down' },
  },
  {
    toolExecutionRequestId: 'exec-b',
    toolName: 'read_kb',
    requiresApproval: false,
    approvalType: null,
    toolCallArguments: null,
  },
]

describe('MessageSegmentAccumulator — golden sequences', () => {
  it('coalesces consecutive text deltas into one text segment', () => {
    const acc = createMessageSegmentAccumulator()
    acc.appendText('Hello')
    acc.appendText(', ')
    acc.appendText('world')
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('coalesces thinking deltas, and text after thinking starts a NEW segment', () => {
    const acc = createMessageSegmentAccumulator()
    acc.appendThinking('Let me think')
    acc.appendThinking('… ok.')
    acc.appendText('Answer: ')
    acc.appendText('42')
    // A late thinking delta after text starts ANOTHER thinking segment
    // (append-to-last only merges into a trailing segment of the same type).
    acc.appendThinking('post-answer thought')
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('merges EXECUTING_TOOL → EXECUTED_TOOL in place by toolExecutionRequestId (title restored)', () => {
    const acc = createMessageSegmentAccumulator()
    acc.appendText('Running a cleanup now.')
    acc.addToolExecution(executing('exec-1'))
    acc.addToolExecution(executed('exec-1'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('pairs by (integratedToolType, toolFunction) when no exec id is present (older backends)', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addToolExecution(executing(undefined))
    acc.addToolExecution(executed(undefined))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('EXECUTED with no prior EXECUTING lands as a standalone completed segment', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addToolExecution(executed('exec-orphan'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('CHARACTERIZATION: a LATE standalone EXECUTING after its EXECUTED pushes a NEW executing segment (no in-place downgrade, but a duplicate card appears)', () => {
    // The no-downgrade rule is enforced INSIDE approval batches
    // (applyExecutionToBatch); for standalone segments a redelivered
    // EXECUTING after EXECUTED does NOT downgrade the merged segment —
    // it appends a fresh EXECUTING segment. Recording as-is, see
    // unification plan.
    const acc = createMessageSegmentAccumulator()
    acc.addToolExecution(executing('exec-1'))
    acc.addToolExecution(executed('exec-1'))
    acc.addToolExecution(executing('exec-1'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('single approval request → updateApprovalStatus flips status and stamps resolvedByName only on batches', () => {
    const acc = createMessageSegmentAccumulator({
      onApprove: async () => {},
      onReject: async () => {},
    })
    acc.addApprovalRequest('req-1', 'systemctl restart nats', 'Restart broker', 'CLIENT')
    acc.updateApprovalStatus('req-1', 'approved', 'Jane Admin')
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('tracked (pending) approval + processApprovalResult appends a resolved segment', () => {
    const acc = createMessageSegmentAccumulator()
    acc.trackApprovalRequest('req-2', {
      command: 'rm -rf /tmp/cache',
      explanation: 'Clear caches',
      approvalType: 'CLIENT',
    })
    const result = acc.processApprovalResult('req-2', false, 'CLIENT')
    expect({
      segments: acc.getSegments(),
      pendingData: result?.pendingData ?? null,
      hasPendingAfter: acc.hasPendingApprovals(),
    }).toMatchSnapshot()
  })

  it('batch approval with per-tool executions merged into the batch (no standalone segments)', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addApprovalBatch('batch-1', 'CLIENT', batchToolCalls)
    acc.updateApprovalStatus('batch-1', 'approved', 'Jane Admin')
    // Executions matching the batch's toolExecutionRequestIds merge into
    // `executions` instead of pushing standalone tool_execution segments.
    acc.addToolExecution(executing('exec-a', { toolFunction: 'create_ticket' }))
    acc.addToolExecution(
      executed('exec-a', { toolFunction: 'create_ticket', result: 'Ticket #77 created' }),
    )
    acc.addToolExecution(executing('exec-b', { toolFunction: 'read_kb' }))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('batch no-downgrade rule: a redelivered EXECUTING after EXECUTED keeps the done slot', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addApprovalBatch('batch-1', 'CLIENT', batchToolCalls, 'approved')
    acc.addToolExecution(executed('exec-a', { result: 'done!' }))
    // Late/redelivered EXECUTING for the same exec id — must NOT flip
    // the slot back to 'executing'.
    acc.addToolExecution(executing('exec-a'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('addApprovalBatch upserts by approvalRequestId (replay path produces ONE batch segment)', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addApprovalBatch('batch-1', 'CLIENT', batchToolCalls, 'pending')
    acc.addApprovalBatch('batch-1', 'CLIENT', batchToolCalls, 'approved', {
      'exec-a': { status: 'done', result: 'ok', success: true },
    }, 'Jane Admin')
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('implicit resolvePendingApprovalForExecution: a tool execution flips the LATEST pending single approval (NATS-observer behavior)', () => {
    // An observer (technician mirroring a client chat) may never receive
    // APPROVAL_RESULT — only the tool's EXECUTING/EXECUTED events. The
    // accumulator treats a tool execution as implicit approval of the most
    // recent still-pending single approval gate. Pinning explicitly.
    const acc = createMessageSegmentAccumulator()
    acc.addApprovalRequest('req-old', 'echo old', undefined, 'CLIENT', 'rejected')
    acc.addApprovalRequest('req-1', 'systemctl restart nats', undefined, 'CLIENT', 'pending')
    acc.addToolExecution(executing('exec-9'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('implicit approval flips ONLY the latest pending gate, earlier pending gates stay pending', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addApprovalRequest('req-1', 'first', undefined, 'CLIENT', 'pending')
    acc.addApprovalRequest('req-2', 'second', undefined, 'CLIENT', 'pending')
    acc.addToolExecution(executing('exec-1'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('implicit approval does NOT touch approval_batch segments (handled by applyExecutionToBatch only)', () => {
    const acc = createMessageSegmentAccumulator()
    acc.addApprovalBatch('batch-1', 'CLIENT', batchToolCalls, 'pending')
    // exec id NOT in the batch → standalone segment path; batch stays pending.
    acc.addToolExecution(executing('exec-unrelated'))
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('context compaction start → complete replaces the started segment in place', () => {
    const acc = createMessageSegmentAccumulator()
    acc.appendText('Before compaction')
    acc.addContextCompaction()
    acc.completeContextCompaction('Summarized 34 messages')
    acc.appendText('After compaction')
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('completeContextCompaction with no started segment pushes a completed one', () => {
    const acc = createMessageSegmentAccumulator()
    acc.completeContextCompaction(undefined)
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('error segments append verbatim', () => {
    const acc = createMessageSegmentAccumulator()
    acc.appendText('partial answer')
    acc.addError('Agent crashed', 'boom')
    expect(acc.getSegments()).toMatchSnapshot()
  })

  it('flushPendingApprovals emits pending cards for every tracked-but-unresolved approval', () => {
    const acc = createMessageSegmentAccumulator()
    acc.trackApprovalRequest('req-1', { command: 'cmd-1', approvalType: 'CLIENT' })
    acc.trackApprovalRequest('req-2', { command: 'cmd-2', explanation: 'why', approvalType: 'ADMIN' })
    expect(acc.flushPendingApprovals()).toMatchSnapshot()
  })

  it('replaySegments reproduces a mixed recorded segment array (idempotent replay)', () => {
    const acc = createMessageSegmentAccumulator()
    acc.appendThinking('hmm')
    acc.appendText('Sure — ')
    acc.addToolExecution(executing('exec-1'))
    acc.addToolExecution(executed('exec-1'))
    acc.addApprovalBatch('batch-1', 'CLIENT', batchToolCalls, 'approved', {
      'exec-a': { status: 'done', result: 'ok', success: true },
    })
    acc.appendText('done.')
    const recorded = acc.getSegments()

    const replayed = createMessageSegmentAccumulator().replaySegments(recorded)
    expect(replayed).toMatchSnapshot()
  })

  it('initializeWithState continues an incomplete message across reconnect', () => {
    const first = createMessageSegmentAccumulator()
    first.appendText('partial ')
    first.addToolExecution(executing('exec-1'))
    const state = first.getState()

    const resumed = createMessageSegmentAccumulator()
    resumed.initializeWithState({
      existingSegments: state.segments,
      pendingApprovals: state.pendingApprovals,
      executingTools: state.executingTools,
    })
    // The EXECUTED for the pre-reconnect EXECUTING merges into it.
    resumed.addToolExecution(executed('exec-1'))
    resumed.appendText('and the rest.')
    expect(resumed.getSegments()).toMatchSnapshot()
  })
})
