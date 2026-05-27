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
 * **Implementation: plain `useEffect` + `useState`. NO CLIENT-SIDE
 * CACHE.** Every consumer that needs identity gets it DRILLED IN
 * from a parent that already gates on `identity.user?.email` — the
 * tickets surface uses this pattern in `HelpCenterListAuthed` /
 * `TicketCenterAuthed` / `HelpCenterCreateForm`. A previous attempt
 * to layer TanStack Query on this hook was reverted because:
 *   1. Client caches drift from server truth (empty-state flashes,
 *      stale identity across credential rotations)
 *   2. Drilling identity through props is the explicit data-flow
 *      pattern the rest of the lib uses
 *   3. The fetch is cheap and short — no perf justification for a
 *      cache layer
 *
 * Endpoint URL: read from `useRequiredChatRuntime().endpoints.chatIdentityUrl`
 * so embedded apps with their own reverse-proxy topology can override.
 */

import { useEffect, useState } from 'react'
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
  // their email arrives here and the effect's dep changes → refetch.
  const proxyEmail = getChatProxyAuth()?.email ?? null

  const [data, setData] = useState<ChatIdentityResponse>(ANON_DEFAULTS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()

    setIsLoading(true)
    chatAuthedFetch(url, { signal: ctrl.signal })
      .then(async (resp) => {
        if (!resp.ok) return ANON_DEFAULTS
        return (await resp.json()) as ChatIdentityResponse
      })
      .then((next) => {
        if (cancelled) return
        setData(next)
        setIsLoading(false)
      })
      .catch((err) => {
        // AbortError on unmount is expected; everything else falls
        // back to anon defaults so the UI stays consistent.
        if (cancelled) return
        if ((err as Error).name !== 'AbortError') {
          console.warn('[useChatIdentity] fetch failed, falling back to anon:', err)
        }
        setData(ANON_DEFAULTS)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
      ctrl.abort()
    }
    // `proxyEmail` in deps → refetch the moment the user pastes creds
    // (or rotates them) and triggers a re-render. `url` is stable for
    // the chat session but listed for completeness.
  }, [url, proxyEmail])

  return { ...data, isLoading }
}
