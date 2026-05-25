/**
 * Wire glue + canonical const for the per-message `scrollAnchor`
 * render hint.
 *
 * The actual `SCROLL_ANCHOR` const + `ScrollAnchor` type lives in
 * `../types/message.types.ts` (it's part of the `Message` shape). This
 * module re-exports them alongside the wire-key + a `parseScrollAnchor`
 * narrower so server-side code that emits the metadata leading frame and
 * client-side code that consumes it agree on the literal value AND the
 * key on the wire frame.
 *
 * Consumed by:
 *   - SERVER: emits the field into the metadata leading frame
 *     (`...(scrollAnchor ? { [SCROLL_ANCHOR_WIRE_KEY]: x } : {})`).
 *   - CLIENT: parses each leading frame and feeds the value through
 *     `parseScrollAnchor` before storing it for the chat-message-list
 *     to consume. Malformed wire values return `null` and are filtered
 *     by metadata-merge logic — they never clobber a prior value.
 */

import { SCROLL_ANCHOR, type ScrollAnchor } from '../types/message.types'

export { SCROLL_ANCHOR, type ScrollAnchor }

/** Wire-frame key for the `scrollAnchor` field on the metadata leading
 *  frame. Used as a computed property name on both the emit side
 *  (server) and the parse side (client) so a rename is one-file. */
export const SCROLL_ANCHOR_WIRE_KEY = "scrollAnchor" as const

/** Narrow + validate a wire-supplied value. Returns the literal when
 *  it matches one of the registry's known values; returns `null`
 *  otherwise (which the metadata-merge null-skip filter then drops). */
export function parseScrollAnchor(raw: unknown): ScrollAnchor | null {
  return raw === SCROLL_ANCHOR.TOP || raw === SCROLL_ANCHOR.BOTTOM ? raw : null
}
