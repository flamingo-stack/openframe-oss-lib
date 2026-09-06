/**
 * Narrowing primitives for untrusted hub JSON — ONE owner, shared by every
 * client that talks to a hub route (`use-chat-history-hydration`, the
 * conversation-list client, the NATS decoder).
 *
 * `unwrapEnvelope` encodes the hub's response contract in one place: route-base
 * `successResponse` wraps payloads in `{ data }`, and a raw body is tolerated so
 * an embedder proxying a bare payload still works.
 */

/** `typeof null === 'object'`, so the null check is the whole point. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** route-base `{ data }` envelope, with a raw-body fallback. */
export function unwrapEnvelope(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : payload;
}
