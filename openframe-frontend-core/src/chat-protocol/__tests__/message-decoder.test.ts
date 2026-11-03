/**
 * The ONE decoder, every path: the hub's stream recognised by its first bytes, the old hub's frames whatever they are
 * labelled, Mingo's table, and a stored row in either shape.
 */

import { describe, expect, it } from 'vitest';
import { applyChunk, applyChunkToMessages, createWireState } from '../apply-chunk';
import { storablePartsOf, textOfParts, type ChatMessage, type ChatPart } from '../chat-message';
import {
  createChatStreamReader,
  createMingoDecoder,
  docSearchFieldsOf,
  messageOfStoredRow,
  mingoUserText,
  type MingoDecoder,
} from '../message-decoder';
import { createOldFrameDecoder, createOldSourceIndex, createOldTextWriter } from '../old-wire';
import { encodeUiChunk, encodeUiDone, type ChatStreamEntry, type UiChunk } from '../ui-chunks';
import { ANSWER_STREAM, HISTORY_RESPONSE, STORED_ANSWER_PARTS } from '../wire-fixtures';

const encoder = new TextEncoder();
const containing = (fields: object): unknown => expect.objectContaining(fields);

function bodyOf(...slices: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const slice of slices) controller.enqueue(typeof slice === 'string' ? encoder.encode(slice) : slice);
      controller.close();
    },
  });
}

/** What production main answers on both of its routes that send old frames. */
const EVENT_STREAM_LABEL = {
  'content-type': 'text/event-stream; charset=utf-8',
  'x-vercel-ai-ui-message-stream': 'v1',
};

async function readAll(
  body: ReadableStream<Uint8Array> | null,
  headers?: Record<string, string>,
): Promise<{ wire: string; chunks: UiChunk[] }> {
  const reader = await createChatStreamReader(new Response(body, headers ? { headers } : undefined));
  const chunks: UiChunk[] = [];
  for await (const chunk of reader.chunks) chunks.push(chunk);
  return { wire: reader.wire, chunks };
}

const frame = (value: unknown): string => `${JSON.stringify(value)}\0`;
const END_OF_LEADING = '\x1E';
const TRAILER = '\x1F';
const INLINE = '\x1D';

function partsOf(chunks: readonly UiChunk[]): ChatPart[] {
  const wire = createWireState();
  return chunks.reduce<ChatPart[]>((parts, chunk) => applyChunk(parts, chunk, wire), []);
}

// What the old hub's rows look like.
const OLD_SOURCES = [
  {
    index: 1,
    name: 'OpenFrame vs Atera',
    path: 'blog/openframe-vs-atera',
    documentType: 'blog_post',
    id: '1108',
    externalUrl: 'https://www.flamingo.run/blog/openframe-vs-atera',
    targetPlatform: 'flamingo',
    sourceRepo: 'blog-posts',
  },
  {
    index: 2,
    name: 'Agent offline after upgrade',
    path: '',
    documentType: 'hubspot_ticket_anon',
    id: '48582802965',
    sourceRepo: 'hubspot-tickets-anon',
  },
  {
    index: 3,
    name: 'Blog posts',
    label: 'Blog posts (2)',
    path: '',
    documentType: 'blog_post',
    items: [
      { id: 'a', documentType: 'blog_post', name: 'Post A', externalUrl: '/blog/a', targetPlatform: 'openmsp' },
      { id: 'b', documentType: 'blog_post', name: 'Post B', externalUrl: '/blog/b', targetPlatform: null },
    ],
  },
  { index: 4, name: 'Setup', path: 'docs/setup.md', documentType: 'markdown', id: 'uuid-x', targetPlatform: null },
];

describe('createChatStreamReader: recognised by its first bytes', () => {
  it('a body starting `data: ` is the UI stream', async () => {
    const bytes = [...ANSWER_STREAM.map(encodeUiChunk), encodeUiDone()];
    const { wire, chunks } = await readAll(bodyOf(...bytes));
    expect(wire).toBe('ui');
    expect(chunks).toEqual(ANSWER_STREAM);
  });

  it('whatever its content-type: a proxy may relabel it, and the label decides nothing', async () => {
    const start = encodeUiChunk({ type: 'start', messageId: 'a1' });
    const { wire } = await readAll(bodyOf(start, encodeUiDone()), { 'content-type': 'text/plain' });
    expect(wire).toBe('ui');
  });

  it('recognises it when the first bytes arrive one at a time', async () => {
    const start = encodeUiChunk({ type: 'start', messageId: 'a1' });
    const slices = [...start].map(byte => Uint8Array.of(byte));
    const { wire, chunks } = await readAll(bodyOf(...slices, encodeUiDone()));
    expect(wire).toBe('ui');
    expect(chunks).toEqual([{ type: 'start', messageId: 'a1' }]);
  });

  it('anything else is the old frames, without waiting for more bytes than it takes to tell', async () => {
    const reader = new ReadableStream<Uint8Array>({
      start(controller) {
        // One byte is enough, and nothing more arrives until the reader has answered.
        controller.enqueue(encoder.encode('{'));
      },
    });
    await expect(createChatStreamReader({ body: reader })).resolves.toMatchObject({ wire: 'old' });
  });

  it('a body that ends before it could say is a UI stream that was cut', async () => {
    expect(await readAll(bodyOf('da'))).toEqual({
      wire: 'ui',
      chunks: [{ type: 'finish', finishReason: 'interrupted' }],
    });
    expect(await readAll(bodyOf())).toEqual({ wire: 'ui', chunks: [{ type: 'finish', finishReason: 'interrupted' }] });
    expect(await readAll(null)).toEqual({ wire: 'ui', chunks: [{ type: 'finish', finishReason: 'interrupted' }] });
    await expect(createChatStreamReader({ body: null })).resolves.toMatchObject({ wire: 'ui' });
  });

  it('an old hub`s answer with no frames at all is the old wire too', async () => {
    const { wire } = await readAll(bodyOf(`nope${'\0'}`));
    expect(wire).toBe('old');
  });
});

describe('the old hub`s frames', () => {
  it('an old confirm-tool body labelled text/event-stream is read as old frames', async () => {
    // What origin/main's confirm-tool route answers on an approve: a decision frame, then the continuation.
    const body = bodyOf(
      frame({
        kind: 'decision_resolved',
        proposalId: 'prop-1',
        ok: true,
        action: 'approved',
        tool_name: 'update_ticket',
        result: { ticket_id: '48', status: 'CLOSED', mirror_synced: true },
        willAutoContinue: true,
        receiptText: '✅ Ticket closed. [card://hubspot_ticket:48]',
      }),
      frame({ status: 'thinking' }),
      frame({
        conversationId: 'c1',
        model: 'm',
        modelLabel: 'M',
        provider: 'anthropic',
        contextWindowMaxTokens: 1000,
        sources: [],
      }),
      END_OF_LEADING,
      'Anything else?',
      `${TRAILER}${JSON.stringify({ kind: 'usage', stage: 'end', input_tokens: 5, output_tokens: 6, stop_reason: 'end_turn' })}`,
    );
    const { wire, chunks } = await readAll(body, EVENT_STREAM_LABEL);
    expect(wire).toBe('old');
    expect(chunks[0]).toEqual({ type: 'start' });
    expect(chunks.filter(chunk => chunk.type === 'start')).toHaveLength(1);
    expect(chunks).toContainEqual({
      type: 'tool-output-available',
      toolCallId: 'prop-1',
      dynamic: true,
      output: { ticket_id: '48', status: 'CLOSED', mirror_synced: true },
    });
    expect(chunks).toContainEqual({ type: 'message-metadata', messageMetadata: { willAutoContinue: true } });
    expect(chunks[chunks.length - 1]).toEqual({
      type: 'finish',
      finishReason: 'stop',
      messageMetadata: { usage: { inputTokens: 5, outputTokens: 6, stop_reason: 'end_turn' } },
    });
    expect(partsOf(chunks)).toEqual([
      { type: 'text', text: '✅ Ticket closed. [48](record://hubspot_ticket/48)', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://hubspot_ticket/48'] } },
      { type: 'text', text: '\n\nAnything else?', state: 'done' },
    ]);
  });

  it('an old confirm-tool reject has no trailer, and is not a cut stream', async () => {
    const { wire, chunks } = await readAll(
      bodyOf(
        frame({
          kind: 'decision_resolved',
          proposalId: 'prop-1',
          ok: true,
          action: 'rejected',
          willAutoContinue: false,
        }),
      ),
      EVENT_STREAM_LABEL,
    );
    expect(wire).toBe('old');
    expect(chunks).toEqual([
      { type: 'start' },
      { type: 'tool-output-denied', toolCallId: 'prop-1' },
      { type: 'message-metadata', messageMetadata: { willAutoContinue: false } },
      { type: 'finish', finishReason: 'other' },
    ]);
  });

  it('a batch`s receipts stay apart: each answer continues the card`s message, and text coalesces', () => {
    const decided = (id: string, receiptText: string): string =>
      frame({
        kind: 'decision_resolved',
        proposalId: id,
        ok: true,
        action: 'approved',
        willAutoContinue: false,
        receiptText,
      });
    const card = (id: string): ChatPart => ({
      type: 'dynamic-tool',
      toolName: 'del',
      toolCallId: id,
      state: 'approval-responded',
      input: {},
      approval: { id, approved: true, descriptor: { batchId: 'b' } },
    });
    let messages: ChatMessage[] = [{ id: 'card', role: 'assistant', parts: [card('a'), card('b')] }];
    const wire = createWireState();
    for (const [id, receipt] of [
      ['a', '✅ Task A deleted.'],
      ['b', '✅ Task B deleted.'],
    ]) {
      wire.setMessageId('card');
      const decoder = createOldFrameDecoder();
      for (const chunk of [...decoder.push(encoder.encode(decided(id, receipt))), ...decoder.end()]) {
        messages = applyChunkToMessages(messages, chunk, wire);
      }
    }
    expect(textOfParts(messages[0].parts)).toBe('✅ Task A deleted.\n\n✅ Task B deleted.\n\n');
  });

  it('a read that fails is a cut stream, where a body that closes with no trailer is not', async () => {
    let pulls = 0;
    const cut = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulls++ === 0) controller.enqueue(encoder.encode(`${END_OF_LEADING}Partial`));
        else controller.error(new TypeError('network error'));
      },
    });
    const { wire, chunks } = await readAll(cut);
    expect(wire).toBe('old');
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish', finishReason: 'interrupted' });
    expect(textOfParts(partsOf(chunks))).toBe('Partial');
  });

  it('a failed decision is an error on its row', async () => {
    const { chunks } = await readAll(
      bodyOf(
        frame({
          kind: 'decision_resolved',
          proposalId: 'prop-1',
          ok: false,
          action: 'approved',
          willAutoContinue: false,
          receiptText: 'It failed.',
        }),
      ),
    );
    expect(chunks).toContainEqual({
      type: 'tool-output-error',
      toolCallId: 'prop-1',
      dynamic: true,
      errorText: 'It failed.',
    });
  });

  it('an old display answer labelled text/event-stream is read as old frames', async () => {
    // What origin/main's display-action-response answers: status, usage, metadata, sentinel, text, trailer.
    const body = bodyOf(
      frame({ status: 'thinking' }),
      frame({
        kind: 'usage',
        stage: 'start',
        input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      }),
      frame({
        conversationId: 'c1',
        model: 'display',
        modelLabel: 'Display',
        provider: 'display',
        scrollAnchor: 'top',
        sources: OLD_SOURCES.slice(0, 1),
      }),
      END_OF_LEADING,
      'The article.\n\n[card://blog_post:1108]\n',
      `${TRAILER}${JSON.stringify({ kind: 'usage', stage: 'display', input_tokens: 0, output_tokens: 0 })}`,
    );
    const { wire, chunks } = await readAll(body, EVENT_STREAM_LABEL);
    expect(wire).toBe('old');
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'start',
      'message-metadata',
      'message-metadata',
      'source-url',
      'text-start',
      'text-delta',
      'text-end',
      'data-record-cards',
      'finish',
    ]);
    const parts = partsOf(chunks);
    expect(parts[0]).toEqual({
      type: 'source-url',
      sourceId: 'record://blog_post/1108',
      url: 'https://www.flamingo.run/blog/openframe-vs-atera',
      title: 'OpenFrame vs Atera',
    });
    expect(chunks).toContainEqual({
      type: 'message-metadata',
      messageMetadata: {
        conversationId: 'c1',
        model: 'display',
        modelLabel: 'Display',
        provider: 'display',
        scrollAnchor: 'top',
      },
    });
    expect(chunks[chunks.length - 1]).toMatchObject({ type: 'finish', finishReason: 'stop' });
  });

  it('every kind of leading frame', async () => {
    const { chunks } = await readAll(
      bodyOf(
        frame({ status: 'thinking' }),
        frame({
          type: 'EXECUTING_TOOL',
          integratedToolType: 'OPENFRAME',
          toolFunction: 'searching',
          title: 'Searching 29 sources',
          toolExecutionRequestId: 't1:searching',
        }),
        frame({
          type: 'EXECUTED_TOOL',
          integratedToolType: 'OPENFRAME',
          toolFunction: 'searching',
          title: 'Searching 29 sources',
          toolExecutionRequestId: 't1:searching',
          success: true,
        }),
        frame({
          type: 'EXECUTED_TOOL',
          integratedToolType: 'OPENFRAME',
          toolFunction: 'reading',
          title: 'Reading the results',
          toolExecutionRequestId: 't1:reading',
          success: false,
        }),
        frame({ kind: 'routing', routedComplexity: 'default', routedModel: 'm', routedThinkingBudget: 0 }),
        frame({
          kind: 'usage',
          stage: 'start',
          input_tokens: 1,
          cache_read_input_tokens: 2,
          cache_creation_input_tokens: 3,
        }),
        frame({ kind: 'thinking-delta', text: 'hmm ' }),
        frame({ kind: 'thinking-delta', text: 'yes' }),
        frame({ kind: 'text-leading', text: 'Preamble.' }),
        frame({ kind: 'tool_error', toolName: 'update_ticket', toolUseId: 'toolu_1', message: 'No.' }),
        frame({ kind: 'tool_error', message: 'Turn failed.' }),
        frame({
          kind: 'approval_request',
          proposalId: 'p1',
          toolName: 'close',
          title: 'Close',
          fields: [
            { label: 'A', value: 'B' },
            { label: '', value: 'x' },
          ],
          args: { a: 1 },
          expiresAt: 'soon',
          ttlSeconds: 60,
        }),
        frame({
          kind: 'approval_batch',
          batchId: 'batch:p2',
          proposals: [
            { proposalId: 'p2', toolName: 'delete', title: 'Delete 2' },
            { proposalId: 'p3', toolName: 'delete' },
          ],
        }),
      ),
    );
    expect(chunks).toEqual([
      { type: 'start' },
      {
        type: 'data-chat-progress',
        id: 't1:searching',
        transient: true,
        data: { stage: 'searching', count: 29, state: 'running' },
      },
      {
        type: 'data-chat-progress',
        id: 't1:searching',
        transient: true,
        data: { stage: 'searching', count: 29, state: 'done' },
      },
      { type: 'data-chat-progress', id: 't1:reading', transient: true, data: { stage: 'reading', state: 'failed' } },
      {
        type: 'message-metadata',
        messageMetadata: { routing: { complexity: 'default', model: 'm', thinkingBudget: 0 } },
      },
      {
        type: 'message-metadata',
        messageMetadata: { usage: { inputTokens: 1, inputTokenDetails: { cacheReadTokens: 2, cacheWriteTokens: 3 } } },
      },
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'hmm ' },
      { type: 'reasoning-delta', id: 'r1', delta: 'yes' },
      { type: 'reasoning-end', id: 'r1' },
      { type: 'text-start', id: 't2' },
      { type: 'text-delta', id: 't2', delta: 'Preamble.' },
      { type: 'text-end', id: 't2' },
      {
        type: 'tool-input-error',
        toolCallId: 'toolu_1',
        toolName: 'update_ticket',
        input: {},
        dynamic: true,
        errorText: 'No.',
      },
      { type: 'data-error', data: { title: 'Turn failed.' } },
      {
        type: 'tool-input-available',
        toolCallId: 'p1',
        toolName: 'close',
        input: { a: 1 },
        dynamic: true,
        title: 'Close',
      },
      {
        type: 'tool-approval-request',
        approvalId: 'p1',
        toolCallId: 'p1',
        approvalDescriptor: { fields: [{ label: 'A', value: 'B' }], expiresAt: 'soon', ttlSeconds: 60 },
      },
      {
        type: 'tool-input-available',
        toolCallId: 'p2',
        toolName: 'delete',
        input: {},
        dynamic: true,
        title: 'Delete 2',
      },
      {
        type: 'tool-approval-request',
        approvalId: 'p2',
        toolCallId: 'p2',
        approvalDescriptor: { batchId: 'batch:p2' },
      },
      { type: 'tool-input-available', toolCallId: 'p3', toolName: 'delete', input: {}, dynamic: true },
      {
        type: 'tool-approval-request',
        approvalId: 'p3',
        toolCallId: 'p3',
        approvalDescriptor: { batchId: 'batch:p2' },
      },
      { type: 'finish', finishReason: 'other' },
    ]);
  });

  it('a frame inside the answer sits where it was sent', async () => {
    const { chunks } = await readAll(
      bodyOf(
        frame({ status: 'thinking' }),
        END_OF_LEADING,
        'Before.\n\n',
        `${INLINE}${frame({ type: 'RECORD_CARDS', cards: [{ entityType: 'blog_post', entityId: '1' }, { entityType: 'blog_post', entityId: '1' }, { bad: true }] })}`,
        'After.',
        `${INLINE}{not json\0`,
        ' More.',
      ),
    );
    expect(partsOf(chunks)).toEqual([
      { type: 'text', text: 'Before.\n\n', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/1'] } },
      { type: 'text', text: 'After. More.', state: 'done' },
    ]);
  });

  it('a leading block that is not JSON is the answer itself', async () => {
    const { chunks } = await readAll(bodyOf('Plain answer\0 text.'));
    expect(partsOf(chunks)).toEqual([{ type: 'text', text: 'Plain answer\0 text.', state: 'done' }]);
  });

  it('a malformed trailer is ignored', async () => {
    const { chunks } = await readAll(bodyOf(frame({ status: 'thinking' }), END_OF_LEADING, 'Hi', `${TRAILER}{nope`));
    expect(chunks[chunks.length - 1]).toEqual({ type: 'finish', finishReason: 'other' });
  });

  it.each([
    ['aborted', 'aborted'],
    ['timeout', 'timeout'],
  ])('a trailer that says %s ends the turn with abort', async (stop, reason) => {
    const { chunks } = await readAll(
      bodyOf(
        frame({ status: 'thinking' }),
        END_OF_LEADING,
        'Par',
        `${TRAILER}${JSON.stringify({ kind: 'usage', stage: 'end', input_tokens: 1, stop_reason: stop })}`,
      ),
    );
    expect(chunks.slice(-2)).toEqual([
      { type: 'message-metadata', messageMetadata: { usage: { inputTokens: 1, stop_reason: stop } } },
      { type: 'abort', reason },
    ]);
  });

  it('maps the trailer`s telemetry to the new names', async () => {
    const { chunks } = await readAll(
      bodyOf(
        frame({ status: 'thinking' }),
        END_OF_LEADING,
        `${TRAILER}${JSON.stringify({ kind: 'usage', stage: 'end', telemetry: { cards: 1, chips: 2, sentences: 3, answerLen: 4 }, hit_rate_pct: 9, stop_reason: 'max_tokens', stop_detail: 'x', breakdown: { a: 1 }, debug: { b: 2 } })}`,
      ),
    );
    expect(chunks[chunks.length - 1]).toEqual({
      type: 'finish',
      finishReason: 'length',
      messageMetadata: {
        usage: {
          hit_rate_pct: 9,
          telemetry: { cards: 1, citations: 2, sentences: 3, answerLen: 4 },
          breakdown: { a: 1 },
          debug: { b: 2 },
          stop_reason: 'max_tokens',
          stop_detail: 'x',
        },
      },
    });
  });

  it('old sources are source parts: flat, by record URI, with what `targetPlatform` said on the url', async () => {
    const { chunks } = await readAll(bodyOf(frame({ sources: OLD_SOURCES })));
    expect(partsOf(chunks)).toEqual([
      containing({ type: 'source-url', sourceId: 'record://blog_post/1108' }),
      {
        type: 'source-document',
        sourceId: 'record://hubspot_ticket_anon/48582802965',
        mediaType: 'text/plain',
        title: 'Agent offline after upgrade',
      },
      { type: 'source-url', sourceId: 'record://blog_post/a', url: 'https://www.openmsp.ai/blog/a', title: 'Post A' },
      { type: 'source-url', sourceId: 'record://blog_post/b', url: '/blog/b', title: 'Post B' },
      {
        type: 'source-document',
        sourceId: 'record://markdown/docs%2Fsetup.md',
        mediaType: 'text/plain',
        title: 'Setup',
        filename: 'docs/setup.md',
      },
    ]);
  });

  it('`[N]` becomes a citation live, removed from the text with the spaces before it', async () => {
    const { chunks } = await readAll(
      bodyOf(
        frame({ sources: OLD_SOURCES }),
        END_OF_LEADING,
        'Priced per device [1]. Tickets too [2]. See [99] and [3].',
      ),
    );
    const parts = storablePartsOf(partsOf(chunks));
    const body = parts.find(part => part.type === 'text');
    expect(body).toMatchObject({ text: 'Priced per device. Tickets too. See and.' });
    expect(body?.type === 'text' && body.citations).toEqual([
      { source: containing({ id: 'record://blog_post/1108' }), endIndex: 17 },
      { source: containing({ id: 'record://hubspot_ticket_anon/48582802965' }), endIndex: 30 },
      { source: containing({ id: 'record://blog_post', title: 'Blog posts (2)' }), endIndex: 39 },
    ]);
    // The grouped row's collection is a source of its own, added when it is cited.
    expect(parts).toContainEqual({
      type: 'source-document',
      sourceId: 'record://blog_post',
      mediaType: 'text/plain',
      title: 'Blog posts (2)',
    });
    // Its text closes the wire id at each citation and continues the one part.
    expect(chunks.filter(chunk => chunk.type === 'text-end').length).toBeGreaterThan(1);
  });

  it('any split of an old body builds the same parts', () => {
    const bytes = encoder.encode(
      [
        frame({ status: 'thinking' }),
        frame({ sources: OLD_SOURCES }),
        END_OF_LEADING,
        'One [1] two [card://faq:a] three @device:64f0.\n\n[card://blog_post:1108]\n\nCode `[1]` ok ✅.',
        `${INLINE}${frame({ type: 'RECORD_CARDS', cards: [{ entityType: 'x', entityId: 'y' }] })}`,
        'End.',
        `${TRAILER}${JSON.stringify({ kind: 'usage', stage: 'end', stop_reason: 'end_turn' })}`,
      ].join(''),
    );
    const decode = (cut: number): UiChunk[] => {
      const decoder = createOldFrameDecoder();
      return [...decoder.push(bytes.slice(0, cut)), ...decoder.push(bytes.slice(cut)), ...decoder.end()];
    };
    const whole = storablePartsOf(partsOf(decode(bytes.length)));
    expect(whole.map(part => part.type)).toContain('data-record-cards');
    for (let cut = 0; cut <= bytes.length; cut++) expect(storablePartsOf(partsOf(decode(cut)))).toEqual(whole);
  });

  it('end is idempotent', () => {
    const decoder = createOldFrameDecoder();
    expect(decoder.end()).toHaveLength(2);
    expect(decoder.end()).toEqual([]);
  });
});

describe('old tokens in a text', () => {
  function convert(content: string, sources: unknown[] = OLD_SOURCES, slice = Infinity): ChatPart[] {
    const index = createOldSourceIndex();
    const wire = createWireState();
    let id = 0;
    const writer = createOldTextWriter(index, () => `t${++id}`);
    let parts = (index.register(sources) as UiChunk[]).reduce<ChatPart[]>(
      (all, chunk) => applyChunk(all, chunk, wire),
      [],
    );
    const size = Math.min(slice, content.length || 1);
    for (let at = 0; at < content.length; at += size) {
      parts = writer.push(content.slice(at, at + size)).reduce((all, chunk) => applyChunk(all, chunk, wire), parts);
    }
    parts = writer.close().reduce((all, chunk) => applyChunk(all, chunk, wire), parts);
    return storablePartsOf(parts).filter(part => !('sourceId' in part));
  }

  it.each([
    [
      'a card alone on a line, at that place',
      'Before.\n\n[card://faq:a]\n\nAfter.',
      [
        { type: 'text', text: 'Before.\n\n' },
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
        { type: 'text', text: 'After.' },
      ],
    ],
    [
      'a card in a sentence: a link there, the card after its paragraph',
      'See [card://blog_post:1108] now.\n\nNext.',
      [
        { type: 'text', text: 'See [OpenFrame vs Atera](record://blog_post/1108) now.' },
        { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
        { type: 'text', text: '\n\nNext.' },
      ],
    ],
    [
      'a card in a sentence with no paragraph after it',
      'See [card://faq:a].',
      [
        { type: 'text', text: 'See [a](record://faq/a).' },
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
      ],
    ],
    [
      'a run of cards, no text between them',
      '[card://faq:a]\n\n[card://faq:b]\n',
      [
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
        { type: 'data-record-cards', data: { records: ['record://faq/b'] } },
      ],
    ],
    [
      'more than eight cards, all kept',
      Array.from({ length: 9 }, (_, i) => `[card://faq:${i}]`).join('\n'),
      Array.from({ length: 9 }, (_, i) => ({ type: 'data-record-cards', data: { records: [`record://faq/${i}`] } })),
    ],
    [
      'the same card twice in a paragraph, drawn once',
      'A [card://faq:a] and [card://faq:a].',
      [
        { type: 'text', text: 'A [a](record://faq/a) and [a](record://faq/a).' },
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
      ],
    ],
    ['a malformed card is removed', 'A [card://x] B [card://faq:] C', [{ type: 'text', text: 'A  B  C' }]],
    ['an unterminated card is removed', 'A [card://faq:a', [{ type: 'text', text: 'A ' }]],
    [
      'a card that closes with `)`',
      'A [card://faq:a) B',
      [
        { type: 'text', text: 'A [a](record://faq/a) B' },
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
      ],
    ],
    [
      'a card as a link destination',
      'A [Name](card://faq:a) B',
      [{ type: 'text', text: 'A [Name](record://faq/a) B' }],
    ],
    ['a card in a code span stays', 'Use `[card://faq:a]` here', [{ type: 'text', text: 'Use `[card://faq:a]` here' }]],
    ['a card in a fence stays', '```\n[card://faq:a]\n```\n', [{ type: 'text', text: '```\n[card://faq:a]\n```\n' }]],
    ['a record link stays', 'See [A](record://faq/a).', [{ type: 'text', text: 'See [A](record://faq/a).' }]],
    [
      'a mention is a record link, its token the label',
      'On @device:64f0a1 now',
      [{ type: 'text', text: 'On [@device:64f0a1](record://device/64f0a1) now' }],
    ],
    ['a mention in parentheses', '(@kb:5)', [{ type: 'text', text: '([@kb:5](record://kb/5))' }]],
    [
      'a camelCase mention',
      '@scheduledScript:38',
      [{ type: 'text', text: '[@scheduledScript:38](record://scheduledScript/38)' }],
    ],
    [
      'a sentence period is not the id',
      'Run @script:38.',
      [{ type: 'text', text: 'Run [@script:38](record://script/38).' }],
    ],
    ['an email stays', 'user@host:1234 stays', [{ type: 'text', text: 'user@host:1234 stays' }]],
    ['a url stays', 'https://x.test/@me:abc', [{ type: 'text', text: 'https://x.test/@me:abc' }]],
    ['a mention in code stays', '`@device:1`', [{ type: 'text', text: '`@device:1`' }]],
    ['a bare at sign stays', 'an @ sign and @nope', [{ type: 'text', text: 'an @ sign and @nope' }]],
    ['`[N]` next to a word stays', 'array[1] and foo[12]bar', [{ type: 'text', text: 'array[1] and foo[12]bar' }]],
    [
      '`[N]` in code stays',
      '`a [1]` and\n```\nb [1]\n```\n',
      [{ type: 'text', text: '`a [1]` and\n```\nb [1]\n```\n' }],
    ],
    [
      'a link labelled with a number stays',
      'See [1](https://x.test).',
      [{ type: 'text', text: 'See [1](https://x.test).' }],
    ],
    ['a number with no target goes, citing nothing', 'One [77].', [{ type: 'text', text: 'One.' }]],
    [
      'an escaped token stays',
      '\\[card://faq:a] \\@device:1',
      [{ type: 'text', text: '\\[card://faq:a] \\@device:1' }],
    ],
    [
      'an unclosed backtick protects nothing',
      'a ` b [card://faq:a]\n\nc',
      [
        { type: 'text', text: 'a ` b [a](record://faq/a)' },
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
        { type: 'text', text: '\n\nc' },
      ],
    ],
  ] as Array<[string, string, ChatPart[]]>)('%s', (_name, content, expected) => {
    expect(convert(content)).toEqual(expected);
  });

  it.each([
    'One [1] two [2][3] three.\n\n[card://faq:a]\n\nFour [card://blog_post:1108] five @device:64f0.\n\n`[1]` end.',
    '```js\n[card://faq:a] [1] @device:1\n```\nAfter [1].',
    'Tail held at the end [1',
    'Tail held at the end [card://faq:a',
    'Tail held at the end @device:64f0',
    'Ends in spaces   ',
    '[1] leading chip',
  ])('any slicing of %j builds the same parts', content => {
    const whole = convert(content);
    for (let slice = 1; slice <= content.length; slice++) expect(convert(content, OLD_SOURCES, slice)).toEqual(whole);
  });

  it('a text slice is held only as long as it could still be a token', () => {
    const index = createOldSourceIndex();
    const writer = createOldTextWriter(index, () => 't1');
    const deltas = (slice: string): string[] =>
      writer.push(slice).flatMap(chunk => (chunk.type === 'text-delta' ? [chunk.delta] : []));
    expect(deltas('Hello [')).toEqual(['Hello']);
    expect(deltas('world] and ')).toEqual([' [world] and']);
  });
});

describe('any split of a text builds what the whole text builds', () => {
  /** The parts of a turn whose text arrives in these slices, on the old hub (`citations`) or on Mingo (none). */
  function partsOfSlices(slices: readonly string[], citations: boolean): ChatPart[] {
    const index = createOldSourceIndex();
    index.register(OLD_SOURCES);
    let id = 0;
    const writer = createOldTextWriter(index, () => `t${++id}`, { citations });
    const wire = createWireState();
    const chunks = [...slices.flatMap(slice => writer.push(slice)), ...writer.close()];
    return storablePartsOf(chunks.reduce<ChatPart[]>((parts, chunk) => applyChunk(parts, chunk, wire), []));
  }

  function sliced(text: string, next: (limit: number) => number): string[] {
    const slices: string[] = [];
    for (let at = 0; at < text.length;) {
      const length = 1 + next(7);
      slices.push(text.slice(at, at + length));
      at += length;
    }
    return slices;
  }

  it('a closing backtick run the next slice extends is a fence, not a code span', () => {
    const text = 'Note the stray ` here.\n```\n[card://faq:a]\n```\nDone.';
    const whole = partsOfSlices([text], true);
    expect(whole.some(part => part.type === 'data-record-cards')).toBe(false);
    const cut = text.indexOf('```') + 1;
    expect(partsOfSlices([text.slice(0, cut), text.slice(cut)], true)).toEqual(whole);
  });

  it('a `[N]` opening a line takes what follows it, whatever slice its spaces came in', () => {
    const text = '\n\n [1]\n';
    expect(partsOfSlices(['\n', '\n ', '[1', ']\n'], true)).toEqual(partsOfSlices([text], true));
  });

  it('at any seed', () => {
    const fragments = [
      'Plain words.',
      'A stray ` backtick.',
      '```\n[card://faq:a]\n[1]\n```',
      '~~~js\n@device:1\n~~~',
      '`code [1]` and ``a ` b``',
      '[card://faq:a]',
      'See [card://blog_post:1108] now.',
      'Cited [1].',
      'More [1, 2][3] here',
      '[2]',
      'Mention @device:64f0 here, user@host:1 no.',
      'Broken [card://x] and [card://nope',
      '[Link](card://faq:a)',
      'array[1] stays and ([1]) goes',
      'Escaped \\[1] and \\`x',
      '| a [1] | b |\n|---|---|\n| c | d [2] |',
      '> quoted [1]',
      '- item [1]\n- item [2]',
      'Emoji ✅ [1] 😀',
    ];
    const separators = ['\n\n', '\n', ' ', '', '\n\n ', '  '];
    let seed = 20261102;
    const next = (limit: number): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed % limit;
    };
    for (let round = 0; round < 600; round++) {
      let text = next(4) === 0 ? separators[next(separators.length)] : '';
      for (let count = 1 + next(4); count > 0; count--) {
        text += fragments[next(fragments.length)] + separators[next(separators.length)];
      }
      for (const citations of [true, false]) {
        const whole = partsOfSlices([text], citations);
        expect({ text, parts: partsOfSlices(sliced(text, next), citations) }).toEqual({ text, parts: whole });
      }
    }
  });
});

describe('old citations reach the chips they were', () => {
  const titled = { index: 1, name: 'A', documentType: 'blog_post', id: '1', externalUrl: 'https://www.flamingo.run/a' };
  const other = { index: 2, name: 'B', documentType: 'blog_post', id: '2', externalUrl: 'https://www.flamingo.run/b' };
  const ROW_A = 'record://blog_post/1';
  const ROW_B = 'record://blog_post/2';

  /** The body of an old row, each text with its citations as `[source, position]`. */
  function convertedBody(content: string, slice = Infinity): unknown[] {
    const index = createOldSourceIndex();
    index.register([titled, other]);
    const wire = createWireState();
    let id = 0;
    const writer = createOldTextWriter(index, () => `t${++id}`);
    let parts: ChatPart[] = [];
    const size = Math.min(slice, content.length || 1);
    for (let at = 0; at < content.length; at += size) {
      parts = writer.push(content.slice(at, at + size)).reduce((all, chunk) => applyChunk(all, chunk, wire), parts);
    }
    parts = writer.close().reduce((all, chunk) => applyChunk(all, chunk, wire), parts);
    return parts.flatMap(part =>
      part.type === 'text'
        ? [[part.text, (part.citations ?? []).map(citation => [citation.source.id, citation.endIndex])]]
        : part.type === 'data-record-cards'
          ? [part.data.records]
          : [],
    );
  }

  it.each<[string, string, unknown[]]>([
    [
      'two with a space between',
      'Foo [1] [2] bar.',
      [
        [
          'Foo bar.',
          [
            [ROW_A, 3],
            [ROW_B, 3],
          ],
        ],
      ],
    ],
    [
      'two side by side',
      'Foo [1][2].',
      [
        [
          'Foo.',
          [
            [ROW_A, 3],
            [ROW_B, 3],
          ],
        ],
      ],
    ],
    [
      'three in a list of words',
      'Foo [1], [2] done.',
      [
        [
          'Foo, done.',
          [
            [ROW_A, 3],
            [ROW_B, 4],
          ],
        ],
      ],
    ],
    ['one opening the answer', '[1] Starts with a chip.', [['Starts with a chip.', [[ROW_A, 0]]]]],
    ['one alone before a paragraph', '[1]\n\nNext.', [['Next.', [[ROW_A, 0]]]]],
    ['one right after a card', 'A.\n\n[card://blog_post:1]\n\n[2] B.', [['A.\n\n', []], [ROW_A], ['B.', [[ROW_B, 0]]]]],
    ['one with no target is removed', 'Alpha [9] beta.', [['Alpha beta.', []]]],
    ['one at the end', 'Foo [1]', [['Foo', [[ROW_A, 3]]]]],
  ])('%s', (_name, content, body) => {
    expect(convertedBody(content)).toEqual(body);
    // However it arrives.
    expect(convertedBody(content, 1)).toEqual(body);
  });

  it('a number with nothing after it and no text before it cites nothing, and breaks nothing', () => {
    expect(convertedBody('[1]')).toEqual([]);
  });
});

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

  it('ATTACHMENTS in the old names: sources and videos are sources, cards are not', () => {
    const chunks = decodeAll({
      type: 'ATTACHMENTS',
      sources: OLD_SOURCES.slice(0, 1),
      videos: [
        { id: 'mux-1', title: 'Install', url: 'https://stream.mux.com/mux-1.m3u8', recordLink: 'record://video/mux-1' },
        { ref: '[card://video:MdFJNoJeqZQ]' },
      ],
      cards: [{ entityType: 'blog_post', entityId: '1108', recordLink: 'record://blog_post/1108' }],
    });
    expect(chunks).toEqual([
      containing({ type: 'source-url', sourceId: 'record://blog_post/1108' }),
      {
        type: 'source-url',
        sourceId: 'record://video/mux-1',
        url: 'https://stream.mux.com/mux-1.m3u8',
        title: 'Install',
      },
      {
        type: 'source-document',
        sourceId: 'record://video/MdFJNoJeqZQ',
        mediaType: 'text/plain',
        title: 'MdFJNoJeqZQ',
      },
    ]);
  });

  it('a hero video gives no source: its `ref` names its document, whose URI is its handle', () => {
    const chunks = decodeAll({
      type: 'ATTACHMENTS',
      sources: [],
      videos: [
        { ref: '[card://video:mux-1]', type: 'video', id: 'mux-1', title: 'Embedded', url: 'https://stream.test/1' },
        { ref: '[card://webinar:123]', type: 'video', id: '123', title: 'Hero', url: 'https://stream.test/hero' },
        { recordLink: 'record://webinar/123', type: 'video', id: '123', title: 'Hero by link' },
      ],
    });
    expect(chunks).toEqual([
      { type: 'source-url', sourceId: 'record://video/mux-1', url: 'https://stream.test/1', title: 'Embedded' },
    ]);
  });

  it('a markdown row is keyed by its path, whatever else names it', () => {
    const chunks = decodeAll({
      type: 'ATTACHMENTS',
      sources: [
        { index: 1, name: 'A', documentType: 'markdown', path: 'docs/a.md', recordLink: 'record://markdown/uuid-1' },
        { index: 2, name: 'B', documentType: 'markdown', path: 'docs/b.md', ref: '[card://markdown:uuid-2]' },
        { index: 3, name: 'C', documentType: 'markdown', recordLink: 'record://markdown/uuid-3' },
      ],
    });
    expect(chunks).toEqual([
      containing({ sourceId: 'record://markdown/docs%2Fa.md', filename: 'docs/a.md' }),
      containing({ sourceId: 'record://markdown/docs%2Fb.md', filename: 'docs/b.md' }),
      containing({ sourceId: 'record://markdown/uuid-3' }),
    ]);
  });

  it('an old row names its record by `recordLink`, then `ref`, then its type and id', () => {
    const chunks = decodeAll({
      type: 'ATTACHMENTS',
      sources: [
        { index: 1, name: 'A', recordLink: 'record://kb/a%20b', externalUrl: 'https://x.test/a' },
        { index: 2, name: 'B', ref: '[card://kb:b]', externalUrl: 'https://x.test/b' },
      ],
    });
    expect(chunks.map(chunk => 'sourceId' in chunk && chunk.sourceId)).toEqual(['record://kb/a%20b', 'record://kb/b']);
  });

  it('GUIDE is read as the arrays it wraps', () => {
    expect(decodeAll({ type: 'GUIDE', payload: { sources: OLD_SOURCES.slice(0, 1) } })).toEqual([
      containing({ type: 'source-url', sourceId: 'record://blog_post/1108' }),
    ]);
    expect(decodeAll({ type: 'GUIDE' })).toEqual([]);
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

  it('RECORD_CARDS in the old names', () => {
    expect(decodeAll({ type: 'RECORD_CARDS', cards: [{ entityType: 'a', entityId: '1' }] })).toEqual([
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

  it('a source row in the new names enters in its one spelling', () => {
    const { chunks } = createMingoDecoder().decode({
      type: 'ATTACHMENTS',
      sources: [{ type: 'source-url', sourceId: 'record://markdown/docs/a.md', url: 'https://a.test', title: 'A' }],
    });
    expect(chunks).toEqual([
      { type: 'source-url', sourceId: 'record://markdown/docs%2Fa.md', url: 'https://a.test', title: 'A' },
    ]);
  });

  describe('a tool row with no run id', () => {
    const executing = (title: string): unknown => ({
      type: 'EXECUTING_TOOL',
      integratedToolType: 'A',
      toolFunction: 'b',
      title,
    });
    const executed = (result: string): unknown => ({
      type: 'EXECUTED_TOOL',
      integratedToolType: 'A',
      toolFunction: 'b',
      result,
      success: true,
    });
    const idsOf = (chunks: readonly UiChunk[], type: UiChunk['type']): string[] =>
      chunks.flatMap(chunk => (chunk.type === type && 'toolCallId' in chunk ? [chunk.toolCallId] : []));

    it('each run is a row of its own, and a result closes the oldest still open', () => {
      const chunks = decodeAll(executing('first'), executing('second'), executed('one'), executed('two'));
      const [first, second] = idsOf(chunks, 'tool-input-available');
      expect(first).not.toBe(second);
      expect(idsOf(chunks, 'tool-output-available')).toEqual([first, second]);
    });

    it('a result with no run open has a row of its own to land on', () => {
      const chunks = decodeAll(executed('one'));
      expect(chunks.map(chunk => chunk.type)).toEqual(['tool-input-available', 'tool-output-available']);
    });

    it('a run a turn left open never takes a later turn`s result', () => {
      for (const endTurn of [
        (decoder: MingoDecoder) => decoder.decode({ type: 'MESSAGE_END' }),
        (decoder: MingoDecoder) => decoder.decode({ type: 'MESSAGE_START' }),
        (decoder: MingoDecoder) => decoder.endTurn(),
      ]) {
        const decoder = createMingoDecoder();
        const [left] = idsOf(decoder.decode(executing('cut off')).chunks, 'tool-input-available');
        endTurn(decoder);
        const [next] = idsOf(decoder.decode(executing('next')).chunks, 'tool-input-available');
        const [closed] = idsOf(decoder.decode(executed('ok')).chunks, 'tool-output-available');
        expect(next).not.toBe(left);
        expect(closed).toBe(next);
      }
    });

    it('a row that has its run id keeps it', () => {
      const [chunk] = decodeAll({
        type: 'EXECUTING_TOOL',
        integratedToolType: 'A',
        toolFunction: 'b',
        toolExecutionRequestId: 'x',
      }).slice(-1);
      expect(chunk).toMatchObject({ type: 'tool-input-available', toolCallId: 'x' });
    });
  });

  describe('discardHeld: another copy of the text is what is drawn now', () => {
    const typesOf = (entry: ChatStreamEntry): string[] => entry.chunks.map(chunk => chunk.type);

    it.each([
      ['an open code span', 'Run `ls'],
      ['an open bracket', 'See ['],
      ['a card token not finished', 'See [card://blog'],
      ['a mention not finished', 'ask @dev'],
      ['the spaces at its end', 'Run '],
    ])('%s is forgotten, and the next turn opens with nothing of it', (_name, said) => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'MESSAGE_START', streamSeq: 1 });
      decoder.decode({ type: 'TEXT', text: said, streamSeq: 2 });
      decoder.discardHeld();
      expect(typesOf(decoder.decode({ type: 'MESSAGE_START', streamSeq: 3 }))).toEqual(['start']);
    });

    it('the answer goes on with what comes next, and nothing of what was held', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'MESSAGE_START', streamSeq: 1 });
      decoder.decode({ type: 'TEXT', text: 'Run `ls', streamSeq: 2 });
      decoder.discardHeld();
      const entries = [
        decoder.decode({ type: 'TEXT', text: 'Next line.', streamSeq: 3 }),
        decoder.decode({ type: 'MESSAGE_END', streamSeq: 4 }),
      ];
      expect(textOfParts(partsOf(entries.flatMap(entry => entry.chunks)))).toBe('Next line.');
    });

    it('nothing of a code span it was inside carries over', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'TEXT', text: '```\ninside [card://blog_post:1]', streamSeq: 1 });
      decoder.discardHeld();
      const { chunks } = decoder.decode({ type: 'TEXT', text: 'See [card://blog_post:2]\n\nnext', streamSeq: 2 });
      expect(chunks).toContainEqual(containing({ delta: expect.stringContaining('record://blog_post/2') }));
    });

    it('an open reasoning is forgotten', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'THINKING', text: 'hm', streamSeq: 1 });
      decoder.discardHeld();
      expect(typesOf(decoder.decode({ type: 'MESSAGE_END', streamSeq: 2 }))).toEqual(['finish']);
    });

    it('emits nothing, and a redelivery is still a redelivery', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'TEXT', text: 'Run `ls', streamSeq: 5 });
      decoder.discardHeld();
      expect(decoder.decode({ type: 'TEXT', text: 'again', streamSeq: 5 })).toEqual({ seq: 5, chunks: [] });
    });
  });

  describe('closeHeld: a send moves the thread on, and what the decoder holds has to land before it', () => {
    const typesOf = (entry: ChatStreamEntry): string[] => entry.chunks.map(chunk => chunk.type);

    it.each([
      ['an open code span', 'Run `ls'],
      ['an open bracket', 'See ['],
      ['a mention not finished', 'ask @dev'],
    ])('%s is written and closed, and the next turn opens with nothing of it', (_name, said) => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'MESSAGE_START', streamSeq: 1 });
      const seen = decoder.decode({ type: 'TEXT', text: said, streamSeq: 2 }).chunks;
      const closed = decoder.closeHeld();

      expect(textOfParts(partsOf([...seen, ...closed.chunks]))).toBe(said);
      expect(closed.chunks[closed.chunks.length - 1]?.type).toBe('text-end');
      expect(typesOf(decoder.decode({ type: 'MESSAGE_START', streamSeq: 3 }))).toEqual(['start']);
    });

    it('a card token not finished goes as at any end of a turn: it never shows raw', () => {
      const decoder = createMingoDecoder();
      const seen = decoder.decode({ type: 'TEXT', text: 'See [card://blog', streamSeq: 1 }).chunks;
      expect(textOfParts(partsOf([...seen, ...decoder.closeHeld().chunks]))).toBe('See ');
    });

    it('an open reasoning closes', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'THINKING', text: 'hm', streamSeq: 1 });
      expect(typesOf(decoder.closeHeld())).toEqual(['reasoning-end']);
    });

    it('a turn with nothing open answers nothing, and names no sequence: it is no chunk off the wire', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'MESSAGE_START', streamSeq: 1 });
      decoder.decode({ type: 'MESSAGE_END', streamSeq: 2 });
      expect(decoder.closeHeld()).toEqual({ chunks: [] });
    });

    it('a redelivery is still a redelivery', () => {
      const decoder = createMingoDecoder();
      decoder.decode({ type: 'TEXT', text: 'Run `ls', streamSeq: 5 });
      decoder.closeHeld();
      expect(decoder.decode({ type: 'TEXT', text: 'again', streamSeq: 5 })).toEqual({ seq: 5, chunks: [] });
    });
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

  describe('a text part is a document of its own', () => {
    const CARD_FAQ = { type: 'data-record-cards', data: { records: ['record://faq/a'] } };
    const threadBody = (...raws: unknown[]): unknown[] => {
      const decoder = createMingoDecoder();
      const chunks = raws.flatMap((raw, index) => decoder.decode({ streamSeq: index + 1, ...(raw as object) }).chunks);
      const wire = createWireState();
      const messages = chunks.reduce<ChatMessage[]>((all, chunk) => applyChunkToMessages(all, chunk, wire), []);
      return messages.map(message => message.parts.map(part => (part.type === 'text' ? part.text : part)));
    };

    it('a card alone on a line after a tool row is a card, with no link', () => {
      const [parts] = threadBody(
        { type: 'MESSAGE_START' },
        { type: 'TEXT', text: 'Checking.' },
        { type: 'EXECUTED_TOOL', toolExecutionRequestId: 'x', toolFunction: 'f', result: '{}', success: true },
        { type: 'TEXT', text: '[card://faq:a]\n\nThe FAQ.' },
        { type: 'MESSAGE_END' },
      ) as unknown[][];
      expect(parts).toEqual(['Checking.', expect.objectContaining({ type: 'dynamic-tool' }), CARD_FAQ, 'The FAQ.']);
    });

    it('a card first in a new turn is a card, with no link', () => {
      expect(
        threadBody(
          { type: 'MESSAGE_START' },
          { type: 'TEXT', text: 'Done.' },
          { type: 'MESSAGE_END' },
          { type: 'MESSAGE_START' },
          { type: 'TEXT', text: '[card://faq:a]' },
          { type: 'MESSAGE_END' },
        ),
      ).toEqual([['Done.'], [CARD_FAQ]]);
    });

    it('an answer that ends in an open fence leaves the next one alone', () => {
      expect(
        threadBody(
          { type: 'MESSAGE_START' },
          { type: 'TEXT', text: '```js\ncut off' },
          { type: 'MESSAGE_END' },
          { type: 'MESSAGE_START' },
          { type: 'TEXT', text: 'Next [card://faq:a] turn [1].' },
          { type: 'MESSAGE_END' },
        ),
      ).toEqual([['```js\ncut off'], ['Next [a](record://faq/a) turn.', CARD_FAQ]]);
    });

    it('the same on rows of history, which share one decoder across a dialog', () => {
      const decoder = createMingoDecoder();
      const rowOf = (text: string): UiChunk[] => decoder.decode({ type: 'TEXT', text }, { row: {} }).chunks;
      expect(rowOf('```js\ncut off').filter(chunk => chunk.type === 'text-delta')).toHaveLength(1);
      expect(rowOf('[card://faq:a]')).toEqual([CARD_FAQ]);
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

  it('APPROVAL_REQUEST with no tool list: its command is the tool', () => {
    expect(
      decodeAll({ type: 'APPROVAL_REQUEST', approvalRequestId: 'r1', command: 'rm -rf', explanation: 'why' }),
    ).toEqual([
      {
        type: 'tool-input-available',
        toolCallId: 'r1',
        toolName: 'command',
        input: {},
        dynamic: true,
        title: 'rm -rf',
      },
      {
        type: 'tool-approval-request',
        approvalId: 'r1',
        toolCallId: 'r1',
        reason: 'why',
        approvalDescriptor: { approvalType: 'USER' },
      },
    ]);
  });

  it('a persisted request defaults to the history tier', () => {
    const { chunks } = createMingoDecoder().decode(
      { type: 'APPROVAL_REQUEST', approvalRequestId: 'r1', command: 'x' },
      { row: {} },
    );
    expect(chunks[1]).toMatchObject({ approvalDescriptor: { approvalType: 'CLIENT' } });
  });

  it('a tool that runs grants the newest single gate, which never carries its id', () => {
    const chunks = decodeAll(
      { type: 'APPROVAL_REQUEST', approvalRequestId: 'r1', command: 'x' },
      { type: 'EXECUTING_TOOL', integratedToolType: 'A', toolFunction: 'b', toolExecutionRequestId: 'x' },
    );
    expect(partsOf(chunks)).toMatchObject([
      { toolCallId: 'r1', state: 'approval-responded', approval: { approved: true } },
      { toolCallId: 'x', state: 'input-available' },
    ]);
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
          text: 'on [@device:1](record://device/1)',
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

  it('old tokens in Mingo text become parts; a stray `[N]` goes and cites nothing, Mingo has no citations', () => {
    const chunks = decodeAll(
      { type: 'ATTACHMENTS', sources: OLD_SOURCES.slice(0, 1) },
      { type: 'TEXT', text: 'See [card://blog_po' },
      { type: 'TEXT', text: 'st:1108] now [1].' },
      { type: 'MESSAGE_END' },
    );
    const parts = storablePartsOf(partsOf(chunks));
    expect(parts.filter(part => !('sourceId' in part))).toEqual([
      { type: 'text', text: 'See [OpenFrame vs Atera](record://blog_post/1108) now.' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
    ]);
  });

  it('a persisted text row is whole: what it opens it closes, and adjacent rows coalesce', () => {
    const decoder = createMingoDecoder();
    const first = decoder.decode({ type: 'TEXT', text: 'One [card://faq:a]' }, { row: {} }).chunks;
    expect(first[first.length - 1]).toMatchObject({ type: 'data-record-cards' });
    const second = decoder.decode({ type: 'THINKING', text: 'r' }, { row: {} }).chunks;
    expect(second.map(chunk => chunk.type)).toEqual(['reasoning-start', 'reasoning-delta', 'reasoning-end']);
    const parts = partsOf([
      ...decoder.decode({ type: 'TEXT', text: 'a ' }, { row: {} }).chunks,
      ...decoder.decode({ type: 'TEXT', text: 'b' }, { row: {} }).chunks,
    ]);
    expect(parts).toEqual([{ type: 'text', text: 'a b', state: 'done' }]);
  });

  it('a person`s old mention is a record link', () => {
    expect(mingoUserText('see @device:64f0a1, and user@host:1')).toBe(
      'see [@device:64f0a1](record://device/64f0a1), and user@host:1',
    );
    expect(mingoUserText('no token')).toBe('no token');
  });

  it.each([
    ['a code span', 'add `@get:JsonProperty` here'],
    ['a fence', '```kotlin\n@get:JsonProperty("x")\n```'],
    ['a tilde fence', '~~~\n@get:JsonProperty("x")\n~~~\n'],
  ])('a mention pattern in %s stays code', (_name, text) => {
    expect(mingoUserText(text)).toBe(text);
  });

  it('a person`s other brackets are their own: a mention beside them converts, the rest stays as typed', () => {
    expect(mingoUserText('[card://faq:a] [1] (card://x:y) `a` @device:1\n')).toBe(
      '[card://faq:a] [1] (card://x:y) `a` [@device:1](record://device/1)\n',
    );
  });

  it('a stray backtick opens no code, so a mention after it converts', () => {
    expect(mingoUserText('a ` b @device:1')).toBe('a ` b [@device:1](record://device/1)');
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
    for (const row of [null, 'x', { role: 'tool', parts: [] }, { role: 'system', parts: [] }, { parts: [] }]) {
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

  describe('an old row', () => {
    const row = {
      seq: 5,
      role: 'assistant',
      kind: 'approval_receipt',
      content: 'Priced per device [1]. See [card://blog_post:1108] now.\n\n[card://faq:a]\n',
      sources: OLD_SOURCES.slice(0, 2),
      created_at: '2026-10-01T00:00:00Z',
      aborted: true,
    };

    it('reads as parts: sources, then text and cards, tokens converted', () => {
      const message = messageOfStoredRow(row, 'hydrated-5');
      expect(message).toMatchObject({
        id: 'hydrated-5',
        role: 'assistant',
        metadata: { seq: 5, createdAt: '2026-10-01T00:00:00Z', kind: 'approval_receipt', aborted: true },
      });
      expect(message?.parts).toEqual([
        containing({ type: 'source-url', sourceId: 'record://blog_post/1108' }),
        containing({ type: 'source-document', sourceId: 'record://hubspot_ticket_anon/48582802965' }),
        {
          type: 'text',
          text: 'Priced per device. See [OpenFrame vs Atera](record://blog_post/1108) now.',
          citations: [{ source: containing({ id: 'record://blog_post/1108' }), endIndex: 17 }],
        },
        { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
        { type: 'text', text: '\n\n' },
        { type: 'data-record-cards', data: { records: ['record://faq/a'] } },
      ]);
    });

    it('an old user row is what the person typed, verbatim', () => {
      expect(messageOfStoredRow({ role: 'user', content: 'see [card://faq:a] [1]', seq: 1 }, 'u1')?.parts).toEqual([
        { type: 'text', text: 'see [card://faq:a] [1]' },
      ]);
    });

    it('an old row`s id falls back to its sequence', () => {
      expect(messageOfStoredRow({ role: 'user', content: 'hi', seq: 7 })?.id).toBe('hydrated-7');
    });

    it('reads a row holding `RECORD_CARDS` parts, in order', () => {
      const message = messageOfStoredRow({
        role: 'assistant',
        content: 'flattened, not read',
        parts: [
          { type: 'text', text: 'Before.\n\n' },
          { type: 'RECORD_CARDS', cards: [{ entityType: 'blog_post', entityId: '1' }] },
          { type: 'text', text: 'After.' },
        ],
      });
      expect(message?.parts).toEqual([
        { type: 'text', text: 'Before.\n\n' },
        { type: 'data-record-cards', data: { records: ['record://blog_post/1'] } },
        { type: 'text', text: 'After.' },
      ]);
    });

    it('an empty old answer is `[]`, plus its sources', () => {
      expect(messageOfStoredRow({ role: 'assistant', content: '' })?.parts).toEqual([]);
      expect(
        messageOfStoredRow({ role: 'assistant', content: '', sources: OLD_SOURCES.slice(0, 1) })?.parts,
      ).toHaveLength(1);
    });
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

  it('else the old', () => {
    expect(
      docSearchFieldsOf({
        path: 'docs/a.md',
        name: 'A',
        documentType: 'markdown',
        sourceRepo: 'openframe-docs',
        entityId: 'uuid',
      }),
    ).toEqual({ sourceId: 'record://markdown/docs%2Fa.md', title: 'A', url: null });
    expect(
      docSearchFieldsOf({
        path: 'blog/a',
        name: 'A',
        documentType: 'blog_post',
        entityId: '1',
        externalUrl: '/blog/a',
        targetPlatform: 'openmsp',
      }),
    ).toEqual({ sourceId: 'record://blog_post/1', title: 'A', url: 'https://www.openmsp.ai/blog/a' });
  });

  it('a row that names no record has no source id', () => {
    expect(docSearchFieldsOf({ name: 'Folder' })).toEqual({ sourceId: null, title: 'Folder', url: null });
  });
});
