/** The ONE writer: one terminal chunk and one `[DONE]` on every path, whatever a turn does. */

import { describe, expect, it } from 'vitest';
import { storablePartsOf } from '../chat-message';
import { createUiChunkDecoder, type UiChunk } from '../ui-chunks';
import { createUiMessageWriter, type UiMessageWriterOptions } from '../ui-writer';

function setup(options?: UiMessageWriterOptions) {
  const out: Uint8Array[] = [];
  const writer = createUiMessageWriter(bytes => out.push(bytes), options);
  const sent = (): string => out.map(bytes => new TextDecoder().decode(bytes)).join('');
  const chunks = (): UiChunk[] => {
    const decoder = createUiChunkDecoder();
    return out.flatMap(bytes => decoder.push(bytes));
  };
  const dones = (): number => sent().split('data: [DONE]\n\n').length - 1;
  return { writer, sent, chunks, dones };
}

describe('createUiMessageWriter', () => {
  it('sends each chunk as an event and keeps the parts they build', () => {
    const { writer, chunks } = setup();
    writer.write({ type: 'start', messageId: 'a1' });
    writer.write({ type: 'text-start', id: 't1' });
    writer.write({ type: 'text-delta', id: 't1', delta: 'Hello' });
    writer.write({ type: 'text-end', id: 't1' });
    writer.write({ type: 'finish', finishReason: 'stop' });
    expect(chunks().map(chunk => chunk.type)).toEqual(['start', 'text-start', 'text-delta', 'text-end', 'finish']);
    expect(storablePartsOf(writer.parts())).toEqual([{ type: 'text', text: 'Hello' }]);
  });

  it('closes an open text id before a card, so text after the card sits after it', () => {
    const { writer, chunks } = setup();
    writer.write({ type: 'text-start', id: 't1' });
    writer.write({ type: 'text-delta', id: 't1', delta: 'Before.' });
    writer.write({ type: 'data-record-cards', data: { records: ['record://a/1'] } });
    expect(chunks().map(chunk => chunk.type)).toEqual(['text-start', 'text-delta', 'text-end', 'data-record-cards']);
  });

  it('closes an open text id before a tool row', () => {
    const { writer, chunks } = setup();
    writer.write({ type: 'text-start', id: 't1' });
    writer.write({ type: 'tool-input-available', toolCallId: '1', toolName: 'x', input: {}, dynamic: true });
    expect(chunks().map(chunk => chunk.type)).toEqual(['text-start', 'text-end', 'tool-input-available']);
  });

  it('a source, reasoning, metadata or a stage does not close the text it arrives inside', () => {
    const { writer, chunks } = setup();
    writer.write({ type: 'text-start', id: 't1' });
    writer.write({ type: 'source-url', sourceId: 'record://a/1', url: 'https://x.test' });
    writer.write({ type: 'reasoning-delta', id: 'r1', delta: 'x' });
    writer.write({ type: 'message-metadata', messageMetadata: { model: 'm' } });
    writer.write({
      type: 'data-chat-progress',
      id: 't:reading',
      transient: true,
      data: { stage: 'reading', state: 'running' },
    });
    expect(chunks().some(chunk => chunk.type === 'text-end')).toBe(false);
  });

  it('close ends what is open, adds the terminal chunk if none went out, and [DONE] once', () => {
    const { writer, chunks, dones } = setup();
    writer.write({ type: 'text-start', id: 't1' });
    writer.write({ type: 'reasoning-start', id: 'r1' });
    writer.close();
    writer.close();
    expect(chunks().map(chunk => chunk.type)).toEqual([
      'text-start',
      'reasoning-start',
      'text-end',
      'reasoning-end',
      'finish',
    ]);
    expect(dones()).toBe(1);
  });

  it('exactly one finish, however many paths try', () => {
    const { writer, chunks, dones } = setup();
    writer.write({ type: 'finish', finishReason: 'stop' });
    writer.write({ type: 'finish', finishReason: 'other' });
    writer.close();
    expect(chunks().filter(chunk => chunk.type === 'finish')).toEqual([{ type: 'finish', finishReason: 'stop' }]);
    expect(dones()).toBe(1);
  });

  it.each<[string, UiChunk]>([
    ['abort', { type: 'abort', reason: 'timeout' }],
    ['error', { type: 'error', errorText: 'Failed.' }],
  ])('%s is the terminal chunk: no finish after it', (_name, chunk) => {
    const { writer, chunks, dones } = setup();
    writer.write({ type: 'text-start', id: 't1' });
    writer.write(chunk);
    writer.close();
    expect(chunks().map(c => c.type)).toEqual(['text-start', 'text-end', chunk.type]);
    expect(dones()).toBe(1);
  });

  it('writes nothing after close: the client is gone', () => {
    const { writer, chunks } = setup();
    writer.close();
    writer.write({ type: 'text-delta', id: 't1', delta: 'late' });
    expect(chunks().map(chunk => chunk.type)).toEqual(['finish']);
    expect(writer.parts()).toEqual([]);
  });

  it('a second start stays out: the standard reads start as a new message', () => {
    const { writer, chunks } = setup();
    writer.write({ type: 'start', messageId: 'a1' });
    writer.write({ type: 'start', messageId: 'a2', messageMetadata: { model: 'm' } });
    expect(chunks()).toEqual([
      { type: 'start', messageId: 'a1' },
      { type: 'message-metadata', messageMetadata: { model: 'm' } },
    ]);
  });

  describe('piped into another stream', () => {
    const piped = { sendStart: false, sendFinish: false };

    it('sends no start, finish or [DONE], and what they said about the message still goes out', () => {
      const { writer, chunks, dones } = setup(piped);
      writer.write({ type: 'start', messageId: 'a1', messageMetadata: { model: 'm' } });
      writer.write({ type: 'text-start', id: 't1' });
      writer.write({ type: 'text-delta', id: 't1', delta: 'Hello' });
      writer.write({ type: 'finish', finishReason: 'stop', messageMetadata: { usage: { outputTokens: 1 } } });
      writer.close();
      expect(chunks()).toEqual([
        { type: 'message-metadata', messageMetadata: { model: 'm' } },
        { type: 'text-start', id: 't1' },
        { type: 'text-delta', id: 't1', delta: 'Hello' },
        { type: 'text-end', id: 't1' },
        { type: 'message-metadata', messageMetadata: { usage: { outputTokens: 1 } } },
      ]);
      expect(dones()).toBe(0);
      expect(storablePartsOf(writer.parts())).toEqual([{ type: 'text', text: 'Hello' }]);
    });

    it('sends nothing for a start and finish with nothing to say', () => {
      const { writer, chunks } = setup(piped);
      writer.write({ type: 'start' });
      writer.write({ type: 'finish' });
      writer.close();
      expect(chunks()).toEqual([]);
    });

    it('a tool chunk for another message leaves this row`s parts alone', () => {
      const { writer } = setup(piped);
      writer.write({ type: 'tool-output-available', toolCallId: 'p1', output: 1, dynamic: true });
      expect(writer.parts()).toEqual([]);
    });
  });
});
