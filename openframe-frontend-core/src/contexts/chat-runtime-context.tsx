'use client'

/**
 * Chat runtime context — single seam for embedding the chat panel in a
 * different host (e.g. user1.openframe.ai reverse-proxying API calls
 * under /api/mingo-guide/* to hub.openframe.ai/api/*).
 *
 * Three concerns, one context:
 *   1. API endpoints: chatStreamUrl / approvalToolUrl / commandsUrl /
 *      buildListUrl + attachment endpoints + chat-identity. The chat
 *      reads them from runtime; hub vs embedded app supply different
 *      strings via different providers.
 *   2. Navigation mode + callbacks: 'host' or 'embed' mode. Host wires
 *      its own router/docNav via the optional `navigate` callback
 *      (plain function, NOT a hook); embed forces new-tab via
 *      `defaultContentOrigin` + lib's `resolveExternalNavigation`.
 *   3. Identity context: only `source` (required for localStorage
 *      namespacing). The display identity (greeting first-name etc.)
 *      comes from the server via `useChatIdentity()` — never injected
 *      client-side, so it always matches the server-resolved auth.
 *
 * Sibling of EndpointsRuntimeContext (announcement bar, contact form,
 * access codes). Each runtime stays an independent React context so
 * embedders can opt into either feature without forcing the other.
 *
 * IMPORTANT for embedders: memoize the value passed to
 * `<ChatRuntimeContext.Provider value={...}>` (e.g. via React.useMemo).
 * Every change to its reference identity invalidates downstream
 * `useMemo` consumers (the chat input's slash-commands binding,
 * useNavLink's embed-resolution memo, useDocChat's streamFn factory).
 * The hub's `<HubRuntimeProvider>` already memoizes correctly with
 * stable deps. Embedded apps that build the value inline on each render
 * will pay an avoidable re-render cost across the entire chat tree.
 */

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Runtime config consumed by the chat panel.
 */
export interface ChatRuntime {
  endpoints: {
    /** POST streaming chat. Hub: '/api/docs/chat'. */
    chatStreamUrl: string
    /** POST agent approve/reject. Hub: '/api/chat/agent/confirm-tool'. */
    approvalToolUrl: string
    /** GET slash-command catalog. Hub: '/api/docs/commands'. */
    commandsUrl: string
    /** Build entity-card list URL for a content type + ids. Hub delegates
     *  to the rag-table-config registry; embedded app provides its own
     *  per-type URL builder against the reverse proxy. Returns null when
     *  the type has no list endpoint (caller skips rendering). */
    buildListUrl: (type: string, ids: string[]) => string | null
    /** Chat-attachment endpoints — added for the v2 attachment feature.
     *
     *  Three concerns:
     *    - `attachmentUploadUrl` — POSTed by the chat-attachment hook
     *      to mint a Supabase signed-upload-URL + HMAC view token.
     *    - `attachmentViewUrlPrefix` — embedded in markdown URLs the
     *      chat hosts in user message bubbles (`![]()` / `[Attached]`).
     *      Stored in chat history; chosen at SEND time. In host mode the
     *      relative `/api/storage/view/chat-attachments/` is sufficient
     *      (same-origin); embedders supply an absolute hub URL so the
     *      browser can fetch cross-origin.
     *    - `chatIdentityUrl` — GET endpoint the `useChatIdentity` hook
     *      hits to learn the `{authTier, source, attachmentsEnabled}`
     *      capability bag for the current session. */
    attachmentUploadUrl: string
    attachmentViewUrlPrefix: string
    chatIdentityUrl: string
    /** Optional URL prefix for the image proxy (`<prefix>?url=<external>`).
     *  When unset, lib's `getProxiedImageUrl` returns the original URL
     *  unchanged. Hub default: '/api/image-proxy'. Embedders that don't
     *  host an image-proxy route leave this undefined → images load
     *  directly cross-origin (CORS-permitting). */
    imageProxyUrlPrefix?: string
    /** Optional list of hostnames that should bypass the image proxy
     *  (rendered direct). Hub uses ['openmsp.ai']; embedders typically
     *  leave it unset. Matches the `skipDomains` parameter of
     *  `getProxiedImageUrl`. */
    imageProxySkipDomains?: string[]
  }
  navigation: {
    /** ONE knob, two behaviors:
     *  - 'host' = use the host page's existing click-routing untouched.
     *    The chat panel calls `navigate?.()` for in-app routing.
     *  - 'embed' = guest inside another app: short-circuit at the top
     *    of click handlers to force new-tab + absolutize via
     *    resolveExternalNavigation. */
    mode: 'host' | 'embed'
    /** Embed-only fallback origin for relative URLs whose target platform
     *  can't be inferred. Used by resolveExternalNavigation when
     *  `targetPlatform` is null — without this, a relative `/foo` href would
     *  window.open against the embedder's origin, which is WRONG.
     *  Set to your content host (e.g. 'https://hub.openframe.ai').
     *  Required by the embedded app whenever mode='embed'. */
    defaultContentOrigin?: string
    /** Override for opening external URLs. MUST BE SYNCHRONOUS —
     *  Safari/Firefox block popups opened outside a direct user gesture.
     *  Default: window.open(href, '_blank', 'noopener,noreferrer'). */
    openExternal?: (href: string) => void
    /** Optional in-app navigation callback (host-mode only).
     *  Returns `true` if the host handled the click in-app
     *  (router.push + docNav.navigate); returns `false`, `undefined`,
     *  or `void` → lib falls back to window.location.assign(href).
     *  Hub wires this via HubRuntimeProvider's HubNavigationWiring;
     *  embedders not in Next.js leave it undefined. */
    navigate?: (input: { href: string; path?: string | null; targetPlatform?: string | null }) => boolean | void
    /** Optional new-tab decision callback. Returns true → lib opens in
     *  new tab; false → same tab via `navigate`. Hub wires the existing
     *  `decideNewTab` logic from use-nav-link.tsx (re-imports the pure
     *  helper from lib). Embedders may omit; lib defaults to:
     *  same-origin/same-platform → same tab, else new tab. */
    decideNewTab?: (args: { href: string; targetPlatform?: string | null }) => boolean
  }
  /** Chat source identifier — REQUIRED. Used for localStorage
   *  namespacing (`mingo-chat-<source>-v1`). Hub sets via
   *  `currentPlatform()`; embedders set explicitly.
   *  `useEmbeddedChat()` throws if source is empty/missing. */
  source: string
  // NOTE: No `user` field. The chat's display identity (greeting
  // first-name, etc.) comes from the SERVER-resolved auth via
  // `useChatIdentity()` — the same identity the server uses to
  // authorize requests. Letting embedders pass a client-side `user`
  // would let it desync from the actual auth tier, causing greetings
  // like "Hey Bob" while the server treats the session as
  // alice@example.com. Single source of truth: the server.
}

export const ChatRuntimeContext = createContext<ChatRuntime | null>(null)

/**
 * Returns the active runtime, or null when no provider is mounted.
 * NULL is a first-class value — it signals "no chat runtime configured."
 * Optional consumers fall back to no-op behavior; strict consumers
 * use `useRequiredChatRuntime` (below).
 */
export function useChatRuntime(): ChatRuntime | null {
  return useContext(ChatRuntimeContext)
}

/**
 * Strict variant used INSIDE the chat panel. Throws if no provider.
 * The hub guarantees one exists by mounting `<HubRuntimeProvider>` at
 * root; the embedded app mounts its own `<ChatRuntimeContext.Provider>`
 * at the tree root. In Jest / Storybook tests that render chat
 * internals directly, wrap with `<HubRuntimeProvider>` (hub defaults)
 * or supply `<ChatRuntimeContext.Provider value={mockedRuntime}>`.
 */
export function useRequiredChatRuntime(): ChatRuntime {
  const v = useContext(ChatRuntimeContext)
  if (!v) {
    throw new Error(
      '[chat-runtime] hook called outside a <ChatRuntimeContext.Provider>. ' +
        'The hub mounts <HubRuntimeProvider> at root — this only fires when ' +
        'chat internals are rendered above the provider tree. ' +
        'Fix: ensure the rendering subtree descends from the runtime provider. ' +
        'In tests/Storybook: wrap with <HubRuntimeProvider> or supply ' +
        'a <ChatRuntimeContext.Provider value={mockedRuntime}>.',
    )
  }
  return v
}
