'use client'

/**
 * Customer-scoped ticket list — wraps `POST /api/chat/agent/find-ticket`.
 * The server treats `query: ''` as "list all my tickets" for self-scoped
 * sources, accepts an optional `status` ('open' | 'closed') filter, and
 * paginates via `page` + `pageSize` (server caps pageSize at 100). All
 * three fold into ONE mirror SELECT with `count: 'exact'` so the
 * response carries both the rows AND total count in a single round-trip.
 *
 * Auth: rides on `embedAuthedFetch`. The server self-scopes by session
 * email — there's no client-supplied scope. An anon caller receives 401;
 * we short-circuit before fetching to avoid the wasted round-trip.
 *
 * Cache: keyed by `['tickets', 'self', identity, search, status, page, pageSize]`.
 * Each filter+page combo gets its own slot, so toggling the URL never
 * blows away the existing slot — TanStack just serves the slot for the
 * new key. `useTicketActions` calls `queryClient.invalidateQueries({queryKey:['tickets']})`
 * after every mutation so all slots refresh together.
 */

import { useQuery } from '@tanstack/react-query'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import { useChatIdentity } from '../../chat/hooks/use-chat-identity'
import type { TicketData } from '../types'

const FIND_TICKET_ENDPOINT = '/api/chat/agent/find-ticket'
const DEFAULT_PAGE_SIZE = 20

interface FindTicketResponse {
  tickets?: TicketData[]
  count?: number
  totalCount?: number
  page?: number
  pageSize?: number
  totalPages?: number
  scope?: 'self' | 'all'
}

export interface UseTicketsListFilters {
  /** Free-text query — server runs FTS on `search_vector`. Empty → no
   *  search filter (self-scoped "list all my tickets"). */
  search?: string
  /** Canonical 'open' | 'closed'. Server maps to the underlying mirror
   *  status column. Empty / 'all' → no status filter. */
  status?: string
  /** 1-based page number. Defaults to 1. */
  page?: number
  /** Items per page (server caps at 100). Defaults to 20. */
  pageSize?: number
}

export interface UseTicketsListReturn {
  tickets: TicketData[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
  /** Wall-clock timestamp of the last successful fetch; null while
   *  loading the first time. */
  lastUpdatedAt: number | null
  /** Total ticket count across all pages (NOT just the current page).
   *  Drives the `<UnifiedPagination>` total-pages calculation. */
  totalCount: number
  /** 1-based current page (echoed from the server response so the URL
   *  and the rendered set always agree). */
  page: number
  /** Page size in use — echoed from the server (capped at 100). */
  pageSize: number
  /** Pre-computed `Math.ceil(totalCount / pageSize)` clamped to ≥1 so
   *  the pagination renders "1 / 1" instead of "1 / 0" on empty
   *  result sets. */
  totalPages: number
}

export function useTicketsList(filters: UseTicketsListFilters = {}): UseTicketsListReturn {
  const identity = useChatIdentity()
  const search = (filters.search ?? '').trim()
  const status = (filters.status ?? '').trim().toLowerCase()
  const statusFilter = status && status !== 'all' ? status : ''
  const page = Math.max(1, Math.floor(filters.page ?? 1) || 1)
  const pageSize = Math.max(1, Math.min(100, Math.floor(filters.pageSize ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE))

  // Anon → no fetch. The hook returns the loading=false / empty path
  // so the parent renders an EmptyState sign-in CTA instead of a
  // skeleton or a query-error.
  const enabled = identity.authTier !== 'anon' && !!identity.user?.email

  // Identity-keyed cache (admin swaps proxy creds in /debug mid-session
  // → new key, new cache slot, no flash of the previous identity's data).
  const identityKey = identity.user?.email ?? 'anon'

  const query = useQuery({
    queryKey: ['tickets', 'self', identityKey, search, statusFilter, page, pageSize],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<FindTicketResponse> => {
      const body: Record<string, string | number> = {
        query: search,
        page,
        pageSize,
      }
      if (statusFilter) body.status = statusFilter
      const response = await embedAuthedFetch(FIND_TICKET_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`find-ticket failed: ${response.status} ${text.slice(0, 200)}`)
      }
      return (await response.json()) as FindTicketResponse
    },
  })

  const data = query.data
  const totalCount = data?.totalCount ?? data?.count ?? (data?.tickets?.length ?? 0)
  const echoedPage = data?.page ?? page
  const echoedPageSize = data?.pageSize ?? pageSize
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(totalCount / echoedPageSize))

  return {
    tickets: data?.tickets ?? [],
    // Loading-state-truth = `data === undefined`. TanStack v5's
    // `isPending` / `isLoading` flags can be `false` in transient
    // windows where the query is enabled-but-fetch-not-yet-fired
    // OR where stale-data exists from a sibling cache slot — both
    // produced the EmptyState flash on /tickets first load. Treating
    // "no data for THIS query slot yet" as the universal loading
    // signal can't lie:
    //   - Initial render after enabled flips: data === undefined → load
    //   - Background refetch with existing data: data !== undefined → no load
    //   - Filter-change refetch landing on empty results: data?.tickets===[]
    //     + isFetching → bridge skeleton (the `||` branch)
    isLoading:
      enabled &&
      (data === undefined ||
        (query.isFetching && (data?.tickets ?? []).length === 0)),
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch()
    },
    lastUpdatedAt: query.dataUpdatedAt || null,
    totalCount,
    page: echoedPage,
    pageSize: echoedPageSize,
    totalPages,
  }
}
