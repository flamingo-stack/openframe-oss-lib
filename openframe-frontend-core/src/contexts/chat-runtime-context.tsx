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

import type { ComposeContentUrl } from '../utils/content-href'

/**
 * Runtime config consumed by the chat panel.
 */
export interface ChatRuntime {
  endpoints: {
    /** POST streaming chat. Hub: '/api/docs/chat'. */
    chatStreamUrl: string
    /** POST agent approve/reject. Hub: '/api/chat/agent/confirm-tool'. */
    approvalToolUrl: string
    /** Customer-ticket agent endpoints (Help Center). OPTIONAL — when unset,
     *  the ticket hooks fall back to the bare hub paths
     *  (`/api/chat/agent/{find-ticket,ticket-action,list-engagements}`).
     *  Embedders behind a reverse proxy set these to their proxied paths
     *  (e.g. `/content/api/chat/agent/...`) so tickets route through the SAME
     *  endpoint config + proxy as every other endpoint. */
    findTicketUrl?: string
    ticketActionUrl?: string
    listEngagementsUrl?: string
    /** GET slash-command catalog. Hub: '/api/docs/commands'. */
    commandsUrl: string
    /** GET RAG-search endpoint behind `<DocSearchBar>` (the in-source search
     *  bar mounted by `<DocViewer>` / `<DocsHubPage>` when `showAIChat` is on).
     *  Hub: '/api/docs/search'. OPTIONAL — falls back to the hub path so
     *  same-origin Next.js hosts don't need to set it. Cross-origin embedders
     *  set their proxied path so the search bar routes through the same
     *  reverse proxy as everything else. Same pattern as `findTicketUrl`. */
    docsSearchUrl?: string
    /** GET per-platform empty-state config (admin-edited in
     *  `/admin/chat-config`): `{ greeting, enabledRagTableIds, suggestedQueries }`.
     *  Hub: '/api/docs/empty-state'. OPTIONAL — the in-app (host-mode) chat
     *  injects these values as SSR props instead, so it leaves this unset.
     *  Cross-origin EMBEDDERS (no server hop) set it to their proxied path
     *  (e.g. '/content/api/docs/empty-state') so `<EmbeddableChat>` can fetch
     *  the greeting / quick-action chips / RAG-source filter at runtime. When
     *  unset, the chat falls back to the explicit `emptyStateGreeting` /
     *  `suggestedQueries` / `enabledRagTableIds` props (or in-code defaults). */
    emptyStateUrl?: string
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
     *    - `identityUrl` — GET endpoint the `useChatIdentity` hook
     *      hits to learn the `{authTier, source, attachmentsEnabled}`
     *      capability bag for the current session. Used beyond chat
     *      (tickets / contact form / any embedded surface that needs
     *      to identify the proxied customer), so the name has no
     *      "chat" prefix even though the consuming hook still does. */
    attachmentUploadUrl: string
    attachmentViewUrlPrefix: string
    identityUrl: string
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
    /** Supabase storage origin (e.g. `https://xyz.supabase.co`) — used
     *  by `useVideoWarmup` to scope the `<link rel="preload" as="video">`
     *  hint to MP4s the deployment actually hosts. Hub wires it via
     *  `getSupabaseStorageOrigin()`; embedders without a Supabase
     *  storage origin leave it unset (preload is then skipped; Mux/
     *  YouTube preconnect still fires). */
    supabaseStorageOrigin?: string
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
  /** Optional OG placeholder URL builder. Returns a branded
   *  `/api/og-placeholder?...` URL for the given title. Hub wires this
   *  to its `buildOgPlaceholderUrl` (resolves CSS-var ODS colors to
   *  hex via the static map). Embedders can wire any equivalent that
   *  hits their own placeholder route — or omit, in which case entity
   *  cards fall back to no placeholder.
   *
   *  Pure synchronous function — NOT a hook. Callers wrap with
   *  `useMemo`/`useOgPlaceholder` for memoization. */
  resolvePlaceholderUrl?: (
    title: string,
    options?: { site?: string; aspect?: 'wide' | 'square' },
  ) => string
  /** Optional content-URL composer. Returns the platform-aware href +
   *  target-platform tuple for a content entity. Hub wires this to its
   *  `buildContentURL(type, slug, extractPrimaryPlatform(platforms))`
   *  pipeline so the lib catalog/detail views can derive cross-
   *  platform hrefs without knowing the hub's platform topology
   *  (openmsp.ai / openframe.app / flamingo.run / tmcg).
   *
   *  THE single content-href authority for every embeddable surface — page
   *  views (onboarding catalog/detail, releases) AND chat cards / chips /
   *  search results all resolve content links through this one seam, so a
   *  given type lands in the SAME place regardless of where it's rendered.
   *  Embedders wire `makeComposeContentUrl({ hostedTypes, contentOrigin })`;
   *  omit it and lib views fall back to a same-origin relative path
   *  (`buildDefaultHref`).
   *
   *  Takes a single `ComposeContentUrlInput`: `type` + `identifier` (page
   *  views pass the slug; chat rows pass the id + `externalUrl`, whose path
   *  yields the slug for in-app routing) + optional `platforms` /
   *  `externalUrl` / `targetPlatform`. */
  composeContentUrl?: ComposeContentUrl
  /** Per-`documentType` doc-viewer targets — the UNIFIED, DYNAMIC replacement for
   *  the single `chipBasePlatform` prop. Maps a doc-table documentType
   *  (`'markdown'`, `'data_room_doc'`, …) → `{ platform, basePath }` for the PUBLIC
   *  doc viewer that hosts it. Doc chips with no `externalUrl` resolve PER ROW to
   *  `getBaseUrl(platform)/<basePath>/<path>`, so a chat mixing several doc sources
   *  sends EACH to its own home (markdown→flamingo/knowledge-base,
   *  data_room_doc→company-hub/data-room) instead of one static fallback. The hub
   *  may keep using `chipBasePlatform` (one doc source per platform); embedders that
   *  surface multiple doc sources wire this. Threaded into `resolveSourceRowCTA`. */
  docPlatformTargets?: Record<string, { platform: string; basePath: string }>
  /** Chat source / platform identifier — OPTIONAL. The hub sets it from
   *  `currentPlatform()`; EMBEDDERS leave it unset and stay platform-agnostic.
   *
   *  It is NOT required for chat to work. The wire resolves source server-side
   *  (`/docs/chat|search|commands` reject any client `source`); the
   *  same-tab-vs-new-tab link decision falls back to an origin comparison when
   *  it's absent (`decideNewTab` → `isCrossOriginUrl`); and the localStorage
   *  history namespace falls back to a stable constant. Set it only where the
   *  client legitimately needs to know its platform a priori — i.e. the hub,
   *  where several platforms share related origins so "same platform" can't be
   *  inferred from a URL alone. */
  source?: string
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
