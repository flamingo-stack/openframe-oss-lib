'use client'

/**
 * Customer-scoped ticket list — wraps `POST /api/chat/agent/find-ticket`
 * with empty-query semantics (the server treats `query: ''` as "list all
 * my tickets" for self-scoped sources, per the route's empty-query
 * branch — see `find-ticket/route.ts` and the executor at
 * `hubspot-tools.ts:534`).
 *
 * Auth: rides on `embedAuthedFetch`. The server self-scopes by session
 * email — there's no client-supplied scope. An anon caller receives 401;
 * we short-circuit before fetching to avoid the wasted round-trip and
 * the resulting query-error noise in DevTools.
 *
 * Cache: keyed by `['tickets', 'self']`. `useTicketActions` calls
 * `queryClient.invalidateQueries({queryKey:['tickets']})` after every
 * mutation. `staleTime: 60_000` prevents a refetch storm when the user
 * tab-switches.
 */

import { useQuery } from '@tanstack/react-query'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import { useChatIdentity } from '../../chat/hooks/use-chat-identity'
import type { TicketData } from '../types'

/** Endpoint path is hardcoded as same-origin relative URL. The hub
 *  serves this directly. Embedders proxy `/api/chat/agent/*` through
 *  their own server to the hub (same pattern as `embedAuthedFetch` URLs
 *  inside `useEmbeddedChat`). If a future embedder needs an absolute
 *  override we can promote this to `ChatRuntime.endpoints.findTicketUrl`. */
const FIND_TICKET_ENDPOINT = '/api/chat/agent/find-ticket'

interface FindTicketResponse {
  tickets?: TicketData[]
  count?: number
  scope?: 'self' | 'all'
}

interface UseTicketsListReturn {
  tickets: TicketData[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
  /** Wall-clock timestamp of the last successful fetch; null while
   *  loading the first time. Drives the "Updated Xm ago" toolbar. */
  lastUpdatedAt: number | null
}

export function useTicketsList(): UseTicketsListReturn {
  const identity = useChatIdentity()

  // Anon → no fetch. The hook returns the loading=false / empty path
  // so the parent renders an EmptyState sign-in CTA instead of a
  // skeleton or a query-error.
  const enabled = identity.authTier !== 'anon' && !!identity.user?.email

  // Identity-keyed cache. When the resolved email changes (admin swaps
  // proxy creds in /debug mid-session), the queryKey changes and
  // TanStack automatically uses the new cache slot — no flash of the
  // previous identity's data, no manual removeQueries. The old key's
  // entries garbage-collect via `gcTime`.
  const identityKey = identity.user?.email ?? 'anon'

  const query = useQuery({
    queryKey: ['tickets', 'self', identityKey],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<TicketData[]> => {
      const response = await embedAuthedFetch(FIND_TICKET_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ query: '' }),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`find-ticket failed: ${response.status} ${text.slice(0, 200)}`)
      }
      const body = (await response.json()) as FindTicketResponse
      return Array.isArray(body.tickets) ? body.tickets : []
    },
  })

  return {
    tickets: query.data ?? [],
    // Show the skeleton during initial load AND during identity-induced
    // refetch (no cached data yet for the new key). Without `isFetching`,
    // an identity change briefly renders "No tickets yet" before the new
    // query lands.
    isLoading: enabled && (query.isLoading || (query.isFetching && (query.data ?? []).length === 0)),
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch()
    },
    lastUpdatedAt: query.dataUpdatedAt || null,
  }
}
