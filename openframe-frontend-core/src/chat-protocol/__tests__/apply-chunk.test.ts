/**
 * The ONE accumulator and the ONE list rule. What these pin is what keeps a stored row and the live message the same
 * thing: `parts` for one message, `applyChunkToMessages` across a thread.
 */

import { describe, expect, it, vi } from 'vitest';
import { applyChunk, applyChunkToMessages, createWireState } from '../apply-chunk';
import {
  approvalStatusOf,
  storablePartsOf,
  textOfParts,
  type ChatCitation,
  type ChatMessage,
  type ChatPart,
  type ChatToolPart,
} from '../chat-message';
import type { UiChunk } from '../ui-chunks';
import { createUiMessageWriter } from '../ui-writer';
import {
  ANSWER_STREAM,
  APPROVAL_BATCH_STREAM,
  APPROVAL_CARD_MESSAGE,
  APPROVAL_RESPONSE_STREAM,
  APPROVAL_STREAM,
  COLLECTION_CITATION_STREAM,
  FIXTURE_ASSISTANT_ID,
  FIXTURE_BLOG_URI,
  FIXTURE_COLLECTION_URI,
  FIXTURE_PROPOSAL_ID,
  NEW_MESSAGE_STREAMS,
  TOOL_ERROR_STREAM,
} from '../wire-fixtures';

const anyString: unknown = expect.any(String);
const anyList: unknown = expect.any(Array);
const containing = (fields: object): unknown => expect.objectContaining(fields);

function accumulate(chunks: readonly UiChunk[], from: ChatPart[] = []): ChatPart[] {
  const wire = createWireState();
  return chunks.reduce((parts, chunk) => applyChunk(parts, chunk, wire), from);
}

function thread(chunks: readonly UiChunk[], from: ChatMessage[] = [], wire = createWireState()): ChatMessage[] {
  return chunks.reduce((messages, chunk) => applyChunkToMessages(messages, chunk, wire), from);
}

const source: ChatCitation['source'] = {
  type: 'source',
  sourceType: 'url',
  id: FIXTURE_BLOG_URI,
  url: 'https://www.flamingo.run/blog/a',
};
const sourcePart: UiChunk = { type: 'source-url', sourceId: FIXTURE_BLOG_URI, url: 'https://www.flamingo.run/blog/a' };

function text(id: string, delta: string, citations?: ChatCitation[]): UiChunk[] {
  return [
    { type: 'text-start', id },
    { type: 'text-delta', id, delta },
    { type: 'text-end', id, ...(citations ? { citations } : {}) },
  ];
}

describe('text', () => {
  it('coalesces wire ids into one part, never one per Anthropic block', () => {
    const parts = accumulate([...text('t1', 'One '), ...text('t2', 'two '), ...text('t3', 'three.')]);
    expect(parts).toEqual([{ type: 'text', text: 'One two three.', state: 'done' }]);
  });

  it('rebases each citation by the offset its wire id started at', () => {
    const parts = accumulate([
      sourcePart,
      ...text('t1', 'One. ', [{ source, startIndex: 0, endIndex: 4 }]),
      ...text('t2', 'Two.', [{ source, startIndex: 0, endIndex: 4 }]),
    ]);
    const body = parts[1];
    expect(body).toMatchObject({ type: 'text', text: 'One. Two.' });
    expect(body.type === 'text' && body.citations).toEqual([
      { source, startIndex: 0, endIndex: 4 },
      { source, startIndex: 5, endIndex: 9 },
    ]);
  });

  it('rebases a citation that knows only its end', () => {
    const parts = accumulate([sourcePart, ...text('t1', 'One. '), ...text('t2', 'Two.', [{ source, endIndex: 4 }])]);
    expect(parts[1].type === 'text' && parts[1].citations).toEqual([{ source, endIndex: 9 }]);
  });

  it('drops a citation whose range is not inside its part: the range would be a lie', () => {
    const parts = accumulate([sourcePart, ...text('t1', 'Short', [{ source, startIndex: 0, endIndex: 99 }])]);
    expect(parts[1]).not.toHaveProperty('citations');
  });

  it('starts a new part after a card or a tool row, and keeps wire text equal to stored text', () => {
    const parts = accumulate([
      ...text('t1', 'Before.\n\n'),
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
      ...text('t2', 'After.'),
    ]);
    expect(parts.map(part => part.type)).toEqual(['text', 'data-record-cards', 'text']);
    expect(textOfParts(parts)).toBe('Before.\n\nAfter.');
  });

  it('keeps streaming until the text ends, on the part it continues', () => {
    const wire = createWireState();
    let parts = accumulate(text('t1', 'One '));
    parts = applyChunk(parts, { type: 'text-start', id: 't2' }, wire);
    parts = applyChunk(parts, { type: 'text-delta', id: 't2', delta: 'two' }, wire);
    expect(parts).toEqual([{ type: 'text', text: 'One two', state: 'streaming' }]);
    parts = applyChunk(parts, { type: 'text-end', id: 't2' }, wire);
    expect(parts).toEqual([{ type: 'text', text: 'One two', state: 'done' }]);
  });

  it('makes no part of a text with no delta', () => {
    expect(
      accumulate([
        { type: 'text-start', id: 't1' },
        { type: 'text-end', id: 't1' },
      ]),
    ).toEqual([]);
  });
});

describe('sources', () => {
  it('insert at the head of the body, in arrival order, and never split text', () => {
    const wire = createWireState();
    let parts = accumulate([{ type: 'source-url', sourceId: 'record://a/1', url: 'https://a.test' }]);
    parts = applyChunk(parts, { type: 'text-start', id: 't1' }, wire);
    parts = applyChunk(parts, { type: 'text-delta', id: 't1', delta: 'One ' }, wire);
    parts = applyChunk(parts, { type: 'source-url', sourceId: 'record://a/2', url: 'https://b.test' }, wire);
    parts = applyChunk(parts, { type: 'text-delta', id: 't1', delta: 'two.' }, wire);
    expect(parts.map(part => part.type)).toEqual(['source-url', 'source-url', 'text']);
    expect(parts[2]).toMatchObject({ text: 'One two.' });
    expect(parts.map(part => ('sourceId' in part ? part.sourceId : null))).toEqual([
      'record://a/1',
      'record://a/2',
      null,
    ]);
  });

  it('are unique by sourceId: the first wins', () => {
    const parts = accumulate([
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://first.test' },
      { type: 'source-url', sourceId: 'record://a/1', url: 'https://second.test' },
    ]);
    expect(parts).toEqual([{ type: 'source-url', sourceId: 'record://a/1', url: 'https://first.test' }]);
  });

  it('a citation whose source the message lacks brings it along, so every citation names a source part', () => {
    const parts = accumulate(text('t1', 'One.', [{ source, startIndex: 0, endIndex: 4 }]));
    expect(parts[0]).toEqual(sourcePart);
    expect(parts[1].type).toBe('text');
  });

  it('a cited collection is a source like any other', () => {
    const parts = accumulate(COLLECTION_CITATION_STREAM);
    expect(parts.map(part => ('sourceId' in part ? part.sourceId : part.type))).toEqual([
      FIXTURE_BLOG_URI,
      FIXTURE_COLLECTION_URI,
      'text',
    ]);
  });
});

describe('reasoning', () => {
  it('goes before the first text part and never splits text', () => {
    const wire = createWireState();
    let parts = accumulate([sourcePart, ...text('t1', 'One ')]);
    parts = applyChunk(parts, { type: 'reasoning-start', id: 'r1' }, wire);
    parts = applyChunk(parts, { type: 'reasoning-delta', id: 'r1', delta: 'hmm' }, wire);
    parts = applyChunk(parts, { type: 'reasoning-end', id: 'r1' }, wire);
    parts = [...text('t2', 'two.')].reduce((all, chunk) => applyChunk(all, chunk, wire), parts);
    expect(parts).toEqual([
      sourcePart,
      { type: 'reasoning', text: 'hmm', state: 'done' },
      { type: 'text', text: 'One two.', state: 'done' },
    ]);
  });

  it('continues the reasoning already in front of the text', () => {
    const parts = accumulate([
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'one ' },
      { type: 'reasoning-end', id: 'r1' },
      ...text('t1', 'Text.'),
      { type: 'reasoning-start', id: 'r2' },
      { type: 'reasoning-delta', id: 'r2', delta: 'two' },
      { type: 'reasoning-end', id: 'r2' },
    ]);
    expect(parts).toEqual([
      { type: 'reasoning', text: 'one two', state: 'done' },
      { type: 'text', text: 'Text.', state: 'done' },
    ]);
  });

  it('sits where it arrived while there is no text yet', () => {
    const parts = accumulate([
      { type: 'tool-input-available', toolCallId: '1', toolName: 'x', input: {}, dynamic: true },
      { type: 'reasoning-delta', id: 'r1', delta: 'hmm' },
    ]);
    expect(parts.map(part => part.type)).toEqual(['dynamic-tool', 'reasoning']);
  });
});

describe('data', () => {
  it('a chunk with an existing id replaces its part, in place', () => {
    const parts = accumulate([
      { type: 'data-context-compaction', id: 'c1', data: { status: 'started' } },
      ...text('t1', 'After.'),
      { type: 'data-context-compaction', id: 'c1', data: { status: 'completed', summary: 'Done' } },
    ]);
    expect(parts[0]).toEqual({
      type: 'data-context-compaction',
      id: 'c1',
      data: { status: 'completed', summary: 'Done' },
    });
    expect(parts).toHaveLength(2);
  });

  it('a transient chunk goes to the handler and is never a part', () => {
    const onTransient = vi.fn();
    const wire = createWireState({ onTransient });
    const chunk: UiChunk = {
      type: 'data-token-usage',
      transient: true,
      data: { inputTokensSize: 1, outputTokensSize: 2, totalTokensSize: 3, contextSize: 4 },
    };
    const parts: ChatPart[] = [];
    expect(applyChunk(parts, chunk, wire)).toBe(parts);
    expect(onTransient).toHaveBeenCalledWith(chunk);
  });

  it('the wire field `transient` never reaches a part', () => {
    const parts = accumulate([{ type: 'data-record-cards', transient: false, data: { records: ['record://a/1'] } }]);
    expect(parts).toEqual([{ type: 'data-record-cards', data: { records: ['record://a/1'] } }]);
  });

  it('a card part with no records is nothing', () => {
    expect(accumulate([{ type: 'data-record-cards', data: { records: [] } }])).toEqual([]);
  });

  it('a resolved offer keeps the text its pending chunk painted', () => {
    const parts = accumulate([
      { type: 'data-escalation-offer', id: 'o1', data: { text: 'Hand off?', status: 'pending', origin: 'TOOL' } },
      { type: 'data-escalation-offer', id: 'o1', data: { status: 'approved', resolvedByName: 'Ann' } },
    ]);
    expect(parts).toEqual([
      {
        type: 'data-escalation-offer',
        id: 'o1',
        data: { text: 'Hand off?', status: 'approved', origin: 'TOOL', resolvedByName: 'Ann' },
      },
    ]);
  });

  it('a resolution with no offer to flip draws nothing', () => {
    expect(accumulate([{ type: 'data-escalation-offer', id: 'o1', data: { status: 'cancelled' } }])).toEqual([]);
  });

  describe('a ticket event', () => {
    const resolved = { kind: 'RESOLVED', actorName: 'Ann' };

    it('a redelivery replaces its part by sequence, and the first-known time wins', () => {
      const parts = accumulate([
        { type: 'data-ticket-event', id: '7', data: { ...resolved, occurredAt: '2026-11-02T10:00:00Z' } },
        { type: 'data-ticket-event', id: '7', data: { ...resolved, occurredAt: '2026-11-02T12:00:00Z' } },
      ]);
      expect(parts).toEqual([
        { type: 'data-ticket-event', id: '7', data: { ...resolved, occurredAt: '2026-11-02T10:00:00Z' } },
      ]);
    });

    it('a replayed copy joins a hydrated twin with no sequence', () => {
      const parts = accumulate([
        { type: 'data-ticket-event', data: { ...resolved, occurredAt: '2026-11-02T10:00:00Z' } },
        { type: 'data-ticket-event', id: '7', data: { ...resolved, occurredAt: '2026-11-02T12:00:00Z' } },
      ]);
      expect(parts).toEqual([
        { type: 'data-ticket-event', id: '7', data: { ...resolved, occurredAt: '2026-11-02T10:00:00Z' } },
      ]);
    });

    it('a repeated resolve with its own sequence is its own card', () => {
      const parts = accumulate([
        { type: 'data-ticket-event', id: '7', data: resolved },
        { type: 'data-ticket-event', id: '8', data: { kind: 'REOPENED' } },
        { type: 'data-ticket-event', id: '9', data: resolved },
      ]);
      expect(parts).toHaveLength(3);
    });

    it('only the last event can be the twin: an older one may be a real repeat', () => {
      const parts = accumulate([
        { type: 'data-ticket-event', data: resolved },
        { type: 'data-ticket-event', data: { kind: 'REOPENED' } },
        { type: 'data-ticket-event', data: resolved },
      ]);
      expect(parts).toHaveLength(3);
    });
  });
});

describe('tools', () => {
  const input: UiChunk = {
    type: 'tool-input-available',
    toolCallId: 'p1',
    toolName: 'close',
    input: { a: 1 },
    dynamic: true,
    title: 'Close',
  };
  const request: UiChunk = {
    type: 'tool-approval-request',
    approvalId: 'p1',
    toolCallId: 'p1',
    reason: 'why',
    approvalDescriptor: { approvalType: 'CLIENT' },
  };

  it('a chunk whose call the parts do not hold is ignored', () => {
    const parts: ChatPart[] = [{ type: 'text', text: 'a' }];
    const wire = createWireState();
    for (const chunk of [
      { type: 'tool-approval-request', approvalId: 'x', toolCallId: 'x' },
      { type: 'tool-approval-response', approvalId: 'x', approved: true },
      { type: 'tool-output-available', toolCallId: 'x', output: 1 },
      { type: 'tool-output-error', toolCallId: 'x', errorText: 'no' },
      { type: 'tool-output-denied', toolCallId: 'x' },
    ] as UiChunk[]) {
      expect(applyChunk(parts, chunk, wire)).toBe(parts);
    }
  });

  it('walks a card through its states, by state only', () => {
    const wire = createWireState();
    let parts = applyChunk([], input, wire);
    expect(parts[0]).toMatchObject({ state: 'input-available', input: { a: 1 }, title: 'Close' });
    parts = applyChunk(parts, request, wire);
    expect(parts[0]).toMatchObject({
      state: 'approval-requested',
      approval: { id: 'p1', requestReason: 'why', descriptor: { approvalType: 'CLIENT' } },
    });
    parts = applyChunk(parts, { type: 'tool-approval-response', approvalId: 'p1', approved: true }, wire);
    expect(parts[0]).toMatchObject({ state: 'approval-responded', approval: { approved: true } });
    parts = applyChunk(parts, { type: 'tool-output-available', toolCallId: 'p1', output: { ok: 1 } }, wire);
    expect(parts[0]).toMatchObject({ state: 'output-available', output: { ok: 1 }, approval: { approved: true } });
  });

  it('an output grants the gate even when no response reached this reader', () => {
    const parts = accumulate([input, request, { type: 'tool-output-error', toolCallId: 'p1', errorText: 'no' }]);
    expect(parts[0]).toMatchObject({ state: 'output-error', errorText: 'no', approval: { id: 'p1', approved: true } });
    expect(parts[0]).not.toHaveProperty('output');
  });

  it('a denial records it on the approval, and keeps why', () => {
    const parts = accumulate([
      input,
      request,
      { type: 'tool-approval-response', approvalId: 'p1', approved: false, reason: 'not now' },
      { type: 'tool-output-denied', toolCallId: 'p1' },
    ]);
    expect(parts[0]).toMatchObject({ state: 'output-denied', approval: { approved: false, reason: 'not now' } });
  });

  it('a redelivered request or input never moves a part back', () => {
    const wire = createWireState();
    let parts = accumulate([input, request, { type: 'tool-output-available', toolCallId: 'p1', output: 1 }]);
    const final = parts;
    parts = applyChunk(parts, input, wire);
    parts = applyChunk(parts, request, wire);
    parts = applyChunk(parts, { type: 'tool-approval-response', approvalId: 'p1', approved: false }, wire);
    parts = applyChunk(parts, { type: 'tool-output-denied', toolCallId: 'p1' }, wire);
    expect(parts).toBe(final);
  });

  it('a re-sent card leaves a pending card pending', () => {
    const once = accumulate([input, request]);
    const twice = accumulate([input, request, input, request]);
    expect(twice).toEqual(once);
  });

  it('a run with no arguments keeps the card`s arguments', () => {
    const parts = accumulate([
      input,
      request,
      { type: 'tool-input-available', toolCallId: 'p1', toolName: 'close', input: {}, dynamic: true },
    ]);
    expect(parts[0]).toMatchObject({ state: 'approval-requested', input: { a: 1 } });
  });

  it('a tool-input-error draws the error row', () => {
    const parts = accumulate(TOOL_ERROR_STREAM);
    expect(parts.map(part => part.type)).toEqual(['text', 'dynamic-tool', 'text']);
    expect(parts[1]).toMatchObject({ state: 'output-error', toolName: 'update_ticket', errorText: anyString });
  });
});

describe('a rejection stands', () => {
  const rejected: ChatPart = {
    type: 'dynamic-tool',
    toolName: 'close',
    toolCallId: 'p1',
    title: 'Close',
    state: 'approval-responded',
    input: { a: 1 },
    approval: { id: 'p1', approved: false, reason: 'not now' },
  };

  it('a refusal of the answer ends it denied, with its reason: it never reads as approved', () => {
    const [part] = accumulate([{ type: 'tool-output-error', toolCallId: 'p1', errorText: 'Expired.' }], [rejected]);
    expect(part).toEqual({
      type: 'dynamic-tool',
      toolName: 'close',
      toolCallId: 'p1',
      title: 'Close',
      state: 'output-denied',
      input: { a: 1 },
      approval: { id: 'p1', approved: false, reason: 'not now' },
    });
    expect(approvalStatusOf(part as ChatToolPart)).toBe('rejected');
  });

  it('so does a tool that failed before it ran', () => {
    const [part] = accumulate(
      [{ type: 'tool-input-error', toolCallId: 'p1', toolName: 'close', input: {}, errorText: 'Bad.' }],
      [rejected],
    );
    expect(approvalStatusOf(part as ChatToolPart)).toBe('rejected');
    expect(part).toMatchObject({ state: 'output-denied', approval: { reason: 'not now' } });
  });

  it('an approved answer that fails stays approved, with its error', () => {
    const approved: ChatPart = {
      type: 'dynamic-tool',
      toolName: 'close',
      toolCallId: 'p1',
      state: 'approval-responded',
      input: {},
      approval: { id: 'p1', approved: true },
    };
    const [part] = accumulate([{ type: 'tool-output-error', toolCallId: 'p1', errorText: 'Expired.' }], [approved]);
    expect(part).toMatchObject({ state: 'output-error', errorText: 'Expired.', approval: { approved: true } });
  });

  it('a gate nobody answered that fails was never rejected', () => {
    const pending: ChatPart = {
      type: 'dynamic-tool',
      toolName: 'close',
      toolCallId: 'p1',
      state: 'approval-requested',
      input: {},
      approval: { id: 'p1' },
    };
    const [part] = accumulate([{ type: 'tool-output-error', toolCallId: 'p1', errorText: 'Failed.' }], [pending]);
    expect(approvalStatusOf(part as ChatToolPart)).toBe('approved');
  });
});

describe('copy-on-write', () => {
  it('a delta keeps the identity of every other part', () => {
    const wire = createWireState();
    const before: ChatPart[] = [
      sourcePart,
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
      { type: 'text', text: 'a' },
    ];
    const after = applyChunk(before, { type: 'text-delta', id: 't1', delta: 'b' }, wire);
    expect(after).not.toBe(before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(before[2]).toEqual({ type: 'text', text: 'a' });
  });

  it('a source arriving mid-answer keeps the body parts', () => {
    const wire = createWireState();
    const text1: ChatPart = { type: 'text', text: 'a', state: 'streaming' };
    const after = applyChunk([text1], sourcePart, wire);
    expect(after[1]).toBe(text1);
  });

  it('a chunk that changes nothing returns the same reference', () => {
    const wire = createWireState();
    const parts = accumulate([sourcePart, input()]);
    for (const chunk of [
      sourcePart,
      { type: 'start' },
      { type: 'message-metadata', messageMetadata: {} },
      input(),
    ] as UiChunk[]) {
      expect(applyChunk(parts, chunk, wire)).toBe(parts);
    }
    function input(): UiChunk {
      return { type: 'tool-input-available', toolCallId: '1', toolName: 'x', input: { a: 1 }, dynamic: true };
    }
  });

  it('a list chunk keeps the identity of every other message', () => {
    const wire = createWireState();
    const first: ChatMessage = { id: 'a', role: 'user', parts: [{ type: 'text', text: 'hi' }] };
    const second: ChatMessage = { id: 'b', role: 'assistant', parts: [] };
    const after = applyChunkToMessages([first, second], { type: 'text-delta', id: 't1', delta: 'x' }, wire);
    expect(after[0]).toBe(first);
    expect(after[1]).not.toBe(second);
    expect(second.parts).toEqual([]);
  });
});

describe('ending', () => {
  it('finish and abort close what is still streaming', () => {
    for (const end of [{ type: 'finish' }, { type: 'abort', reason: 'timeout' }] as UiChunk[]) {
      const parts = accumulate([
        { type: 'reasoning-delta', id: 'r1', delta: 'hmm' },
        { type: 'text-delta', id: 't1', delta: 'partial' },
        end,
      ]);
      expect(parts).toEqual([
        { type: 'reasoning', text: 'hmm', state: 'done' },
        { type: 'text', text: 'partial', state: 'done' },
      ]);
    }
  });

  it('a turn-level error is an error part, never a role', () => {
    const parts = accumulate([
      { type: 'text-delta', id: 't1', delta: 'partial' },
      { type: 'error', errorText: 'Failed.' },
    ]);
    expect(parts[1]).toEqual({ type: 'data-error', data: { title: 'Failed.' } });
    expect(storablePartsOf(parts)).toEqual([{ type: 'text', text: 'partial' }]);
  });
});

describe('applyChunkToMessages: the message being built', () => {
  it('start with an id opens a new assistant message', () => {
    const user: ChatMessage = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] };
    const messages = thread([{ type: 'start', messageId: 'a1' }, ...text('t1', 'Hello')], [user]);
    expect(messages.map(m => [m.id, m.role])).toEqual([
      ['u1', 'user'],
      ['a1', 'assistant'],
    ]);
    expect(messages[1].parts).toEqual([{ type: 'text', text: 'Hello', state: 'done' }]);
  });

  it('start with an id renames the placeholder the client is holding', () => {
    const wire = createWireState();
    wire.setMessageId('placeholder');
    const messages = thread(
      [{ type: 'start', messageId: 'a1', messageMetadata: { model: 'm' } }],
      [{ id: 'placeholder', role: 'assistant', parts: [] }],
      wire,
    );
    expect(messages).toEqual([{ id: 'a1', role: 'assistant', metadata: { model: 'm' }, parts: [] }]);
  });

  it('start with no id continues the card`s message, the one the lib set', () => {
    const later: ChatMessage = { id: 'later', role: 'assistant', parts: [{ type: 'text', text: 'later' }] };
    const wire = createWireState();
    wire.setMessageId(APPROVAL_CARD_MESSAGE.id);
    const messages = thread(APPROVAL_RESPONSE_STREAM, [APPROVAL_CARD_MESSAGE, later], wire);
    expect(messages[1]).toBe(later);
    expect(messages[0].id).toBe(APPROVAL_CARD_MESSAGE.id);
    expect(messages[0].parts.map(part => part.type)).toEqual([
      'text',
      'dynamic-tool',
      'text',
      'data-record-cards',
      'text',
    ]);
    expect(messages[0].metadata).toMatchObject({ willAutoContinue: true, finishReason: 'stop' });
  });

  it('with nothing named, a chunk goes to the trailing assistant message, else a new one', () => {
    const wire = createWireState({ newMessageId: () => 'new' });
    const answer: ChatMessage = { id: 'a1', role: 'assistant', parts: [] };
    const user: ChatMessage = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] };
    expect(applyChunkToMessages([answer], { type: 'text-delta', id: 't', delta: 'x' }, wire)[0].parts).toHaveLength(1);
    const fresh = applyChunkToMessages([user], { type: 'text-delta', id: 't', delta: 'x' }, wire);
    expect(fresh.map(m => m.id)).toEqual(['u1', 'new']);
    expect(wire.messageId).toBe('new');
  });

  it('a chunk that only describes a message makes none', () => {
    const user: ChatMessage = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] };
    const messages = [user];
    const wire = createWireState();
    for (const chunk of [
      { type: 'message-metadata', messageMetadata: { model: 'm' } },
      { type: 'finish', finishReason: 'stop' },
      { type: 'abort' },
      { type: 'data-chat-progress', id: 't:reading', transient: true, data: { stage: 'reading', state: 'running' } },
      { type: 'tool-output-denied', toolCallId: 'x' },
      { type: 'text-start', id: 't' },
      { type: 'text-end', id: 't' },
    ] as UiChunk[]) {
      expect(applyChunkToMessages(messages, chunk, wire)).toBe(messages);
    }
  });

  it('finish ends the message: what arrives after is on the trailing one, never a stale one', () => {
    const wire = createWireState({ newMessageId: () => 'new' });
    const messages = thread([{ type: 'start', messageId: 'a1' }, ...text('t1', 'Hello'), { type: 'finish' }], [], wire);
    expect(wire.messageId).toBeNull();
    const withUser: ChatMessage[] = [...messages, { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }];
    const after = applyChunkToMessages(
      withUser,
      { type: 'data-ticket-escalated', id: 'T', data: { ticketId: 'T', reason: 'INACTIVITY' } },
      wire,
    );
    expect(after.map(m => m.id)).toEqual(['a1', 'u1', 'new']);
  });

  it('merges metadata field by field, usage across its two chunks included', () => {
    const [message] = thread([
      { type: 'start', messageId: 'a1' },
      {
        type: 'message-metadata',
        messageMetadata: { model: 'm', usage: { inputTokens: 1, inputTokenDetails: { cacheReadTokens: 2 } } },
      },
      {
        type: 'finish',
        finishReason: 'length',
        messageMetadata: { usage: { outputTokens: 3, inputTokenDetails: { cacheWriteTokens: 4 } } },
      },
    ]);
    expect(message.metadata).toEqual({
      model: 'm',
      finishReason: 'length',
      usage: { inputTokens: 1, outputTokens: 3, inputTokenDetails: { cacheReadTokens: 2, cacheWriteTokens: 4 } },
    });
  });

  it('an abort marks the message and keeps its text', () => {
    const [message] = thread([
      { type: 'start', messageId: 'a1' },
      { type: 'text-delta', id: 't', delta: 'par' },
      { type: 'abort', reason: 'timeout' },
    ]);
    expect(message.metadata).toEqual({ aborted: true });
    expect(message.parts).toEqual([{ type: 'text', text: 'par', state: 'done' }]);
  });

  it('a turn-level error draws on the message, and creates one when there is none', () => {
    const wire = createWireState({ newMessageId: () => 'new' });
    const messages = applyChunkToMessages([], { type: 'error', errorText: 'Failed.' }, wire);
    expect(messages).toEqual([
      { id: 'new', role: 'assistant', parts: [{ type: 'data-error', data: { title: 'Failed.' } }] },
    ]);
    expect(wire.messageId).toBeNull();
  });

  it('holds a stage in metadata.progress, one row per stage', () => {
    const onTransient = vi.fn();
    const [message] = thread(
      [
        { type: 'start', messageId: 'a1' },
        {
          type: 'data-chat-progress',
          id: 't:searching',
          transient: true,
          data: { stage: 'searching', count: 2, state: 'running' },
        },
        { type: 'data-chat-progress', id: 't:reading', transient: true, data: { stage: 'reading', state: 'running' } },
        {
          type: 'data-chat-progress',
          id: 't:searching',
          transient: true,
          data: { stage: 'searching', count: 2, state: 'done' },
        },
      ],
      [],
      createWireState({ onTransient }),
    );
    expect(message.metadata?.progress).toEqual([
      { id: 't:searching', stage: 'searching', count: 2, state: 'done' },
      { id: 't:reading', stage: 'reading', state: 'running' },
    ]);
    expect(message.parts).toEqual([]);
    expect(onTransient).toHaveBeenCalledTimes(3);
  });

  it('participant, usage and closed chunks go to the handler alone', () => {
    const onTransient = vi.fn();
    const wire = createWireState({ onTransient });
    const messages: ChatMessage[] = [];
    const chunks = [
      { type: 'data-chat-participant', transient: true, data: { kind: 'system', text: 'x' } },
      {
        type: 'data-token-usage',
        transient: true,
        data: { inputTokensSize: 1, outputTokensSize: 1, totalTokensSize: 2, contextSize: 3 },
      },
      { type: 'data-dialog-closed', transient: true, data: {} },
    ] as UiChunk[];
    for (const chunk of chunks) expect(applyChunkToMessages(messages, chunk, wire)).toBe(messages);
    expect(onTransient).toHaveBeenCalledTimes(3);
  });
});

describe('applyChunkToMessages: a stage left running ends with its turn', () => {
  const running: ChatMessage = {
    id: 'a',
    role: 'assistant',
    metadata: {
      progress: [
        { id: 't:understanding', stage: 'understanding', state: 'done' },
        { id: 't:searching', stage: 'searching', count: 2, state: 'running' },
      ],
    },
    parts: [],
  };
  const statesAfter = (chunk: UiChunk): string[] => {
    const wire = createWireState();
    wire.setMessageId('a');
    const [message] = applyChunkToMessages([running], chunk, wire);
    return (message.metadata?.progress ?? []).map(row => row.state);
  };

  it.each<[string, UiChunk, string[]]>([
    ['a turn that finished', { type: 'finish', finishReason: 'stop' }, ['done', 'done']],
    ['a turn with no reason', { type: 'finish' }, ['done', 'done']],
    ['a cut stream', { type: 'finish', finishReason: 'interrupted' }, ['done', 'failed']],
    ['a turn that failed', { type: 'finish', finishReason: 'error' }, ['done', 'failed']],
    ['an abort', { type: 'abort', reason: 'timeout' }, ['done', 'failed']],
    ['a turn-level error', { type: 'error', errorText: 'Failed.' }, ['done', 'failed']],
  ])('%s', (_name, chunk, states) => {
    expect(statesAfter(chunk)).toEqual(states);
  });

  it('a message with nothing running keeps its identity', () => {
    const settled: ChatMessage = { id: 'a', role: 'assistant', metadata: { aborted: true }, parts: [] };
    const wire = createWireState();
    wire.setMessageId('a');
    const [message] = applyChunkToMessages([settled], { type: 'abort' }, wire);
    expect(message).toBe(settled);
  });
});

describe('applyChunkToMessages: a resolution finds its part across messages', () => {
  const card: ChatMessage = {
    id: 'card',
    role: 'assistant',
    parts: [
      {
        type: 'dynamic-tool',
        toolName: 'x',
        toolCallId: 'p1',
        state: 'approval-requested',
        input: {},
        approval: { id: 'p1' },
      },
    ],
  };
  const latest: ChatMessage = { id: 'latest', role: 'assistant', parts: [{ type: 'text', text: 'later' }] };

  it.each<[string, UiChunk, string]>([
    [
      'tool-approval-response',
      { type: 'tool-approval-response', approvalId: 'p1', approved: true },
      'approval-responded',
    ],
    ['tool-output-available', { type: 'tool-output-available', toolCallId: 'p1', output: 1 }, 'output-available'],
    ['tool-output-error', { type: 'tool-output-error', toolCallId: 'p1', errorText: 'no' }, 'output-error'],
    ['tool-output-denied', { type: 'tool-output-denied', toolCallId: 'p1' }, 'output-denied'],
  ])('%s', (_name, chunk, state) => {
    const messages = applyChunkToMessages([card, latest], chunk, createWireState());
    expect(messages[0].parts[0]).toMatchObject({ state });
    expect(messages[1]).toBe(latest);
  });

  it('newest first: an agent retry reuses an id, and the newest card takes it', () => {
    const retry: ChatMessage = { ...card, id: 'retry' };
    const messages = applyChunkToMessages(
      [card, retry],
      { type: 'tool-output-available', toolCallId: 'p1', output: 1 },
      createWireState(),
    );
    expect(messages[0]).toBe(card);
    expect(messages[1].parts[0]).toMatchObject({ state: 'output-available' });
  });

  it('a run of a card`s row lands on the card, not in the message being built', () => {
    const messages = applyChunkToMessages(
      [card, latest],
      { type: 'tool-input-available', toolCallId: 'p1', toolName: 'x', input: { a: 1 }, dynamic: true },
      createWireState(),
    );
    expect(messages[1]).toBe(latest);
    expect(messages[0].parts[0]).toMatchObject({ state: 'approval-requested', input: { a: 1 } });
  });

  it('an unknown call is ignored', () => {
    const messages = [card, latest];
    expect(applyChunkToMessages(messages, { type: 'tool-output-denied', toolCallId: 'nope' }, createWireState())).toBe(
      messages,
    );
  });

  it('a result naming the batch flips every row in it, and leaves other cards alone', () => {
    const row = (id: string, batchId: string): ChatPart => ({
      type: 'dynamic-tool',
      toolName: 'x',
      toolCallId: id,
      state: 'approval-requested',
      input: {},
      approval: { id, descriptor: { batchId } },
    });
    const batch: ChatMessage = {
      id: 'batch',
      role: 'assistant',
      parts: [row('a', 'B1'), row('b', 'B1'), row('c', 'B2')],
    };
    const wire = createWireState();
    const approved = applyChunkToMessages(
      [batch],
      { type: 'tool-approval-response', approvalId: 'B1', approved: true, toolMetadata: { resolvedByName: 'Ann' } },
      wire,
    );
    expect(approved[0].parts).toMatchObject([
      {
        toolCallId: 'a',
        state: 'approval-responded',
        approval: { approved: true },
        toolMetadata: { resolvedByName: 'Ann' },
      },
      { toolCallId: 'b', state: 'approval-responded', approval: { approved: true } },
      { toolCallId: 'c', state: 'approval-requested' },
    ]);
    const denied = applyChunkToMessages([batch], { type: 'tool-output-denied', toolCallId: 'B1' }, wire);
    expect(denied[0].parts).toMatchObject([
      { toolCallId: 'a', state: 'output-denied', approval: { approved: false } },
      { toolCallId: 'b', state: 'output-denied' },
      { toolCallId: 'c', state: 'approval-requested' },
    ]);
  });

  it('one row of a batch can fail while the others proceed', () => {
    const wire = createWireState();
    const parts = thread(APPROVAL_BATCH_STREAM, [], wire);
    const after = thread(
      [
        { type: 'start' },
        { type: 'tool-output-available', toolCallId: 'prop-a', dynamic: true, output: {} },
        { type: 'tool-output-error', toolCallId: 'prop-b', dynamic: true, errorText: 'Expired.' },
      ],
      parts,
      createWireState(),
    );
    expect(after[0].parts).toMatchObject([
      { toolCallId: 'prop-a', state: 'output-available' },
      { toolCallId: 'prop-b', state: 'output-error', errorText: 'Expired.' },
    ]);
  });

  it('an offer resolved in a later bubble flips the card where it is', () => {
    const offer: ChatMessage = {
      id: 'offer',
      role: 'assistant',
      parts: [{ type: 'data-escalation-offer', id: 'o1', data: { text: 'Hand off?', status: 'pending' } }],
    };
    const user: ChatMessage = { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'never mind' }] };
    const messages = applyChunkToMessages(
      [offer, user, latest],
      { type: 'data-escalation-offer', id: 'o1', data: { status: 'cancelled' } },
      createWireState(),
    );
    expect(messages[0].parts[0]).toMatchObject({ data: { text: 'Hand off?', status: 'cancelled' } });
    expect(messages[2]).toBe(latest);
  });
});

describe('the hub accumulates what the lib accumulates', () => {
  it.each(Object.entries(NEW_MESSAGE_STREAMS))('%s', (_name, stream) => {
    const writer = createUiMessageWriter(() => undefined);
    for (const chunk of stream) writer.write(chunk);
    const [message] = thread(stream);
    expect(writer.parts()).toEqual(message.parts);
  });

  it('wire text concatenated equals stored text, and every stored range is inside its part', () => {
    for (const stream of Object.values(NEW_MESSAGE_STREAMS)) {
      const wireText = stream.flatMap(chunk => (chunk.type === 'text-delta' ? [chunk.delta] : [])).join('');
      const stored = storablePartsOf(accumulate(stream));
      expect(stored.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('')).toBe(wireText);
      for (const part of stored) {
        if (part.type !== 'text') continue;
        for (const citation of part.citations ?? []) {
          expect(citation.endIndex ?? 0).toBeLessThanOrEqual(part.text.length);
          expect(citation.startIndex ?? 0).toBeLessThanOrEqual(part.text.length);
        }
      }
    }
  });

  it('the whole answer, as a row stores it', () => {
    expect(storablePartsOf(accumulate(ANSWER_STREAM))).toEqual([
      { type: 'source-url', sourceId: FIXTURE_BLOG_URI, url: anyString, title: 'OpenFrame vs Atera' },
      {
        type: 'source-document',
        sourceId: anyString,
        mediaType: 'text/plain',
        title: 'Agent offline after upgrade',
      },
      {
        type: 'text',
        text: 'OpenFrame is priced per device. Compare it with [Atera](record://vendor/42).\n\n',
        citations: [containing({ startIndex: 0, endIndex: 31 })],
      },
      { type: 'data-record-cards', data: { records: anyList } },
      { type: 'text', text: 'Both are on the pricing page.' },
    ]);
  });

  it('a card turn: the preamble stays, and the card is not stored', () => {
    const parts = accumulate(APPROVAL_STREAM);
    expect(parts[1]).toMatchObject({ state: 'approval-requested', toolCallId: FIXTURE_PROPOSAL_ID });
    expect(storablePartsOf(parts)).toEqual([{ type: 'text', text: 'I can close that ticket.' }]);
    expect(thread(APPROVAL_STREAM)[0].id).toBe(FIXTURE_ASSISTANT_ID);
  });
});
