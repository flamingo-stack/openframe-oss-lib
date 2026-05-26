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
  /** Display name for `customer`-role engagements (resolved server-side
   *  from the Custom Channels sender). `null` for `support` since notes
   *  don't carry a per-engagement display name — the drawer falls back
   *  to "Support team" for those. */
  authorName: string | null
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

export function useTicketEngagements(externalTicketId: string | null | undefined, enabled = true): UseTicketEngagementsReturn {
  const identity = useChatIdentity()
  const identityKey = identity.user?.email ?? 'anon'

  const queryEnabled =
    enabled &&
    identity.authTier !== 'anon' &&
    !!identity.user?.email &&
    !!externalTicketId &&
    !externalTicketId.startsWith('temp-') // optimistic placeholders have no real id yet

  const query = useQuery({
    queryKey: ['ticket-engagements', externalTicketId, identityKey],
    enabled: queryEnabled,
    staleTime: 30_000,
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
    isLoading: queryEnabled && query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
