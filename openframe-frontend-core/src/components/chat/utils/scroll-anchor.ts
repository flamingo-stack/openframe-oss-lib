/**
 * The wire key of the per-message `scrollAnchor` render hint. The server writes the field into the turn's
 * `message-metadata` chunk under this key; `SCROLL_ANCHOR` and `ScrollAnchor` (`../types/message.types.ts`) are its values,
 * and the chat-message-list compares `metadata.scrollAnchor` with them.
 */
export const SCROLL_ANCHOR_WIRE_KEY = 'scrollAnchor' as const;
