/**
 * The `[card://<type>:<id>]` marker grammar — ONE definition, two readers.
 *
 * The model writes these markers into the answer body, and the metadata frame
 * describes the same references separately. Two parsers therefore have to agree
 * on what counts as a marker: the payload decoder (`source-metadata.ts`) and the
 * body renderer (`chat-message-enhanced.tsx`). When they disagree the failure is
 * silent and one-sided — the stricter side drops a reference the other accepted,
 * and the reader is left looking at raw `[card://…]` text in a sentence.
 *
 * The id half is deliberately permissive: the backend validates it as "anything
 * but `]` and newlines", and a client that narrows that is the side that breaks.
 * `)` is excluded on top because the body form also terminates on it (a marker
 * written as a markdown link target).
 *
 * Server-safe: no React, no browser APIs.
 */

/** Entity-type half. A closed vocabulary of slug-shaped names. */
const CARD_TYPE = '[a-zA-Z0-9_-]+';

/** Id half — see the permissiveness note above. */
const CARD_ID = '[^\\]\\r\\n)]+';

/**
 * A marker standing ALONE, anchored — for validating a `ref` field in the
 * metadata payload, where the whole string must be the marker and nothing else.
 */
export const CARD_REFERENCE = new RegExp(`^\\[card://(${CARD_TYPE}):(${CARD_ID})\\]$`);

/**
 * A marker EMBEDDED in answer text, unanchored and global.
 *
 * Terminates on `]` or `)` so a marker used as a markdown link target
 * (`[card://x:y](…)`) is matched too. Being global, it carries `lastIndex`
 * state — reset it before each scan.
 */
export function createCardMarkerScanner(): RegExp {
  return new RegExp(`\\[card://(${CARD_TYPE}):(${CARD_ID})[\\])]`, 'g');
}
