/**
 * The ONE decoder: Mingo's table, a stored row of the hub, and a row of `/api/docs/search`.
 */

import { describe, expect, it } from 'vitest';
import { applyChunk, applyChunkToMessages, createWireState } from '../apply-chunk';
import { textOfParts, type ChatMessage, type ChatPart } from '../chat-message';
import { createMingoDecoder, docSearchFieldsOf, messageOfStoredRow } from '../message-decoder';
import type { ChatStreamEntry, UiChunk } from '../ui-chunks';
import { HISTORY_RESPONSE, STORED_ANSWER_PARTS } from '../wire-fixtures';

function partsOf(chunks: readonly UiChunk[]): ChatPart[] {
  const wire = createWireState();
  return chunks.reduce<ChatPart[]>((parts, chunk) => applyChunk(parts, chunk, wire), []);
}

describe('createMingoDecoder: the table', () => {
  const decodeAll = (...raws: unknown[]): UiChunk[] => {
    const decoder = createMingoDecoder({ now: () => '2026-11-02T10:00:00Z' });
    return raws.flatMap(raw => decoder.decode(raw).chunks);
  };

  it('lifts the JetStream sequence out of the chunk', () => {
    const decoder = createMingoDecoder();
    expect(decoder.decode({ type: 'MESSAGE_END', streamSeq: 42 }).seq).toBe(42);
    expect(decoder.decode({ type: 'MESSAGE_END' }).seq).toBeUndefined();
    expect(decoder.decode({ type: 'TICKET_EVENT', kind: 'RESOLVED', sequenceId: 9 }).seq).toBe(9);
    expect(decoder.decode({ type: 'TICKET_EVENT', kind: 'RESOLVED', sequenceId: 9, streamSeq: 10 }).seq).toBe(10);
  });

  it('answers nothing for what it cannot read', () => {
    for (const raw of [null, 'x', 1, {}, { type: 'NEW_THING' }, { type: 'ASK', question: '' }, { type: 'TEXT' }]) {
      expect(createMingoDecoder().decode(raw).chunks).toEqual([]);
    }
  });

  it('MESSAGE_START opens a message of its own, closing what the last turn left open', () => {
    expect(decodeAll({ type: 'TEXT', text: 'a' }, { type: 'MESSAGE_START', streamSeq: 3 })).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'a' },
      { type: 'text-end', id: 't1' },
      { type: 'start', messageId: 'stream-3' },
    ]);
  });

  it('MESSAGE_END closes open ids, then finish', () => {
    expect(decodeAll({ type: 'THINKING', text: 'r' }, { type: 'TEXT', text: 't' }, { type: 'MESSAGE_END' })).toEqual([
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'r' },
      { type: 'reasoning-end', id: 'r1' },
      { type: 'text-start', id: 't2' },
      { type: 'text-delta', id: 't2', delta: 't' },
      { type: 'text-end', id: 't2' },
      { type: 'finish', finishReason: 'stop' },
    ]);
  });

  it('AI_METADATA is message metadata', () => {
    expect(
      decodeAll({
        type: 'AI_METADATA',
        modelName: 'm',
        modelDisplayName: 'M',
        providerName: 'anthropic',
        contextWindow: 9,
      }),
    ).toEqual([
      {
        type: 'message-metadata',
        messageMetadata: { model: 'm', provider: 'anthropic', contextWindowMaxTokens: 9, modelLabel: 'M' },
      },
    ]);
    expect(decodeAll({ type: 'AI_METADATA', modelName: 'm' })).toEqual([]);
  });

  it('TEXT opens one text id, and keeps it across deltas', () => {
    expect(decodeAll({ type: 'TEXT', text: 'a' }, { type: 'TEXT', text: 'b' })).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'a' },
      { type: 'text-delta', id: 't1', delta: 'b' },
    ]);
  });

  it('THINKING opens one reasoning id, and a text in between does not split it', () => {
    expect(decodeAll({ type: 'THINKING', text: 'a' }, { type: 'THINKING', text: 'b' })).toEqual([
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'a' },
      { type: 'reasoning-delta', id: 'r1', delta: 'b' },
    ]);
  });

  it('ATTACHMENTS in the new names is one source per row, and leaves the text open', () => {
    expect(
      decodeAll(
        { type: 'TEXT', text: 'a' },
        {
          type: 'ATTACHMENTS',
          sources: [
            {
              type: 'source-url',
              sourceId: 'record://blog_post/1',
              url: 'https://x.test/1',
              title: 'One',
              mediaType: null,
              filename: null,
            },
            {
              type: 'source-document',
              sourceId: 'record://x/2',
              title: 'Two',
              mediaType: 'text/plain',
              filename: 'a.md',
              url: null,
            },
            { type: 'source-document', sourceId: 'record://x/3', title: null },
          ],
        },
      ),
    ).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'a' },
      { type: 'source-url', sourceId: 'record://blog_post/1', url: 'https://x.test/1', title: 'One' },
      { type: 'source-document', sourceId: 'record://x/2', mediaType: 'text/plain', title: 'Two', filename: 'a.md' },
      { type: 'source-document', sourceId: 'record://x/3', mediaType: 'text/plain', title: '3' },
    ]);
  });

  it('RECORD_CARDS closes the text, then the records', () => {
    expect(
      decodeAll(
        { type: 'TEXT', text: 'a' },
        { type: 'RECORD_CARDS', records: ['record://a/1', 'record://a/1', 'record://a', 'nope'] },
      ),
    ).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'a' },
      { type: 'text-end', id: 't1' },
      { type: 'data-record-cards', data: { records: ['record://a/1'] } },
    ]);
  });

  it('ASK is its intro as text, then the card', () => {
    expect(
      decodeAll({
        type: 'ASK',
        text: 'Which one?',
        question: ' Pick ',
        options: [{ label: ' A ', description: 'first' }, { label: '' }, { label: 'B' }],
      }),
    ).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Which one?' },
      { type: 'text-end', id: 't1' },
      { type: 'data-ask', data: { question: 'Pick', options: [{ label: 'A', description: 'first' }, { label: 'B' }] } },
    ]);
  });

  it('an ASK with nothing to pick draws nothing', () => {
    expect(decodeAll({ type: 'ASK', question: 'Pick', options: [{ label: ' ' }] })).toEqual([]);
  });

  it('EXECUTING_TOOL is an input, and grants its own row`s gate', () => {
    expect(
      decodeAll({
        type: 'EXECUTING_TOOL',
        integratedToolType: 'MESHCENTRAL',
        toolFunction: 'run',
        title: 'Run',
        toolExplanation: 'why',
        parameters: { a: 1 },
        toolExecutionRequestId: 'x',
      }),
    ).toEqual([
      { type: 'tool-approval-response', approvalId: 'x', approved: true },
      {
        type: 'tool-input-available',
        toolCallId: 'x',
        toolName: 'run',
        input: { a: 1 },
        dynamic: true,
        title: 'Run',
        toolMetadata: { started: true, integratedToolType: 'MESHCENTRAL', toolExplanation: 'why' },
      },
    ]);
  });

  it('a tool row that names no run draws nothing', () => {
    expect(
      decodeAll(
        { type: 'EXECUTING_TOOL', integratedToolType: 'A', toolFunction: 'b' },
        { type: 'EXECUTED_TOOL', integratedToolType: 'A', toolFunction: 'b', result: 'ok', success: true },
      ),
    ).toEqual([]);
  });

  it('a source row in the new names enters in its one spelling', () => {
    const { chunks } = createMingoDecoder().decode({
      type: 'ATTACHMENTS',
      sources: [{ type: 'source-url', sourceId: 'record://markdown/docs/a.md', url: 'https://a.test', title: 'A' }],
    });
    expect(chunks).toEqual([
      { type: 'source-url', sourceId: 'record://markdown/docs%2Fa.md', url: 'https://a.test', title: 'A' },
    ]);
  });

  describe('a redelivery moves no state', () => {
    const textOf = (entries: readonly ChatStreamEntry[]): string =>
      textOfParts(partsOf(entries.flatMap(entry => entry.chunks)));

    it('answers no chunks, with its sequence', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'TEXT', streamSeq: 2, text: 'a' });
      expect(decoder.decode({ type: 'TEXT', streamSeq: 2, text: 'a' })).toEqual({ seq: 2, chunks: [] });
      expect(decoder.decode({ type: 'TEXT', streamSeq: 1, text: 'b' })).toEqual({ seq: 1, chunks: [] });
    });

    it.each([
      ['closes nothing it was holding', { type: 'EXECUTING_TOOL', streamSeq: 1, toolFunction: 'f' }],
      ['opens no new turn over it', { type: 'MESSAGE_START', streamSeq: 1 }],
      ['adds no second copy of a slice', { type: 'TEXT', streamSeq: 2, text: 'See [' }],
      ['ends no turn', { type: 'MESSAGE_END', streamSeq: 1 }],
      ['a ticket event too, by its own sequence', { type: 'TICKET_EVENT', kind: 'RESOLVED', sequenceId: 1 }],
    ])('%s', (_name, redelivery) => {
      const decoder = createMingoDecoder();
      const entries = [
        decoder.decode({ type: 'MESSAGE_START', streamSeq: 1 }),
        decoder.decode({ type: 'TEXT', streamSeq: 2, text: 'See [' }),
        decoder.decode(redelivery),
        decoder.decode({ type: 'TEXT', streamSeq: 3, text: 'Laptop](record://device/abc) ok' }),
        decoder.decode({ type: 'MESSAGE_END', streamSeq: 4 }),
      ];
      expect(textOf(entries)).toBe('See [Laptop](record://device/abc) ok');
    });

    it('a code span a redelivery lands inside stays whole', () => {
      const decoder = createMingoDecoder();
      const entries = [
        decoder.decode({ type: 'TEXT', streamSeq: 2, text: 'See `co' }),
        decoder.decode({ type: 'TEXT', streamSeq: 2, text: 'See `co' }),
        decoder.decode({ type: 'TEXT', streamSeq: 3, text: 'de` now' }),
        decoder.decode({ type: 'MESSAGE_END', streamSeq: 4 }),
      ];
      expect(textOf(entries)).toBe('See `code` now');
    });

    it('a row of history is read whatever its sequence: rows are not a stream', () => {
      const decoder = createMingoDecoder();
      expect(decoder.decode({ type: 'TEXT', text: 'one' }, { row: { seq: 9 } }).chunks).not.toEqual([]);
      expect(decoder.decode({ type: 'TEXT', text: 'two' }, { row: { seq: 3 } }).chunks).not.toEqual([]);
    });
  });

  it('EXECUTED_TOOL is an output or an error, by `success`', () => {
    const executing = {
      type: 'EXECUTING_TOOL',
      integratedToolType: 'A',
      toolFunction: 'b',
      toolExecutionRequestId: 'x',
    };
    expect(
      decodeAll(executing, {
        type: 'EXECUTED_TOOL',
        toolExecutionRequestId: 'x',
        integratedToolType: 'A',
        toolFunction: 'b',
        result: 'ok',
        success: true,
      }).slice(-1),
    ).toEqual([{ type: 'tool-output-available', toolCallId: 'x', dynamic: true, output: 'ok' }]);
    expect(
      decodeAll(executing, {
        type: 'EXECUTED_TOOL',
        toolExecutionRequestId: 'x',
        integratedToolType: 'A',
        toolFunction: 'b',
        result: 'bad',
        success: false,
      }).slice(-1),
    ).toEqual([{ type: 'tool-output-error', toolCallId: 'x', dynamic: true, errorText: 'bad' }]);
  });

  it('a result that reached this reader alone still has a row to land on', () => {
    const chunks = decodeAll({
      type: 'EXECUTED_TOOL',
      toolExecutionRequestId: 'x',
      integratedToolType: 'A',
      toolFunction: 'b',
      title: 'T',
      result: 'ok',
      success: true,
    });
    expect(partsOf(chunks)).toMatchObject([
      { type: 'dynamic-tool', toolCallId: 'x', title: 'T', state: 'output-available', output: 'ok' },
    ]);
  });

  it('APPROVAL_REQUEST with a tool list: per call, an input then a request; none with no approval to give', () => {
    expect(
      decodeAll({
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'B1',
        approvalType: 'ADMIN',
        toolCalls: [
          {
            toolExecutionRequestId: 'a',
            toolName: 'wipe',
            toolTitle: 'Wipe',
            toolExplanation: 'why',
            requiresApproval: true,
            toolCallArguments: { x: 1 },
            toolType: 'FLEET',
          },
          { toolExecutionRequestId: 'b', toolName: 'read', requiresApproval: false },
          { toolName: 'no id', requiresApproval: true },
          'not a row',
        ],
      }),
    ).toEqual([
      {
        type: 'tool-input-available',
        toolCallId: 'a',
        toolName: 'wipe',
        input: { x: 1 },
        dynamic: true,
        title: 'Wipe',
        toolMetadata: { integratedToolType: 'FLEET', toolExplanation: 'why' },
      },
      {
        type: 'tool-approval-request',
        approvalId: 'a',
        toolCallId: 'a',
        reason: 'why',
        approvalDescriptor: { approvalType: 'ADMIN', batchId: 'B1' },
      },
      {
        type: 'tool-input-available',
        toolCallId: 'b',
        toolName: 'read',
        input: {},
        dynamic: true,
        toolMetadata: { batchId: 'B1' },
      },
    ]);
  });

  it('a persisted request defaults to the history tier', () => {
    const { chunks } = createMingoDecoder().decode(
      {
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'r1',
        toolCalls: [{ toolExecutionRequestId: 'a', toolName: 'wipe', requiresApproval: true }],
      },
      { row: {} },
    );
    expect(chunks[1]).toMatchObject({ approvalDescriptor: { approvalType: 'CLIENT' } });
  });

  it('APPROVAL_RESULT: a response naming the request, plus a denial when it was not granted', () => {
    expect(decodeAll({ type: 'APPROVAL_RESULT', approvalRequestId: 'B1', approved: true, displayName: 'Ann' })).toEqual(
      [{ type: 'tool-approval-response', approvalId: 'B1', approved: true, toolMetadata: { resolvedByName: 'Ann' } }],
    );
    expect(
      decodeAll({ type: 'APPROVAL_RESULT', approvalRequestId: 'B1', approved: false, resolvedByName: 'Ann' }),
    ).toEqual([
      { type: 'tool-approval-response', approvalId: 'B1', approved: false, toolMetadata: { resolvedByName: 'Ann' } },
      { type: 'tool-output-denied', toolCallId: 'B1' },
    ]);
    expect(decodeAll({ type: 'APPROVAL_RESULT' })).toEqual([]);
  });

  it('a batch result flips every row, through the list rule', () => {
    const decoder = createMingoDecoder();
    const wire = createWireState();
    const apply = (messages: ChatMessage[], raw: unknown): ChatMessage[] =>
      decoder.decode(raw).chunks.reduce((all, chunk) => applyChunkToMessages(all, chunk, wire), messages);
    let messages: ChatMessage[] = [];
    messages = apply(messages, { type: 'MESSAGE_START', streamSeq: 1 });
    messages = apply(messages, {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'B1',
      approvalType: 'CLIENT',
      toolCalls: [
        { toolExecutionRequestId: 'a', toolName: 'x', requiresApproval: true },
        { toolExecutionRequestId: 'b', toolName: 'x', requiresApproval: true },
      ],
    });
    messages = apply(messages, { type: 'MESSAGE_END', streamSeq: 2 });
    messages = apply(messages, {
      type: 'APPROVAL_RESULT',
      approvalRequestId: 'B1',
      approved: false,
      displayName: 'Ann',
    });
    expect(messages).toHaveLength(1);
    expect(messages[0].parts).toMatchObject([
      {
        toolCallId: 'a',
        state: 'output-denied',
        approval: { approved: false },
        toolMetadata: { resolvedByName: 'Ann' },
      },
      { toolCallId: 'b', state: 'output-denied', approval: { approved: false } },
    ]);
  });

  it('ESCALATION_OFFER: pending, then its resolution', () => {
    expect(
      decodeAll({ type: 'ESCALATION_OFFER', offerId: 'o1', state: 'PENDING', text: 'Hand off?', origin: 'TOOL' }),
    ).toEqual([
      { type: 'data-escalation-offer', id: 'o1', data: { text: 'Hand off?', status: 'pending', origin: 'TOOL' } },
    ]);
    expect(decodeAll({ type: 'ESCALATION_OFFER', offerId: 'o1', state: 'SUPERSEDED', displayName: 'Ann' })).toEqual([
      { type: 'data-escalation-offer', id: 'o1', data: { status: 'cancelled', resolvedByName: 'Ann' } },
    ]);
    expect(decodeAll({ type: 'ESCALATION_OFFER', offerId: 'o1', state: 'NEW_STATE' })).toEqual([]);
    expect(decodeAll({ type: 'ESCALATION_OFFER', state: 'PENDING' })).toEqual([]);
  });

  it('TICKET_ESCALATED and TICKET_EVENT', () => {
    expect(
      decodeAll({ type: 'TICKET_ESCALATED', ticketId: 'T', ticketNumber: 3, reason: 'INACTIVITY', text: 'Moved' }),
    ).toEqual([
      {
        type: 'data-ticket-escalated',
        id: 'T',
        data: { ticketId: 'T', reason: 'INACTIVITY', ticketNumber: 3, text: 'Moved' },
      },
    ]);
    expect(decodeAll({ type: 'TICKET_ESCALATED', ticketId: 'T' })).toEqual([]);
    expect(
      decodeAll({ type: 'TICKET_EVENT', kind: ' NEW_KIND ', actorName: 'Ann', reason: ' ', streamSeq: 7 }),
    ).toEqual([
      {
        type: 'data-ticket-event',
        id: '7',
        data: { kind: 'NEW_KIND', actorName: 'Ann', occurredAt: '2026-11-02T10:00:00Z' },
      },
    ]);
  });

  it('a persisted ticket event takes the row`s sequence and time', () => {
    const decoded = createMingoDecoder().decode(
      { type: 'TICKET_EVENT', kind: 'RESOLVED' },
      { row: { seq: 8, createdAt: '2026-01-01T00:00:00Z' } },
    );
    expect(decoded.seq).toBe(8);
    expect(decoded.chunks).toEqual([
      { type: 'data-ticket-event', id: '8', data: { kind: 'RESOLVED', occurredAt: '2026-01-01T00:00:00Z' } },
    ]);
  });

  it('ERROR is drawn inline: the turn goes on, and its details are read', () => {
    expect(decodeAll({ type: 'ERROR', error: 'Bad', details: '{"error":{"message":"Why"}}' })).toEqual([
      { type: 'data-error', data: { title: 'Bad', details: 'Why' } },
    ]);
    expect(decodeAll({ type: 'ERROR', details: 'plain' })).toEqual([
      { type: 'data-error', data: { title: 'An error occurred', details: 'plain' } },
    ]);
    expect(decodeAll({ type: 'ERROR', error: 'Bad', details: '{"other":1}' })).toEqual([
      { type: 'data-error', data: { title: 'Bad' } },
    ]);
  });

  it('CONTEXT_COMPACTION_*: one id, started then completed', () => {
    const chunks = decodeAll(
      { type: 'CONTEXT_COMPACTION_START' },
      { type: 'CONTEXT_COMPACTION_END', text: 'live summary' },
      { type: 'CONTEXT_COMPACTION_START' },
      { type: 'CONTEXT_COMPACTION_END', summary: 'row summary' },
    );
    expect(chunks).toEqual([
      { type: 'data-context-compaction', id: 'compaction-1', data: { status: 'started' } },
      { type: 'data-context-compaction', id: 'compaction-1', data: { status: 'completed', summary: 'live summary' } },
      { type: 'data-context-compaction', id: 'compaction-2', data: { status: 'started' } },
      { type: 'data-context-compaction', id: 'compaction-2', data: { status: 'completed', summary: 'row summary' } },
    ]);
    expect(partsOf(chunks)).toHaveLength(2);
  });

  it('MESSAGE_REQUEST, DIRECT_MESSAGE and SYSTEM are participants, transient', () => {
    expect(
      decodeAll(
        {
          type: 'MESSAGE_REQUEST',
          text: 'on @device:1',
          ownerType: 'ADMIN',
          displayName: 'Ann',
          userId: 'u1',
          contextItems: [{ type: 'DEVICE', id: '1' }, { bad: true }],
        },
        { type: 'DIRECT_MESSAGE', text: 'hello', ownerType: 'ADMIN' },
        { type: 'SYSTEM', text: 'joined @device:1' },
        { type: 'DIRECT_MESSAGE' },
      ),
    ).toEqual([
      {
        type: 'data-chat-participant',
        transient: true,
        data: {
          kind: 'message-request',
          text: 'on @device:1',
          ownerType: 'ADMIN',
          displayName: 'Ann',
          userId: 'u1',
          contextItems: [{ type: 'DEVICE', id: '1', label: '1' }],
        },
      },
      {
        type: 'data-chat-participant',
        transient: true,
        data: { kind: 'direct-message', text: 'hello', ownerType: 'ADMIN' },
      },
      { type: 'data-chat-participant', transient: true, data: { kind: 'system', text: 'joined @device:1' } },
    ]);
  });

  it('TOKEN_USAGE and DIALOG_CLOSED are transient', () => {
    expect(
      decodeAll(
        { type: 'TOKEN_USAGE', inputTokensSize: 1, outputTokensSize: 2, totalTokensSize: 3 },
        { type: 'DIALOG_CLOSED' },
      ),
    ).toEqual([
      {
        type: 'data-token-usage',
        transient: true,
        data: { inputTokensSize: 1, outputTokensSize: 2, totalTokensSize: 3, contextSize: 0 },
      },
      { type: 'data-dialog-closed', transient: true, data: {} },
    ]);
  });

  it('a persisted text row is whole: what it opens it closes, and adjacent rows coalesce', () => {
    const decoder = createMingoDecoder();
    const first = decoder.decode({ type: 'TEXT', text: 'One' }, { row: {} }).chunks;
    expect(first[first.length - 1]).toMatchObject({ type: 'text-end' });
    const second = decoder.decode({ type: 'THINKING', text: 'r' }, { row: {} }).chunks;
    expect(second.map(chunk => chunk.type)).toEqual(['reasoning-start', 'reasoning-delta', 'reasoning-end']);
    const parts = partsOf([
      ...decoder.decode({ type: 'TEXT', text: 'a ' }, { row: {} }).chunks,
      ...decoder.decode({ type: 'TEXT', text: 'b' }, { row: {} }).chunks,
    ]);
    expect(parts).toEqual([{ type: 'text', text: 'a b', state: 'done' }]);
  });
});

describe('messageOfStoredRow', () => {
  it('reads what a row says about itself field by field, and never a key this client keeps for itself', () => {
    const message = messageOfStoredRow({
      id: 'a',
      role: 'assistant',
      metadata: {
        seq: 3,
        createdAt: '2026-11-02T10:00:00Z',
        kind: 'approval_receipt',
        aborted: true,
        sourceCount: 2,
        hidden: true,
        progress: 'x',
        usage: 'y',
        author: { name: 'Mallory' },
        streamSeq: 9,
      },
      parts: [{ type: 'text', text: 'a' }],
    });
    expect(message?.metadata).toEqual({
      seq: 3,
      createdAt: '2026-11-02T10:00:00Z',
      kind: 'approval_receipt',
      aborted: true,
      sourceCount: 2,
    });
  });

  it('leaves out a field of the wrong type and a kind it does not know', () => {
    const message = messageOfStoredRow({
      id: 'a',
      role: 'assistant',
      metadata: { seq: '3', createdAt: 123, kind: 'other', aborted: false, sourceCount: 'x' },
      parts: [{ type: 'text', text: 'a' }],
    });
    expect(message?.metadata).toBeUndefined();
  });

  it('reads each row of the history answer', () => {
    for (const row of HISTORY_RESPONSE.messages) expect(messageOfStoredRow(row)).toEqual(row);
  });

  it('validates: a part a row may not hold is left out', () => {
    const message = messageOfStoredRow({
      id: 'a',
      role: 'assistant',
      parts: [{ type: 'text', text: 'ok', state: 'done' }, { type: 'dynamic-tool' }, 7],
    });
    expect(message?.parts).toEqual([{ type: 'text', text: 'ok' }]);
  });

  it('is null for what the chat does not show', () => {
    for (const row of [
      null,
      'x',
      { id: 'a', role: 'tool', parts: [] },
      { id: 'a', role: 'system', parts: [] },
      { id: 'a', parts: [] },
      { role: 'assistant', parts: [] },
    ]) {
      expect(messageOfStoredRow(row)).toBeNull();
    }
  });

  it('an empty answer stays a message', () => {
    expect(messageOfStoredRow({ id: 'a', role: 'assistant', parts: [] })).toEqual({
      id: 'a',
      role: 'assistant',
      parts: [],
    });
  });

  it('hides the user rows the chat never shows', () => {
    const hidden = (text: string) =>
      messageOfStoredRow({ id: 'u', role: 'user', parts: [{ type: 'text', text }] })?.metadata?.hidden;
    expect(hidden('[internal-auto-continuation] go on')).toBe(true);
    expect(hidden('a question')).toBeUndefined();
    expect(messageOfStoredRow({ id: 'u', role: 'user', parts: [] })?.metadata?.hidden).toBe(true);
  });

  it('a user row holding only a file is shown', () => {
    const message = messageOfStoredRow({
      id: 'u',
      role: 'user',
      parts: [{ type: 'file', mediaType: 'image/png', url: 'https://x.test/a.png' }],
    });
    expect(message?.metadata).toBeUndefined();
  });

  it('keeps a row`s stored metadata', () => {
    const message = messageOfStoredRow({
      id: 'a',
      role: 'assistant',
      metadata: { seq: 3, kind: 'approval_receipt', sourceCount: 2 },
      parts: [],
    });
    expect(message?.metadata).toEqual({ seq: 3, kind: 'approval_receipt', sourceCount: 2 });
  });

  it('a new row reads the stored fixture`s citations', () => {
    const message = messageOfStoredRow({ id: 'a', role: 'assistant', parts: STORED_ANSWER_PARTS });
    expect(message?.parts).toEqual(STORED_ANSWER_PARTS);
  });
});

describe('docSearchFieldsOf', () => {
  it('reads the new names', () => {
    expect(docSearchFieldsOf({ sourceId: 'record://a/1', title: 'A', url: 'https://x.test/a' })).toEqual({
      sourceId: 'record://a/1',
      title: 'A',
      url: 'https://x.test/a',
    });
  });

  it('a row that names no record has no source id', () => {
    expect(docSearchFieldsOf({ title: 'Folder' })).toEqual({ sourceId: null, title: 'Folder', url: null });
  });
});
