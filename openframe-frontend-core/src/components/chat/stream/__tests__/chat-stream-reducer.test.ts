/**
 * Phase-3 tests — `createChatStreamReducer`, the master chat-stream reader.
 *
 * The golden characterization suites (chunk-processor / SSE-stream /
 * accumulator / history / persisted-v1) pin transport parity through the
 * public hooks; THIS file pins the reducer-specific contracts the plan
 * added on top:
 *
 *   - seq-based idempotency (drop `seq` ≤ last applied, per instance);
 *   - REFERENTIAL STABILITY: untouched messages keep Object.is identity
 *     across applies AND across replayed duplicate events (value-level
 *     no-op merges return prior references);
 *   - `resolvePendingApprovalForExecution` (implicit approve-on-execution)
 *     is a NATS-only semantic — the SSE kernel never triggers it.
 */

import { describe, it, expect } from 'vitest'
import { createChatStreamReducer } from '../chat-stream-reducer'
import type { ChatStreamEvent } from '../../../../chat-protocol/events'

const executing = (execId = 'exec-1', seq?: number): ChatStreamEvent => ({
  type: 'tool-execution',
  data: {
    type: 'EXECUTING_TOOL',
    integratedToolType: 'SHELL',
    toolFunction: 'run_command',
    toolTitle: 'Run command',
    parameters: { cmd: 'ls' },
    toolExecutionRequestId: execId,
  },
  ...(seq != null ? { seq } : {}),
})

const executed = (execId = 'exec-1', seq?: number): ChatStreamEvent => ({
  type: 'tool-execution',
  data: {
    type: 'EXECUTED_TOOL',
    integratedToolType: 'SHELL',
    toolFunction: 'run_command',
    result: 'ok',
    success: true,
    toolExecutionRequestId: execId,
  },
  ...(seq != null ? { seq } : {}),
})

describe('createChatStreamReducer — seq idempotency', () => {
  it('drops events whose seq is ≤ the last applied seq', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'turn-start', seq: 1 })
    r.apply({ type: 'text-delta', text: 'a', seq: 2 })
    r.apply({ type: 'text-delta', text: 'b', seq: 3 })
    // Redelivery of seq 3 and an out-of-order seq 2 must both be dropped.
    r.apply({ type: 'text-delta', text: 'b', seq: 3 })
    r.apply({ type: 'text-delta', text: 'a', seq: 2 })
    const last = r.state.messages[r.state.messages.length - 1]
    expect(last.segments).toEqual([{ type: 'text', text: 'ab' }])
  })

  it('seq-less events are never gated', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'turn-start', seq: 5 })
    r.apply({ type: 'text-delta', text: 'x' })
    r.apply({ type: 'text-delta', text: 'x' })
    const last = r.state.messages[r.state.messages.length - 1]
    expect(last.segments).toEqual([{ type: 'text', text: 'xx' }])
  })
})

describe('createChatStreamReducer — referential stability', () => {
  it('applies reclone ONLY the touched message; earlier messages keep identity', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'participant', kind: 'message-request', text: 'hello', seq: 1 })
    r.apply({ type: 'turn-start', seq: 2 })
    r.apply({ type: 'text-delta', text: 'first reply', seq: 3 })
    r.apply({ type: 'turn-end', seq: 4 })
    const [userBefore, assistantBefore] = r.state.messages

    // A post-END continuation appends into the trailing assistant only.
    r.apply({ type: 'text-delta', text: ' …more', seq: 5 })
    const [userAfter, assistantAfter] = r.state.messages
    expect(userAfter).toBe(userBefore)
    expect(assistantAfter).not.toBe(assistantBefore)
    expect(assistantAfter.segments).toEqual([{ type: 'text', text: 'first reply …more' }])
  })

  it('a replayed duplicate EXECUTED event (same seq) is dropped — full state identity holds', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'turn-start', seq: 1 })
    r.apply({ type: 'text-delta', text: 'running', seq: 2 })
    r.apply({ type: 'turn-end', seq: 3 })
    r.apply(executing('exec-1', 4))
    r.apply(executed('exec-1', 5))
    const messagesBefore = r.state.messages

    r.apply(executed('exec-1', 5)) // JetStream redelivery
    expect(r.state.messages).toBe(messagesBefore)
  })

  it('a replayed seq-less duplicate EXECUTED merge is a value-level no-op — prior references returned', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'turn-start' })
    r.apply({ type: 'text-delta', text: 'running' })
    r.apply({ type: 'turn-end' })
    r.apply(executing())
    r.apply(executed())
    const messagesBefore = r.state.messages
    const trailingBefore = messagesBefore[messagesBefore.length - 1]

    // Same values, new event object, no seq (plain-NATS replay).
    r.apply(executed())
    const messagesAfter = r.state.messages
    expect(messagesAfter).toBe(messagesBefore)
    expect(messagesAfter[messagesAfter.length - 1]).toBe(trailingBefore)
  })

  it('a redelivered EXECUTING after EXECUTED never downgrades (prior references returned)', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply(executing())
    r.apply(executed())
    const before = r.state.messages
    r.apply(executing())
    expect(r.state.messages).toBe(before)
  })
})

describe('createChatStreamReducer — implicit approve-on-execution transport gate', () => {
  const approvalRequest: ChatStreamEvent = {
    type: 'approval-request',
    requestId: 'req-1',
    approvalType: 'CLIENT',
    command: 'systemctl restart nats',
    explanation: 'Restart the broker',
  }

  it("transport 'nats': an in-stream tool execution implicitly approves the pending gate", () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'turn-start' })
    r.apply(approvalRequest)
    // Observer stream: EXECUTING arrives with NO APPROVAL_RESULT chunk.
    r.apply(executing())
    const trailing = r.state.messages[r.state.messages.length - 1]
    const card = trailing.segments?.find((s) => s.type === 'approval_request')
    expect(card).toBeDefined()
    expect((card as { status?: string }).status).toBe('approved')
  })

  it("transport 'sse': tool-execution events are ignored — a pending card stays pending", () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: 'open a ticket', assistantName: 'Mingo AI' })
    r.apply({
      type: 'approval-request',
      requestId: 'prop-1',
      approvalType: 'create_ticket',
      command: 'Create ticket',
      fields: [{ label: 'Subject', value: 'Printer down' }],
    })
    const before = r.state.messages
    r.apply(executing())
    // Ignored entirely: same references, card untouched.
    expect(r.state.messages).toBe(before)
    const trailing = r.state.messages[r.state.messages.length - 1]
    const card = trailing.segments?.find((s) => s.type === 'approval_request')
    expect((card as { status?: string }).status).toBe('pending')
  })
})

describe('createChatStreamReducer — SSE kernel', () => {
  it('accumulates text cumulatively, keeps one thinking segment at the front, escapes tags', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: 'q', assistantName: 'Mingo AI' })
    r.apply({ type: 'thinking-delta', text: 'checking <docs>… ' })
    r.apply({ type: 'turn-start' })
    r.apply({ type: 'text-delta', text: 'Answer ' })
    r.apply({ type: 'thinking-delta', text: 'found it.' })
    r.apply({ type: 'text-delta', text: 'body.' })
    const trailing = r.state.messages[r.state.messages.length - 1]
    expect(trailing.segments).toEqual([
      { type: 'thinking', text: 'checking &lt;docs>… found it.' },
      { type: 'text', text: 'Answer body.' },
    ])
    expect(r.state.streamingPhase).toBe('streaming')
  })

  it('decision_resolved flips the SOURCE card, writes the receipt, and stamps chatRefs', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    // Turn 1: approval card.
    r.beginSseSend({ text: 'open a ticket', assistantName: 'Mingo AI' })
    r.apply({
      type: 'approval-request',
      requestId: 'prop-1',
      approvalType: 'create_ticket',
      command: 'Create ticket',
      fields: [],
    })
    r.endSseTurn()
    // Turn 2: hidden approval-action send → decision_resolved frame.
    r.beginSseSend({ text: '', hidden: true, assistantName: 'Mingo AI' })
    r.apply({
      type: 'approval-resolved',
      requestId: 'prop-1',
      status: 'approved',
      ok: true,
      receiptText: '✅ Approved — ticket created: [card://ticket:77]',
      cardRef: { type: 'ticket', id: '77', title: 'Broken printer' },
      cardType: 'ticket',
    })
    r.endSseTurn()

    const [, sourceMsg, , receiptMsg] = r.state.messages
    const card = sourceMsg.segments?.find((s) => s.type === 'approval_request')
    expect((card as { status?: string }).status).toBe('approved')
    expect(receiptMsg.segments).toEqual([
      { type: 'text', text: '✅ Approved — ticket created: [card://ticket:77]\n\n' },
    ])
    expect(receiptMsg.chatRefs?.['ticket:77']?.id).toBe('77')
    // Per-send refs map got the ref too (sendIdx 1 — the hidden send).
    expect(r.state.turnMeta.refs.get(1)?.['ticket:77']?.id).toBe('77')
    expect(r.state.streamingPhase).toBe('idle')
  })

  it('endSseTurn drops an empty trailing placeholder (reject path)', () => {
    const r = createChatStreamReducer({ transport: 'sse' })
    r.beginSseSend({ text: '', hidden: true, assistantName: 'Mingo AI' })
    expect(r.state.messages).toHaveLength(2)
    r.endSseTurn()
    expect(r.state.messages).toHaveLength(1)
    expect(r.state.messages[0].role).toBe('user')
  })
})

describe('createChatStreamReducer — participant dedup', () => {
  it('optimistic echo consumes exactly one MESSAGE_REQUEST twin', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.pushOptimisticSend('yes')
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    // Echo of our own send → consumed, no duplicate row.
    r.apply({ type: 'participant', kind: 'message-request', text: 'yes' })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    // A genuinely repeated send from another session still renders.
    r.apply({ type: 'participant', kind: 'message-request', text: 'yes', seq: 10 })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
  })

  it('participant seen-seq set dedups redelivered rows', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.apply({ type: 'participant', kind: 'direct-message', text: 'human here', seq: 7 })
    const before = r.state.messages
    r.apply({ type: 'participant', kind: 'direct-message', text: 'human here', seq: 7 })
    expect(r.state.messages).toBe(before)
    expect(r.state.messages).toHaveLength(1)
  })
})
