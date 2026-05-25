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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
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
  const queryClient = useQueryClient()

  // Anon → no fetch. The hook returns the loading=false / empty path
  // so the parent renders an EmptyState sign-in CTA instead of a
  // skeleton or a query-error.
  const enabled = identity.authTier !== 'anon' && !!identity.user?.email

  const query = useQuery({
    queryKey: ['tickets', 'self'],
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

  // Defeat cross-identity cache poisoning: if the resolved email
  // changes (e.g. admin swaps proxy creds in /debug mid-session),
  // wipe ALL ticket caches so the new identity sees fresh data, not
  // a stale flash of the previous identity's tickets.
  //
  // Skip the initial mount (`previousEmailRef.current === undefined`)
  // because there's no prior identity to invalidate against — firing
  // `removeQueries` here would defeat the cache before its first hit.
  // We only act on a true TRANSITION between two non-initial values.
  const previousEmailRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const previous = previousEmailRef.current
    const current = identity.user?.email ?? null
    previousEmailRef.current = current
    if (previous === undefined) return // initial mount
    if (previous === current) return // no real change
    queryClient.removeQueries({ queryKey: ['tickets'] })
    // useQuery refetches automatically because `enabled` flips with
    // identity — no manual refetch needed.
  }, [identity.user?.email, queryClient])

  return {
    tickets: query.data ?? [],
    isLoading: query.isLoading && enabled,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch()
    },
    lastUpdatedAt: query.dataUpdatedAt || null,
  }
}
