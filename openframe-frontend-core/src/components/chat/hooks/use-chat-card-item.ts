'use client'

/**
 * useChatCardItem — fetches the full mapped item for an inline chat
 * card via the SAME list-API endpoint the public pages use.
 *
 * Single source of truth: no parallel `buildImageUrl` / `buildMetadata`
 * synthesis. The chat renders the same shape, with the same joins
 * (author / categories / platforms / hosts / etc.), as `/blog`,
 * `/case-studies`, `/podcasts`, `/roadmap`, etc.
 *
 * Batching: every compact card with the same `(type, id)` shares one
 * TanStack-Query entry; multiple refs of the same type in the same
 * chat message produce ONE network request (TanStack dedups by
 * queryKey). 5-minute staleTime matches `RelatedContentSection`.
 *
 * URL builder is read from `runtime.endpoints.buildListUrl` so the
 * embedded app can supply a per-type URL builder against the reverse
 * proxy; the hub wires the registry-driven builder directly.
 */

import { useQuery } from '@tanstack/react-query'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'

export interface UseChatCardItemResult<T = unknown> {
  item: T | undefined
  isLoading: boolean
  isError: boolean
}

/** Extract the items array from each endpoint's response shape (some
 *  return `{ items }`, others `{ posts }`, etc.). Single normalization
 *  point — callers always read `Item[]`. */
function extractItems(data: unknown): unknown[] {
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
function extractItemId(type: string, item: unknown): string | null {
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

export function useChatCardItem<T = unknown>(
  type: string,
  id: string,
): UseChatCardItemResult<T> {
  // Read the list-URL builder from the chat runtime — hub uses the
  // rag-table-config registry directly; embedded apps supply a per-type
  // URL builder against the reverse proxy.
  const runtime = useRequiredChatRuntime()
  const url = runtime.endpoints.buildListUrl(type, [id])
  const query = useQuery({
    queryKey: ['chat-card-item', type, id],
    queryFn: async (): Promise<T | null> => {
      if (!url) return null
      // Go through `embedAuthedFetch` (NOT bare `fetch`) so the request
      // rides the same auth path as the chat stream/commands: it consults
      // the host-registered `EmbedAuthAdapter` (cookie `credentials:'include'`
      // cross-origin, dev-ticket Bearer, 401 refresh-and-retry). Bare `fetch`
      // sent no credentials, so list endpoints behind the gateway returned
      // 401 and the card rendered blank.
      const res = await embedAuthedFetch(url)
      if (!res.ok) return null
      const data = await res.json()
      const items = extractItems(data)
      const match = items.find((it) => extractItemId(type, it) === id)
      return (match ?? null) as T | null
    },
    enabled: !!url && id.length > 0,
    // Don't refetch on window focus inside the chat — the chat panel
    // is opened and closed frequently, and re-fetching every time the
    // user toggles back to the tab is wasteful (the row's id-keyed
    // payload is effectively immutable).
    refetchOnWindowFocus: false,
    // The id-keyed payload is effectively immutable, and a fetch-mode card
    // inside a STREAMING assistant message re-mounts on every chunk as the
    // surrounding markdown re-parses. Without a staleTime that meant a fresh
    // network fetch + loading-skeleton flash on every single chunk. Treat the
    // row as fresh for 5 min (matches the public pages) and keep it cached
    // long after unmount so remounts resolve synchronously from cache — no
    // refetch, no skeleton flash.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  })
  return {
    item: (query.data ?? undefined) as T | undefined,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
