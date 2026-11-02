/**
 * Wire glue + canonical const for the per-message `scrollAnchor` render hint.
 *
 * The actual `SCROLL_ANCHOR` const + `ScrollAnchor` type lives in `../types/message.types.ts`. This module adds the wire
 * key + a `parseScrollAnchor` narrower, so server-side code that writes `metadata.scrollAnchor` and client-side code that
 * reads it agree on the literal value AND the key.
 *
 * Consumed by:
 *   - SERVER: writes the field into the turn's `message-metadata` chunk.
 *   - CLIENT: feeds `metadata.scrollAnchor` through `parseScrollAnchor` for the chat-message-list to consume. A malformed
 *     value reads as no anchor.
 */

import { SCROLL_ANCHOR, type ScrollAnchor } from '../types/message.types';

/** Wire key of the `scrollAnchor` field. Used as a computed property name on both the emit side (server) and the parse side
 *  (client) so a rename is one-file. */
export const SCROLL_ANCHOR_WIRE_KEY = 'scrollAnchor' as const;

/** Narrow + validate a wire-supplied value. Returns the literal when it matches one of the registry's known values; returns
 *  `null` otherwise. */
export function parseScrollAnchor(raw: unknown): ScrollAnchor | null {
  return raw === SCROLL_ANCHOR.TOP || raw === SCROLL_ANCHOR.BOTTOM ? raw : null;
}
