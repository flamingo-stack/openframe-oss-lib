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

import { describe, it, expect, vi } from 'vitest'
import {
  createChatStreamReducer,
  OWN_ECHO_AUTHOR_TTL_MS,
  OWN_ECHO_TTL_MS,
} from '../chat-stream-reducer'
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

  it('ADMIN echo is NOT consumed by default (it is a technician reply)', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.pushOptimisticSend('same words')
    // An ADMIN-authored row that happens to match our text is somebody
    // else's message on hosts where the operator is not the admin.
    r.apply({ type: 'participant', kind: 'message-request', text: 'same words', ownerType: 'ADMIN' })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
  })

  it('ADMIN echo IS consumed when the host declares ownEchoIncludesAdmin', () => {
    const r = createChatStreamReducer({ transport: 'nats', ownEchoIncludesAdmin: true })
    r.pushOptimisticSend('same words')
    r.apply({ type: 'participant', kind: 'message-request', text: 'same words', ownerType: 'ADMIN' })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    // Still one-shot: a second ADMIN row with the same text renders.
    r.apply({ type: 'participant', kind: 'message-request', text: 'same words', ownerType: 'ADMIN', seq: 11 })
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

  /**
   * REGRESSION (round 3): on a shared ADMIN side, raw-text echo matching
   * could delete a SECOND technician's message. Tech A sends "ok", A's echo
   * never lands; Tech B sends "ok" → ADMIN-authored, matched the stale entry,
   * consumed, never rendered for A.
   */
  it('selfUserId: another author\'s identical text never consumes our echo', () => {
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: 'tech-a',
    })
    r.pushOptimisticSend('ok')
    // Tech B's message — same text, same ADMIN owner type, different author.
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-b',
      seq: 1,
    })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    // Our OWN echo still dedups.
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-a',
      seq: 2,
    })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
  })

  /**
   * REGRESSION (round 4): the author guard must fail OPEN. A transport whose
   * decoder does not surface the author id (the ticket wire model declares it
   * at `owner.userId`; the app's id may live in another id space entirely)
   * would otherwise never dedup — every send rendered TWICE, strictly worse
   * than the message-theft bug the guard fixes.
   */
  it('selfUserId: an id-LESS row still dedups via the text+TTL fallback (fails open)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      r.pushOptimisticSend('on it')
      r.apply({ type: 'participant', kind: 'message-request', text: 'on it', ownerType: 'ADMIN', seq: 1 })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
      // The misconfiguration is surfaced — once, not per row.
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toContain('selfUserId')
      r.pushOptimisticSend('again')
      r.apply({ type: 'participant', kind: 'message-request', text: 'again', ownerType: 'ADMIN', seq: 2 })
      expect(warn).toHaveBeenCalledTimes(1)
    } finally {
      warn.mockRestore()
    }
  })

  it('selfUserId accepts a GETTER resolved at event time (late auth / user switch)', () => {
    let self: string | undefined
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: () => self,
    })
    // Auth rehydrates AFTER the reducer was created.
    self = 'tech-a'
    r.pushOptimisticSend('ok')
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-b',
      seq: 1,
    })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    // Log out, log in as somebody else — the guard tracks it without a reload.
    self = 'tech-b'
    r.pushOptimisticSend('ok')
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-b',
      seq: 2,
    })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(3)
  })

  /**
   * REGRESSION (round 4): a JetStream catch-up replay after a >30s network gap
   * delivers our own echo long after the send. Its rows carry `seq`, so the
   * seq-less content-dedup fallback cannot rescue it — expiring an
   * AUTHOR-MATCHED entry at the short TTL means a guaranteed duplicate row.
   */
  it('an AUTHOR-MATCHED echo is consumed well past the unattributed TTL', () => {
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      r.pushOptimisticSend('on it')
      now += OWN_ECHO_TTL_MS + 1_000
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'on it',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 9,
      })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
      // Still one-shot — a second author-matched row with the same text renders.
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'on it',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 10,
      })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    } finally {
      Date.now = realNow
    }
  })

  /**
   * REGRESSION (round 5): the author check rules out a COLLEAGUE's message, not
   * the SAME user on a second tab. An entry whose echo never landed used to
   * stay armed forever on the author-matched path, so the same user's identical
   * send from another tab an hour later was silently DROPPED — message loss,
   * strictly worse than the duplicate row the bypass was avoiding.
   */
  it('an AUTHOR-MATCHED entry expires, so an identical send an HOUR later renders', () => {
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      // Tab A sends "ok" — the echo never lands (dropped frame / reconnect gap).
      r.pushOptimisticSend('ok')
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
      // An HOUR later the same user sends "ok" from tab B. The row is
      // author-matched, but the stale entry must NOT eat it.
      now += 60 * 60_000
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 7,
      })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    } finally {
      Date.now = realNow
    }
  })

  /**
   * REGRESSION (round 6): `OWN_ECHO_AUTHOR_TTL_MS` alone preserved TEN MINUTES
   * of cross-tab message loss. A `turn-end` proves the server finished the
   * send, so an echo that has not landed by then never will — the entry must
   * be disarmed at that boundary, cutting the window to one turn.
   */
  it('a turn-end disarms a stale echo, so a second-tab send minutes later RENDERS', () => {
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      // Tab A sends "ok" — the echo never lands.
      r.pushOptimisticSend('ok')
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
      // The turn runs and ends: the server is demonstrably done with that send.
      r.apply({ type: 'turn-start', seq: 2 })
      r.apply({ type: 'turn-end', seq: 3 })
      // Five minutes later — well INSIDE the 10-minute backstop — the same
      // user sends "ok" from tab B. It must render, not be swallowed.
      now += 5 * 60_000
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 7,
      })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    } finally {
      Date.now = realNow
    }
  })

  /** The echo entry is still consumed on the NORMAL path: the server's echo
   *  arrives before the turn ends, so `turn-end` must not break dedup. */
  it('an echo landing BEFORE turn-end is still deduped', () => {
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: 'tech-a',
    })
    r.pushOptimisticSend('ok')
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-a',
      seq: 2,
    })
    r.apply({ type: 'turn-start', seq: 3 })
    r.apply({ type: 'turn-end', seq: 4 })
    expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
  })

  it('an author-matched entry is still consumed just INSIDE the author TTL', () => {
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      r.pushOptimisticSend('ok')
      now += OWN_ECHO_AUTHOR_TTL_MS - 1
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 7,
      })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    } finally {
      Date.now = realNow
    }
  })

  /** A short-TTL (unattributed) lookup must not EVICT an entry a later
   *  author-matched row is still entitled to consume. */
  it('an unattributed miss does not evict an entry the author path still owns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      r.pushOptimisticSend('ok')
      now += OWN_ECHO_TTL_MS + 1
      // Unattributed row: outside the short TTL, so it renders (2 user rows)…
      r.apply({ type: 'participant', kind: 'message-request', text: 'ok', ownerType: 'ADMIN', seq: 5 })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
      // …and our own late echo, declared ours, is still consumed.
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 6,
      })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    } finally {
      Date.now = realNow
      warn.mockRestore()
    }
  })

  it('an aged entry still expires on the UNATTRIBUTED path (no author to trust)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      })
      r.pushOptimisticSend('done')
      now += OWN_ECHO_TTL_MS + 1
      r.apply({ type: 'participant', kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    } finally {
      Date.now = realNow
      warn.mockRestore()
    }
  })

  it('an echo entry expires, so an un-echoed send cannot arm a trap', () => {
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({ transport: 'nats', ownEchoIncludesAdmin: true })
      r.pushOptimisticSend('done')
      // Our echo never lands. Much later, somebody else says the same thing.
      now += OWN_ECHO_TTL_MS + 1
      r.apply({ type: 'participant', kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(2)
    } finally {
      Date.now = realNow
    }
  })

  it('an echo INSIDE the TTL is still consumed', () => {
    const realNow = Date.now
    try {
      let now = 1_000_000
      Date.now = () => now
      const r = createChatStreamReducer({ transport: 'nats', ownEchoIncludesAdmin: true })
      r.pushOptimisticSend('done')
      now += OWN_ECHO_TTL_MS - 1
      r.apply({ type: 'participant', kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 })
      expect(r.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    } finally {
      Date.now = realNow
    }
  })
})

describe('createChatStreamReducer — mergeApprovalStatuses precedence', () => {
  it('stream-learned resolution beats a LAGGING persisted pending', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.setApprovalStatus('req-1', 'approved')
    r.mergeApprovalStatuses({ 'req-1': 'pending' })
    expect(r.state.approvalStatuses['req-1']).toBe('approved')
  })

  it('persisted resolution beats a STALE stream-learned pending (second tab)', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    // This tab saw the request; the operator approved it in another tab.
    r.apply({
      type: 'approval-request',
      requestId: 'req-2',
      command: 'rm -rf /tmp/x',
      approvalType: 'CLIENT',
      seq: 1,
    })
    expect(r.state.approvalStatuses['req-2']).toBeUndefined()
    r.setApprovalStatus('req-2', 'pending')
    r.mergeApprovalStatuses({ 'req-2': 'approved' })
    expect(r.state.approvalStatuses['req-2']).toBe('approved')
  })

  it('fills unknown ids and is a no-op when nothing changes', () => {
    const r = createChatStreamReducer({ transport: 'nats' })
    r.setApprovalStatus('req-3', 'rejected')
    r.mergeApprovalStatuses({ 'req-3': 'rejected', 'req-4': 'cancelled' })
    expect(r.state.approvalStatuses).toEqual({ 'req-3': 'rejected', 'req-4': 'cancelled' })
    const before = r.state.approvalStatuses
    r.mergeApprovalStatuses({ 'req-3': 'pending', 'req-4': 'cancelled' })
    expect(r.state.approvalStatuses).toBe(before)
  })
})
