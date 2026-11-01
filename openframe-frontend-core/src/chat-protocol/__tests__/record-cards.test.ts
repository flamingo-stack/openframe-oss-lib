/**
 * The record-cards part: one wire shape on every transport, decoded once, always first in its message.
 */

import { describe, expect, it } from 'vitest';
import { withRecordCards } from '../../components/chat/stream/message-mutations';
import { MessageSegmentAccumulator } from '../../components/chat/utils/message-segment-accumulator';
import { decodeHistoricalMessageData } from '../../components/chat/utils/process-historical-messages';
import { createSseFrameDecoder } from '../decode';
import { encodeEndOfLeading, encodeLeadingFrame, encodeTextDelta, encodeTrailingUsageFrame } from '../encode';
import { decodeNatsChunk } from '../nats-decoder';
import { RECORD_CARDS_MAX, recordCardsEvent, recordCardsPart } from '../record-cards';

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

  it('decodes the same part from a Mingo chunk, a stored row, a hub leading frame and the hub trailer', () => {
    const part = recordCardsPart([guide]);
    const expected = { type: 'record-cards', cards: [guide] };
    expect(decodeNatsChunk({ ...part, streamSeq: 7 })).toEqual({ ...expected, seq: 7 });
    expect(decodeHistoricalMessageData(part)).toEqual(expected);
    expect(decodeAll([encodeLeadingFrame(part), encodeEndOfLeading(), encodeTextDelta('Here.')])).toContainEqual(
      expected,
    );
    const trailing = decodeAll([
      encodeEndOfLeading(),
      encodeTextDelta('Here.'),
      encodeTrailingUsageFrame({ kind: 'usage', stage: 'end', record_cards: part }),
    ]);
    expect(trailing).toContainEqual(expected);
  });
});

describe('record cards in a message', () => {
  it('is one segment, first, whenever in the turn it arrived', () => {
    const accumulator = new MessageSegmentAccumulator();
    accumulator.appendText('The guide covers it.');
    accumulator.addRecordCards([guide]);
    const segments = accumulator.addRecordCards([release, guide]);
    expect(segments[0]).toEqual({ type: 'record_cards', cards: [guide, release] });
    expect(segments.filter(segment => segment.type === 'record_cards')).toHaveLength(1);
    expect(segments[1]).toEqual({ type: 'text', text: 'The guide covers it.' });
  });

  it('adds to the existing part in a stored message the same way', () => {
    const segments = withRecordCards(
      [
        { type: 'text', text: 'Hi.' },
        { type: 'record_cards', cards: [guide] },
      ],
      [release],
    );
    expect(segments).toEqual([
      { type: 'record_cards', cards: [guide, release] },
      { type: 'text', text: 'Hi.' },
    ]);
  });
});
