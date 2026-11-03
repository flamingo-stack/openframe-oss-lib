/**
 * The stream's wire: what goes out and what comes back, split at every byte, and a stream that is cut. These read the
 * lib's OWN copy of the chunk union: `ai-sdk-conformance.test.ts` is what holds that copy to the real schema.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APPROVAL_CANCELLED } from '../chat-message';
import {
  approvalStatusOfResponse,
  createUiChunkDecoder,
  encodeUiChunk,
  encodeUiDone,
  finishReasonOfStop,
  isOwnRowGrant,
  readUiChunks,
  STREAM_CLOSE_GRACE_MS,
  UI_MESSAGE_STREAM_HEADERS,
  type UiChunk,
} from '../ui-chunks';
import {
  ANSWER_STREAM,
  APPROVAL_BATCH_STREAM,
  APPROVAL_REFUSED_STREAM,
  APPROVAL_REJECT_STREAM,
  APPROVAL_RESPONSE_STREAM,
  APPROVAL_STREAM,
  ABORT_STREAM,
  COLLECTION_CITATION_STREAM,
  TOOL_ERROR_STREAM,
  TURN_FAILURE_STREAM,
} from '../wire-fixtures';

const encoder = new TextEncoder();

const STREAMS: ReadonlyArray<[string, UiChunk[]]> = [
  ['answer', ANSWER_STREAM],
  ['collection citation', COLLECTION_CITATION_STREAM],
  ['tool error', TOOL_ERROR_STREAM],
  ['turn failure', TURN_FAILURE_STREAM],
  ['abort', ABORT_STREAM],
  ['approval', APPROVAL_STREAM],
  ['approval batch', APPROVAL_BATCH_STREAM],
  ['approval response', APPROVAL_RESPONSE_STREAM],
  ['approval reject', APPROVAL_REJECT_STREAM],
  ['approval refused', APPROVAL_REFUSED_STREAM],
];

function bytesOf(chunks: readonly UiChunk[]): Uint8Array {
  const parts = [...chunks.map(encodeUiChunk), encodeUiDone()];
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

function decodeSplit(bytes: Uint8Array, cut: number): UiChunk[] {
  const decoder = createUiChunkDecoder();
  return [...decoder.push(bytes.slice(0, cut)), ...decoder.push(bytes.slice(cut)), ...decoder.end()];
}

function bodyOf(...slices: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const slice of slices) controller.enqueue(encoder.encode(slice));
      controller.close();
    },
  });
}

async function collect(chunks: AsyncIterable<UiChunk>): Promise<UiChunk[]> {
  const out: UiChunk[] = [];
  for await (const chunk of chunks) out.push(chunk);
  return out;
}

describe('headers', () => {
  it('names the stream and keeps every intermediary from buffering it', () => {
    expect(UI_MESSAGE_STREAM_HEADERS).toEqual({
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-vercel-ai-ui-message-stream': 'v1',
      'x-accel-buffering': 'no',
    });
  });
});

describe('encoding', () => {
  it('one event per chunk, and the end', () => {
    const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
    expect(decode(encodeUiChunk({ type: 'text-delta', id: 't1', delta: 'a\nb' }))).toBe(
      'data: {"type":"text-delta","id":"t1","delta":"a\\nb"}\n\n',
    );
    expect(decode(encodeUiDone())).toBe('data: [DONE]\n\n');
  });
});

describe('every chunk of every stream', () => {
  it.each(STREAMS)('%s comes back as it went out', (_name, stream) => {
    const decoder = createUiChunkDecoder();
    expect([...decoder.push(bytesOf(stream)), ...decoder.end()]).toEqual(stream);
  });

  it.each(STREAMS)('%s survives a split at every byte', (_name, stream) => {
    const bytes = bytesOf(stream);
    for (let cut = 0; cut <= bytes.length; cut++) expect(decodeSplit(bytes, cut)).toEqual(stream);
  });

  it('survives a split inside a multi-byte character', () => {
    const stream: UiChunk[] = [{ type: 'text-delta', id: 't1', delta: '✅ é 🦩' }, { type: 'finish' }];
    const bytes = bytesOf(stream);
    for (let cut = 0; cut <= bytes.length; cut++) expect(decodeSplit(bytes, cut)).toEqual(stream);
  });

  it('survives one byte at a time', () => {
    const decoder = createUiChunkDecoder();
    const out: UiChunk[] = [];
    for (const byte of bytesOf(ANSWER_STREAM)) out.push(...decoder.push(Uint8Array.of(byte)));
    expect([...out, ...decoder.end()]).toEqual(ANSWER_STREAM);
  });
});

describe('server-sent events', () => {
  const read = (body: string): UiChunk[] => {
    const decoder = createUiChunkDecoder();
    return [...decoder.push(encoder.encode(body)), ...decoder.end()];
  };

  it('reads CRLF, CR and no space after the colon', () => {
    expect(read('data: {"type":"start"}\r\n\r\ndata:{"type":"abort"}\r\rdata: [DONE]\n\n')).toEqual([
      { type: 'start' },
      { type: 'abort' },
    ]);
  });

  it('holds a CR at the end of a slice: it may be half of a CRLF', () => {
    const decoder = createUiChunkDecoder();
    const out = [
      ...decoder.push(encoder.encode('data: {"type":"start"}\r')),
      ...decoder.push(encoder.encode('\n\r\n')),
      ...decoder.push(encoder.encode('data: [DONE]\n\n')),
      ...decoder.end(),
    ];
    expect(out).toEqual([{ type: 'start' }]);
  });

  it('ignores a comment and the fields it has no use for', () => {
    expect(read(': keep-alive\n\nevent: x\nid: 1\ndata: {"type":"start"}\n\nretry: 5\n\ndata: [DONE]\n\n')).toEqual([
      { type: 'start' },
    ]);
  });

  it('joins several data lines of one event', () => {
    expect(read('data: {"type":\ndata: "start"}\n\ndata: [DONE]\n\n')).toEqual([{ type: 'start' }]);
  });

  it('reads nothing after [DONE]', () => {
    expect(read('data: [DONE]\n\ndata: {"type":"start"}\n\n')).toEqual([]);
  });

  it('skips an event that is not JSON and goes on', () => {
    expect(read('data: {not json\n\ndata: {"type":"start"}\n\ndata: [DONE]\n\n')).toEqual([{ type: 'start' }]);
  });
});

describe('a stream that is cut', () => {
  const cut = (body: string): UiChunk[] => {
    const decoder = createUiChunkDecoder();
    return [...decoder.push(encoder.encode(body)), ...decoder.end()];
  };
  const event = (chunk: UiChunk): string => `data: ${JSON.stringify(chunk)}\n\n`;

  it('closes the open text and ends the turn as interrupted, so the partial text stays', () => {
    const body = event({ type: 'text-start', id: 't1' }) + event({ type: 'text-delta', id: 't1', delta: 'par' });
    expect(cut(body)).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-delta', id: 't1', delta: 'par' },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: 'interrupted' },
    ]);
  });

  it('closes open reasoning too', () => {
    expect(cut(event({ type: 'reasoning-start', id: 'r1' }))).toEqual([
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-end', id: 'r1' },
      { type: 'finish', finishReason: 'interrupted' },
    ]);
  });

  it('a body cut mid-event loses that event and nothing else', () => {
    const body = `${event({ type: 'start' })}data: {"type":"text-del`;
    expect(cut(body)).toEqual([{ type: 'start' }, { type: 'finish', finishReason: 'interrupted' }]);
  });

  it('an empty body is an interrupted turn', () => {
    expect(cut('')).toEqual([{ type: 'finish', finishReason: 'interrupted' }]);
  });

  it.each<[string, UiChunk]>([
    ['finish', { type: 'finish', finishReason: 'stop' }],
    ['abort', { type: 'abort', reason: 'timeout' }],
    ['error', { type: 'error', errorText: 'Failed.' }],
  ])('a stream that said %s was not cut', (_name, chunk) => {
    expect(cut(event(chunk))).toEqual([chunk]);
  });

  it('a stream that said [DONE] was not cut', () => {
    expect(cut(`${event({ type: 'start' })}data: [DONE]\n\n`)).toEqual([{ type: 'start' }]);
  });

  it('end is idempotent', () => {
    const decoder = createUiChunkDecoder();
    expect(decoder.end()).toEqual([{ type: 'finish', finishReason: 'interrupted' }]);
    expect(decoder.end()).toEqual([]);
  });
});

describe('readUiChunks', () => {
  it('reads a body, slices and all', async () => {
    const text = new TextDecoder().decode(bytesOf(ANSWER_STREAM));
    const middle = Math.floor(text.length / 2);
    expect(await collect(readUiChunks(bodyOf(text.slice(0, middle), text.slice(middle))))).toEqual(ANSWER_STREAM);
  });

  it('a read that fails is a cut connection', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encodeUiChunk({ type: 'text-start', id: 't1' }));
      },
      pull() {
        throw new TypeError('terminated');
      },
    });
    expect(await collect(readUiChunks(body))).toEqual([
      { type: 'text-start', id: 't1' },
      { type: 'text-end', id: 't1' },
      { type: 'finish', finishReason: 'interrupted' },
    ]);
  });

  it('the caller`s own abort is thrown, never read as a cut', async () => {
    const body = new ReadableStream<Uint8Array>({
      pull() {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      },
    });
    await expect(collect(readUiChunks(body))).rejects.toMatchObject({ name: 'AbortError' });
  });

  describe('a body that has said it is over', () => {
    const FINISH = { type: 'finish', finishReason: 'stop' } as const;
    /** A body the test closes or leaves open, and whether anyone cancelled it. */
    function openBody(...written: Uint8Array[]) {
      const cancel = vi.fn();
      let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c;
          for (const bytes of written) c.enqueue(bytes);
        },
        cancel,
      });
      return { body, cancel, controller: () => controller };
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('the read ends at `[DONE]`, with the body still open, and the body is cancelled only after the bound', async () => {
      const { body, cancel } = openBody(encodeUiChunk(FINISH), encodeUiDone());
      expect(await collect(readUiChunks(body))).toEqual([FINISH]);
      expect(cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(STREAM_CLOSE_GRACE_MS - 1);
      expect(cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('a server that closes after `[DONE]` is left to: it is never told the reader left', async () => {
      const { body, cancel, controller } = openBody(encodeUiChunk(FINISH), encodeUiDone());
      await collect(readUiChunks(body));
      controller()?.close();
      await vi.advanceTimersByTimeAsync(STREAM_CLOSE_GRACE_MS * 2);
      expect(cancel).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('a terminal chunk with no `[DONE]` ends the read at the bound, and the body is cancelled', async () => {
      const { body, cancel } = openBody(encodeUiChunk(FINISH));
      const read = collect(readUiChunks(body));
      await vi.advanceTimersByTimeAsync(STREAM_CLOSE_GRACE_MS - 1);
      expect(cancel).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(await read).toEqual([FINISH]);
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('what arrives inside the bound is still read', async () => {
      const { body, cancel, controller } = openBody(encodeUiChunk(FINISH));
      const read = collect(readUiChunks(body));
      await vi.advanceTimersByTimeAsync(10);
      controller()?.enqueue(encodeUiDone());
      controller()?.close();
      expect(await read).toEqual([FINISH]);
      await vi.advanceTimersByTimeAsync(STREAM_CLOSE_GRACE_MS * 2);
      expect(cancel).not.toHaveBeenCalled();
    });

    it('a stream still running has no bound', async () => {
      const { body, cancel, controller } = openBody(encodeUiChunk({ type: 'start' }));
      const read = collect(readUiChunks(body));
      await vi.advanceTimersByTimeAsync(STREAM_CLOSE_GRACE_MS * 5);
      expect(cancel).not.toHaveBeenCalled();
      controller()?.close();
      expect(await read).toEqual([{ type: 'start' }, { type: 'finish', finishReason: 'interrupted' }]);
    });
  });

  it('leaving early cancels the body', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encodeUiChunk({ type: 'start' }));
      },
      cancel,
    });
    for await (const chunk of readUiChunks(body)) {
      expect(chunk).toEqual({ type: 'start' });
      break;
    }
    expect(cancel).toHaveBeenCalled();
  });
});

describe('what a chunk may say', () => {
  /** One value through the reader: the chunk it became, or null when it was dropped. */
  const parseUiChunk = (value: unknown): UiChunk | null =>
    createUiChunkDecoder().push(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))[0] ?? null;

  it.each([
    ['not an object', 'text'],
    ['no type', { id: 't1' }],
    ['an unknown type', { type: 'start-step' }],
    ['an inherited name', { type: 'constructor' }],
    ['an unknown data type', { type: 'data-new-thing', data: {} }],
    ['a delta with no id', { type: 'text-delta', delta: 'x' }],
    ['a delta with no text', { type: 'text-delta', id: 't1' }],
    ['a source with no url', { type: 'source-url', sourceId: 'x' }],
    ['a document with no title', { type: 'source-document', sourceId: 'x', mediaType: 'text/plain' }],
    ['a response with no answer', { type: 'tool-approval-response', approvalId: 'x' }],
    ['metadata that is not an object', { type: 'message-metadata', messageMetadata: 'x' }],
    ['cards that are not a list', { type: 'data-record-cards', data: { records: 'x' } }],
    ['cards holding a non-string', { type: 'data-record-cards', data: { records: [1] } }],
    [
      'a stage this build cannot word',
      { type: 'data-chat-progress', id: 'x', transient: true, data: { stage: 'new', state: 'running' } },
    ],
    ['a data chunk with no data', { type: 'data-error' }],
  ])('drops %s', (_name, value) => {
    expect(parseUiChunk(value)).toBeNull();
  });

  it('drops a malformed citation and keeps the chunk', () => {
    const source = { type: 'source', sourceType: 'url', id: 'x', url: 'https://x.test' };
    expect(parseUiChunk({ type: 'text-end', id: 't1', citations: [{ source, endIndex: 1 }, { source: 1 }] })).toEqual({
      type: 'text-end',
      id: 't1',
      citations: [{ source, endIndex: 1 }],
    });
    expect(parseUiChunk({ type: 'text-end', id: 't1', citations: [{ source: 1 }] })).toEqual({
      type: 'text-end',
      id: 't1',
    });
  });

  it('reads an optional object that is not one as absent', () => {
    expect(parseUiChunk({ type: 'finish', messageMetadata: 'x' })).toEqual({ type: 'finish' });
    expect(parseUiChunk({ type: 'start', messageMetadata: 7 })).toEqual({ type: 'start' });
    expect(parseUiChunk({ type: 'tool-output-available', toolCallId: 'x', output: 1, toolMetadata: 'y' })).toEqual({
      type: 'tool-output-available',
      toolCallId: 'x',
      output: 1,
    });
  });

  describe('metadata, field by field', () => {
    const metadataOf = (messageMetadata: unknown) => {
      const chunk = parseUiChunk({ type: 'message-metadata', messageMetadata });
      return chunk?.type === 'message-metadata' ? chunk.messageMetadata : null;
    };

    it('keeps what the stream states, with its types', () => {
      const stated = {
        conversationId: 'c',
        model: 'm',
        modelLabel: 'M',
        provider: 'anthropic',
        contextWindowMaxTokens: 200000,
        scrollAnchor: 'top',
        routing: { complexity: 'default', model: 'm', thinkingBudget: null },
        willAutoContinue: false,
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3,
          inputTokenDetails: { noCacheTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
          hit_rate_pct: 10,
          telemetry: { cards: 1, citations: 2, sentences: 3, answerLen: 4 },
          breakdown: { any: 'shape' },
          debug: { any: 'shape' },
          stop_reason: 'end_turn',
          stop_detail: 'x',
        },
      };
      expect(metadataOf(stated)).toEqual(stated);
    });

    it('never reads this client`s own keys, or a stored row`s, off a stream', () => {
      expect(
        metadataOf({
          hidden: true,
          progress: 'x',
          author: { name: 'Mallory' },
          contextItems: [],
          streamSeq: 9,
          finishReason: 'stop',
          seq: 1,
          createdAt: 'now',
          kind: 'approval_receipt',
          aborted: true,
          sourceCount: 1,
          unknown: 1,
        }),
      ).toEqual({});
    });

    it('leaves out a field of the wrong type and keeps the rest', () => {
      expect(metadataOf({ conversationId: 7, model: 'm', willAutoContinue: 'yes', usage: 'y' })).toEqual({
        model: 'm',
      });
      expect(metadataOf({ routing: { model: 'm' } })).toEqual({});
      expect(metadataOf({ routing: { complexity: 'c', thinkingBudget: 'x' } })).toEqual({
        routing: { complexity: 'c' },
      });
      expect(
        metadataOf({
          usage: { inputTokens: '1', outputTokens: 2, telemetry: { cards: 1 }, inputTokenDetails: 'x', stop_reason: 3 },
        }),
      ).toEqual({ usage: { outputTokens: 2 } });
    });

    it('holds on a finish and a start too', () => {
      expect(parseUiChunk({ type: 'finish', messageMetadata: { progress: 'x', usage: { inputTokens: 1 } } })).toEqual({
        type: 'finish',
        messageMetadata: { usage: { inputTokens: 1 } },
      });
      expect(parseUiChunk({ type: 'start', messageId: 'a', messageMetadata: { hidden: true } })).toEqual({
        type: 'start',
        messageId: 'a',
        messageMetadata: {},
      });
    });
  });
});

describe('an answer on the stream', () => {
  const answer = (fields: object) => ({ type: 'tool-approval-response', approvalId: 't1', ...fields }) as never;

  it('says its status', () => {
    expect(approvalStatusOfResponse(answer({ approved: true }))).toBe('approved');
    expect(approvalStatusOfResponse(answer({ approved: false }))).toBe('rejected');
    expect(approvalStatusOfResponse(answer({ approved: false, reason: APPROVAL_CANCELLED }))).toBe('cancelled');
  });

  it('a grant beside a chunk about its own row is that row reporting, and nobody answering', () => {
    const report = { type: 'tool-output-error', toolCallId: 't1', errorText: 'Rejected by user' } as UiChunk;
    expect(isOwnRowGrant(answer({ approved: true }), { chunks: [report] })).toBe(true);
    expect(isOwnRowGrant(answer({ approved: true }), { chunks: [] })).toBe(false);
    expect(isOwnRowGrant(answer({ approved: false }), { chunks: [report] })).toBe(false);
  });
});

describe('finishReasonOfStop', () => {
  it.each([
    ['end_turn', 'stop'],
    ['stop_sequence', 'stop'],
    ['tool_use', 'tool-calls'],
    ['max_tokens', 'length'],
    ['refusal', 'content-filter'],
    ['error', 'error'],
    ['incomplete', 'interrupted'],
    ['retrieval_only', 'other'],
    ['something_new', 'other'],
    ['constructor', 'other'],
  ])('%s is %s', (stop, reason) => {
    expect(finishReasonOfStop(stop)).toBe(reason);
  });

  it('a turn that aborted has no finish at all', () => {
    expect(finishReasonOfStop('aborted')).toBeNull();
    expect(finishReasonOfStop('timeout')).toBeNull();
  });
});
