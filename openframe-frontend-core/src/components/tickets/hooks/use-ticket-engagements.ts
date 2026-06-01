'use client'

/**
 * Fetch the conversation timeline (Note engagements + attachments) for
 * a single ticket. Powers the drawer's timeline view — separate from
 * `useTicketsList` because the engagements are expensive to fetch
 * (multi-stage HubSpot API calls) and only needed when a row is
 * expanded.
 *
 * Auth: rides `embedAuthedFetch` (same proxy creds as the chat). The
 * server-side route asserts ticket ownership via
 * `ticketBelongsToCustomer` for self-scoped sources before reading
 * notes — a customer can't enumerate another customer's notes by
 * guessing ticket ids.
 */

import { useQuery } from '@tanstack/react-query'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import { useChatIdentity } from '../../chat/hooks/use-chat-identity'

const LIST_ENGAGEMENTS_ENDPOINT = '/api/chat/agent/list-engagements'

export interface TicketEngagementFile {
  id: string
  name: string | null
  url: string | null
  mime: string | null
  size: number | null
}

export interface TicketEngagement {
  id: string
  body: string | null
  authorId: string | null
  /** Whether this engagement is customer-authored (Custom Channels
   *  Messages — INCOMING direction) or team-authored (Notes + future
   *  OUTGOING messages). Drives avatar variant + the "Customer"/"Support
   *  team" header label in the drawer's conversation thread. */
  authorRole: 'customer' | 'support'
  /** Display name. Server resolves it differently per role:
   *    - `support` (Notes) → HubSpot owner id is resolved to an owner
   *      email, then matched against our `profiles` table; the matched
   *      employee's `full_name` is returned here. Null when the owner
   *      isn't a known Flamingo employee.
   *    - `customer` (Conversations messages) → null on new messages
   *      (drawer renders identity.user.name LIVE for the current
   *      user's own messages). Set only on legacy rows from earlier
   *      migrations. */
  authorName: string | null
  /** Resolved author email — for `support` it's the HubSpot owner's
   *  email; for `customer` it's the message sender. Used by the
   *  drawer to cross-check "is this me?" against `identity.user.email`. */
  authorEmail: string | null
  /** Avatar URL. For `support`, resolved from the matched `profiles`
   *  row's `avatar_url`. Null when the owner isn't a known Flamingo
   *  employee. For `customer`, always null on the wire (drawer reads
   *  identity.user.avatarUrl live for own messages). */
  authorAvatarUrl: string | null
  createdAt: string
  attachments: TicketEngagementFile[]
}

interface ListEngagementsResponse {
  engagements?: TicketEngagement[]
  count?: number
}

export interface UseTicketEngagementsReturn {
  engagements: TicketEngagement[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

export function useTicketEngagements(
  externalTicketId: string | null | undefined,
  enabled = true,
  /** Poll cadence (ms) for live conversation refresh while the drawer is
   *  open. The drawer only mounts this hook when expanded, so a constant
   *  here is already gated to "drawer open" — closing the drawer unmounts
   *  the panel and the polling stops. `false`/undefined disables it (the
   *  default, preserving prior fetch-once-per-open behavior for any other
   *  caller). Mirrors `useTicketsList.refetchInterval`; see
   *  `TICKET_LIVE_POLL_MS`. */
  refetchInterval: number | false = false,
): UseTicketEngagementsReturn {
  const identity = useChatIdentity()
  const identityKey = identity.user?.email ?? 'anon'

  // "Will this ticket fetch its timeline once identity is ready?" — i.e. it's a
  // real, non-optimistic ticket the caller enabled. INDEPENDENT of whether
  // identity has resolved yet, so the loading state is correct from the very
  // first render (before `useChatIdentity` settles).
  const fetchable =
    enabled &&
    !!externalTicketId &&
    !externalTicketId.startsWith('temp-') // optimistic placeholders have no real id yet

  const queryEnabled =
    fetchable && identity.authTier !== 'anon' && !!identity.user?.email

  const query = useQuery({
    queryKey: ['ticket-engagements', externalTicketId, identityKey],
    enabled: queryEnabled,
    // Caches OFF — same reasoning as `useTicketsList`. The conversation
    // timeline must reflect HubSpot truth on every drawer-open; a stale
    // window risks hiding a freshly-arrived agent reply.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    // Live conversation: poll while the caller opts in (drawer open). New
    // agent replies + attachments appear within one interval without a
    // manual refresh. `refetchIntervalInBackground` stays false (default)
    // so polling pauses on a hidden tab.
    refetchInterval,
    queryFn: async (): Promise<TicketEngagement[]> => {
      const response = await embedAuthedFetch(LIST_ENGAGEMENTS_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ ticket_id: externalTicketId }),
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`list-engagements failed: ${response.status} ${text.slice(0, 200)}`)
      }
      const body = (await response.json()) as ListEngagementsResponse
      return Array.isArray(body.engagements) ? body.engagements : []
    },
  })

  return {
    engagements: query.data ?? [],
    // Loading-state truth that prevents the "body → blink → skeleton → data"
    // double-flash. The bug: `useChatIdentity` starts at anon defaults and
    // resolves async, so on the first render `queryEnabled` is false and the
    // OLD `queryEnabled && query.isLoading` returned FALSE — the panel rendered
    // the ticket body, THEN identity resolved, the query enabled, isLoading
    // flipped true → skeleton appeared (the blink), then data landed.
    //
    // Fix: for a fetchable ticket we are "loading" whenever we don't yet have
    // the timeline to show — that includes the window while identity is still
    // resolving (so we skeleton from the FIRST render, never the body) AND the
    // cold query fetch (`data === undefined`). A background poll keeps
    // `query.data` defined, so it never re-flashes the skeleton. Non-fetchable
    // (optimistic/disabled) or a resolved-anon viewer → not loading.
    isLoading:
      fetchable &&
      (identity.isLoading || (queryEnabled && query.data === undefined)),
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
