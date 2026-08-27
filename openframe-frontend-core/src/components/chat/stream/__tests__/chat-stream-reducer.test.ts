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

import { describe, it, expect, vi } from 'vitest';
import type { ChatStreamEvent } from '../../../../chat-protocol/events';
import { createChatStreamReducer, OWN_ECHO_AUTHOR_TTL_MS, OWN_ECHO_TTL_MS } from '../chat-stream-reducer';

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
});

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
});

describe('createChatStreamReducer — seq idempotency', () => {
  it('drops events whose seq is ≤ the last applied seq', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'a', seq: 2 });
    r.apply({ type: 'text-delta', text: 'b', seq: 3 });
    // Redelivery of seq 3 and an out-of-order seq 2 must both be dropped.
    r.apply({ type: 'text-delta', text: 'b', seq: 3 });
    r.apply({ type: 'text-delta', text: 'a', seq: 2 });
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([{ type: 'text', text: 'ab' }]);
  });

  it('seq-less events are never gated', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 5 });
    r.apply({ type: 'text-delta', text: 'x' });
    r.apply({ type: 'text-delta', text: 'x' });
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([{ type: 'text', text: 'xx' }]);
  });
});

describe('createChatStreamReducer — referential stability', () => {
  it('applies reclone ONLY the touched message; earlier messages keep identity', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'participant', kind: 'message-request', text: 'hello', seq: 1 });
    r.apply({ type: 'turn-start', seq: 2 });
    r.apply({ type: 'text-delta', text: 'first reply', seq: 3 });
    r.apply({ type: 'turn-end', seq: 4 });
    const [userBefore, assistantBefore] = r.state.messages;

    // A post-END continuation appends into the trailing assistant only.
    r.apply({ type: 'text-delta', text: ' …more', seq: 5 });
    const [userAfter, assistantAfter] = r.state.messages;
    expect(userAfter).toBe(userBefore);
    expect(assistantAfter).not.toBe(assistantBefore);
    expect(assistantAfter.segments).toEqual([{ type: 'text', text: 'first reply …more' }]);
  });

  it('a replayed duplicate EXECUTED event (same seq) is dropped — full state identity holds', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'running', seq: 2 });
    r.apply({ type: 'turn-end', seq: 3 });
    r.apply(executing('exec-1', 4));
    r.apply(executed('exec-1', 5));
    const messagesBefore = r.state.messages;

    r.apply(executed('exec-1', 5)); // JetStream redelivery
    expect(r.state.messages).toBe(messagesBefore);
  });

  it('a replayed seq-less duplicate EXECUTED merge is a value-level no-op — prior references returned', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start' });
    r.apply({ type: 'text-delta', text: 'running' });
    r.apply({ type: 'turn-end' });
    r.apply(executing());
    r.apply(executed());
    const messagesBefore = r.state.messages;
    const trailingBefore = messagesBefore[messagesBefore.length - 1];

    // Same values, new event object, no seq (plain-NATS replay).
    r.apply(executed());
    const messagesAfter = r.state.messages;
    expect(messagesAfter).toBe(messagesBefore);
    expect(messagesAfter[messagesAfter.length - 1]).toBe(trailingBefore);
  });

  it('a redelivered EXECUTING after EXECUTED never downgrades (prior references returned)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply(executing());
    r.apply(executed());
    const before = r.state.messages;
    r.apply(executing());
    expect(r.state.messages).toBe(before);
  });
});

describe('createChatStreamReducer — implicit approve-on-execution transport gate', () => {
  const approvalRequest: ChatStreamEvent = {
    type: 'approval-request',
    requestId: 'req-1',
    approvalType: 'CLIENT',
    command: 'systemctl restart nats',
    explanation: 'Restart the broker',
  };

  it("transport 'nats': an in-stream tool execution implicitly approves the pending gate", () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start' });
    r.apply(approvalRequest);
    // Observer stream: EXECUTING arrives with NO APPROVAL_RESULT chunk.
    r.apply(executing());
    const trailing = r.state.messages[r.state.messages.length - 1];
    const card = trailing.segments?.find(s => s.type === 'approval_request');
    expect(card).toBeDefined();
    expect((card as { status?: string }).status).toBe('approved');
  });

  it("transport 'sse': tool-execution events are ignored — a pending card stays pending", () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'open a ticket', assistantName: 'Mingo AI' });
    r.apply({
      type: 'approval-request',
      requestId: 'prop-1',
      approvalType: 'create_ticket',
      command: 'Create ticket',
      fields: [{ label: 'Subject', value: 'Printer down' }],
    });
    const before = r.state.messages;
    r.apply(executing());
    // Ignored entirely: same references, card untouched.
    expect(r.state.messages).toBe(before);
    const trailing = r.state.messages[r.state.messages.length - 1];
    const card = trailing.segments?.find(s => s.type === 'approval_request');
    expect((card as { status?: string }).status).toBe('pending');
  });
});

describe('createChatStreamReducer — SSE kernel', () => {
  it('accumulates text cumulatively, keeps one thinking segment at the front, escapes tags', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'q', assistantName: 'Mingo AI' });
    r.apply({ type: 'thinking-delta', text: 'checking <docs>… ' });
    r.apply({ type: 'turn-start' });
    r.apply({ type: 'text-delta', text: 'Answer ' });
    r.apply({ type: 'thinking-delta', text: 'found it.' });
    r.apply({ type: 'text-delta', text: 'body.' });
    const trailing = r.state.messages[r.state.messages.length - 1];
    expect(trailing.segments).toEqual([
      { type: 'thinking', text: 'checking &lt;docs>… found it.' },
      { type: 'text', text: 'Answer body.' },
    ]);
    expect(r.state.streamingPhase).toBe('streaming');
  });

  it('decision_resolved flips the SOURCE card and writes the receipt', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    // Turn 1: approval card.
    r.beginSseSend({ text: 'open a ticket', assistantName: 'Mingo AI' });
    r.apply({
      type: 'approval-request',
      requestId: 'prop-1',
      approvalType: 'create_ticket',
      command: 'Create ticket',
      fields: [],
    });
    r.endSseTurn();
    // Turn 2: hidden approval-action send → decision_resolved frame.
    r.beginSseSend({ text: '', hidden: true, assistantName: 'Mingo AI' });
    r.apply({
      type: 'approval-resolved',
      requestId: 'prop-1',
      status: 'approved',
      ok: true,
      receiptText: '✅ Approved — ticket created: [card://ticket:77]',
    });
    r.endSseTurn();

    // Three rows, not four: the hidden approval-action send is out-of-band
    // metadata and mints NO user row (it would render as a bare author label).
    expect(r.state.messages).toHaveLength(3);
    const [, sourceMsg, receiptMsg] = r.state.messages;
    const card = sourceMsg.segments?.find(s => s.type === 'approval_request');
    expect((card as { status?: string }).status).toBe('approved');
    // The receipt's `[card://…]` marker hydrates by id via the card fetch
    // path — no ref stamping.
    expect(receiptMsg.segments).toEqual([
      { type: 'text', text: '✅ Approved — ticket created: [card://ticket:77]\n\n' },
    ]);
    expect(r.state.streamingPhase).toBe('idle');
  });

  it('endSseTurn drops an empty trailing placeholder (reject path)', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'q', assistantName: 'Mingo AI' });
    r.apply({ type: 'text-delta', text: 'answer' });
    r.endSseTurn();
    // Reject: an empty-text (approval-action) send adds ONLY the assistant
    // placeholder…
    r.beginSseSend({ text: '', hidden: true, assistantName: 'Mingo AI' });
    expect(r.state.messages).toHaveLength(3);
    expect(r.state.messages[2].role).toBe('assistant');
    // …and the reject frame streams nothing, so the turn leaves the thread
    // exactly as it was — no bare user label, no blank bubble.
    r.endSseTurn();
    expect(r.state.messages).toHaveLength(2);
    expect(r.state.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });
});

describe('createChatStreamReducer — participant dedup', () => {
  it('optimistic echo consumes exactly one MESSAGE_REQUEST twin', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.pushOptimisticSend('yes');
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    // Echo of our own send → consumed, no duplicate row.
    r.apply({ type: 'participant', kind: 'message-request', text: 'yes' });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    // A genuinely repeated send from another session still renders.
    r.apply({ type: 'participant', kind: 'message-request', text: 'yes', seq: 10 });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('ADMIN echo is NOT consumed by default (it is a technician reply)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.pushOptimisticSend('same words');
    // An ADMIN-authored row that happens to match our text is somebody
    // else's message on hosts where the operator is not the admin.
    r.apply({ type: 'participant', kind: 'message-request', text: 'same words', ownerType: 'ADMIN' });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('ADMIN echo IS consumed when the host declares ownEchoIncludesAdmin', () => {
    const r = createChatStreamReducer({ transport: 'nats', ownEchoIncludesAdmin: true });
    r.pushOptimisticSend('same words');
    r.apply({ type: 'participant', kind: 'message-request', text: 'same words', ownerType: 'ADMIN' });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    // Still one-shot: a second ADMIN row with the same text renders.
    r.apply({ type: 'participant', kind: 'message-request', text: 'same words', ownerType: 'ADMIN', seq: 11 });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('participant seen-seq set dedups redelivered rows', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'participant', kind: 'direct-message', text: 'human here', seq: 7 });
    const before = r.state.messages;
    r.apply({ type: 'participant', kind: 'direct-message', text: 'human here', seq: 7 });
    expect(r.state.messages).toBe(before);
    expect(r.state.messages).toHaveLength(1);
  });

  /**
   * REGRESSION (round 3): on a shared ADMIN side, raw-text echo matching
   * could delete a SECOND technician's message. Tech A sends "ok", A's echo
   * never lands; Tech B sends "ok" → ADMIN-authored, matched the stale entry,
   * consumed, never rendered for A.
   */
  it("selfUserId: another author's identical text never consumes our echo", () => {
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: 'tech-a',
    });
    r.pushOptimisticSend('ok');
    // Tech B's message — same text, same ADMIN owner type, different author.
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-b',
      seq: 1,
    });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    // Our OWN echo still dedups.
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-a',
      seq: 2,
    });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  /**
   * REGRESSION (round 4): the author guard must fail OPEN. A transport whose
   * decoder does not surface the author id (the ticket wire model declares it
   * at `owner.userId`; the app's id may live in another id space entirely)
   * would otherwise never dedup — every send rendered TWICE, strictly worse
   * than the message-theft bug the guard fixes.
   */
  it('selfUserId: an id-LESS row still dedups via the text+TTL fallback (fails open)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('on it');
      r.apply({ type: 'participant', kind: 'message-request', text: 'on it', ownerType: 'ADMIN', seq: 1 });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // The misconfiguration is surfaced — once, not per row.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('selfUserId');
      r.pushOptimisticSend('again');
      r.apply({ type: 'participant', kind: 'message-request', text: 'again', ownerType: 'ADMIN', seq: 2 });
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('selfUserId accepts a GETTER resolved at event time (late auth / user switch)', () => {
    let self: string | undefined;
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: () => self,
    });
    // Auth rehydrates AFTER the reducer was created.
    self = 'tech-a';
    r.pushOptimisticSend('ok');
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-b',
      seq: 1,
    });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    // Log out, log in as somebody else — the guard tracks it without a reload.
    self = 'tech-b';
    r.pushOptimisticSend('ok');
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-b',
      seq: 2,
    });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(3);
  });

  /**
   * REGRESSION (round 4): a JetStream catch-up replay after a >30s network gap
   * delivers our own echo long after the send. Its rows carry `seq`, so the
   * seq-less content-dedup fallback cannot rescue it — expiring an
   * AUTHOR-MATCHED entry at the short TTL means a guaranteed duplicate row.
   */
  it('an AUTHOR-MATCHED echo is consumed well past the unattributed TTL', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('on it');
      now += OWN_ECHO_TTL_MS + 1_000;
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'on it',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 9,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // Still one-shot — a second author-matched row with the same text renders.
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'on it',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 10,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /**
   * REGRESSION (round 5): the author check rules out a COLLEAGUE's message, not
   * the SAME user on a second tab. An entry whose echo never landed used to
   * stay armed forever on the author-matched path, so the same user's identical
   * send from another tab an hour later was silently DROPPED — message loss,
   * strictly worse than the duplicate row the bypass was avoiding.
   */
  it('an AUTHOR-MATCHED entry expires, so an identical send an HOUR later renders', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      // Tab A sends "ok" — the echo never lands (dropped frame / reconnect gap).
      r.pushOptimisticSend('ok');
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // An HOUR later the same user sends "ok" from tab B. The row is
      // author-matched, but the stale entry must NOT eat it.
      now += 60 * 60_000;
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 7,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /**
   * REGRESSION (round 6): `OWN_ECHO_AUTHOR_TTL_MS` alone preserved TEN MINUTES
   * of cross-tab message loss. A `turn-end` proves the server finished the
   * send, so an echo that has not landed by then never will — the entry must
   * be disarmed at that boundary, cutting the window to one turn.
   */
  it('a turn-end disarms a stale echo, so a second-tab send minutes later RENDERS', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      // Tab A sends "ok" — the echo never lands.
      r.pushOptimisticSend('ok');
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // The turn runs and ends: the server is demonstrably done with that send.
      r.apply({ type: 'turn-start', seq: 2 });
      r.apply({ type: 'turn-end', seq: 3 });
      // Five minutes later — well INSIDE the 10-minute backstop — the same
      // user sends "ok" from tab B. It must render, not be swallowed.
      now += 5 * 60_000;
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 7,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /** The echo entry is still consumed on the NORMAL path: the server's echo
   *  arrives before the turn ends, so `turn-end` must not break dedup. */
  it('an echo landing BEFORE turn-end is still deduped', () => {
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: 'tech-a',
    });
    r.pushOptimisticSend('ok');
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'tech-a',
      seq: 2,
    });
    r.apply({ type: 'turn-start', seq: 3 });
    r.apply({ type: 'turn-end', seq: 4 });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });

  /**
   * REGRESSION (round 7): the round-6 purge was UNCONDITIONAL, so a `turn-end`
   * arriving between a send and its echo disarmed an entry that was never
   * stale — the echo then rendered a SECOND user bubble. Reachable via a
   * reconnect catch-up replay (a pre-disconnect MESSAGE_END delivered after
   * the user has already sent) and via the approval-interrupt path (sending
   * while an approval pends cancels the in-flight turn, so the interrupted
   * turn's MESSAGE_END lands after the new send armed its entry). Only
   * entries armed BEFORE the turn being ended may be purged.
   */
  it('a turn-end arriving between a send and its echo does NOT duplicate the bubble', () => {
    const r = createChatStreamReducer({
      transport: 'nats',
      ownEchoIncludesAdmin: true,
      selfUserId: 'me',
    });
    r.pushOptimisticSend('hello world');
    // A stale MESSAGE_END for a turn that started before this send (catch-up
    // replay / approval interrupt) — no turn-start was ever observed here.
    r.apply({ type: 'turn-end', seq: 10 });
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'hello world',
      ownerType: 'ADMIN',
      userId: 'me',
      seq: 11,
    });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });

  /**
   * DOCUMENTED LIMIT, not an aspiration: when a reconnect catch-up replay
   * delivers BOTH a pre-disconnect `turn-start` and its `turn-end` after the
   * user has sent, the replayed `turn-start` restamps the arrival-time
   * boundary and the `turn-end` purges the still-live entry — the echo then
   * renders a SECOND bubble. The normalized event union carries no event-own
   * timestamp (only `seq`), so at this layer the interleaving is identical to
   * "send queued mid-turn, own turn opened and closed before the echo", which
   * the module deliberately resolves toward duplicating rather than risk
   * swallowing a real message. Pins the behavior so a future transport-level
   * fix (event-own time) has to update this test consciously.
   */
  it('a replayed turn boundary after a send duplicates the bubble (known limit)', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'me',
      });
      r.pushOptimisticSend('hello');
      now += 5; // the replay lands a few ms after the send
      r.apply({ type: 'turn-start', seq: 1 });
      r.apply({ type: 'turn-end', seq: 2 });
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'hello',
        ownerType: 'ADMIN',
        userId: 'me',
        seq: 3,
      });
      // Two bubbles: the optimistic one and the un-deduped echo.
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /** Same shape, but the interrupted turn's `turn-start` WAS observed and the
   *  send happened after it — the entry belongs to the current turn and must
   *  survive its `turn-end`. */
  it('an echo armed DURING the turn survives that turn-end', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.apply({ type: 'turn-start', seq: 2 });
      now += 1; // the user types and sends while the turn streams
      r.pushOptimisticSend('hello world');
      r.apply({ type: 'turn-end', seq: 3 });
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'hello world',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 4,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    } finally {
      Date.now = realNow;
    }
  });

  it('an author-matched entry is still consumed just INSIDE the author TTL', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('ok');
      now += OWN_ECHO_AUTHOR_TTL_MS - 1;
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 7,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    } finally {
      Date.now = realNow;
    }
  });

  /** A short-TTL (unattributed) lookup must not EVICT an entry a later
   *  author-matched row is still entitled to consume. */
  it('an unattributed miss does not evict an entry the author path still owns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('ok');
      now += OWN_ECHO_TTL_MS + 1;
      // Unattributed row: outside the short TTL, so it renders (2 user rows)…
      r.apply({ type: 'participant', kind: 'message-request', text: 'ok', ownerType: 'ADMIN', seq: 5 });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
      // …and our own late echo, declared ours, is still consumed.
      r.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 6,
      });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
      warn.mockRestore();
    }
  });

  it('an aged entry still expires on the UNATTRIBUTED path (no author to trust)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        transport: 'nats',
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('done');
      now += OWN_ECHO_TTL_MS + 1;
      r.apply({ type: 'participant', kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
      warn.mockRestore();
    }
  });

  it('an echo entry expires, so an un-echoed send cannot arm a trap', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({ transport: 'nats', ownEchoIncludesAdmin: true });
      r.pushOptimisticSend('done');
      // Our echo never lands. Much later, somebody else says the same thing.
      now += OWN_ECHO_TTL_MS + 1;
      r.apply({ type: 'participant', kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  it('an echo INSIDE the TTL is still consumed', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({ transport: 'nats', ownEchoIncludesAdmin: true });
      r.pushOptimisticSend('done');
      now += OWN_ECHO_TTL_MS - 1;
      r.apply({ type: 'participant', kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 });
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    } finally {
      Date.now = realNow;
    }
  });
});

/**
 * Parked-state round trip across an LRU eviction. The store captures these
 * (`EvictedReducerState`); these tests pin the reducer half of the contract.
 */
describe('createChatStreamReducer — parked echo restore', () => {
  const echoOptions = {
    transport: 'nats',
    ownEchoIncludesAdmin: true,
    selfUserId: 'me',
  } as const;

  it('restored pendingEchoes still consume the echo (no duplicate bubble)', () => {
    const dropped = createChatStreamReducer(echoOptions);
    dropped.pushOptimisticSend('hello world');
    const parked = dropped.getPendingEchoes();
    expect(parked).toHaveLength(1);

    // The key was evicted between the send and its echo; the replacement
    // reducer restores the armed entry alongside the refetched thread.
    const recreated = createChatStreamReducer(echoOptions);
    recreated.initializeWithState([{ id: 'u1', role: 'user', content: 'hello world' }], { pendingEchoes: parked });
    recreated.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'hello world',
      ownerType: 'ADMIN',
      userId: 'me',
      seq: 11,
    });
    expect(recreated.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });

  it('getPendingEchoes returns a SNAPSHOT, not the live internal array', () => {
    const r = createChatStreamReducer(echoOptions);
    r.pushOptimisticSend('hello world');
    const parked = r.getPendingEchoes();
    expect(parked).toHaveLength(1);

    // Mutating the reducer after the snapshot must not change what the holder
    // observes — the `readonly PendingEcho[]` return type has to be honest.
    r.pushOptimisticSend('second');
    expect(parked).toHaveLength(1);
    expect(r.getPendingEchoes()).toHaveLength(2);

    // ...and the consume path (which splices) must not empty it either.
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'hello world',
      ownerType: 'ADMIN',
      userId: 'me',
      seq: 11,
    });
    expect(parked).toHaveLength(1);
    expect(parked[0]?.text).toBe('hello world');
  });

  it('drops parked entries already past the author TTL', () => {
    const r = createChatStreamReducer(echoOptions);
    r.initializeWithState(null, {
      pendingEchoes: [{ text: 'ok', at: Date.now() - OWN_ECHO_AUTHOR_TTL_MS - 1 }],
    });
    expect(r.getPendingEchoes()).toHaveLength(0);
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      userId: 'me',
      seq: 3,
    });
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });
});

describe('createChatStreamReducer — initializeWithState resumed gate', () => {
  /** An eviction restore of a key that NEVER streamed (empty parked thread)
   *  must not claim "resumed": a later cold delta with no `turn-start` would
   *  take the append branch and never spawn the first assistant bubble. */
  it('an EMPTY restore leaves the cold-start cumulative path armed', () => {
    const effects: Array<{ name: string; args: unknown[] }> = [];
    const r = createChatStreamReducer({
      transport: 'nats',
      onEffect: e => effects.push(e),
    });
    r.initializeWithState([], { lastAppliedSeq: 1 });
    r.apply({ type: 'text-delta', text: 'hello', seq: 2 });
    const updates = effects.filter(e => e.name === 'onSegmentsUpdate');
    const update = updates[updates.length - 1];
    expect((update?.args[1] as { append?: boolean } | undefined)?.append).toBeUndefined();
    expect(r.state.messages.filter(m => m.role === 'assistant')).toHaveLength(1);
  });

  it('a NON-EMPTY restore is treated as resumed (post-stream deltas append)', () => {
    const effects: Array<{ name: string; args: unknown[] }> = [];
    const r = createChatStreamReducer({
      transport: 'nats',
      onEffect: e => effects.push(e),
    });
    r.initializeWithState([{ id: 'a1', role: 'assistant', content: 'prior', segments: [] }]);
    r.apply({ type: 'text-delta', text: 'more', seq: 2 });
    const updates = effects.filter(e => e.name === 'onSegmentsUpdate');
    const update = updates[updates.length - 1];
    expect((update?.args[1] as { append?: boolean } | undefined)?.append).toBe(true);
  });

  it('an explicit `resumed` overrides the derivation', () => {
    const effects: Array<{ name: string; args: unknown[] }> = [];
    const r = createChatStreamReducer({
      transport: 'nats',
      onEffect: e => effects.push(e),
    });
    r.initializeWithState([], { resumed: true });
    r.apply({ type: 'text-delta', text: 'hello', seq: 2 });
    const updates = effects.filter(e => e.name === 'onSegmentsUpdate');
    const update = updates[updates.length - 1];
    expect((update?.args[1] as { append?: boolean } | undefined)?.append).toBe(true);
  });
});

describe('createChatStreamReducer — mergeApprovalStatuses precedence', () => {
  it('stream-learned resolution beats a LAGGING persisted pending', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.setApprovalStatus('req-1', 'approved');
    r.mergeApprovalStatuses({ 'req-1': 'pending' });
    expect(r.state.approvalStatuses['req-1']).toBe('approved');
  });

  it('persisted resolution beats a STALE stream-learned pending (second tab)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    // This tab saw the request; the operator approved it in another tab.
    r.apply({
      type: 'approval-request',
      requestId: 'req-2',
      command: 'rm -rf /tmp/x',
      approvalType: 'CLIENT',
      seq: 1,
    });
    expect(r.state.approvalStatuses['req-2']).toBeUndefined();
    r.setApprovalStatus('req-2', 'pending');
    r.mergeApprovalStatuses({ 'req-2': 'approved' });
    expect(r.state.approvalStatuses['req-2']).toBe('approved');
  });

  it('fills unknown ids and is a no-op when nothing changes', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.setApprovalStatus('req-3', 'rejected');
    r.mergeApprovalStatuses({ 'req-3': 'rejected', 'req-4': 'cancelled' });
    expect(r.state.approvalStatuses).toEqual({ 'req-3': 'rejected', 'req-4': 'cancelled' });
    const before = r.state.approvalStatuses;
    r.mergeApprovalStatuses({ 'req-3': 'pending', 'req-4': 'cancelled' });
    expect(r.state.approvalStatuses).toBe(before);
  });
});

// ─── GUIDE segments (#1583 threaded through the unified reader) ─────────────
//
// A `GUIDE` chunk is an APPEND-ONLY body stream like TEXT/THINKING, but it
// renders as a titled "OpenFrame Guide" card. It must therefore coalesce the
// same way (extend the trailing `guide` segment, never push a new one per
// chunk) and satisfy the same reducer invariants — seq idempotency,
// referential stability, and post-MESSAGE_END append mode.

describe('createChatStreamReducer — guide segments', () => {
  it('coalesces consecutive guide deltas into ONE trailing guide segment', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'guide-delta', text: '## Enroll a device\n', seq: 2 });
    r.apply({ type: 'guide-delta', text: '1. Open Settings', seq: 3 });
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([{ type: 'guide', text: '## Enroll a device\n1. Open Settings' }]);
  });

  it('starts a NEW guide segment when a non-guide segment interrupts', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'guide-delta', text: 'step one', seq: 2 });
    r.apply({ type: 'text-delta', text: 'aside', seq: 3 });
    r.apply({ type: 'guide-delta', text: 'step two', seq: 4 });
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([
      { type: 'guide', text: 'step one' },
      { type: 'text', text: 'aside' },
      { type: 'guide', text: 'step two' },
    ]);
  });

  it('drops a redelivered guide delta via the shared seq gate (no double text)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'guide-delta', text: 'a', seq: 2 });
    r.apply({ type: 'guide-delta', text: 'b', seq: 3 });
    r.apply({ type: 'guide-delta', text: 'b', seq: 3 });
    r.apply({ type: 'guide-delta', text: 'a', seq: 2 });
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([{ type: 'guide', text: 'ab' }]);
  });

  it('reclones ONLY the touched message — earlier rows keep identity', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'participant', kind: 'message-request', text: 'how do I enroll?', seq: 1 });
    r.apply({ type: 'turn-start', seq: 2 });
    r.apply({ type: 'guide-delta', text: 'first', seq: 3 });
    const userRow = r.state.messages[0];
    r.apply({ type: 'guide-delta', text: ' more', seq: 4 });
    expect(r.state.messages[0]).toBe(userRow);
  });

  it('post-MESSAGE_END continuation emits a DELTA guide segment with append:true', () => {
    const effects: Array<{ name: string; args: unknown[] }> = [];
    const r = createChatStreamReducer({
      transport: 'nats',
      onEffect: e => effects.push(e),
    });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'guide-delta', text: 'in-stream ', seq: 2 });
    r.apply({ type: 'turn-end', seq: 3 });
    r.apply({ type: 'guide-delta', text: 'post-end', seq: 4 });

    const appendEmits = effects.filter(
      e => e.name === 'onSegmentsUpdate' && (e.args[1] as { append?: boolean } | undefined)?.append === true,
    );
    expect(appendEmits).toHaveLength(1);
    expect(appendEmits[0].args[0]).toEqual([{ type: 'guide', text: 'post-end' }]);
    // …and the bubble carries ONE coalesced guide segment, not two.
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([{ type: 'guide', text: 'in-stream post-end' }]);
  });
});

/**
 * `setMessages` is a RAW setter and must not be used to hydrate history.
 *
 * It assigns the thread and nothing else — in particular it does not mark the
 * reducer resumed, which is what makes a later chunk with no preceding
 * `turn-start` take the APPEND branch. Hydrating with it leaves the reducer
 * looking cold, so the first such chunk goes down the cumulative path and
 * REPLACES the restored bubble's segments. When that bubble holds a pending
 * approval card, the control the agent is blocked on disappears with it and
 * there is no way back.
 *
 * `initializeWithState` derives `resumed` from the restored thread, which is
 * why every hydration path must go through it (the SSE adapter always did; the
 * NATS adapter used `setMessages` and hit exactly this).
 */
describe('createChatStreamReducer — history hydration must declare resumed', () => {
  const hydrated = () => [
    {
      id: 'a1',
      role: 'assistant' as const,
      content: '',
      segments: [
        { type: 'text' as const, text: 'I need approval first.' },
        {
          type: 'approval_request' as const,
          data: { requestId: 'r1', command: 'systemctl restart nats' },
          status: 'pending' as const,
        },
      ],
    },
  ];

  it('initializeWithState keeps a hydrated pending approval when a cold delta lands', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.initializeWithState(hydrated());
    // No `turn-start`: the turn opened server-side before we subscribed.
    r.apply({ type: 'text-delta', text: 'Approved, restarting…', seq: 99 });

    const segments = r.state.messages[r.state.messages.length - 1].segments ?? [];
    expect(segments.filter(s => s.type === 'approval_request')).toHaveLength(1);
    expect(segments.map(s => s.type)).toEqual(['text', 'approval_request', 'text']);
  });

  it('CONTRAST: raw setMessages does NOT declare resumed, so the card is lost', () => {
    // Pinned deliberately. This is the footgun, not a desired behaviour: it
    // documents WHY hydration paths must use `initializeWithState`, and it
    // fails loudly if `setMessages` ever starts deriving `resumed` itself
    // (at which point the contrast above is redundant and can go).
    const r = createChatStreamReducer({ transport: 'nats' });
    r.setMessages(hydrated());
    r.apply({ type: 'text-delta', text: 'Approved, restarting…', seq: 99 });

    const segments = r.state.messages[r.state.messages.length - 1].segments ?? [];
    expect(segments.filter(s => s.type === 'approval_request')).toHaveLength(0);
  });
});

/**
 * POST-`MESSAGE_END` ARRIVALS MUST NOT DESTROY THE COMPLETED BUBBLE.
 *
 * `turn-end` calls `accumulator.resetSegments()`, so once a turn has closed the
 * accumulator's "cumulative" array holds ONLY the segment just added. Any case
 * that emits that array in REPLACE mode therefore overwrites the finished
 * answer instead of extending it. `text-delta` and `tool-execution` both branch
 * on `isInStream` for exactly this reason; `approval-request` and `error` did
 * not, and post-END arrivals of both are routine — an approved command executes
 * between the approval bubble and the continuation stream, and the catchup
 * replay re-emits chunks that follow the last `MESSAGE_END` with no preceding
 * `turn-start`.
 */
describe('createChatStreamReducer — post-MESSAGE_END arrivals extend the bubble', () => {
  const trailingSegments = (r: ReturnType<typeof createChatStreamReducer>) =>
    r.state.messages[r.state.messages.length - 1]?.segments ?? [];

  const finishedTurn = () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'Here is your answer.', seq: 2 });
    r.apply({ type: 'turn-end', seq: 3 });
    return r;
  };

  it('an approval-request after turn-end APPENDS instead of replacing', () => {
    const r = finishedTurn();
    r.apply({
      type: 'approval-request',
      requestId: 'r1',
      approvalType: 'CLIENT',
      command: 'systemctl restart nats',
      seq: 4,
    });

    const segments = trailingSegments(r);
    expect(segments.map(s => s.type)).toEqual(['text', 'approval_request']);
    expect(segments[0]).toEqual({ type: 'text', text: 'Here is your answer.' });
  });

  it('an error after turn-end APPENDS instead of replacing', () => {
    const r = finishedTurn();
    r.apply({ type: 'error', title: 'Tool failed', details: 'boom', seq: 4 });

    const segments = trailingSegments(r);
    expect(segments.map(s => s.type)).toEqual(['text', 'error']);
    expect(segments[0]).toEqual({ type: 'text', text: 'Here is your answer.' });
  });

  it('a COLD approval-request (no turn ever seen) still spawns the first bubble', () => {
    // The cold-start path must stay cumulative — otherwise the very first
    // approval of a session has no bubble to append into and renders nothing.
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({
      type: 'approval-request',
      requestId: 'r1',
      approvalType: 'CLIENT',
      command: 'ls',
      seq: 1,
    });
    expect(trailingSegments(r).map(s => s.type)).toEqual(['approval_request']);
  });

  it('an IN-STREAM approval-request stays cumulative (accumulator owns the bubble)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'Checking… ', seq: 2 });
    r.apply({
      type: 'approval-request',
      requestId: 'r1',
      approvalType: 'CLIENT',
      command: 'ls',
      seq: 3,
    });
    expect(trailingSegments(r).map(s => s.type)).toEqual(['text', 'approval_request']);
  });

  it('a hydrated thread survives a post-END approval-request with no turn-start', () => {
    // The catchup-replay shape: history restored the finished turn, and the
    // replay begins AFTER the last MESSAGE_END — so no `turn-start` precedes the
    // card at all. `initializeWithState` with a non-empty thread is what marks
    // the reducer resumed, which is the signal that picks the append branch.
    const r = createChatStreamReducer({ transport: 'nats' });
    r.initializeWithState([
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        segments: [{ type: 'text', text: 'Long hydrated answer body.' }],
      },
    ]);
    r.apply({
      type: 'approval-request',
      requestId: 'r1',
      approvalType: 'CLIENT',
      command: 'ls',
      seq: 3,
    });

    // The card joins the hydrated bubble; the persisted answer is untouched.
    expect(trailingSegments(r).map(s => s.type)).toEqual(['text', 'approval_request']);
    expect(trailingSegments(r)[0]).toEqual({
      type: 'text',
      text: 'Long hydrated answer body.',
    });
  });

  it('a turn-start after a hydrated thread opens a NEW bubble (no overwrite)', () => {
    // The complementary guarantee, so the fix above cannot be "improved" into
    // appending a fresh turn onto a completed one.
    const r = createChatStreamReducer({ transport: 'nats' });
    r.initializeWithState([{ id: 'a1', role: 'assistant', content: '', segments: [{ type: 'text', text: 'Done.' }] }]);
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'Next turn.', seq: 2 });

    expect(r.state.messages).toHaveLength(2);
    expect(r.state.messages[0].segments).toEqual([{ type: 'text', text: 'Done.' }]);
    expect(trailingSegments(r)).toEqual([{ type: 'text', text: 'Next turn.' }]);
  });
});

/**
 * `resetForDialogSwitch()` had NO direct coverage, while `reset()` is pinned
 * through the SSE adapter's goldens. That asymmetry matters because the two
 * functions clear overlapping-but-different field sets by hand: anything added
 * to the reducer and wired into only one of them becomes a silent cross-dialog
 * leak. These fixtures pin the per-dialog boundary field by field, INCLUDING
 * the two survivors that are deliberate — so a future "make them identical"
 * cleanup fails loudly instead of resurrecting a resolved approval as
 * actionable or un-suppressing a replaying catchup.
 */
describe('createChatStreamReducer — resetForDialogSwitch boundary', () => {
  it('clears the cumulative SSE turn text (no cross-dialog answer bleed)', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'question about dialog A' });
    r.apply({ type: 'text-delta', text: 'Answer for A.' });
    expect(r.state.messages[r.state.messages.length - 1].segments).toEqual([{ type: 'text', text: 'Answer for A.' }]);

    r.resetForDialogSwitch();
    // Dialog B is RESUMED mid-turn: history restores the open assistant bubble
    // and live deltas flow straight in, with no `beginSseSend` to zero the
    // cumulative buffer. `sseAppendText` only ever appends, so a surviving
    // buffer prepends the whole previous answer to B's first delta.
    r.initializeWithState([{ id: 'b1', role: 'assistant', content: '', segments: [] }]);
    r.apply({ type: 'text-delta', text: 'Answer for B.' });

    expect(r.state.messages[r.state.messages.length - 1].segments).toEqual([{ type: 'text', text: 'Answer for B.' }]);
  });

  it('clears the per-send SSE maps and the send counter', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'q' });
    r.apply({ type: 'metadata', provider: 'anthropic', modelLabel: 'Opus' });
    expect(r.state.turnMeta.sendCount).toBe(1);
    expect(r.state.turnMeta.meta.get(0)?.modelLabel).toBe('Opus');

    r.resetForDialogSwitch();

    expect(r.state.turnMeta.sendCount).toBe(0);
    expect(r.state.turnMeta.meta.size).toBe(0);
    expect(r.state.turnMeta.sources.size).toBe(0);
  });

  it('SURVIVOR: approvalStatuses outlive the switch (request ids are global)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.setApprovalStatus('req-1', 'approved');
    r.resetForDialogSwitch();
    // A resolved approval whose APPROVAL_RESULT row is absent from the
    // refetched history page must NOT re-render as actionable.
    expect(r.state.approvalStatuses).toEqual({ 'req-1': 'approved' });
  });

  it('SURVIVOR: agent-busy suppression outlives the switch (in-flight refcount)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    // A catchup window opened before the switch; its `-1` is still pending.
    r.adjustAgentBusySuppression(1);
    r.resetForDialogSwitch();

    // The dead tail replays EXECUTING_TOOL with no releasing MESSAGE_END. While
    // the window is open that must NOT engage the busy phase — zeroing the
    // count on a dialog switch is what would let an A → B → A re-entry lock the
    // composer on a still-replaying catchup.
    r.apply(executing('exec-a'));
    expect(r.state.streamingPhase).toBe('idle');

    // Once the window's own `finally` releases it, busy engages again.
    r.adjustAgentBusySuppression(-1);
    r.apply(executing('exec-b'));
    expect(r.state.streamingPhase).toBe('thinking');
  });

  it('clears the seq gate so the new dialog’s own seq space starts fresh', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 500 });
    expect(r.getLastAppliedSeq()).toBe(500);

    r.resetForDialogSwitch();

    // Sequence spaces are per (dialogId, chatType): the next dialog's seq 1 is
    // NOT a redelivery and must be applied, not dropped by a carried-over gate.
    expect(r.getLastAppliedSeq()).toBe(Number.NEGATIVE_INFINITY);
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'fresh', seq: 2 });
    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([{ type: 'text', text: 'fresh' }]);
  });
});

/**
 * The reducer stamps the consumed chunk seq onto the rows it owns. This is not
 * bookkeeping — `mergeHistoryWithRealtime` decides per-message coverage with
 * it, and with the field missing it falls through to a wall-clock fallback that
 * drops live bubbles the backend has not finished persisting.
 */
describe('streamSeq stamping (history-merge coverage signal)', () => {
  it('stamps the trailing assistant with the seq that built it', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 10 });
    r.apply({ type: 'text-delta', text: 'hello', seq: 11 });

    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.role).toBe('assistant');
    expect(last.streamSeq).toBe(11);
  });

  it('keeps the stamp MONOTONIC across a replay of older chunks', () => {
    // JetStream redelivers; coverage must never move backwards, or a replayed
    // early chunk would make an already-covered bubble look uncovered.
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 10 });
    r.apply({ type: 'text-delta', text: 'a', seq: 40 });
    r.apply({ type: 'text-delta', text: 'b', seq: 41 });

    const before = r.state.messages[r.state.messages.length - 1].streamSeq;
    // The gate drops it, but assert the stamp directly too.
    r.apply({ type: 'text-delta', text: 'stale', seq: 20 });

    expect(before).toBe(41);
    expect(r.state.messages[r.state.messages.length - 1].streamSeq).toBe(41);
  });

  it('stamps participant rows too', () => {
    // `user-` synthetics need it to tell a REPLAYED echo (its row is already in
    // history) from a genuine new send that merely repeats an earlier text.
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({
      type: 'participant',
      kind: 'message-request',
      text: 'run it',
      ownerType: 'USER',
      seq: 7,
    });

    const row = r.state.messages[r.state.messages.length - 1];
    expect(row.role).toBe('user');
    expect(row.streamSeq).toBe(7);
  });
});

/**
 * `agentBusy` — the restore-time counterpart of a live `onAgentBusy`. The
 * activity indicator is driven off the phase, and nothing on the wire brings it
 * back after a reload.
 */
describe('agentBusy on initializeWithState', () => {
  it('raises an idle reducer to thinking', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.initializeWithState(null, { agentBusy: true });
    expect(r.state.streamingPhase).toBe('thinking');
  });

  it('leaves an open stream owning the phase', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    expect(r.state.streamingPhase).toBe('streaming');

    r.initializeWithState(null, { agentBusy: true });

    // Only 'idle' upgrades — a downgrade to 'thinking' would report a live
    // stream as merely pending.
    expect(r.state.streamingPhase).toBe('streaming');
  });

  it('stays idle without the flag', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.initializeWithState(null, { existingSegments: [{ type: 'text', text: 'done' }] });
    expect(r.state.streamingPhase).toBe('idle');
  });
});

/**
 * `ask` — the guide-routing clarification card. Not a delta: one chunk carries
 * the whole card, plus the intro sentence that must render as ordinary answer
 * text IN FRONT of it. The post-MESSAGE_END path is the interesting one — the
 * card routinely lands in a continuation, where the delta is appended to the
 * finished bubble rather than replacing it.
 */
describe('createChatStreamReducer — ask cards', () => {
  const ask = (question: string, seq?: number, text?: string): ChatStreamEvent => ({
    type: 'ask',
    ...(text ? { text } : {}),
    question,
    options: [
      { label: 'Find documentation', description: 'How the feature works' },
      { label: 'Work with workspace data' },
    ],
    ...(seq != null ? { seq } : {}),
  });

  it('renders the intro as text ahead of the card, in one bubble', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply(ask('What do you want to work on?', 2, 'Docs, or your own workspace?'));

    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments).toEqual([
      { type: 'text', text: 'Docs, or your own workspace?' },
      {
        type: 'ask',
        question: 'What do you want to work on?',
        options: [
          { label: 'Find documentation', description: 'How the feature works' },
          { label: 'Work with workspace data' },
        ],
      },
    ]);
  });

  it('appends into the finished bubble after MESSAGE_END, keeping the reply', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply({ type: 'text-delta', text: 'Working on it. ', seq: 2 });
    r.apply({ type: 'turn-end', seq: 3 });
    r.apply(ask('Which one?', 4, 'One thing first: '));

    const last = r.state.messages[r.state.messages.length - 1];
    // The intro COALESCES onto the completed reply (same rule as a post-END
    // `text-delta`) — a slice off the accumulator used to drop it here.
    expect(last.segments).toEqual([
      { type: 'text', text: 'Working on it. One thing first: ' },
      {
        type: 'ask',
        question: 'Which one?',
        options: [
          { label: 'Find documentation', description: 'How the feature works' },
          { label: 'Work with workspace data' },
        ],
      },
    ]);
  });

  it('keeps two cards in one turn as separate segments (the card pages them)', () => {
    const r = createChatStreamReducer({ transport: 'nats' });
    r.apply({ type: 'turn-start', seq: 1 });
    r.apply(ask('First?', 2));
    r.apply(ask('Second?', 3));

    const last = r.state.messages[r.state.messages.length - 1];
    expect(last.segments?.map(s => s.type)).toEqual(['ask', 'ask']);
  });
});
