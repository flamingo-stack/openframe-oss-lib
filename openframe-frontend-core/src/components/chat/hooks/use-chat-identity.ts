'use client'

/**
 * Chat-identity capability hook.
 *
 * Surfaces the `{authTier, source, attachmentsEnabled, user}` bag for
 * the CURRENT chat session so client code can gate UI elements
 * (attachment button, drawer composer, /tickets gate) on chat-side
 * identity tiers WITHOUT sending a chat message first.
 *
 * Server-side parity: the route at `/api/chat/identity` runs the same
 * 3-tier `requireChatAuth` chain the chat itself uses.
 * `attachmentsEnabled` is computed server-side as
 * `authTier !== 'anon' AND isSelfScopedSource(source)` — single
 * source of truth, consumers don't combine the fields themselves.
 *
 * Implementation: TanStack Query with a shared cache slot.
 *
 * History — this hook used to be plain `useState` + `useEffect`. The
 * rationale at the time was "single consumer, no dedup benefit". Since
 * then the lib grew multiple consumers (`HelpCenterList`, `useTicketsList`,
 * `useTicketActions`, `TicketDetailDrawer`, chat panel, attachment button…)
 * and the plain `useState` model produced empty-state flashes because
 * EACH call mounted its own anon-default state independently, racing
 * the parent's already-resolved identity. Converting to TanStack Query
 * with a shared `['chat-identity', proxyEmail]` slot means every
 * `useChatIdentity()` call across the tree reads the SAME cached
 * response — no inter-consumer races. Aligns with how every other
 * shared data fetch in the lib is implemented (`useTicketsList`,
 * `useTicketEngagements`, etc.).
 *
 * The HMR concern that prompted the original move AWAY from useQuery
 * is addressed by keying on the proxy email itself (a stable value)
 * rather than passing function references — module reload doesn't
 * change the value, so the cache slot survives.
 *
 * Endpoint URL: read from `useRequiredChatRuntime().endpoints.chatIdentityUrl`
 * so embedded apps with their own reverse-proxy topology can override.
 */

import { useQuery } from '@tanstack/react-query'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { chatAuthedFetch } from '../utils/chat-authed-fetch'
import { getChatProxyAuth } from '../utils/chat-proxy-auth-storage'

/**
 * Wire-shape for the `/api/chat/identity` route response. Mirrors
 * the hub's `ChatIdentityResponse` (in `app/api/chat/identity/route.ts`)
 * — kept in sync there. Lib-side declaration so the chat panel can
 * compile without depending on hub-internal types.
 */
export interface ChatIdentityResponse {
  authTier: 'session' | 'bearer-act-as' | 'anon'
  source: string | null
  attachmentsEnabled: boolean
  /** Server-resolved display identity. `null` for anon. Read by the
   *  chat panel for the greeting first-name — embedders DON'T pass
   *  user info into the runtime; server is the single source of truth
   *  so the displayed name always matches the auth tier.
   *
   *  All sub-fields are optional and may be `null`. Consumers MUST
   *  treat missing values as "use empty string and skip the affected
   *  UI line" — never substitute a placeholder. */
  user: {
    name: string | null
    email: string | null
    /** Optional first name supplied by the identity webservice.
     *  When set, the chat greeting renders `Hey ${firstName}, I'm Mingo`.
     *  When absent (null/undefined/empty), the greeting falls back to
     *  the no-name variant `Hey, I'm Mingo`. */
    firstName?: string | null
    /** Optional last name. Currently unused by chat UI; surfaced for
     *  embedders that want to display the full name elsewhere. */
    lastName?: string | null
    /** Optional avatar URL. Validated as https:// server-side. */
    avatarUrl?: string | null
  } | null
}

/** Shape returned by the hook. NEVER throws — loading + error fall
 *  back to anon defaults so consumers can always render synchronously. */
export interface ChatIdentitySurface extends ChatIdentityResponse {
  /** True while the query is in-flight on first mount; consumers that
   *  show a skeleton spinner can read this. */
  isLoading: boolean
}

const ANON_DEFAULTS: ChatIdentityResponse = {
  authTier: 'anon',
  source: null,
  attachmentsEnabled: false,
  user: null,
}

export function useChatIdentity(): ChatIdentitySurface {
  const runtime = useRequiredChatRuntime()
  const url = runtime.endpoints.chatIdentityUrl

  // `getChatProxyAuth()` reads localStorage every render. If the user
  // pastes bearer creds mid-session (via the `/debug` creds bar),
  // their email arrives here and the queryKey changes → TanStack
  // refetches the new slot. Stable values, no function references —
  // safe under HMR.
  const proxyEmail = getChatProxyAuth()?.email ?? null

  const query = useQuery<ChatIdentityResponse>({
    queryKey: ['chat-identity', url, proxyEmail],
    queryFn: async ({ signal }) => {
      try {
        const resp = await chatAuthedFetch(url, { signal })
        if (!resp.ok) return ANON_DEFAULTS
        return (await resp.json()) as ChatIdentityResponse
      } catch (err) {
        // AbortError on unmount is expected. Everything else falls
        // back to anon defaults — keeps the UI rendering consistently
        // instead of throwing inside hooks that consume this surface.
        if ((err as Error).name !== 'AbortError') {
          console.warn('[useChatIdentity] fetch failed, falling back to anon:', err)
        }
        return ANON_DEFAULTS
      }
    },
    // Identity is stable for the chat session — no auto-refetch on
    // mount / focus. Mid-session credential rotation flips the
    // queryKey (`proxyEmail` is a key segment) so a new cache slot
    // gets fetched.
    staleTime: Infinity,
    // 5-minute GC ceiling so a signed-out user's slot doesn't linger
    // forever if they never sign back in.
    gcTime: 5 * 60 * 1000,
    // Don't retry — server returns 200+anon for unauthenticated
    // callers (capability-probe pattern). A genuine network error
    // already degrades to ANON_DEFAULTS via the try/catch above.
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const data = query.data ?? ANON_DEFAULTS
  return {
    ...data,
    // `query.isPending` is `true` until the first successful fetch
    // completes (consistent across every consumer thanks to the
    // shared cache slot — no per-call racing).
    isLoading: query.isPending,
  }
}
