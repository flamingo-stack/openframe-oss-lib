/**
 * `createChatStreamReducer`, the master chat-stream reader, driven through what it reads: the chunk union, and for a Mingo
 * turn the wire chunks `createMingoDecoder` turns into it.
 *
 * What a chunk does to a part is `applyChunk`'s and is pinned in `chat-protocol/__tests__/apply-chunk.test.ts`. This file pins
 * what the reducer adds:
 *
 *   - seq-based idempotency (drop `seq` ≤ last applied, per instance);
 *   - REFERENTIAL STABILITY: untouched messages keep Object.is identity across applies AND across replayed duplicates;
 *   - the phase, an agent working outside an open turn, echo dedup, the direct-mode barrier;
 *   - what this client already knows about a card a replay shows again.
 */

import { describe, it, expect, vi } from 'vitest';
import { approvalStatusOf, isToolPart, type ChatMessage, type ChatPart } from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import type { ChatStreamEntry, UiChunk } from '../../../../chat-protocol/ui-chunks';
import { createChatStreamReducer, OWN_ECHO_AUTHOR_TTL_MS, OWN_ECHO_TTL_MS } from '../chat-stream-reducer';
import type { ChatStreamReducerOptions } from '../chat-stream-reducer';

const chunks = (...list: UiChunk[]): ChatStreamEntry => ({ chunks: list });
const start = (seq?: number): ChatStreamEntry => ({
  ...(seq != null ? { seq } : {}),
  chunks: [{ type: 'start', messageId: `stream-${seq ?? 'x'}` }],
});
const end = (seq?: number): ChatStreamEntry => ({
  ...(seq != null ? { seq } : {}),
  chunks: [{ type: 'finish', finishReason: 'stop' }],
});
const text = (delta: string, seq?: number): ChatStreamEntry => ({
  ...(seq != null ? { seq } : {}),
  chunks: [{ type: 'text-delta', id: 't1', delta }],
});

const participant = ({
  kind = 'message-request',
  seq,
  ...data
}: {
  kind?: 'message-request' | 'direct-message' | 'system';
  text: string;
  ownerType?: string;
  displayName?: string;
  userId?: string;
  seq?: number;
}): ChatStreamEntry => ({
  ...(seq != null ? { seq } : {}),
  chunks: [{ type: 'data-chat-participant', transient: true, data: { kind, ...data } }],
});

/** A reducer fed what the wire says: Mingo chunks through their one decoder. */
function onWire(options?: ChatStreamReducerOptions) {
  const r = createChatStreamReducer(options);
  const decoder = createMingoDecoder();
  const send = (...raw: unknown[]) => {
    for (const chunk of raw) r.apply(decoder.decode(chunk));
  };
  return { r, send };
}

const executing = (execId = 'exec-1', streamSeq?: number) => ({
  type: 'EXECUTING_TOOL',
  integratedToolType: 'SHELL',
  toolFunction: 'run_command',
  title: 'Run command',
  parameters: { cmd: 'ls' },
  toolExecutionRequestId: execId,
  ...(streamSeq != null ? { streamSeq } : {}),
});

const executed = (execId = 'exec-1', streamSeq?: number) => ({
  type: 'EXECUTED_TOOL',
  integratedToolType: 'SHELL',
  toolFunction: 'run_command',
  result: 'ok',
  success: true,
  toolExecutionRequestId: execId,
  ...(streamSeq != null ? { streamSeq } : {}),
});

type Reducer = ReturnType<typeof createChatStreamReducer>;
const trailing = (r: Reducer): ChatMessage => r.state.messages[r.state.messages.length - 1];
/** A part as a row stores it: how far a stream had got is not what it says. */
const said = (part: ChatPart): ChatPart => {
  if (part.type !== 'text' && part.type !== 'reasoning') return part;
  const { state: _state, ...content } = part;
  return content;
};
const body = (message: ChatMessage): ChatPart[] => message.parts.map(said);
const toolParts = (message: ChatMessage) => message.parts.filter(isToolPart);

describe('createChatStreamReducer — seq idempotency', () => {
  it('drops entries whose seq is ≤ the last applied seq', () => {
    const r = createChatStreamReducer();
    r.apply(start(1));
    r.apply(text('a', 2));
    r.apply(text('b', 3));
    // Redelivery of seq 3 and an out-of-order seq 2 must both be dropped.
    r.apply(text('b', 3));
    r.apply(text('a', 2));
    expect(body(trailing(r))).toEqual([{ type: 'text', text: 'ab' }]);
  });

  it('seq-less entries are never gated', () => {
    const r = createChatStreamReducer();
    r.apply(start(5));
    r.apply(text('x'));
    r.apply(text('x'));
    expect(body(trailing(r))).toEqual([{ type: 'text', text: 'xx' }]);
  });

  it('admits every chunk of one entry: one wire chunk can become several', () => {
    const { r, send } = onWire();
    send({ type: 'MESSAGE_START', streamSeq: 1 }, { type: 'TEXT', text: 'hello', streamSeq: 2 });
    expect(body(trailing(r))).toEqual([{ type: 'text', text: 'hello' }]);
  });
});

describe('createChatStreamReducer — referential stability', () => {
  it('applies reclone ONLY the touched message; earlier messages keep identity', () => {
    const r = createChatStreamReducer();
    r.apply(participant({ text: 'hello', seq: 1 }));
    r.apply(start(2));
    r.apply(text('first reply', 3));
    r.apply(end(4));
    const [userBefore, assistantBefore] = r.state.messages;

    // A post-END continuation appends into the trailing assistant only.
    r.apply(text(' …more', 5));
    const [userAfter, assistantAfter] = r.state.messages;
    expect(userAfter).toBe(userBefore);
    expect(assistantAfter).not.toBe(assistantBefore);
    expect(body(assistantAfter)).toEqual([{ type: 'text', text: 'first reply …more' }]);
  });

  it('a replayed duplicate EXECUTED entry (same seq) is dropped: full state identity holds', () => {
    const { r, send } = onWire();
    send(
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'running', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      executing('exec-1', 4),
      executed('exec-1', 5),
    );
    const messagesBefore = r.state.messages;

    send(executed('exec-1', 5)); // JetStream redelivery
    expect(r.state.messages).toBe(messagesBefore);
  });

  it('a replayed seq-less duplicate EXECUTED merge is a value-level no-op: prior references returned', () => {
    const { r, send } = onWire();
    send(
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'running' },
      { type: 'MESSAGE_END' },
      executing(),
      executed(),
    );
    const messagesBefore = r.state.messages;
    const trailingBefore = trailing(r);

    // Same values, new chunk object, no seq (plain-NATS replay).
    send(executed());
    expect(r.state.messages).toBe(messagesBefore);
    expect(trailing(r)).toBe(trailingBefore);
  });

  it('a redelivered EXECUTING after EXECUTED never downgrades (prior references returned)', () => {
    const { r, send } = onWire();
    send(executing(), executed());
    const before = r.state.messages;
    send(executing());
    expect(r.state.messages).toBe(before);
  });
});

describe('createChatStreamReducer — a tool that runs and a gate', () => {
  it('a tool run on Mingo grants the newest single gate: it only runs after its gate was granted', () => {
    const { r, send } = onWire();
    send(
      { type: 'MESSAGE_START' },
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'req-1',
        approvalType: 'CLIENT',
        command: 'systemctl restart nats',
        explanation: 'Restart the broker',
      },
      // Observer stream: EXECUTING arrives with NO APPROVAL_RESULT chunk.
      executing(),
    );
    const card = toolParts(trailing(r)).find(part => part.toolCallId === 'req-1');
    expect(card && approvalStatusOf(card)).toBe('approved');
  });

  it("a tool row on the hub's stream draws beside a pending card and never approves it", () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'open a ticket' });
    r.apply(chunks({ type: 'tool-input-available', toolCallId: 'prop-1', toolName: 'create_ticket', input: {} }));
    r.apply(chunks({ type: 'tool-approval-request', approvalId: 'prop-1', toolCallId: 'prop-1' }));
    r.apply(chunks({ type: 'tool-input-available', toolCallId: 'exec-1', toolName: 'read_kb', input: {} }));
    const [card, row] = toolParts(trailing(r));
    expect(approvalStatusOf(card)).toBe('pending');
    expect(row.state).toBe('input-available');
  });
});

describe('createChatStreamReducer — a call the model got wrong', () => {
  it('is an error on its own row, with what it asked, and nothing reads as running', () => {
    const r = createChatStreamReducer();
    r.apply(start(1));
    r.apply(
      chunks({
        type: 'tool-input-error',
        toolCallId: 'bad-1',
        toolName: 'search',
        input: { q: 1 },
        errorText: 'q must be a string',
        dynamic: true,
      }),
    );
    expect(toolParts(trailing(r))[0]).toMatchObject({
      toolCallId: 'bad-1',
      state: 'output-error',
      input: { q: 1 },
      errorText: 'q must be a string',
    });
    r.apply(end(2));
    expect(r.state.streamingPhase).toBe('idle');
  });
});

describe('createChatStreamReducer — the phase', () => {
  it('a card is not a run: an approval waits on the user, and the composer stays free', () => {
    const { r, send } = onWire();
    send({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'batch-1',
      approvalType: 'CLIENT',
      toolCalls: [{ toolExecutionRequestId: 'a', toolName: 'x', requiresApproval: true }],
    });
    expect(r.state.streamingPhase).toBe('idle');
  });

  it('nor is a row of a batch that needs no approval of its own', () => {
    const { r, send } = onWire();
    send({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'batch-1',
      approvalType: 'CLIENT',
      toolCalls: [{ toolExecutionRequestId: 'a', toolName: 'x', requiresApproval: false }],
    });
    expect(r.state.streamingPhase).toBe('idle');
  });

  it('an EXECUTING outside a turn means the agent is working; its result does not', () => {
    const { r, send } = onWire();
    send(executing());
    expect(r.state.streamingPhase).toBe('thinking');

    const { r: other, send: sendOther } = onWire();
    sendOther(executed());
    expect(other.state.streamingPhase).toBe('idle');
  });

  it('an approved result locks the composer, a rejected one keeps it free', () => {
    const approved = onWire();
    approved.send({ type: 'APPROVAL_RESULT', approvalRequestId: 'req', approved: true });
    expect(approved.r.state.streamingPhase).toBe('thinking');

    const rejected = onWire();
    rejected.send({ type: 'APPROVAL_RESULT', approvalRequestId: 'req', approved: false });
    expect(rejected.r.state.streamingPhase).toBe('idle');
  });

  it('opens at a turn, and a send waits as `thinking` until the turn or its first text', () => {
    const r = createChatStreamReducer();
    r.pushOptimisticSend('hi');
    expect(r.state.streamingPhase).toBe('thinking');
    r.apply(text('cold'));
    expect(r.state.streamingPhase).toBe('streaming');
    r.apply(end());
    expect(r.state.streamingPhase).toBe('idle');
    r.apply(start());
    expect(r.state.streamingPhase).toBe('streaming');
  });

  it('text after a turn ended does not reopen it: nothing would close it again', () => {
    const r = createChatStreamReducer();
    r.apply(start());
    r.apply(end());
    r.apply(text('continuation'));
    expect(r.state.streamingPhase).toBe('idle');
  });

  it('an error drawn inline unlocks the composer unless an open stream owns the phase', () => {
    const open = onWire();
    open.send({ type: 'MESSAGE_START' }, { type: 'ERROR', error: 'boom' });
    expect(open.r.state.streamingPhase).toBe('streaming');

    const waiting = onWire();
    waiting.r.pushOptimisticSend('hi');
    waiting.send({ type: 'ERROR', error: 'boom' });
    expect(waiting.r.state.streamingPhase).toBe('idle');
    expect(trailing(waiting.r).parts).toEqual([{ type: 'data-error', data: { title: 'boom' } }]);
  });
});

describe('createChatStreamReducer — the message a stream builds', () => {
  it("a send's placeholder takes the turn's id", () => {
    const r = createChatStreamReducer();
    r.pushOptimisticSend('hi');
    const placeholder = trailing(r).id;
    r.apply(chunks({ type: 'start', messageId: 'server-id' }));
    r.apply(text('hello'));
    expect(r.state.messages).toHaveLength(2);
    expect(trailing(r).id).toBe('server-id');
    expect(trailing(r).id).not.toBe(placeholder);
  });

  it('a placeholder a stale turn-end left unnamed is still the one a turn fills', () => {
    const r = createChatStreamReducer();
    r.pushOptimisticSend('hi');
    r.apply(end());
    r.apply(chunks({ type: 'start', messageId: 'server-id' }));
    expect(r.state.messages.map(m => m.id)[1]).toBe('server-id');
    expect(r.state.messages).toHaveLength(2);
  });

  it('a new turn never overwrites a completed bubble', () => {
    const r = createChatStreamReducer();
    r.apply(start(1));
    r.apply(text('first', 2));
    r.apply(end(3));
    r.apply(start(4));
    r.apply(text('second', 5));
    expect(r.state.messages.map(body)).toEqual([[{ type: 'text', text: 'first' }], [{ type: 'text', text: 'second' }]]);
  });

  it('a start with no id continues the message named: the card an approval answers', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'do it' });
    r.apply(chunks({ type: 'start', messageId: 'card' }));
    r.apply(chunks({ type: 'tool-input-available', toolCallId: 'p1', toolName: 'x', input: {} }));
    r.apply(chunks({ type: 'tool-approval-request', approvalId: 'p1', toolCallId: 'p1' }));
    r.apply(end());
    r.endSseTurn();

    r.continueMessage('card');
    expect(r.state.streamingPhase).toBe('thinking');
    r.apply(chunks({ type: 'start' }));
    r.apply(chunks({ type: 'tool-output-available', toolCallId: 'p1', output: { ok: true } }));
    r.apply(chunks({ type: 'text-delta', id: 't1', delta: 'Done.' }));
    r.apply(end());
    r.endSseTurn();

    expect(r.state.messages.map(m => m.id)).toEqual([r.state.messages[0].id, 'card']);
    expect(trailing(r).parts.map(part => part.type)).toEqual(['dynamic-tool', 'text']);
    expect(toolParts(trailing(r))[0].state).toBe('output-available');
    expect(r.state.streamingPhase).toBe('idle');
  });

  it('a replay of an incomplete tail takes that message over, and its old body gives way at the first content', () => {
    const r = createChatStreamReducer();
    r.initializeWithState([
      {
        id: 'persisted',
        role: 'assistant',
        parts: [
          { type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://x.test/1' },
          { type: 'text', text: 'partial' },
        ],
      },
    ]);
    r.armAdoptTrailingAssistant(true);
    r.apply(start(5));
    // Nothing has replaced it yet: a replay that stops here must not blank the bubble.
    expect(body(trailing(r)).map(part => part.type)).toEqual(['source-url', 'text']);

    r.apply(text('partial and the rest', 6));
    expect(r.state.messages).toHaveLength(1);
    expect(trailing(r).id).toBe('persisted');
    expect(body(trailing(r))).toEqual([
      { type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://x.test/1' },
      { type: 'text', text: 'partial and the rest' },
    ]);
  });

  it('the adopt flag is one-shot: the next turn opens its own bubble', () => {
    const r = createChatStreamReducer();
    r.initializeWithState([{ id: 'persisted', role: 'assistant', parts: [{ type: 'text', text: 'partial' }] }]);
    r.armAdoptTrailingAssistant(true);
    r.apply(start(5));
    r.apply(end(6));
    r.apply(start(7));
    expect(r.state.messages).toHaveLength(2);
  });

  it('metadata reaches the message being built and the live model', () => {
    const { r, send } = onWire();
    r.pushOptimisticSend('hi');
    send({
      type: 'AI_METADATA',
      modelDisplayName: 'Claude Sonnet',
      modelName: 'claude-sonnet-x',
      providerName: 'anthropic',
      contextWindow: 200000,
    });
    expect(r.state.liveModel).toEqual({
      provider: 'anthropic',
      modelLabel: 'Claude Sonnet',
      contextWindowMaxTokens: 200000,
    });
    expect(trailing(r).metadata).toMatchObject({ model: 'claude-sonnet-x', provider: 'anthropic' });
  });

  it('tells a host that shows the model what the stream said', () => {
    const effects: unknown[] = [];
    const { send } = onWire({ onEffect: effect => effects.push(effect) });
    send({ type: 'AI_METADATA', modelName: 'm', providerName: 'p', contextWindow: 1 });
    expect(effects).toEqual([{ name: 'onMetadata', args: [{ modelName: 'm', providerName: 'p', contextWindow: 1 }] }]);
  });

  it('a failed turn keeps what it said and ends with the failure on the same message', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'q' });
    r.apply(text('partial'));
    r.failSseTurn('The server is busy');
    expect(r.state.messages).toHaveLength(2);
    expect(body(trailing(r))).toEqual([
      { type: 'text', text: 'partial' },
      { type: 'data-error', data: { title: 'The server is busy' } },
    ]);
    expect(trailing(r).role).toBe('assistant');
    expect(r.state.streamingPhase).toBe('idle');
  });

  it('a failed send with nothing said reads as the failure alone', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'q' });
    r.failSseTurn('The server is busy');
    r.endSseTurn();
    expect(body(trailing(r))).toEqual([{ type: 'data-error', data: { title: 'The server is busy' } }]);
  });

  it('a send carries its attachments as file parts after its text', () => {
    const r = createChatStreamReducer();
    const file = { type: 'file' as const, mediaType: 'image/png', filename: 'a.png', url: '/view/a.png?t=1' };
    r.beginSseSend({ text: 'look', files: [file] });
    expect(r.state.messages[0].parts).toEqual([{ type: 'text', text: 'look' }, file]);
  });

  it('endSseTurn drops an empty trailing placeholder', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'q' });
    r.apply(text('answer'));
    r.endSseTurn();
    // A send that says nothing adds ONLY the assistant placeholder…
    r.beginSseSend({ text: '', hidden: true });
    expect(r.state.messages).toHaveLength(3);
    expect(r.state.messages[2].role).toBe('assistant');
    // …and a stream that writes nothing leaves the thread exactly as it was: no blank bubble.
    r.endSseTurn();
    expect(r.state.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });
});

describe('createChatStreamReducer — what this client knows about a card', () => {
  const card = (id: string, streamSeq?: number) => ({
    type: 'APPROVAL_REQUEST',
    approvalRequestId: id,
    approvalType: 'CLIENT',
    command: 'reboot',
    ...(streamSeq != null ? { streamSeq } : {}),
  });

  it('a card a replay shows again keeps its known answer', () => {
    const { r, send } = onWire({
      approvalStatuses: { 'req-1': 'approved', 'req-2': 'rejected', 'req-3': 'cancelled' },
    });
    send(card('req-1'), card('req-2'), card('req-3'), card('req-4'));
    expect(toolParts(trailing(r)).map(approvalStatusOf)).toEqual(['approved', 'rejected', 'cancelled', 'pending']);
  });

  it('a batch card keeps the answer known for its request', () => {
    const { r, send } = onWire({ approvalStatuses: { 'batch-1': 'approved' } });
    send({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'batch-1',
      approvalType: 'CLIENT',
      toolCalls: [{ toolExecutionRequestId: 'a', toolName: 'x', requiresApproval: true }],
    });
    expect(toolParts(trailing(r)).map(approvalStatusOf)).toEqual(['approved']);
  });

  it('a result is remembered, even for a card this client has not seen', () => {
    const { r, send } = onWire();
    send({ type: 'APPROVAL_RESULT', approvalRequestId: 'req-1', approved: false });
    expect(r.state.approvalStatuses).toEqual({ 'req-1': 'rejected' });
  });

  it('a tool run is not remembered as an approval: only a gate it grants is', () => {
    const { r, send } = onWire();
    send(card('req-1'), executing('exec-1'));
    expect(r.state.approvalStatuses).toEqual({ 'req-1': 'approved' });
  });

  it('projectApprovalResolution flips a card and an offer, whoever told it', () => {
    const { r, send } = onWire();
    send(card('req-1'), { type: 'ESCALATION_OFFER', offerId: 'offer-1', state: 'PENDING', text: 'Hand off?' });
    r.projectApprovalResolution('req-1', 'rejected', 'Jane');
    r.projectApprovalResolution('offer-1', 'approved', 'Jane');
    const [tool, offer] = trailing(r).parts;
    expect(isToolPart(tool) && approvalStatusOf(tool)).toBe('rejected');
    expect(offer).toMatchObject({ data: { status: 'approved', resolvedByName: 'Jane' } });
    expect(r.state.approvalStatuses).toEqual({ 'req-1': 'rejected', 'offer-1': 'approved' });
  });

  it('projectToolChunk merges only into a card this side holds', () => {
    const { r, send } = onWire();
    send(executing('exec-1'));
    const before = r.state.messages;
    r.projectToolChunk({ type: 'tool-output-available', toolCallId: 'elsewhere', output: 'x' });
    expect(r.state.messages).toBe(before);
    r.projectToolChunk({ type: 'tool-output-available', toolCallId: 'exec-1', output: 'ok' });
    expect(toolParts(trailing(r))[0].state).toBe('output-available');
  });
});

describe('createChatStreamReducer — participant dedup', () => {
  it('optimistic echo consumes exactly one MESSAGE_REQUEST twin', () => {
    const r = createChatStreamReducer();
    r.pushOptimisticSend('yes');
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    // Echo of our own send → consumed, no duplicate row.
    r.apply(participant({ kind: 'message-request', text: 'yes' }));
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    // A genuinely repeated send from another session still renders.
    r.apply(participant({ kind: 'message-request', text: 'yes', seq: 10 }));
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('ADMIN echo is NOT consumed by default (it is a technician reply)', () => {
    const r = createChatStreamReducer();
    r.pushOptimisticSend('same words');
    // An ADMIN-authored row that happens to match our text is somebody
    // else's message on hosts where the operator is not the admin.
    r.apply(participant({ kind: 'message-request', text: 'same words', ownerType: 'ADMIN' }));
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('ADMIN echo IS consumed when the host declares ownEchoIncludesAdmin', () => {
    const r = createChatStreamReducer({ ownEchoIncludesAdmin: true });
    r.pushOptimisticSend('same words');
    r.apply(participant({ kind: 'message-request', text: 'same words', ownerType: 'ADMIN' }));
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    // Still one-shot: a second ADMIN row with the same text renders.
    r.apply(participant({ kind: 'message-request', text: 'same words', ownerType: 'ADMIN', seq: 11 }));
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
  });

  it('participant seen-seq set dedups redelivered rows', () => {
    const r = createChatStreamReducer();
    r.apply(participant({ kind: 'direct-message', text: 'human here', seq: 7 }));
    const before = r.state.messages;
    r.apply(participant({ kind: 'direct-message', text: 'human here', seq: 7 }));
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
      ownEchoIncludesAdmin: true,
      selfUserId: 'tech-a',
    });
    r.pushOptimisticSend('ok');
    // Tech B's message — same text, same ADMIN owner type, different author.
    r.apply(
      participant({
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-b',
        seq: 1,
      }),
    );
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    // Our OWN echo still dedups.
    r.apply(
      participant({
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 2,
      }),
    );
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('on it');
      r.apply(participant({ kind: 'message-request', text: 'on it', ownerType: 'ADMIN', seq: 1 }));
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // The misconfiguration is surfaced — once, not per row.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('selfUserId');
      r.pushOptimisticSend('again');
      r.apply(participant({ kind: 'message-request', text: 'again', ownerType: 'ADMIN', seq: 2 }));
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('selfUserId accepts a GETTER resolved at event time (late auth / user switch)', () => {
    let self: string | undefined;
    const r = createChatStreamReducer({
      ownEchoIncludesAdmin: true,
      selfUserId: () => self,
    });
    // Auth rehydrates AFTER the reducer was created.
    self = 'tech-a';
    r.pushOptimisticSend('ok');
    r.apply(
      participant({
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-b',
        seq: 1,
      }),
    );
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    // Log out, log in as somebody else — the guard tracks it without a reload.
    self = 'tech-b';
    r.pushOptimisticSend('ok');
    r.apply(
      participant({
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-b',
        seq: 2,
      }),
    );
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('on it');
      now += OWN_ECHO_TTL_MS + 1_000;
      r.apply(
        participant({
          kind: 'message-request',
          text: 'on it',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 9,
        }),
      );
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // Still one-shot — a second author-matched row with the same text renders.
      r.apply(
        participant({
          kind: 'message-request',
          text: 'on it',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 10,
        }),
      );
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      // Tab A sends "ok" — the echo never lands (dropped frame / reconnect gap).
      r.pushOptimisticSend('ok');
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // An HOUR later the same user sends "ok" from tab B. The row is
      // author-matched, but the stale entry must NOT eat it.
      now += 60 * 60_000;
      r.apply(
        participant({
          kind: 'message-request',
          text: 'ok',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 7,
        }),
      );
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /**
   * REGRESSION (round 6): `OWN_ECHO_AUTHOR_TTL_MS` alone preserved TEN MINUTES
   * of cross-tab message loss. A `finish` proves the server finished the
   * send, so an echo that has not landed by then never will — the entry must
   * be disarmed at that boundary, cutting the window to one turn.
   */
  it('a finish disarms a stale echo, so a second-tab send minutes later RENDERS', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      // Tab A sends "ok" — the echo never lands.
      r.pushOptimisticSend('ok');
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
      // The turn runs and ends: the server is demonstrably done with that send.
      r.apply(start(2));
      r.apply(end(3));
      // Five minutes later — well INSIDE the 10-minute backstop — the same
      // user sends "ok" from tab B. It must render, not be swallowed.
      now += 5 * 60_000;
      r.apply(
        participant({
          kind: 'message-request',
          text: 'ok',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 7,
        }),
      );
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /** The echo entry is still consumed on the NORMAL path: the server's echo
   *  arrives before the turn ends, so `finish` must not break dedup. */
  it('an echo landing BEFORE finish is still deduped', () => {
    const r = createChatStreamReducer({
      ownEchoIncludesAdmin: true,
      selfUserId: 'tech-a',
    });
    r.pushOptimisticSend('ok');
    r.apply(
      participant({
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'tech-a',
        seq: 2,
      }),
    );
    r.apply(start(3));
    r.apply(end(4));
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });

  /**
   * REGRESSION (round 7): the round-6 purge was UNCONDITIONAL, so a `finish`
   * arriving between a send and its echo disarmed an entry that was never
   * stale — the echo then rendered a SECOND user bubble. Reachable via a
   * reconnect catch-up replay (a pre-disconnect MESSAGE_END delivered after
   * the user has already sent) and via the approval-interrupt path (sending
   * while an approval pends cancels the in-flight turn, so the interrupted
   * turn's MESSAGE_END lands after the new send armed its entry). Only
   * entries armed BEFORE the turn being ended may be purged.
   */
  it('a finish arriving between a send and its echo does NOT duplicate the bubble', () => {
    const r = createChatStreamReducer({
      ownEchoIncludesAdmin: true,
      selfUserId: 'me',
    });
    r.pushOptimisticSend('hello world');
    // A stale MESSAGE_END for a turn that started before this send (catch-up
    // replay / approval interrupt) — no start was ever observed here.
    r.apply(end(10));
    r.apply(
      participant({
        kind: 'message-request',
        text: 'hello world',
        ownerType: 'ADMIN',
        userId: 'me',
        seq: 11,
      }),
    );
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });

  /**
   * DOCUMENTED LIMIT, not an aspiration: when a reconnect catch-up replay
   * delivers BOTH a pre-disconnect `start` and its `finish` after the
   * user has sent, the replayed `start` restamps the arrival-time
   * boundary and the `finish` purges the still-live entry — the echo then
   * renders a SECOND bubble. The chunk union carries no event-own
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'me',
      });
      r.pushOptimisticSend('hello');
      now += 5; // the replay lands a few ms after the send
      r.apply(start(1));
      r.apply(end(2));
      r.apply(
        participant({
          kind: 'message-request',
          text: 'hello',
          ownerType: 'ADMIN',
          userId: 'me',
          seq: 3,
        }),
      );
      // Two bubbles: the optimistic one and the un-deduped echo.
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    } finally {
      Date.now = realNow;
    }
  });

  /** Same shape, but the interrupted turn's `start` WAS observed and the
   *  send happened after it — the entry belongs to the current turn and must
   *  survive its `finish`. */
  it('an echo armed DURING the turn survives that finish', () => {
    const realNow = Date.now;
    try {
      let now = 1_000_000;
      Date.now = () => now;
      const r = createChatStreamReducer({
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.apply(start(2));
      now += 1; // the user types and sends while the turn streams
      r.pushOptimisticSend('hello world');
      r.apply(end(3));
      r.apply(
        participant({
          kind: 'message-request',
          text: 'hello world',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 4,
        }),
      );
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('ok');
      now += OWN_ECHO_AUTHOR_TTL_MS - 1;
      r.apply(
        participant({
          kind: 'message-request',
          text: 'ok',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 7,
        }),
      );
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('ok');
      now += OWN_ECHO_TTL_MS + 1;
      // Unattributed row: outside the short TTL, so it renders (2 user rows)…
      r.apply(participant({ kind: 'message-request', text: 'ok', ownerType: 'ADMIN', seq: 5 }));
      expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(2);
      // …and our own late echo, declared ours, is still consumed.
      r.apply(
        participant({
          kind: 'message-request',
          text: 'ok',
          ownerType: 'ADMIN',
          userId: 'tech-a',
          seq: 6,
        }),
      );
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
        ownEchoIncludesAdmin: true,
        selfUserId: 'tech-a',
      });
      r.pushOptimisticSend('done');
      now += OWN_ECHO_TTL_MS + 1;
      r.apply(participant({ kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 }));
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
      const r = createChatStreamReducer({ ownEchoIncludesAdmin: true });
      r.pushOptimisticSend('done');
      // Our echo never lands. Much later, somebody else says the same thing.
      now += OWN_ECHO_TTL_MS + 1;
      r.apply(participant({ kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 }));
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
      const r = createChatStreamReducer({ ownEchoIncludesAdmin: true });
      r.pushOptimisticSend('done');
      now += OWN_ECHO_TTL_MS - 1;
      r.apply(participant({ kind: 'message-request', text: 'done', ownerType: 'ADMIN', seq: 5 }));
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
    recreated.initializeWithState([{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hello world' }] }], {
      pendingEchoes: parked,
    });
    recreated.apply(
      participant({
        kind: 'message-request',
        text: 'hello world',
        ownerType: 'ADMIN',
        userId: 'me',
        seq: 11,
      }),
    );
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
    r.apply(
      participant({
        kind: 'message-request',
        text: 'hello world',
        ownerType: 'ADMIN',
        userId: 'me',
        seq: 11,
      }),
    );
    expect(parked).toHaveLength(1);
    expect(parked[0]?.text).toBe('hello world');
  });

  it('drops parked entries already past the author TTL', () => {
    const r = createChatStreamReducer(echoOptions);
    r.initializeWithState(null, {
      pendingEchoes: [{ text: 'ok', at: Date.now() - OWN_ECHO_AUTHOR_TTL_MS - 1 }],
    });
    expect(r.getPendingEchoes()).toHaveLength(0);
    r.apply(
      participant({
        kind: 'message-request',
        text: 'ok',
        ownerType: 'ADMIN',
        userId: 'me',
        seq: 3,
      }),
    );
    expect(r.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
  });
});

describe('createChatStreamReducer — a restored thread', () => {
  it('an EMPTY restore: a cold delta spawns the first bubble', () => {
    const r = createChatStreamReducer();
    r.initializeWithState([], { lastAppliedSeq: 1 });
    r.apply(text('hello', 2));
    expect(r.state.messages.filter(m => m.role === 'assistant')).toHaveLength(1);
    expect(r.getLastAppliedSeq()).toBe(2);
  });

  it('a NON-EMPTY restore: a delta extends the restored bubble', () => {
    const r = createChatStreamReducer();
    r.initializeWithState([{ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'prior' }] }]);
    r.apply(text(' more', 2));
    expect(r.state.messages).toHaveLength(1);
    expect(body(trailing(r))).toEqual([{ type: 'text', text: 'prior more' }]);
  });
});

describe('createChatStreamReducer — mergeApprovalStatuses precedence', () => {
  it('stream-learned resolution beats a LAGGING persisted pending', () => {
    const r = createChatStreamReducer();
    r.setApprovalStatus('req-1', 'approved');
    r.mergeApprovalStatuses({ 'req-1': 'pending' });
    expect(r.state.approvalStatuses['req-1']).toBe('approved');
  });

  it('persisted resolution beats a STALE stream-learned pending (second tab)', () => {
    const { r, send } = onWire();
    // This tab saw the request; the operator approved it in another tab.
    send({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req-2',
      command: 'rm -rf /tmp/x',
      approvalType: 'CLIENT',
      streamSeq: 1,
    });
    expect(r.state.approvalStatuses['req-2']).toBeUndefined();
    r.setApprovalStatus('req-2', 'pending');
    r.mergeApprovalStatuses({ 'req-2': 'approved' });
    expect(r.state.approvalStatuses['req-2']).toBe('approved');
  });

  it('fills unknown ids and is a no-op when nothing changes', () => {
    const r = createChatStreamReducer();
    r.setApprovalStatus('req-3', 'rejected');
    r.mergeApprovalStatuses({ 'req-3': 'rejected', 'req-4': 'cancelled' });
    expect(r.state.approvalStatuses).toEqual({ 'req-3': 'rejected', 'req-4': 'cancelled' });
    const before = r.state.approvalStatuses;
    r.mergeApprovalStatuses({ 'req-3': 'pending', 'req-4': 'cancelled' });
    expect(r.state.approvalStatuses).toBe(before);
  });
});

/**
 * POST-`MESSAGE_END` ARRIVALS MUST NOT DESTROY THE COMPLETED BUBBLE.
 *
 * They are routine: an approved command executes between the approval bubble and the continuation stream, and the catchup
 * replay re-emits chunks that follow the last `MESSAGE_END` with no preceding `start`.
 */
describe('createChatStreamReducer — post-MESSAGE_END arrivals extend the bubble', () => {
  const approvalChunk = (streamSeq: number) => ({
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'r1',
    approvalType: 'CLIENT',
    command: 'systemctl restart nats',
    streamSeq,
  });

  const finishedTurn = () => {
    const wire = onWire();
    wire.send(
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Here is your answer.', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
    );
    return wire;
  };

  it('an approval card after the end APPENDS', () => {
    const { r, send } = finishedTurn();
    send(approvalChunk(4));
    expect(r.state.messages).toHaveLength(1);
    expect(trailing(r).parts.map(part => part.type)).toEqual(['text', 'dynamic-tool']);
    expect(said(trailing(r).parts[0])).toEqual({ type: 'text', text: 'Here is your answer.' });
  });

  it('an error after the end APPENDS', () => {
    const { r, send } = finishedTurn();
    send({ type: 'ERROR', error: 'Tool failed', details: 'boom', streamSeq: 4 });
    expect(trailing(r).parts.map(part => part.type)).toEqual(['text', 'data-error']);
    expect(trailing(r).parts[1]).toEqual({ type: 'data-error', data: { title: 'Tool failed', details: 'boom' } });
  });

  it('a COLD approval card (no turn ever seen) spawns the first bubble', () => {
    const { r, send } = onWire();
    send(approvalChunk(1));
    expect(r.state.messages).toHaveLength(1);
    expect(trailing(r).parts.map(part => part.type)).toEqual(['dynamic-tool']);
  });

  it('a hydrated thread survives a post-END card with no turn opening', () => {
    // The catchup-replay shape: history restored the finished turn, and the replay begins AFTER the last MESSAGE_END.
    const { r, send } = onWire();
    r.initializeWithState([
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Long hydrated answer body.' }] },
    ]);
    send(approvalChunk(3));
    expect(trailing(r).parts.map(part => part.type)).toEqual(['text', 'dynamic-tool']);
    expect(said(trailing(r).parts[0])).toEqual({ type: 'text', text: 'Long hydrated answer body.' });
  });

  it('a hydrated pending approval stays when a cold delta lands', () => {
    const { r, send } = onWire();
    r.initializeWithState(processedCard());
    // No turn opening: the turn opened server-side before we subscribed.
    send({ type: 'TEXT', text: 'Approved, restarting…', streamSeq: 99 });
    expect(trailing(r).parts.map(part => part.type)).toEqual(['text', 'dynamic-tool', 'text']);
  });

  it('a turn after a hydrated thread opens a NEW bubble (no overwrite)', () => {
    const r = createChatStreamReducer();
    r.initializeWithState([{ id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Done.' }] }]);
    r.apply(start(1));
    r.apply(text('Next turn.', 2));

    expect(r.state.messages.map(body)).toEqual([
      [{ type: 'text', text: 'Done.' }],
      [{ type: 'text', text: 'Next turn.' }],
    ]);
  });
});

function processedCard(): ChatMessage[] {
  return [
    {
      id: 'a1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'I need approval first.' },
        {
          type: 'dynamic-tool',
          toolName: 'command',
          toolCallId: 'r1',
          title: 'systemctl restart nats',
          state: 'approval-requested',
          input: {},
          approval: { id: 'r1' },
        },
      ],
    },
  ];
}

/**
 * The two reset functions clear overlapping-but-different field sets: anything added to the reducer and wired into only one
 * of them becomes a silent cross-dialog leak. These fixtures pin the per-dialog boundary field by field, INCLUDING the two
 * survivors that are deliberate, so a future "make them identical" cleanup fails loudly instead of resurrecting a resolved
 * approval as actionable or un-suppressing a replaying catchup.
 */
describe('createChatStreamReducer — resetForDialogSwitch boundary', () => {
  it('the next dialog starts from its own message, with no bleed from the last stream', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'question about dialog A' });
    r.apply(text('Answer for A.'));

    r.resetForDialogSwitch();
    // Dialog B is RESUMED mid-turn: history restores the open assistant bubble and live deltas flow straight in.
    r.initializeWithState([{ id: 'b1', role: 'assistant', parts: [] }]);
    r.apply(text('Answer for B.'));

    expect(r.state.messages).toHaveLength(1);
    expect(body(trailing(r))).toEqual([{ type: 'text', text: 'Answer for B.' }]);
  });

  it('clears the live model', () => {
    const { r, send } = onWire();
    send({ type: 'AI_METADATA', modelName: 'm', providerName: 'p', contextWindow: 1 });
    expect(r.state.liveModel).not.toBeNull();
    r.resetForDialogSwitch();
    expect(r.state.liveModel).toBeNull();
  });

  it('SURVIVOR: approvalStatuses outlive the switch (request ids are global)', () => {
    const r = createChatStreamReducer();
    r.setApprovalStatus('req-1', 'approved');
    r.resetForDialogSwitch();
    // A resolved approval whose APPROVAL_RESULT row is absent from the
    // refetched history page must NOT re-render as actionable.
    expect(r.state.approvalStatuses).toEqual({ 'req-1': 'approved' });
  });

  it('SURVIVOR: agent-busy suppression outlives the switch (in-flight refcount)', () => {
    const { r, send } = onWire();
    // A catchup window opened before the switch; its `-1` is still pending.
    r.adjustAgentBusySuppression(1);
    r.resetForDialogSwitch();

    // The dead tail replays EXECUTING_TOOL with no releasing MESSAGE_END. While
    // the window is open that must NOT engage the busy phase: zeroing the
    // count on a dialog switch is what would let an A → B → A re-entry lock the
    // composer on a still-replaying catchup.
    send(executing('exec-a'));
    expect(r.state.streamingPhase).toBe('idle');

    // Once the window's own `finally` releases it, busy engages again.
    r.adjustAgentBusySuppression(-1);
    send(executing('exec-b'));
    expect(r.state.streamingPhase).toBe('thinking');
  });

  it('clears the seq gate so the new dialog’s own seq space starts fresh', () => {
    const r = createChatStreamReducer();
    r.apply(start(500));
    expect(r.getLastAppliedSeq()).toBe(500);

    r.resetForDialogSwitch();

    // Sequence spaces are per (dialogId, chatType): the next dialog's seq 1 is
    // NOT a redelivery and must be applied, not dropped by a carried-over gate.
    expect(r.getLastAppliedSeq()).toBe(Number.NEGATIVE_INFINITY);
    r.apply(start(1));
    r.apply(text('fresh', 2));
    expect(body(trailing(r))).toEqual([{ type: 'text', text: 'fresh' }]);
  });
});

/**
 * The reducer stamps the consumed chunk seq onto the rows it owns. This is not
 * bookkeeping: `mergeHistoryWithRealtime` decides per-message coverage with
 * it, and with the field missing it falls through to a wall-clock fallback that
 * drops live bubbles the backend has not finished persisting.
 */
describe('streamSeq stamping (history-merge coverage signal)', () => {
  it('stamps the row with the seq of the content that built it', () => {
    const r = createChatStreamReducer();
    r.apply(start(10));
    r.apply(text('hello', 11));

    expect(trailing(r).role).toBe('assistant');
    expect(trailing(r).metadata?.streamSeq).toBe(11);
  });

  it('never from a control chunk: a row must not claim seqs past its content', () => {
    const r = createChatStreamReducer();
    r.apply(start(10));
    r.apply(text('hello', 11));
    r.apply(end(12));
    expect(trailing(r).metadata?.streamSeq).toBe(11);
  });

  it('a result stamps the row it landed on, not the trailing one', () => {
    const { r, send } = onWire();
    send(executing('exec-1', 5));
    const row = trailing(r).id;
    send({ type: 'MESSAGE_REQUEST', text: 'meanwhile', streamSeq: 6 });
    send(executed('exec-1', 7));
    expect(r.state.messages.find(message => message.id === row)?.metadata?.streamSeq).toBe(7);
    expect(trailing(r).metadata?.streamSeq).toBe(6);
  });

  it('stamps participant rows too', () => {
    // `user-` synthetics need it to tell a REPLAYED echo (its row is already in
    // history) from a genuine new send that merely repeats an earlier text.
    const r = createChatStreamReducer();
    r.apply(participant({ text: 'run it', ownerType: 'USER', seq: 7 }));

    expect(trailing(r).role).toBe('user');
    expect(trailing(r).metadata?.streamSeq).toBe(7);
  });

  it('dates every row it makes, once: a thread reads its order and a card its time from it', () => {
    const r = createChatStreamReducer();
    r.apply(participant({ text: 'hi', seq: 1 }));
    r.apply(text('hello', 2));
    const [user, assistant] = r.state.messages;
    expect(Number.isNaN(Date.parse(user.metadata?.createdAt ?? ''))).toBe(false);
    const stamped = assistant.metadata?.createdAt;
    expect(Number.isNaN(Date.parse(stamped ?? ''))).toBe(false);
    r.apply(text(' more', 3));
    expect(trailing(r).metadata?.createdAt).toBe(stamped);
  });
});

/**
 * `agentBusy`: the restore-time counterpart of a live busy signal. The
 * activity indicator is driven off the phase, and nothing on the wire brings it
 * back after a reload.
 */
describe('agentBusy on initializeWithState', () => {
  it('raises an idle reducer to thinking', () => {
    const r = createChatStreamReducer();
    r.initializeWithState(null, { agentBusy: true });
    expect(r.state.streamingPhase).toBe('thinking');
  });

  it('leaves an open stream owning the phase', () => {
    const r = createChatStreamReducer();
    r.apply(start(1));
    expect(r.state.streamingPhase).toBe('streaming');

    r.initializeWithState(null, { agentBusy: true });

    // Only 'idle' upgrades: a downgrade to 'thinking' would report a live
    // stream as merely pending.
    expect(r.state.streamingPhase).toBe('streaming');
  });

  it('stays idle without the flag', () => {
    const r = createChatStreamReducer();
    r.initializeWithState(null, {});
    expect(r.state.streamingPhase).toBe('idle');
  });
});

/**
 * `ask`: the guide-routing clarification card. Not a delta: one chunk carries
 * the whole card, plus the intro sentence that must render as ordinary answer
 * text IN FRONT of it. The post-MESSAGE_END path is the interesting one: the
 * card routinely lands in a continuation, on the finished bubble.
 */
describe('createChatStreamReducer — ask cards', () => {
  const options = [
    { label: 'Find documentation', description: 'How the feature works' },
    { label: 'Work with workspace data' },
  ];
  const ask = (question: string, streamSeq?: number, intro?: string) => ({
    type: 'ASK',
    ...(intro ? { text: intro } : {}),
    question,
    options,
    ...(streamSeq != null ? { streamSeq } : {}),
  });

  it('renders the intro as text ahead of the card, in one bubble', () => {
    const { r, send } = onWire();
    send(
      { type: 'MESSAGE_START', streamSeq: 1 },
      ask('What do you want to work on?', 2, 'Docs, or your own workspace?'),
    );

    expect(body(trailing(r))).toEqual([
      { type: 'text', text: 'Docs, or your own workspace?' },
      { type: 'data-ask', data: { question: 'What do you want to work on?', options } },
    ]);
  });

  it('appends into the finished bubble after MESSAGE_END, keeping the reply', () => {
    const { r, send } = onWire();
    send(
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Working on it. ', streamSeq: 2 },
      { type: 'MESSAGE_END', streamSeq: 3 },
      ask('Which one?', 4, 'One thing first: '),
    );

    // The intro COALESCES onto the completed reply, the same rule as a post-END text.
    expect(body(trailing(r))).toEqual([
      { type: 'text', text: 'Working on it. One thing first: ' },
      { type: 'data-ask', data: { question: 'Which one?', options } },
    ]);
  });

  it('keeps two cards in one turn as separate parts (the card pages them)', () => {
    const { r, send } = onWire();
    send({ type: 'MESSAGE_START', streamSeq: 1 }, ask('First?', 2), ask('Second?', 3));
    expect(trailing(r).parts.map(part => part.type)).toEqual(['data-ask', 'data-ask']);
  });
});

describe('createChatStreamReducer — a thinking answer', () => {
  it('holds its reasoning where it arrived, so a later round reads after what is already shown', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'q' });
    r.apply(chunks({ type: 'reasoning-delta', id: 'r1', delta: 'checking <docs>… ' }));
    r.apply(chunks({ type: 'reasoning-delta', id: 'r1', delta: 'found it.' }));
    r.apply(chunks({ type: 'reasoning-end', id: 'r1' }));
    r.apply(chunks({ type: 'text-delta', id: 't1', delta: 'Answer ' }));
    r.apply(chunks({ type: 'text-delta', id: 't1', delta: 'body.' }));
    r.apply(chunks({ type: 'reasoning-delta', id: 'r2', delta: ' one more check.' }));
    r.apply(chunks({ type: 'text-delta', id: 't1', delta: ' Done.' }));
    // The text is stored as written: `<` is escaped where thinking is drawn (`ThinkingDisplay`).
    expect(body(trailing(r))).toEqual([
      { type: 'reasoning', text: 'checking <docs>… found it.' },
      { type: 'text', text: 'Answer body.' },
      { type: 'reasoning', text: ' one more check.' },
      { type: 'text', text: ' Done.' },
    ]);
    expect(r.state.streamingPhase).toBe('streaming');
  });
});

describe('createChatStreamReducer: what a replay shows again', () => {
  const batch = {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'req1',
    approvalType: 'ADMIN',
    toolCalls: [
      { toolExecutionRequestId: 't1', toolName: 'run', requiresApproval: true },
      { toolExecutionRequestId: 't2', toolName: 'read', requiresApproval: false },
    ],
  };
  const rows = (r: ReturnType<typeof createChatStreamReducer>) =>
    r.state.messages.flatMap(message => message.parts).filter(isToolPart);

  it('reads the batch’s answer before a row’s, and it reaches the row that asks nothing', () => {
    const { r, send } = onWire({ approvalStatuses: { req1: 'rejected', t1: 'approved' } });
    send({ type: 'MESSAGE_START' }, batch);
    expect(rows(r).map(part => [part.toolCallId, part.state])).toEqual([
      ['t1', 'output-denied'],
      ['t2', 'output-denied'],
    ]);
  });

  it('keeps who rejected, when the click here settled it before the server named them', () => {
    const { r, send } = onWire();
    send({ type: 'MESSAGE_START' }, batch);
    r.projectApprovalResolution('req1', 'rejected');
    send({ type: 'APPROVAL_RESULT', approvalRequestId: 'req1', approved: false, displayName: 'Bob Admin' });
    expect(rows(r).map(part => part.toolMetadata?.resolvedByName)).toEqual(['Bob Admin', 'Bob Admin']);
    expect(rows(r).map(approvalStatusOf)).toEqual(['rejected', 'rejected']);
  });

  it('a tool’s report grants its row and tells nobody an answer, gate or no gate', () => {
    const { r, send } = onWire();
    send({ type: 'MESSAGE_START' }, batch);
    send({ type: 'APPROVAL_RESULT', approvalRequestId: 'req1', approved: true });
    send({
      type: 'EXECUTED_TOOL',
      toolExecutionRequestId: 't1',
      integratedToolType: 'A',
      toolFunction: 'run',
      success: true,
      result: 'ok',
    });
    expect(r.state.approvalStatuses).toEqual({ req1: 'approved' });
    expect(rows(r)[0].state).toBe('output-available');
  });
});

describe('createChatStreamReducer: a standalone chunk after a row between turns', () => {
  const ticketEvent = (kind: string): ChatStreamEntry =>
    chunks({ type: 'data-ticket-event', data: { kind, occurredAt: '2026-11-02T10:00:00Z' } });
  const error = (title: string): ChatStreamEntry => chunks({ type: 'data-error', data: { title } });
  const offer = (id: string): ChatStreamEntry =>
    chunks({ type: 'data-escalation-offer', id, data: { text: 'Escalate?', status: 'pending' } });
  const shape = (r: ReturnType<typeof createChatStreamReducer>) =>
    r.state.messages.map(message => [message.role, message.parts.map(part => part.type).join(',')]);

  it.each([
    ['a ticket event', ticketEvent('ASSIGNED'), ticketEvent('RESOLVED'), 'data-ticket-event'],
    ['an error', error('first'), error('second'), 'data-error'],
    ['an offer', offer('o1'), offer('o2'), 'data-escalation-offer'],
  ])('%s lands below that row, not in the bubble above it', (_name, first, second, type) => {
    const r = createChatStreamReducer();
    r.apply(participant({ text: 'one', seq: 1 }));
    r.apply(first);
    r.apply(participant({ text: 'two', seq: 2 }));
    r.apply(second);
    expect(shape(r)).toEqual([
      ['user', 'text'],
      ['assistant', type],
      ['user', 'text'],
      ['assistant', type],
    ]);
  });

  it('standalone chunks with no row between them share a bubble', () => {
    const r = createChatStreamReducer();
    r.apply(participant({ text: 'one', seq: 1 }));
    r.apply(ticketEvent('ASSIGNED'));
    r.apply(ticketEvent('RESOLVED'));
    expect(shape(r)).toEqual([
      ['user', 'text'],
      ['assistant', 'data-ticket-event,data-ticket-event'],
    ]);
  });

  it('a row during an open stream leaves the answer in its bubble', () => {
    const r = createChatStreamReducer();
    r.apply(start(1));
    r.apply(text('Hello', 2));
    r.apply(participant({ text: 'wait', seq: 3 }));
    r.apply(text(' there', 4));
    expect(shape(r)).toEqual([
      ['assistant', 'text'],
      ['user', 'text'],
    ]);
  });
});
