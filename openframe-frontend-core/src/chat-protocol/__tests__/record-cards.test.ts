/**
 * The record-cards part: one shape on every transport, decoded once, and drawn where it arrived in the message (between the
 * text before and after the `show_records` call), never read out of the text.
 */

import { describe, expect, it } from 'vitest';
import { applyChunkToMessages, createWireState } from '../apply-chunk';
import type { ChatMessage } from '../chat-message';
import { RECORD_CARDS_MAX, recordCardsPart } from '../record-cards';
import type { UiChunk } from '../ui-chunks';

describe('record cards in a message', () => {
  it('are a part where they arrived: after the text before them, before the text after them', () => {
    const chunks: UiChunk[] = [
      { type: 'start', messageId: 'a' },
      { type: 'text-delta', id: 't1', delta: 'Putting it in the same list:' },
      { type: 'text-end', id: 't1' },
      { type: 'data-record-cards', data: { records: ['record://internal_task/t1'] } },
      { type: 'text-start', id: 't2' },
      { type: 'text-delta', id: 't2', delta: 'The task is filed.' },
      { type: 'finish', finishReason: 'stop' },
    ];
    const wire = createWireState();
    const messages = chunks.reduce<ChatMessage[]>((held, chunk) => applyChunkToMessages(held, chunk, wire), []);
    expect(messages).toHaveLength(1);
    expect(messages[0].parts).toEqual([
      { type: 'text', text: 'Putting it in the same list:', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://internal_task/t1'] } },
      { type: 'text', text: 'The task is filed.', state: 'done' },
    ]);
  });
});

describe('recordCardsPart(uris)', () => {
  it('is the standard data part: each URI once, in its one spelling', () => {
    expect(
      recordCardsPart([
        'record://blog_post/1',
        'record://markdown/docs/a.md',
        'record://blog_post/1',
        'record://markdown/docs%2Fa.md',
      ]),
    ).toEqual({
      type: 'data-record-cards',
      data: { records: ['record://blog_post/1', 'record://markdown/docs%2Fa.md'] },
    });
  });

  it('leaves out what names no record: a collection is never a card', () => {
    expect(recordCardsPart(['record://blog_post', 'https://x.test', '']).data.records).toEqual([]);
  });

  it('holds every record: the cap binds the tool call', () => {
    const uris = Array.from({ length: RECORD_CARDS_MAX + 3 }, (_, i) => `record://faq/${i}`);
    expect(recordCardsPart(uris).data.records).toHaveLength(RECORD_CARDS_MAX + 3);
  });
});
