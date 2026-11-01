/**
 * Record cards: the records an answer SHOWS, as a part of the message of its own.
 *
 * Chat products keep two things apart that look alike (OpenAI's Apps SDK, the AI SDK's message parts, MCP Apps):
 *   - a CHIP is an annotation on a span of the answer's text: a citation `[N]` (from the model API's citations) or a
 *     record link `[name](record://<type>/<id>)`, drawn where the text names it;
 *   - a CARD is a typed part of the message, produced by a tool call, drawn ABOVE the text that talks about it
 *     ("inline surfaces appear before the generated model response").
 * So a card is never read out of the answer's text. The model calls `show_records` with the records it wants shown;
 * the server keeps only records the turn retrieved, and sends them as ONE part:
 *
 *   `{ type: 'RECORD_CARDS', cards: [{ entityType, entityId }] }`
 *
 * the same shape on every transport: a hub stream frame, a Mingo chunk, a stored Mongo row and the hub's stored
 * answer. {@link recordCardsEvent} is the one decoder of it.
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
  'Show records to the user as cards, drawn above your answer. Call it BEFORE writing the answer, at most once, ' +
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
