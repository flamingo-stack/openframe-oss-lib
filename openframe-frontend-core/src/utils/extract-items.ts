/**
 * List-API response normalizers — HOISTED from
 * `components/chat/hooks/use-chat-card-item.ts` (private copies) so the
 * related-content rail can import them WITHOUT touching the chat hooks
 * chunk (which reaches `@tanstack/react-query`). Pure + server-safe.
 *
 * The hub's `lib/utils/entity-list-api.ts` re-exports these — one
 * implementation of response-shape normalization across both repos.
 */

import { TRUST_CENTER_CARD_ID, TRUST_CENTER_DOCUMENT_TYPE } from '../types/trust-center';

/** Extract the items array from each endpoint's response shape (some
 *  return `{ items }`, others `{ posts }`, etc.). Single normalization
 *  point — callers always read `Item[]`. */
export function extractItems(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  if (Array.isArray(obj.items)) return obj.items;
  if (Array.isArray(obj.posts)) return obj.posts;
  if (Array.isArray(obj.campaigns)) return obj.campaigns;
  if (Array.isArray(obj.faqs)) return obj.faqs;
  if (Array.isArray(obj.completed) || Array.isArray(obj.inProgress)) {
    // Delivery endpoint splits into completed/inProgress arrays — flatten.
    // Annotated because `Array.isArray` narrows an `unknown` to `any[]`, and
    // spreading that would leak `any` elements into the returned `unknown[]`.
    const completed: unknown[] = Array.isArray(obj.completed) ? obj.completed : [];
    const inProgress: unknown[] = Array.isArray(obj.inProgress) ? obj.inProgress : [];
    return [...completed, ...inProgress];
  }
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(data)) return data;
  return [];
}

/** Extract a stable id from a fetched item — different shapes use
 *  `id` vs `external_id`. Used by the chat loader to match the fetched
 *  array element back to the marker's id. */
export function extractItemId(type: string, item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const obj = item as Record<string, unknown>;
  if (type === 'roadmap_item' || type === 'delivery_item' || type === 'internal_task') {
    const ext = obj.external_id;
    if (typeof ext === 'string') return ext;
  }
  // RoadmapItem-shaped responses use `id` to carry the external_id; the
  // mapper renames external_id→id at the API boundary. Treat both id and
  // external_id as primary-key candidates for these clickup-backed types.
  const id = obj.id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  return null;
}

/**
 * Single-record card types: the type's endpoint returns ONE object (not a
 * list) and the card id is fixed. `extractItems` must not be pointed at such a
 * payload — it would pick up a nested array (the trust center's `faqs`) as the
 * "items" and the card would read as deleted.
 */
const SINGLE_RECORD_CARD_IDS: Record<string, string> = {
  [TRUST_CENTER_DOCUMENT_TYPE]: TRUST_CENTER_CARD_ID,
};

/**
 * `extractItems`, type-aware: a single-record type's object payload becomes a
 * one-element list carrying the type's fixed card id, so the loader's
 * `extractItemId` match finds it. Every other type is `extractItems` unchanged.
 */
export function extractCardItems(type: string, data: unknown): unknown[] {
  const singleId = Object.prototype.hasOwnProperty.call(SINGLE_RECORD_CARD_IDS, type)
    ? SINGLE_RECORD_CARD_IDS[type]
    : undefined;
  if (singleId === undefined) return extractItems(data);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  return [{ ...(data as Record<string, unknown>), id: singleId }];
}
