/**
 * The `[card://…]` grammar has THREE readers, and they only work as a set:
 *
 *   1. `remarkCardLinks` — turns a marker in the body into a card node;
 *   2. the pre-scan in `chat-message-enhanced.tsx` — splits the text at it and
 *      places the card's block payload;
 *   3. `source-metadata.ts` — validates the `ref` field describing it.
 *
 * A marker one accepts and another rejects fails silently and asymmetrically:
 * the pre-scan splitting a marker the plugin will not convert leaves the reader
 * looking at a literal `[card://…]` mid-sentence, and a decoder stricter than
 * the body drops the title of a card the answer explicitly points at.
 *
 * So this pins the grammar itself, including the punctuation the backend allows
 * in an id — which is what made the three diverge in the first place.
 */

import { describe, expect, it } from 'vitest';
import { CARD_REFERENCE, createCardMarkerScanner } from '../card-marker';

/** The id half as the backend validates it: anything but `]` and newlines. */
const PUNCTUATED_IDS = [
  '88dd40cc-66f5-4175-be60-6f34b054a5f1',
  'docs/setup.v2.md',
  'customer_interview.2026',
  'MdFJNoJeqZQ',
];

describe('card marker grammar', () => {
  it.each(PUNCTUATED_IDS)('matches an id the backend accepts: %s', id => {
    const marker = `[card://markdown:${id}]`;
    const scanner = createCardMarkerScanner();

    expect(scanner.exec(marker)?.[2]).toBe(id);
    expect(CARD_REFERENCE.exec(marker)?.[2]).toBe(id);
  });

  it('stops the id at the marker’s own closer, not the next one', () => {
    // Greedy without this and two adjacent markers read as one.
    const scanner = createCardMarkerScanner();
    const found = [...'[card://faq:a] and [card://faq:b]'.matchAll(scanner)].map(m => m[2]);

    expect(found).toEqual(['a', 'b']);
  });

  it('accepts `)` as a closer in the body but not in a `ref` field', () => {
    // The LLM drifts to `)` after long opaque ids, so the body tolerates it.
    // A `ref` is machine-written and has no such excuse.
    const drifted = '[card://podcast:9b2f)';

    expect(createCardMarkerScanner().exec(drifted)?.[2]).toBe('9b2f');
    expect(CARD_REFERENCE.exec(drifted)).toBeNull();
  });

  it('rejects a marker whose id is empty or spans a line break', () => {
    expect(createCardMarkerScanner().exec('[card://faq:]')).toBeNull();
    expect(createCardMarkerScanner().exec('[card://faq:a\nb]')).toBeNull();
  });

  it('anchors `CARD_REFERENCE`, so a ref cannot carry trailing text', () => {
    expect(CARD_REFERENCE.exec('[card://faq:a] plus a note')).toBeNull();
  });
});
