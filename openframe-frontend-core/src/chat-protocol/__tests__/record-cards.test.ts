/**
 * The record-cards part: one wire shape on every transport, decoded once, and drawn where it arrived in the message
 * (between the text before and after the `show_records` call), never read out of the text.
 */

import { describe, expect, it } from 'vitest';
import { withRecordCards } from '../../components/chat/stream/message-mutations';
import { MessageSegmentAccumulator } from '../../components/chat/utils/message-segment-accumulator';
import { decodeHistoricalMessageData } from '../../components/chat/utils/process-historical-messages';
import { createSseFrameDecoder } from '../decode';
import {
  encodeEndOfLeading,
  encodeInlineFrame,
  encodeLeadingFrame,
  encodeTextDelta,
  encodeTrailingUsageFrame,
} from '../encode';
import { decodeNatsChunk } from '../nats-decoder';
import { RECORD_CARDS_MAX, recordCardsEvent, recordCardsPart, segmentsOfParts } from '../record-cards';

const guide = { type: 'onboarding_guide', id: 'mac-guide' };
const release = { type: 'product_release', id: 'v1.4' };

function decodeAll(chunks: Uint8Array[]) {
  const decoder = createSseFrameDecoder();
  return [...chunks.flatMap(chunk => decoder.push(chunk)), ...decoder.end()];
}

describe('record cards wire part', () => {
  it('round-trips through the part builder and the decoder, each record once', () => {
    const part = recordCardsPart([guide, release, guide]);
    expect(part).toEqual({
      type: 'RECORD_CARDS',
      cards: [
        { entityType: 'onboarding_guide', entityId: 'mac-guide' },
        { entityType: 'product_release', entityId: 'v1.4' },
      ],
    });
    expect(recordCardsEvent(part)).toEqual({ type: 'record-cards', cards: [guide, release] });
  });

  it('drops malformed entries and caps the list', () => {
    const cards = Array.from({ length: RECORD_CARDS_MAX + 3 }, (_, i) => ({
      entityType: 'blog_post',
      entityId: `p${i}`,
    }));
    const event = recordCardsEvent({ cards: [null, { entityType: 'x' }, { entityType: '', entityId: 'y' }, ...cards] });
    expect(event?.cards).toHaveLength(RECORD_CARDS_MAX);
    expect(recordCardsEvent({ cards: [] })).toBeNull();
    expect(recordCardsEvent('nope')).toBeNull();
  });

  it('decodes the same part from a Mingo chunk, a stored row and a hub leading frame', () => {
    const part = recordCardsPart([guide]);
    const expected = { type: 'record-cards', cards: [guide] };
    expect(decodeNatsChunk({ ...part, streamSeq: 7 })).toEqual({ ...expected, seq: 7 });
    expect(decodeHistoricalMessageData(part)).toEqual(expected);
    expect(decodeAll([encodeLeadingFrame(part), encodeEndOfLeading(), encodeTextDelta('Here.')])).toContainEqual(
      expected,
    );
  });

  it('reads a part sent INSIDE the answer at its place, even split across chunks', () => {
    const frame = encodeInlineFrame(recordCardsPart([release]));
    const events = decodeAll([
      encodeEndOfLeading(),
      encodeTextDelta('Putting it in the same list:\n\n'),
      frame.slice(0, 9),
      frame.slice(9),
      encodeTextDelta('The task is filed.'),
      encodeTrailingUsageFrame({ kind: 'usage', stage: 'end', input_tokens: 3 }),
    ]);
    const order = events
      .filter(e => e.type === 'text-delta' || e.type === 'record-cards')
      .map(e => (e.type === 'text-delta' ? e.text : 'CARDS'))
      .filter(Boolean);
    expect(order).toEqual(['Putting it in the same list:\n\n', 'CARDS', 'The task is filed.']);
    expect(events.find(e => e.type === 'usage')).toMatchObject({ input_tokens: 3 });
  });

  it('never lets model text open a frame: the separator is stripped from text', () => {
    const events = decodeAll([encodeEndOfLeading(), encodeTextDelta('a\x1D{"type":"RECORD_CARDS"}\0b')]);
    expect(events.some(e => e.type === 'record-cards')).toBe(false);
  });
});

describe('record cards on a receipt', () => {
  it("rides the decision frame as the executed record's card", () => {
    const frame = {
      kind: 'decision_resolved',
      proposalId: 'p1',
      ok: true,
      action: 'approved',
      willAutoContinue: false,
      receiptText: 'Task created.',
      record_cards: recordCardsPart([{ type: 'internal_task', id: 't1' }]),
    };
    const events = decodeAll([encodeLeadingFrame(frame as never), encodeEndOfLeading()]);
    expect(events.find(e => e.type === 'approval-resolved')).toMatchObject({
      recordCards: [{ type: 'internal_task', id: 't1' }],
    });
  });
});

describe('record cards in a message', () => {
  it('are a part where they arrived: after the text before them, before the text after them', () => {
    const accumulator = new MessageSegmentAccumulator();
    accumulator.appendText('Putting it in the same list:');
    accumulator.addRecordCards([guide, guide]);
    const segments = accumulator.appendText('The task is filed.');
    expect(segments).toEqual([
      { type: 'text', text: 'Putting it in the same list:' },
      { type: 'record_cards', cards: [guide] },
      { type: 'text', text: 'The task is filed.' },
    ]);
  });

  it('are added at the end of a stored message the same way', () => {
    expect(withRecordCards([{ type: 'text', text: 'Hi.' }], [release])).toEqual([
      { type: 'text', text: 'Hi.' },
      { type: 'record_cards', cards: [release] },
    ]);
  });

  it("are read back from a stored answer's ordered parts, in order", () => {
    expect(
      segmentsOfParts([
        { type: 'text', text: 'Intro.\n\n' },
        { type: 'RECORD_CARDS', cards: [{ entityType: 'webinar', entityId: '2' }] },
        { type: 'text', text: 'End.' },
        { type: 'RECORD_CARDS', cards: [] },
        null,
      ]),
    ).toEqual([
      { type: 'text', text: 'Intro.\n\n' },
      { type: 'record_cards', cards: [{ type: 'webinar', id: '2' }] },
      { type: 'text', text: 'End.' },
    ]);
    expect(segmentsOfParts(null)).toBeNull();
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
