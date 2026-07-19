/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS — `useRealtimeChunkProcessor`.
 *
 * Pins the hook's callback contract before the stream-reader unification:
 * every recorded chunk sequence is fed through `processChunk` and EVERY
 * callback invocation is appended to an event log, which is snapshotted.
 * The log (order + payloads) is the recorded baseline the future reducer
 * must reproduce.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRealtimeChunkProcessor } from '../use-realtime-chunk-processor'
import type {
  UseRealtimeChunkProcessorOptions,
  RealtimeChunkCallbacks,
} from '../../types'

type EventLog = Array<Record<string, unknown>>

/** Build a full callback set that records every invocation into `log`. */
function makeRecordingCallbacks(log: EventLog): RealtimeChunkCallbacks {
  return {
    onStreamStart: () => log.push({ event: 'onStreamStart' }),
    onStreamEnd: () => log.push({ event: 'onStreamEnd' }),
    onMetadata: (metadata) => log.push({ event: 'onMetadata', metadata }),
    onSegmentsUpdate: (segments, metadata) =>
      log.push({ event: 'onSegmentsUpdate', segments, metadata }),
    onError: (error, details) => log.push({ event: 'onError', error, details }),
    onUserMessage: (text, metadata) => log.push({ event: 'onUserMessage', text, metadata }),
    onTokenUsage: (data) => log.push({ event: 'onTokenUsage', data }),
    onDirectMessage: (text, metadata) => log.push({ event: 'onDirectMessage', text, metadata }),
    onSystemMessage: (text, metadata) => log.push({ event: 'onSystemMessage', text, metadata }),
    onApprove: async () => log.push({ event: 'onApprove' }),
    onReject: async () => log.push({ event: 'onReject' }),
    onEscalatedApproval: (requestId, data) =>
      log.push({ event: 'onEscalatedApproval', requestId, data }),
    onEscalatedApprovalResult: (requestId, approved, data) =>
      log.push({ event: 'onEscalatedApprovalResult', requestId, approved, data }),
    onApprovalResolved: (requestId, status, approvalType, resolvedByName) =>
      log.push({ event: 'onApprovalResolved', requestId, status, approvalType, resolvedByName }),
    onToolExecuted: (segment) => log.push({ event: 'onToolExecuted', segment }),
    onAgentBusy: () => log.push({ event: 'onAgentBusy' }),
    onDialogClosed: () => log.push({ event: 'onDialogClosed' }),
  }
}

function setup(options?: Partial<UseRealtimeChunkProcessorOptions>) {
  const log: EventLog = []
  const callbacks = makeRecordingCallbacks(log)
  const hook = renderHook(() =>
    useRealtimeChunkProcessor({ callbacks, ...options }),
  )
  const feed = (chunks: unknown[]) => {
    act(() => {
      for (const chunk of chunks) hook.result.current.processChunk(chunk)
    })
  }
  return { log, hook, feed }
}

const EXECUTING = {
  type: 'EXECUTING_TOOL',
  integratedToolType: 'TACTICAL_RMM',
  toolFunction: 'run_script',
  title: 'Run cleanup script',
  parameters: { script: 'cleanup.sh' },
  toolExecutionRequestId: 'exec-1',
}
const EXECUTED = {
  type: 'EXECUTED_TOOL',
  integratedToolType: 'TACTICAL_RMM',
  toolFunction: 'run_script',
  result: 'Freed 2.3 GB',
  success: true,
  toolExecutionRequestId: 'exec-1',
}

describe('useRealtimeChunkProcessor — golden event logs', () => {
  it('normal turn: start → metadata → text ×3 → token usage → end', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'AI_METADATA',
        modelDisplayName: 'Claude Sonnet',
        modelName: 'claude-sonnet-x',
        providerName: 'anthropic',
        contextWindow: 200000,
      },
      { type: 'TEXT', text: 'Hello' },
      { type: 'TEXT', text: ', ' },
      { type: 'TEXT', text: 'world' },
      {
        type: 'TOKEN_USAGE',
        inputTokensSize: 100,
        outputTokensSize: 20,
        totalTokensSize: 120,
        contextSize: 180000,
      },
      { type: 'MESSAGE_END' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('streamSeq on content chunks is threaded into onSegmentsUpdate metadata', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'seq-stamped', streamSeq: 7 },
      { type: 'MESSAGE_END' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('cold start (no MESSAGE_START ever): text emits CUMULATIVE segments (no append flag)', () => {
    const { log, feed } = setup()
    feed([
      { type: 'TEXT', text: 'cold ' },
      { type: 'TEXT', text: 'start' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('post-MESSAGE_END continuation: text/thinking emit DELTA segments with append:true', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'in-stream' },
      { type: 'MESSAGE_END' },
      { type: 'TEXT', text: 'post-end text' },
      { type: 'THINKING', text: 'post-end thinking' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('tool execution OUTSIDE a message window: onAgentBusy + cross-message onToolExecuted (accumulator skipped)', () => {
    const { log, feed } = setup()
    // No MESSAGE_START — approved commands execute between the approval
    // bubble's MESSAGE_END and the continuation stream.
    feed([EXECUTING, EXECUTED])
    expect(log).toMatchSnapshot()
  })

  it('tool execution IN-stream: accumulator-driven segment updates, onToolExecuted NOT fired', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'Running now. ' },
      EXECUTING,
      EXECUTED,
      { type: 'MESSAGE_END' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('approval request (displayed) → approval result: in-message flip + onApprovalResolved', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        command: 'systemctl restart nats',
        explanation: 'Restart the broker',
      },
      { type: 'MESSAGE_END' },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-1',
        approved: true,
        approvalType: 'CLIENT',
        displayName: 'Jane Admin',
      },
    ])
    // CHARACTERIZATION: because onApprovalResolved IS wired, the result
    // does NOT emit onSegmentsUpdate — only the cross-message callback.
    expect(log).toMatchSnapshot()
  })

  it('approval result WITHOUT onApprovalResolved wired: emits cumulative onSegmentsUpdate instead', () => {
    const log: EventLog = []
    const callbacks = makeRecordingCallbacks(log)
    delete callbacks.onApprovalResolved
    const { result } = renderHook(() => useRealtimeChunkProcessor({ callbacks }))
    act(() => {
      result.current.processChunk({ type: 'MESSAGE_START' })
      result.current.processChunk({
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        command: 'reboot',
      })
      result.current.processChunk({
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-1',
        approved: false,
        approvalType: 'CLIENT',
      })
    })
    expect(log).toMatchSnapshot()
  })

  it('escalated approval (type not displayed) → onEscalatedApproval, then result appends resolved card', () => {
    const { log, feed, hook } = setup() // displayApprovalTypes defaults to ['CLIENT']
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-adm',
        approvalType: 'ADMIN',
        command: 'drop database prod',
      },
      { type: 'MESSAGE_END' },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-adm',
        approved: true,
        approvalType: 'ADMIN',
      },
    ])
    expect({ log, pendingAfter: Array.from(hook.result.current.getPendingApprovals().entries()) }).toMatchSnapshot()
  })

  it('batch approval (batchApprovalsEnabled default ON): one batch segment, executions merge into it', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'batch-1',
        approvalType: 'CLIENT',
        toolCalls: [
          {
            toolExecutionRequestId: 'exec-a',
            toolName: 'create_ticket',
            toolTitle: 'Create ticket',
            requiresApproval: true,
            approvalType: 'CLIENT',
            toolCallArguments: { subject: 'Printer down' },
          },
          {
            toolExecutionRequestId: 'exec-b',
            toolName: 'read_kb',
            requiresApproval: false,
          },
        ],
      },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'batch-1',
        approved: true,
        displayName: 'Alice Client',
      },
      {
        type: 'EXECUTING_TOOL',
        integratedToolType: 'PSA',
        toolFunction: 'create_ticket',
        toolExecutionRequestId: 'exec-a',
      },
      {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'PSA',
        toolFunction: 'create_ticket',
        result: 'Ticket #77 created',
        success: true,
        toolExecutionRequestId: 'exec-a',
      },
      { type: 'MESSAGE_END' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('batch approval with batchApprovalsEnabled:false unfolds into legacy cards (requiresApproval only)', () => {
    const { log, feed } = setup({ batchApprovalsEnabled: false })
    feed([
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'batch-1',
        approvalType: 'CLIENT',
        toolCalls: [
          {
            toolExecutionRequestId: 'exec-a',
            toolName: 'create_ticket',
            toolTitle: 'Create ticket',
            requiresApproval: true,
            toolCallArguments: { subject: 'Printer down' },
          },
          {
            toolExecutionRequestId: 'exec-b',
            toolName: 'read_kb',
            requiresApproval: false,
          },
        ],
      },
      { type: 'MESSAGE_END' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('CHARACTERIZATION duplicate/out-of-order: redelivered EXECUTING after EXECUTED in-stream appends a NEW executing segment (no dedup)', () => {
    // The hook itself does no duplicate suppression for standalone tool
    // segments — dedup only exists inside approval batches (no-downgrade
    // rule). Recording actual behavior, see unification plan.
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      EXECUTING,
      EXECUTED,
      EXECUTING, // redelivered
      { type: 'MESSAGE_END' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('error chunk: segment append + onError with JSON-extracted message', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'partial' },
      { type: 'ERROR', error: 'Agent crashed', details: '{"error":{"message":"boom"}}' },
      { type: 'ERROR', error: 'Plain details', details: 'not-json' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('user echo / system / direct-message / dialog-closed routing', () => {
    const { log, feed } = setup()
    feed([
      {
        type: 'MESSAGE_REQUEST',
        text: 'open a ticket',
        ownerType: 'CLIENT',
        displayName: 'Alice',
        userId: 'user-42',
        streamSeq: 3,
        contextItems: [{ type: 'device', id: 'dev-1' }],
      },
      { type: 'SYSTEM', text: 'User joined the chat', streamSeq: 4 },
      {
        type: 'DIRECT_MESSAGE',
        text: 'Human here now',
        ownerType: 'ADMIN',
        displayName: 'Jane Admin',
        userId: 'admin-7',
        streamSeq: 5,
      },
      { type: 'DIALOG_CLOSED' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('direct-mode barrier: after a DIRECT_MESSAGE, AI chunks are dropped with a one-shot teardown', () => {
    const { log, feed } = setup()
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'ai text before takeover' },
      { type: 'DIRECT_MESSAGE', text: 'Human takeover', ownerType: 'ADMIN' },
      // AI chunks now dropped; first one triggers the teardown (onStreamEnd).
      { type: 'TEXT', text: 'dropped ai text' },
      { type: 'TEXT', text: 'also dropped' },
      // Allowlisted chunks still flow.
      { type: 'SYSTEM', text: 'still visible' },
      { type: 'DIRECT_MESSAGE', text: 'second human message' },
    ])
    expect(log).toMatchSnapshot()
  })

  it('context compaction outside a stream emits append+isCompacting metadata; inside a stream it is cumulative', () => {
    const { log, feed } = setup()
    feed([
      // standalone (no open stream)
      { type: 'CONTEXT_COMPACTION_START' },
      { type: 'CONTEXT_COMPACTION_END', text: 'Summarized 12 messages' },
    ])
    const standaloneLog = [...log]
    log.length = 0
    feed([
      { type: 'MESSAGE_START' },
      { type: 'CONTEXT_COMPACTION_START' },
      { type: 'CONTEXT_COMPACTION_END', text: 'Mid-stream summary' },
      { type: 'MESSAGE_END' },
    ])
    expect({ standalone: standaloneLog, inStream: log }).toMatchSnapshot()
  })

  it('reset() clears accumulator + stream flags so the next dialog cold-starts cumulative', () => {
    const { log, feed, hook } = setup()
    feed([
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'dialog one' },
      { type: 'MESSAGE_END' },
    ])
    act(() => hook.result.current.reset())
    log.length = 0
    feed([{ type: 'TEXT', text: 'dialog two cold start' }])
    expect(log).toMatchSnapshot()
  })

  it('initialState resume: continuation chunks after resume take the post-stream append path', () => {
    const log: EventLog = []
    const callbacks = makeRecordingCallbacks(log)
    renderHook(() =>
      useRealtimeChunkProcessor({
        callbacks,
        initialState: {
          existingSegments: [{ type: 'text', text: 'restored partial ' }],
          escalatedApprovals: new Map([
            ['req-esc', { command: 'escalated cmd', approvalType: 'ADMIN' }],
          ]),
        },
      }),
    )
    // initializeWithState replays escalated approvals via onEscalatedApproval
    // (from the useEffect) and marks hasEverStreamed=true.
    expect(log).toMatchSnapshot()
  })
})
