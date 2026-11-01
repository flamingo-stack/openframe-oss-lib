/**
 * Chat wire-protocol SSOT.
 *
 * The byte-level SSE framing contract (frames + encode + decode) and the
 * transport-agnostic `ChatStreamEvent` union both the SSE and NATS
 * decoders emit. Published as the server-safe `./chat-protocol` subpath —
 * no React, no browser APIs beyond TextEncoder/TextDecoder — so the hub's
 * stream route (emit side) and the lib's chat hooks (decode side) share
 * one protocol module.
 */

export * from './frames';
export * from './events';
// The stages a turn reports before its first answer token, and their copy.
export * from './progress';
export * from './encode';
export * from './decode';
export * from './nats-decoder';
// The hub's confirm-tool request/error contract — shared by every transport
// that resolves a Product Guide proposal.
export * from './confirm-tool';
// Cross-repo IP bucket-key normalizer (producer app + consumer hub share it).
export * from './ip-normalize';
// Cross-repo env-flag predicate — the trust assertion that gates the IP
// forwarding above must be parsed IDENTICALLY on both sides of the seam.
export * from './env-flag';
export { isRecord, unwrapEnvelope } from './wire-narrow';
// Record links (`[name](record://<type>/<id>)`): the one grammar a record is named by, server and renderer alike.
export * from './record-link';
// Record cards: the records an answer shows, a typed part drawn above its text (never read from the text).
export * from './record-cards';
export type { RecordCard } from '../components/chat/types/message.types';
// The `[N]` citation chip grammar — written by the server, read and hidden by the renderer.
export * from './citation-chip';
export { escapeThinkingTags } from './leading-frames';
