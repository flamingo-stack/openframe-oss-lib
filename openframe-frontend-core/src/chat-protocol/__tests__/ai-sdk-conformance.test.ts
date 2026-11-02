/**
 * The wire against the REAL thing: `ai@7.0.159`, a dev dependency of this package and of nothing it ships.
 *
 * `ui-chunks.test.ts` reads the lib's own copy of the chunk union, so a wrong copy would pass it. These run every
 * fixture through the SDK's own schema, its own stream reader with `terminateOnError` (what a `useChat` client does with
 * this stream) and its own message validator (what a host storing these rows would run). What differs from what a
 * standard reader would hold is a stated deviation of the contract, and each has a named test here.
 */

import {
  asSchema,
  parseJsonEventStream,
  readUIMessageStream,
  uiMessageChunkSchema,
  validateUIMessages,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { describe, expect, it } from 'vitest';
import { parseWireCommandOverride } from '../../components/chat/utils/slash-dispatch-utils';
import { applyChunk, applyChunkToMessages, createWireState } from '../apply-chunk';
import {
  approvalStatusOf,
  isToolPart,
  storablePartsOf,
  type ChatMessage,
  type ChatMessageMetadata,
  type ChatPart,
  type ChatToolPart,
} from '../chat-message';
import { createMingoDecoder } from '../message-decoder';
import { chatProgressChunk } from '../progress';
import { encodeUiChunk, encodeUiDone, UI_MESSAGE_STREAM_HEADERS, type UiChunk } from '../ui-chunks';
import {
  APPROVAL_CARD_MESSAGE,
  APPROVAL_REFUSED_STREAM,
  APPROVAL_REJECT_STREAM,
  APPROVAL_REQUEST_BODY,
  APPROVAL_RESPONSE_STREAM,
  ANSWER_STREAM,
  CARD_MESSAGE_STREAMS,
  CHAT_REQUEST_BODY,
  FIXTURE_ASSISTANT_ID,
  FIXTURE_PROPOSAL_ID,
  HISTORY_RESPONSE,
  NEW_MESSAGE_STREAMS,
  STORED_ANSWER_PARTS,
  STORED_RECEIPT_PARTS,
  STORED_USER_PARTS,
  TURN_FAILURE_STREAM,
} from '../wire-fixtures';

const ALL_STREAMS: ReadonlyArray<[string, UiChunk[]]> = [
  ...Object.entries(NEW_MESSAGE_STREAMS),
  ...Object.entries(CARD_MESSAGE_STREAMS),
  ['turnFailure', TURN_FAILURE_STREAM],
];

function streamOf(chunks: readonly UiChunk[]): ReadableStream<UIMessageChunk> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

/** What a standard reader holds at the end of a stream. Throws what `terminateOnError` raises. */
async function standardMessage(chunks: readonly UiChunk[], message?: ChatMessage): Promise<UIMessage> {
  let last: UIMessage | undefined;
  const stream = readUIMessageStream<UIMessage>({
    stream: streamOf(chunks),
    terminateOnError: true,
    ...(message ? { message: structuredClone(message) } : {}),
  });
  for await (const snapshot of stream) last = snapshot;
  if (!last) throw new Error('the stream produced no message');
  return last;
}

function bytesOf(chunks: readonly UiChunk[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encodeUiChunk(chunk));
      controller.enqueue(encodeUiDone());
      controller.close();
    },
  });
}

describe('the types are the standard`s', () => {
  // These compile only while the lib's copy of the types is assignable to the SDK's: `tsc` is the assertion.
  const messageIsStandard = (message: ChatMessage): UIMessage<ChatMessageMetadata> => message;
  const partIsStandard = (part: ChatPart): UIMessage['parts'][number] => part;
  const chunkIsStandard = (chunk: UiChunk): UIMessageChunk => chunk;

  it('a ChatMessage is a UIMessage, a ChatPart a part of one, and a UiChunk a UIMessageChunk', () => {
    expect(messageIsStandard(APPROVAL_CARD_MESSAGE)).toBe(APPROVAL_CARD_MESSAGE);
    expect(partIsStandard(STORED_RECEIPT_PARTS[0])).toBe(STORED_RECEIPT_PARTS[0]);
    expect(chunkIsStandard(ANSWER_STREAM[0])).toBe(ANSWER_STREAM[0]);
  });
});

describe('uiMessageChunkSchema', () => {
  const schema = asSchema(uiMessageChunkSchema);

  it.each(ALL_STREAMS)('accepts every chunk of %s', async (_name, stream) => {
    for (const chunk of stream) {
      const result = await schema.validate?.(chunk);
      expect(result, JSON.stringify(chunk)).toMatchObject({ success: true });
    }
  });

  it('accepts a progress chunk from the builder', async () => {
    const chunk = chatProgressChunk({ stage: 'searching', count: 29 }, 'running', 'turn-1');
    await expect(schema.validate?.(chunk)).resolves.toMatchObject({ success: true });
  });

  it('the SDK refuses what the schema is there to refuse, so a pass above means something', async () => {
    await expect(schema.validate?.({ type: 'text-delta', delta: 'no id' })).resolves.toMatchObject({ success: false });
    await expect(
      schema.validate?.({ type: 'source-document', sourceId: 'x', mediaType: 'text/plain' }),
    ).resolves.toMatchObject({
      success: false,
    });
  });
});

describe('the wire, through the SDK`s own event-stream parser', () => {
  it.each(ALL_STREAMS)(
    '%s parses to the chunks that went out, on the transport a `useChat` client uses',
    async (_name, stream) => {
      const parsed = parseJsonEventStream({ stream: bytesOf(stream), schema: uiMessageChunkSchema });
      const reader = parsed.getReader();
      const out: unknown[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        expect(value.success).toBe(true);
        if (value.success) out.push(value.value);
      }
      expect(out).toHaveLength(stream.length);
    },
  );

  it('the headers are the standard`s, with `no-transform` added', () => {
    expect(UI_MESSAGE_STREAM_HEADERS).toMatchObject({
      'content-type': 'text/event-stream',
      connection: 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
      'x-accel-buffering': 'no',
    });
  });
});

describe('readUIMessageStream with terminateOnError', () => {
  it.each(Object.entries(NEW_MESSAGE_STREAMS))('reads %s to the end', async (_name, stream) => {
    await expect(standardMessage(stream)).resolves.toBeDefined();
  });

  it.each(Object.entries(CARD_MESSAGE_STREAMS))(
    'reads %s against the message holding the card',
    async (_name, stream) => {
      const message = await standardMessage(stream, APPROVAL_CARD_MESSAGE);
      expect(message.id).toBe(FIXTURE_ASSISTANT_ID);
      expect(message.parts.filter(part => part.type === 'dynamic-tool')).toHaveLength(1);
    },
  );

  it('a turn failure ends a standard client: nothing after `error` reaches it', async () => {
    await expect(standardMessage(TURN_FAILURE_STREAM)).rejects.toThrow('Something went wrong');
  });

  it('`start` with no messageId does not rename the card`s message', async () => {
    expect((await standardMessage(APPROVAL_RESPONSE_STREAM, APPROVAL_CARD_MESSAGE)).id).toBe(FIXTURE_ASSISTANT_ID);
  });

  it('a standard reader lands the approval`s outcome on the card', async () => {
    const tool = (message: UIMessage) => message.parts.find(part => part.type === 'dynamic-tool');
    expect(tool(await standardMessage(APPROVAL_RESPONSE_STREAM, APPROVAL_CARD_MESSAGE))).toMatchObject({
      state: 'output-available',
      output: { ticket_id: '4858', status: 'CLOSED' },
      toolCallId: FIXTURE_PROPOSAL_ID,
    });
    expect(tool(await standardMessage(APPROVAL_REJECT_STREAM, APPROVAL_CARD_MESSAGE))).toMatchObject({
      state: 'output-denied',
    });
    expect(tool(await standardMessage(APPROVAL_REFUSED_STREAM, APPROVAL_CARD_MESSAGE))).toMatchObject({
      state: 'output-error',
      errorText: 'This approval expired, ask again to get a fresh one.',
    });
  });

  it('merges the turn`s metadata the way this package does', async () => {
    const standard = await standardMessage(ANSWER_STREAM);
    const wire = createWireState();
    const [mine] = ANSWER_STREAM.reduce<ChatMessage[]>(
      (messages, chunk) => applyChunkToMessages(messages, chunk, wire),
      [],
    );
    const { progress: _progress, finishReason: _finishReason, ...metadata } = mine.metadata ?? {};
    expect(standard.metadata).toEqual(metadata);
  });

  it('a transient chunk never becomes a part of a standard reader`s message either', async () => {
    const message = await standardMessage(ANSWER_STREAM);
    expect(message.parts.some(part => part.type === 'data-chat-progress')).toBe(false);
  });
});

describe('validateUIMessages', () => {
  const validate = (messages: unknown) => validateUIMessages({ messages });

  it('accepts the stored parts, field for field', async () => {
    const message: ChatMessage = { id: 'a', role: 'assistant', parts: STORED_ANSWER_PARTS };
    await expect(validate([message])).resolves.toEqual([message]);
  });

  it('accepts a user row and a receipt', async () => {
    const messages: ChatMessage[] = [
      { id: 'u', role: 'user', parts: STORED_USER_PARTS },
      { id: 'r', role: 'assistant', metadata: { kind: 'approval_receipt' }, parts: STORED_RECEIPT_PARTS },
    ];
    await expect(validate(messages)).resolves.toEqual(messages);
  });

  it('accepts an empty answer, and refuses an empty user row: a user row always holds something', async () => {
    await expect(validate([{ id: 'a', role: 'assistant', parts: [] }])).resolves.toHaveLength(1);
    await expect(validate([{ id: 'u', role: 'user', parts: [] }])).rejects.toThrow();
  });

  it('accepts the history answer', async () => {
    await expect(validate(HISTORY_RESPONSE.messages)).resolves.toEqual(HISTORY_RESPONSE.messages);
  });

  it('accepts the chat request', async () => {
    await expect(validate(CHAT_REQUEST_BODY.messages)).resolves.toEqual(CHAT_REQUEST_BODY.messages);
  });

  it('the chat request`s extra field is one a server takes', () => {
    expect(parseWireCommandOverride(CHAT_REQUEST_BODY.commandOverride)).toEqual(CHAT_REQUEST_BODY.commandOverride);
  });

  it('accepts the approval request', async () => {
    await expect(validate(APPROVAL_REQUEST_BODY.messages)).resolves.toEqual(APPROVAL_REQUEST_BODY.messages);
  });

  it('accepts a citation that knows only its end', async () => {
    const message: ChatMessage = {
      id: 'a',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'Filled row.',
          citations: [
            {
              source: {
                type: 'source',
                sourceType: 'document',
                id: 'record://blog_post',
                mediaType: 'text/plain',
                title: 'Blog posts',
              },
              endIndex: 11,
            },
          ],
        },
      ],
    };
    await expect(validate([message])).resolves.toEqual([message]);
  });

  it.each(Object.entries(NEW_MESSAGE_STREAMS))(
    'accepts what %s accumulates to, and what a row stores of it',
    async (_name, stream) => {
      const wire = createWireState();
      const parts = stream.reduce<ChatPart[]>((all, chunk) => applyChunk(all, chunk, wire), []);
      await expect(validate([{ id: 'a', role: 'assistant', parts }])).resolves.toHaveLength(1);
      const stored = storablePartsOf(parts);
      await expect(validate([{ id: 'a', role: 'assistant', parts: stored }])).resolves.toEqual([
        { id: 'a', role: 'assistant', parts: stored },
      ]);
    },
  );

  it('accepts what the approval response accumulates to, in the card`s message', async () => {
    const wire = createWireState();
    wire.setMessageId(APPROVAL_CARD_MESSAGE.id);
    for (const stream of Object.values(CARD_MESSAGE_STREAMS)) {
      const messages = stream.reduce<ChatMessage[]>(
        (all, chunk) => applyChunkToMessages(all, chunk, wire),
        [APPROVAL_CARD_MESSAGE],
      );
      await expect(validate(messages)).resolves.toHaveLength(1);
      wire.setMessageId(APPROVAL_CARD_MESSAGE.id);
    }
  });
});

describe('the stated deviations', () => {
  it('D1: a NATS chunk keeps its uppercase `type`, and the one decoder hands the library standard chunks', async () => {
    const decoder = createMingoDecoder();
    const chunks = [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', streamSeq: 2, text: 'Hello.' },
      { type: 'RECORD_CARDS', streamSeq: 3, records: ['record://blog_post/1108'] },
      { type: 'MESSAGE_END', streamSeq: 4 },
    ].flatMap(raw => decoder.decode(raw).chunks);
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
      'text-end',
      'data-record-cards',
      'finish',
    ]);
    const schema = asSchema(uiMessageChunkSchema);
    for (const chunk of chunks) await expect(schema.validate?.(chunk)).resolves.toMatchObject({ success: true });
    await expect(schema.validate?.({ type: 'TEXT', text: 'Hello.' })).resolves.toMatchObject({ success: false });
  });

  it('a rejection the server refuses is a rejection to this package and to a standard reader alike', async () => {
    const answered: ChatMessage = {
      ...APPROVAL_CARD_MESSAGE,
      parts: APPROVAL_CARD_MESSAGE.parts.map(part =>
        part.type === 'dynamic-tool' && part.state === 'approval-responded'
          ? { ...part, approval: { ...part.approval, approved: false, reason: 'not now' } }
          : part,
      ),
    };
    const standard = await standardMessage(APPROVAL_REFUSED_STREAM, answered);
    const wire = createWireState();
    wire.setMessageId(answered.id);
    const [mine] = APPROVAL_REFUSED_STREAM.reduce<ChatMessage[]>(
      (all, chunk) => applyChunkToMessages(all, chunk, wire),
      [answered],
    );
    const theirs = standard.parts.find(part => part.type === 'dynamic-tool');
    const ours = mine.parts.find(isToolPart);
    if (!ours || theirs?.type !== 'dynamic-tool') throw new Error('no tool part');
    expect(approvalStatusOf(ours)).toBe('rejected');
    expect(approvalStatusOf(theirs as ChatToolPart)).toBe('rejected');
    expect('approval' in ours ? ours.approval : undefined).toEqual(theirs.approval);
    // The SDK's type says `output-error` holds a granted approval and its reader does not enforce it, so the state may
    // differ; `output-denied` is what its own validator accepts.
    await expect(validateUIMessages({ messages: [mine] })).resolves.toHaveLength(1);
  });

  it('D5: Mingo has no citations: the standard`s field is optional', () => {
    const decoder = createMingoDecoder();
    const chunks = [{ type: 'TEXT', text: 'Priced per device [1].' }, { type: 'MESSAGE_END' }].flatMap(
      raw => decoder.decode(raw).chunks,
    );
    expect(chunks.some(chunk => chunk.type === 'text-end' && chunk.citations)).toBe(false);
  });

  it('D6: `record://` is unregistered, and to the standard it is any stable string', async () => {
    const chunk: UiChunk = {
      type: 'source-url',
      sourceId: 'record://blog_post/1108',
      url: 'https://www.flamingo.run/blog/a',
    };
    await expect(asSchema(uiMessageChunkSchema).validate?.(chunk)).resolves.toMatchObject({ success: true });
    const message = await standardMessage([{ type: 'start', messageId: 'a' }, chunk]);
    expect(message.parts[0]).toMatchObject({ type: 'source-url', sourceId: 'record://blog_post/1108' });
  });

  it('D7: a standard reader holds several text parts where this package coalesces, each with its own offsets', async () => {
    const standard = await standardMessage(ANSWER_STREAM);
    const standardText = standard.parts.flatMap(part => (part.type === 'text' ? [part.text] : []));
    expect(standardText).toHaveLength(3);
    const cited = standard.parts.find(part => part.type === 'text' && part.citations);
    expect(cited).toMatchObject({
      text: 'OpenFrame is priced per device.',
      citations: [expect.objectContaining({ startIndex: 0, endIndex: 31 })],
    });

    const wire = createWireState();
    const stored = storablePartsOf(ANSWER_STREAM.reduce<ChatPart[]>((all, chunk) => applyChunk(all, chunk, wire), []));
    expect(stored.filter(part => part.type === 'text')).toHaveLength(2);
    // The same words either way.
    expect(stored.flatMap(part => (part.type === 'text' ? [part.text] : [])).join('')).toBe(standardText.join(''));
  });

  it('D7: a standard reader keeps sources where they arrive; this package leads with them', async () => {
    const stream: UiChunk[] = [
      { type: 'start', messageId: 'a' },
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'Hello.' },
      { type: 'source-document', sourceId: 'record://blog_post', mediaType: 'text/plain', title: 'Blog posts' },
      { type: 'text-end', id: 't1' },
    ];
    const standard = await standardMessage(stream);
    expect(standard.parts.map(part => part.type)).toEqual(['text', 'source-document']);
    const wire = createWireState();
    const parts = stream.reduce<ChatPart[]>((all, chunk) => applyChunk(all, chunk, wire), []);
    expect(parts.map(part => part.type)).toEqual(['source-document', 'text']);
  });

  it('D7: live, a receipt and its continuation sit inside the card`s message', async () => {
    const standard = await standardMessage(APPROVAL_RESPONSE_STREAM, APPROVAL_CARD_MESSAGE);
    expect(standard.parts.map(part => part.type)).toEqual([
      'text',
      'dynamic-tool',
      'text',
      'data-record-cards',
      'text',
    ]);
  });

  it('D8: a collection source is an ordinary source to the standard', async () => {
    const message: ChatMessage = {
      id: 'a',
      role: 'assistant',
      parts: [
        { type: 'source-document', sourceId: 'record://blog_post', mediaType: 'text/plain', title: 'Blog posts' },
      ],
    };
    await expect(validateUIMessages({ messages: [message] })).resolves.toEqual([message]);
  });

  it('D9: an approval part carries the arguments the person edited as its `input`', async () => {
    const [edited] = await validateUIMessages({
      messages: [
        {
          ...APPROVAL_REQUEST_BODY.messages[0],
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'update_ticket',
              toolCallId: FIXTURE_PROPOSAL_ID,
              state: 'approval-responded',
              input: { ticket_id: '4858', status: 'OPEN' },
              approval: { id: FIXTURE_PROPOSAL_ID, approved: true },
            },
          ],
        },
      ],
    });
    expect(edited.parts[0]).toMatchObject({ input: { status: 'OPEN' } });
  });

  it('D10: on Mingo, a response naming a batch and a resolver are lib-internal: a standard reader would refuse the batch', async () => {
    const chunk: UiChunk = {
      type: 'tool-approval-response',
      approvalId: 'batch:1',
      approved: true,
      toolMetadata: { resolvedByName: 'Ann' },
    };
    await expect(asSchema(uiMessageChunkSchema).validate?.(chunk)).resolves.toMatchObject({ success: true });
    await expect(standardMessage([{ type: 'start', messageId: 'a' }, chunk])).rejects.toThrow(
      'No tool invocation found',
    );
  });

  it('D11: metadata carries app fields beside the SDK`s names', async () => {
    const standard = await standardMessage(ANSWER_STREAM);
    expect((standard.metadata as ChatMessageMetadata).usage).toMatchObject({
      inputTokens: 1200,
      hit_rate_pct: 83,
      telemetry: { citations: 1 },
    });
  });
});
