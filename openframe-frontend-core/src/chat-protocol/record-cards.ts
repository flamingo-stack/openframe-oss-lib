/**
 * Record cards: the records an answer SHOWS, as a part of the message of its own.
 *
 * Chat products keep two things apart that look alike (the AI SDK's message parts, MCP Apps, Claude's own widgets):
 *   - a CHIP is an annotation on a span of the answer's text: a citation `[N]` (from the model API's citations) or a
 *     record link `[name](record://<type>/<id>)`, drawn where the text names it;
 *   - a CARD is a typed part of the message, produced by a tool call, drawn WHERE THE CALL HAPPENED: between the text
 *     written before it and the text written after it, the way a tool's widget sits in a reply.
 * So a card is never read out of the answer's text. The model calls `show_records` with the records it wants shown;
 * the server keeps only records the turn retrieved, and sends them as ONE part at that point of the stream:
 *
 *   `{ type: 'RECORD_CARDS', cards: [{ entityType, entityId }] }`
 *
 * the same shape on every transport: a hub stream frame (a leading frame, or a frame inside the text), a Mingo chunk
 * and a stored row, all in message order. {@link recordCardsEvent} is the one decoder of it. A stored answer is its
 * ORDERED PARTS ({@link MessagePart}: text and record cards, in the order they streamed), like Mingo's `messageData`
 * and the AI SDK's `message.parts`; {@link segmentsOfParts} reads them back.
 *
 * Server-safe: no React, no browser APIs.
 */

import { MESSAGE_TYPE, type RecordCard } from '../components/chat/types/message.types';
import type { RecordCardsEvent } from './events';
import { isRecord } from './wire-narrow';

/** The tool the model calls to show records as cards. */
export const SHOW_RECORDS_TOOL_NAME = 'show_records';

/** The most cards one answer shows. Past it a list belongs in the text. */
export const RECORD_CARDS_MAX = 8;

/** The tool's description, the one wording every host offers it with. */
export const SHOW_RECORDS_TOOL_DESCRIPTION =
  'Show records to the user as cards, drawn at the point of your answer where you call it. Call it where the cards ' +
  'belong, usually before the sentences about them, once for the answer, ' +
  `with up to ${RECORD_CARDS_MAX} records the answer is about, by their record links (record://<type>/<id>) as the ` +
  'records give them. Show a record when the user would open it: the guide, release, video, article or ticket the ' +
  'answer is about. Do not show every record you read, and do not repeat the cards in the text: the answer that ' +
  'follows says what they are for.';

/** The wire part: `{ type: 'RECORD_CARDS', cards }`. */
export interface RecordCardsPart {
  type: typeof MESSAGE_TYPE.RECORD_CARDS;
  cards: Array<{ entityType: string; entityId: string }>;
}

/** Build the wire part from cards (deduplicated, capped). */
export function recordCardsPart(cards: readonly RecordCard[]): RecordCardsPart {
  return {
    type: MESSAGE_TYPE.RECORD_CARDS,
    cards: uniqueCards(cards).map(card => ({ entityType: card.type, entityId: card.id })),
  };
}

/** The cards of a wire part (a stream frame, a chunk or a stored row), or `null` when it holds none. */
export function recordCardsEvent(raw: unknown): RecordCardsEvent | null {
  if (!isRecord(raw) || !Array.isArray(raw.cards)) return null;
  const cards = uniqueCards(
    raw.cards
      .filter(isRecord)
      .map(item => ({ type: item.entityType, id: item.entityId }))
      .filter(
        (card): card is RecordCard =>
          typeof card.type === 'string' && card.type !== '' && typeof card.id === 'string' && card.id !== '',
      ),
  );
  return cards.length > 0 ? { type: 'record-cards', cards } : null;
}

/** One part of a stored answer, in message order: its text, or a set of record cards (the wire part, unchanged). */
export type MessagePart = { type: 'text'; text: string } | RecordCardsPart;

/**
 * A stored answer's parts as the message's segments, in order: text parts as text, a `RECORD_CARDS` part as its
 * cards. A malformed part is left out. Null when `parts` is not a list (the message is its text alone).
 */
export function segmentsOfParts(
  parts: unknown,
): Array<{ type: 'text'; text: string } | { type: 'record_cards'; cards: RecordCard[] }> | null {
  if (!Array.isArray(parts)) return null;
  const out: Array<{ type: 'text'; text: string } | { type: 'record_cards'; cards: RecordCard[] }> = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (part.type === 'text' && typeof part.text === 'string') {
      if (part.text.trim()) out.push({ type: 'text', text: part.text });
      continue;
    }
    const event = part.type === MESSAGE_TYPE.RECORD_CARDS ? recordCardsEvent(part) : null;
    if (event) out.push({ type: 'record_cards', cards: event.cards });
  }
  return out;
}

/** Cards in order, each record once, at most {@link RECORD_CARDS_MAX}. */
export function uniqueCards(cards: readonly RecordCard[]): RecordCard[] {
  const seen = new Set<string>();
  const out: RecordCard[] = [];
  for (const card of cards) {
    const key = `${card.type}:${card.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ type: card.type, id: card.id });
    if (out.length === RECORD_CARDS_MAX) break;
  }
  return out;
}
