/**
 * The chat wire protocol: one message shape and one stream, the AI SDK's. Published as the server-safe `./chat-protocol`
 * subpath (no React, no browser APIs beyond TextEncoder/TextDecoder), so the hub's stream route and the lib's chat share
 * one protocol module.
 */

// The chat message and its stream: the AI SDK's names, one shape on every wire and in every store.
export * from './chat-message';
export * from './ui-chunks';
export * from './apply-chunk';
export * from './ui-writer';
export * from './citations';
// Approvals a server reads: the parts a turn left asking, and the answers a request carries.
export * from './approval-response';
export * from './message-decoder';
// The stages a turn reports before its first answer token, and their copy.
export * from './progress';
// The hub's error envelope.
export * from './server-error';
// Cross-repo IP bucket-key normalizer (producer app + consumer hub share it).
export * from './ip-normalize';
// Cross-repo env-flag predicate: the trust assertion that gates the IP forwarding above must be parsed IDENTICALLY on
// both sides of the seam.
export * from './env-flag';
export { isRecord, unwrapEnvelope } from './wire-narrow';
// Record links (`[name](record://<type>/<id>)`): the one grammar a record is named by, server and renderer alike.
export * from './record-link';
// Record cards: the records an answer shows, a typed part drawn where it sits (never read from the text).
export * from './record-cards';
// The `[N]` grammar: what a stream removes from a model's text.
export * from './citation-chip';
// One row of the docs search, as the hub writes it and the search bar reads it.
export type { DocSearchResult } from './doc-search';
// A chat attachment: its constants, its shape and its `file` part, for the hub's routes and the lib's composer.
export * from './attachment';
// OpenFrame's chat history document (selecting `Message.parts`) and the read of its answer.
export * from './mingo-graphql';
// OpenFrame's record types: the kind a context item carries and the type its record link writes.
export * from './openframe-record-types';
// A chat between people read as lines: a remote session's side chat, live and from history.
export * from './participant-lines';
