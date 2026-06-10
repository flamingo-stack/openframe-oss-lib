/**
 * List-API response normalizers — HOISTED from
 * `components/chat/hooks/use-chat-card-item.ts` (private copies) so the
 * related-content rail can import them WITHOUT touching the chat hooks
 * chunk (which reaches `@tanstack/react-query`). Pure + server-safe.
 *
 * The hub's `lib/utils/entity-list-api.ts` re-exports these — one
 * implementation of response-shape normalization across both repos.
 */

/** Extract the items array from each endpoint's response shape (some
 *  return `{ items }`, others `{ posts }`, etc.). Single normalization
 *  point — callers always read `Item[]`. */
export function extractItems(data: unknown): unknown[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  if (Array.isArray(obj.items)) return obj.items
  if (Array.isArray(obj.posts)) return obj.posts
  if (Array.isArray(obj.campaigns)) return obj.campaigns
  if (Array.isArray(obj.completed) || Array.isArray(obj.inProgress)) {
    // Delivery endpoint splits into completed/inProgress arrays — flatten.
    const completed = Array.isArray(obj.completed) ? obj.completed : []
    const inProgress = Array.isArray(obj.inProgress) ? obj.inProgress : []
    return [...completed, ...inProgress]
  }
  if (Array.isArray(obj.data)) return obj.data
  if (Array.isArray(data)) return data
  return []
}

/** Extract a stable id from a fetched item — different shapes use
 *  `id` vs `external_id`. Used by the chat loader to match the fetched
 *  array element back to the marker's id. */
export function extractItemId(type: string, item: unknown): string | null {
  if (!item || typeof item !== 'object') return null
  const obj = item as Record<string, unknown>
  if (type === 'roadmap_item' || type === 'delivery_item' || type === 'internal_task') {
    const ext = obj.external_id
    if (typeof ext === 'string') return ext
  }
  // RoadmapItem-shaped responses use `id` to carry the external_id; the
  // mapper renames external_id→id at the API boundary. Treat both id and
  // external_id as primary-key candidates for these clickup-backed types.
  const id = obj.id
  if (typeof id === 'string') return id
  if (typeof id === 'number') return String(id)
  return null
}
