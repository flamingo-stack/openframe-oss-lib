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

export * from './frames'
export * from './events'
export * from './encode'
export * from './decode'
export * from './nats-decoder'
// Cross-repo IP bucket-key normalizer (producer app + consumer hub share it).
export * from './ip-normalize'
// Cross-repo env-flag predicate — the trust assertion that gates the IP
// forwarding above must be parsed IDENTICALLY on both sides of the seam.
export * from './env-flag'
