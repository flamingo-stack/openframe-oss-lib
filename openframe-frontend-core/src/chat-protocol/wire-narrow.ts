/**
 * Narrowing primitives for untrusted hub JSON — ONE owner, shared by every
 * client that talks to a hub route (`use-chat-history-hydration`, the
 * conversation-list client, the NATS decoder).
 *
 * `unwrapEnvelope` encodes the response contract in one place. The hub's
 * route-base `successResponse` is `NextResponse.json(data)` — a RAW body, which
 * is the shape these clients normally see. The `{ data }` branch is defensive,
 * for an embedder or gateway that proxies our routes inside an envelope of its
 * own; it is not the hub's shape. (A payload whose own top-level key is `data`
 * would be unwrapped by mistake — none of ours has one.)
 */

/** `typeof null === 'object'`, so the null check is the whole point. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** route-base `{ data }` envelope, with a raw-body fallback. */
export function unwrapEnvelope(payload: unknown): unknown {
  return isRecord(payload) && 'data' in payload ? payload.data : payload;
}
