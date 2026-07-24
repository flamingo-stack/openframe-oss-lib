/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS — `processHistoricalMessages`.
 *
 * Pins the CURRENT GraphQL-history → ProcessedMessage[] transformation
 * before the stream-reader unification. A recorded corpus of messageData
 * rows is processed and the FULL output array is snapshotted.
 *
 * NOTE: `process-historical-messages-approvals.test.ts` already guards
 * displayApprovalTypes semantics — this file deliberately does not
 * duplicate it and instead records the full-output shape.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { processHistoricalMessages, extractErrorMessages, processHistoricalMessagesWithErrors } from '../process-historical-messages'
import type { HistoricalMessage } from '../../types'

// Deterministic Date.now for the `pending-approvals-${Date.now()}` synthetic
// message id + its `new Date()` timestamp.
const FIXED_NOW = new Date('2026-07-20T10:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

/** Recorded corpus — one realistic dialog covering every row shape. */
const CORPUS: HistoricalMessage[] = [
  // 1. User message with contextItems (CLIENT owner).
  {
    id: 'u1',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:00:00Z',
    owner: { type: 'CLIENT', userId: 'user-42' },
    lastChunkStreamSeq: 10,
    messageData: [
      {
        type: 'TEXT',
        text: 'diagnose this device please',
        // wire shape: [{ type, id }] — label falls back to id
        contextItems: [
          { type: 'device', id: 'dev-1' },
          { type: 'bad' }, // missing id → filtered
        ],
      } as any,
    ],
  },
  // 2. Assistant: thinking + text (grouped into one bubble).
  {
    id: 'a1',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:00:05Z',
    owner: { type: 'ASSISTANT', model: 'claude-sonnet-x' },
    lastChunkStreamSeq: 20,
    messageData: [
      { type: 'THINKING', text: 'Checking device state… ' },
      { type: 'THINKING', text: 'looks like disk pressure.' },
      { type: 'TEXT', text: 'The device is low on disk. ' },
    ],
  },
  // 3. Assistant continued: EXECUTING + EXECUTED tool pair merges in place.
  {
    id: 'a2',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:00:10Z',
    owner: { type: 'ASSISTANT' },
    lastChunkStreamSeq: 15, // lower than a1's — MAX (20) must win on the flushed turn
    messageData: [
      {
        type: 'EXECUTING_TOOL',
        integratedToolType: 'TACTICAL_RMM',
        toolFunction: 'run_script',
        title: 'Run cleanup script',
        parameters: { script: 'cleanup.sh' },
        toolExecutionRequestId: 'exec-1',
      },
      {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'TACTICAL_RMM',
        toolFunction: 'run_script',
        parameters: { script: 'cleanup.sh' },
        result: 'Freed 2.3 GB',
        success: true,
        toolExecutionRequestId: 'exec-1',
      },
      { type: 'TEXT', text: 'Cleanup done.' },
    ],
  },
  // 4. ADMIN-owned user message (owner-type author resolution: display name from user).
  {
    id: 'u2',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:01:00Z',
    owner: {
      type: 'ADMIN',
      user: {
        id: 'admin-7',
        firstName: 'Jane',
        lastName: 'Admin',
        image: { imageUrl: '/avatars/jane.png' },
      },
    },
    messageData: [{ type: 'TEXT', text: 'please restart the broker' }],
  },
  // 5. Assistant: single approval request + result (resolved in-history).
  {
    id: 'a3',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:01:05Z',
    owner: { type: 'ASSISTANT' },
    lastChunkStreamSeq: 30,
    messageData: [
      { type: 'TEXT', text: 'I need approval to restart it.' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        command: 'systemctl restart nats',
        explanation: 'Restart the message broker',
      },
      {
        type: 'APPROVAL_RESULT',
        approvalRequestId: 'req-1',
        approved: true,
        approvalType: 'CLIENT',
        resolvedByName: 'Jane Admin',
      },
    ],
  },
  // 6. Assistant: batch approval + per-tool executions merged into the batch.
  {
    id: 'a4',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:02:00Z',
    owner: { type: 'ASSISTANT' },
    messageData: [
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
        resolvedByName: 'Alice Client',
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
    ],
  },
  // 7. Standalone SYSTEM message row — flushes the assistant turn and
  //    renders as a system-authored row.
  {
    id: 's1',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:03:00Z',
    owner: { type: 'ASSISTANT' },
    lastChunkStreamSeq: 40,
    messageData: [{ type: 'SYSTEM', text: 'Technician joined the chat' } as any],
  },
  // 8. DIRECT_MESSAGE row. CHARACTERIZATION: DIRECT_MESSAGE is a
  //    realtime-only concept — the history processors have NO branch for
  //    it. This ADMIN-owned row takes the user-message path, which only
  //    renders TEXT data, so it contributes NOTHING to the output (the
  //    bubble is lost on reload). Recording current behavior as-is; see
  //    unification plan.
  {
    id: 'd1',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:03:30Z',
    owner: { type: 'ADMIN', user: { id: 'admin-7', firstName: 'Jane' } },
    messageData: [{ type: 'DIRECT_MESSAGE', text: 'Human here, taking over' } as any],
  },
  // 9. Error row inside an assistant turn.
  {
    id: 'a5',
    chatType: 'CLIENT_CHAT',
    createdAt: '2026-07-19T09:04:00Z',
    owner: { type: 'ASSISTANT' },
    messageData: [
      { type: 'TEXT', text: 'Attempting one more thing… ' },
      { type: 'ERROR', error: 'Agent crashed', details: '{"error":{"message":"boom"}}' },
    ],
  },
]

describe('processHistoricalMessages — golden corpus', () => {
  it('processes the full recorded dialog (snapshot)', () => {
    const result = processHistoricalMessages(CORPUS, {
      assistantName: 'Mingo AI',
      assistantType: 'mingo',
      assistantAvatar: '/avatars/mingo.png',
    })
    expect({
      messages: result.messages,
      escalatedApprovals: Array.from(result.escalatedApprovals.entries()),
    }).toMatchSnapshot()
  })

  it('unresolved single approval is resurrected as a synthetic pending-approvals bubble', () => {
    const result = processHistoricalMessages([
      {
        id: 'a1',
        createdAt: '2026-07-19T09:00:00Z',
        owner: { type: 'ASSISTANT' },
        messageData: [
          {
            type: 'APPROVAL_REQUEST',
            approvalRequestId: 'req-pending',
            approvalType: 'CLIENT',
            command: 'reboot server',
          },
        ],
      },
    ])
    // Date.now is frozen → deterministic synthetic id.
    expect(result.messages).toMatchSnapshot()
  })

  it('owner-type author resolution: CLIENT vs ADMIN vs ADMIN-without-name display names/avatars', () => {
    const rows: HistoricalMessage[] = [
      {
        id: 'u-client',
        createdAt: '2026-07-19T09:00:00Z',
        owner: { type: 'CLIENT', userId: 'user-1' },
        messageData: [{ type: 'TEXT', text: 'from client' }],
      },
      {
        id: 'u-admin-named',
        createdAt: '2026-07-19T09:00:01Z',
        owner: {
          type: 'ADMIN',
          user: { id: 'adm', firstName: 'Jane', lastName: 'Admin', image: { imageUrl: '/a.png' } },
        },
        messageData: [{ type: 'TEXT', text: 'from named admin' }],
      },
      {
        id: 'u-admin-anon',
        createdAt: '2026-07-19T09:00:02Z',
        owner: { type: 'ADMIN' },
        messageData: [{ type: 'TEXT', text: 'from anonymous admin' }],
      },
    ]
    expect(processHistoricalMessages(rows).messages).toMatchSnapshot()
  })

  it('chatTypeFilter drops rows of other chat types', () => {
    const rows: HistoricalMessage[] = [
      {
        id: 'u1',
        chatType: 'CLIENT_CHAT',
        createdAt: '2026-07-19T09:00:00Z',
        owner: { type: 'CLIENT' },
        messageData: [{ type: 'TEXT', text: 'visible' }],
      },
      {
        id: 'u2',
        chatType: 'ADMIN_AI_CHAT',
        createdAt: '2026-07-19T09:00:01Z',
        owner: { type: 'CLIENT' },
        messageData: [{ type: 'TEXT', text: 'filtered out' }],
      },
    ]
    expect(
      processHistoricalMessages(rows, { chatTypeFilter: 'CLIENT_CHAT' }).messages,
    ).toMatchSnapshot()
  })
})

describe('extractErrorMessages / processHistoricalMessagesWithErrors — golden', () => {
  it('extractErrorMessages surfaces ERROR rows as standalone error-role messages', () => {
    expect(extractErrorMessages(CORPUS, { assistantName: 'Mingo AI', assistantType: 'mingo' })).toMatchSnapshot()
  })

  it('processHistoricalMessagesWithErrors output parity on the same corpus (snapshot)', () => {
    const result = processHistoricalMessagesWithErrors(CORPUS, {
      assistantName: 'Mingo AI',
      assistantType: 'mingo',
      assistantAvatar: '/avatars/mingo.png',
    })
    expect({
      messages: result.messages,
      escalatedApprovals: Array.from(result.escalatedApprovals.entries()),
    }).toMatchSnapshot()
  })
})
