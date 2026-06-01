'use client'

/**
 * Chat-identity capability hook.
 *
 * Surfaces the `{authTier, source, attachmentsEnabled, user}` bag for
 * the CURRENT chat session so client code can gate UI elements
 * (attachment button, drawer composer, /tickets gate) on chat-side
 * identity tiers WITHOUT sending a chat message first.
 *
 * Server-side parity: the host's identity endpoint (hub default
 * `/api/auth/identity`, override via `runtime.endpoints.identityUrl`)
 * runs the same 3-tier `requireChatAuth` chain the chat itself uses.
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
 * For INDEPENDENT surfaces that can't share identity through props because
 * they live in different React subtrees (e.g. a persistent chat widget in
 * the app shell + a tickets page in the router outlet), mount the optional
 * `<ChatIdentityProvider>` (below) near the embed root. It lifts the SAME
 * resolver into ONE shared resolution for the whole subtree — still no cache
 * (see the provider's own doc), just the drill-from-parent pattern
 * formalized as a provider. Omit it and every consumer self-fetches (the
 * hub's behavior, unchanged).
 *
 * Endpoint URL: read from `useRequiredChatRuntime().endpoints.identityUrl`
 * so embedded apps with their own reverse-proxy topology can override.
 */

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { chatAuthedFetch } from '../utils/chat-authed-fetch'
import { getChatProxyAuth } from '../utils/chat-proxy-auth-storage'

/**
 * Wire-shape for the identity route response. Mirrors the hub's
 * `ChatIdentityResponse` (in `app/api/auth/identity/route.ts`) —
 * kept in sync there. Lib-side declaration so the chat panel can
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

/**
 * Internal resolver — the actual fetch-into-state loop (plain
 * `useEffect` + `useState`, the no-cache contract above). Shared by the
 * standalone `useChatIdentity` hook AND `ChatIdentityProvider`.
 *
 * `enabled === false` short-circuits the fetch. `useChatIdentity` passes
 * `enabled = false` whenever a `ChatIdentityProvider` is already resolving
 * identity above it, so the consumer reads the provider's single resolution
 * instead of issuing the duplicate request we're eliminating. The resolver
 * is still called unconditionally (Rules of Hooks); only its effect bails.
 */
function useResolveChatIdentity(enabled: boolean): ChatIdentitySurface {
  const runtime = useRequiredChatRuntime()
  const url = runtime.endpoints.identityUrl
  // `getChatProxyAuth()` reads localStorage every render. If the user
  // pastes bearer creds mid-session (via the `/debug` creds bar),
  // their email arrives here and the effect's dep changes → refetch.
  const proxyEmail = getChatProxyAuth()?.email ?? null

  const [data, setData] = useState<ChatIdentityResponse>(ANON_DEFAULTS)
  // Only "loading" if THIS instance will actually fetch. A disabled
  // consumer (provider present) is never loading — its value comes from
  // context, not from this idle resolver.
  const [isLoading, setIsLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) return
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
    // the chat session but listed for completeness. `enabled` is stable
    // per tree (a provider is either mounted above or it isn't).
  }, [url, proxyEmail, enabled])

  return { ...data, isLoading }
}

/**
 * Optional shared-identity context. When a `<ChatIdentityProvider>` is
 * mounted above, every `useChatIdentity()` in the subtree reads this ONE
 * resolution. `null` (no provider) → consumers self-resolve, which is the
 * default and exactly what the hub does today (unchanged).
 */
const ChatIdentityContext = createContext<ChatIdentitySurface | null>(null)

/**
 * Opt-in identity provider. Resolves the identity capability bag ONCE for
 * its whole subtree and shares it via context.
 *
 * This is the "drill from a parent" pattern (above) lifted to a provider —
 * so INDEPENDENT surfaces in different React subtrees (a persistent chat
 * widget in the app shell + a tickets page in the router outlet) share a
 * single `/identity` resolution instead of each fetching their own. It is
 * NOT the reverted client cache: just one lifted `useState`/`useEffect`
 * (the same resolver the standalone hook uses), so it still refetches on
 * credential rotation (`proxyEmail`) and never persists stale identity.
 *
 * Mount once near the embed root, INSIDE your `ChatRuntimeContext.Provider`
 * (the resolver reads `runtime.endpoints.identityUrl`). Omit it and every
 * `useChatIdentity()` self-fetches as before.
 */
export function ChatIdentityProvider({ children }: { children: ReactNode }) {
  const identity = useResolveChatIdentity(true)
  // `createElement` (not JSX) keeps this module a `.ts` file alongside the
  // hook + response types — no `.tsx` rename, no orphaned doc sidecar.
  return createElement(ChatIdentityContext.Provider, { value: identity }, children)
}

export function useChatIdentity(): ChatIdentitySurface {
  // Read a provider's shared resolution when present; otherwise self-resolve.
  // The resolver is ALWAYS called (Rules of Hooks) but its fetch is disabled
  // when a provider supplies identity, so there is no duplicate request — the
  // provider's value wins.
  const provided = useContext(ChatIdentityContext)
  const selfResolved = useResolveChatIdentity(provided === null)
  return provided ?? selfResolved
}
