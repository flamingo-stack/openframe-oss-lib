/**
 * Record cards: the records an answer SHOWS, as a part of the message of its own.
 *
 * Chat products keep two things apart that look alike (the AI SDK's message parts, MCP Apps, Claude's own widgets):
 *   - a CHIP is an annotation on a span of the answer's text: a citation (from the model API's citations) or a record
 *     link `[name](record://<type>/<id>)`, drawn where the text names it;
 *   - a CARD is a typed part of the message, produced by a tool call, drawn WHERE THE CALL HAPPENED: between the text
 *     written before it and the text written after it, the way a tool's widget sits in a reply.
 * So a card is never read out of the answer's text. The model calls `show_records` with the records it wants shown; the
 * server keeps only records the turn retrieved, and they travel as one `data-record-cards` part at that point of the
 * message (`./chat-message`), the same part on the stream and in a stored row.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { ChatRecordCardsPart } from './chat-message';
import { normalizeRecordUris } from './record-link';

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

/**
 * The part that shows records as cards: each URI once, in its one spelling. A URI that names no record (a collection,
 * anything else) is left out. Not capped: `RECORD_CARDS_MAX` binds the tool call, and a stored answer holds what it held.
 */
export function recordCardsPart(uris: readonly string[]): ChatRecordCardsPart {
  return { type: 'data-record-cards', data: { records: normalizeRecordUris(uris) } };
}
