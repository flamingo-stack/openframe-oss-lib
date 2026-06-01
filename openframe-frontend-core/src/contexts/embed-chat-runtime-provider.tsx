'use client'

/**
 * `<EmbedChatRuntimeProvider>` — the embedder-facing ChatRuntime provider that
 * resolves `source` (which platform this embed mirrors) from the SERVER, so the
 * embedding app never has to be platform-aware.
 *
 * Why this exists
 * ───────────────
 * `ChatRuntime.source` drives CLIENT-side concerns only — localStorage namespacing
 * (`mingo-chat-<source>-v1`) and the same-platform-soft-nav vs cross-platform-new-tab
 * decision. The HUB knows its platform synchronously (`currentPlatform()`) and mounts
 * its own provider with `source` set. An EMBEDDER can't know the platform a priori — it
 * just points its proxy at a hub — so forcing it to configure a `source` that must be
 * kept in lockstep with the proxied hub is a footgun (and was: the old example shipped a
 * `VITE_CHAT_SOURCE` env var). This provider instead reads the value from the hub's
 * `/auth/identity` response, whose `source` IS the hub's server-side `currentPlatform()`.
 * Single source of truth: the server.
 *
 * The chat WIRE never sends `source` anyway — `/docs/chat`, `/docs/search`, and
 * `/docs/commands` all resolve it from `currentPlatform()` server-side and reject client
 * input. This provider only feeds the remaining CLIENT-side nav/localStorage uses.
 *
 * Bootstrapping note
 * ──────────────────
 * `useChatIdentity()` reads `endpoints.identityUrl` from the runtime context, so the
 * provider must be mounted BEFORE identity can be fetched. We break that chicken-and-egg
 * by providing a provisional runtime (`source: ''`) up front — purely so the invisible
 * `<ChatSourceResolver>` child can issue the identity fetch — then re-provide with the
 * resolved server `source`. The only consumer that READS `source` (the chat panel) gates
 * on a non-empty value, so it never observes the provisional empty string.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useChatIdentity } from '../components/chat/hooks/use-chat-identity'
import { ChatRuntimeContext, type ChatRuntime } from './chat-runtime-context'

export interface EmbedChatRuntimeProviderProps {
  /** The chat runtime MINUS `source`. The embedder stays platform-agnostic — the lib
   *  fills `source` from the proxied hub's `/auth/identity` (its `currentPlatform()`). */
  runtime: Omit<ChatRuntime, 'source'>
  children: ReactNode
}

export function EmbedChatRuntimeProvider({ runtime, children }: EmbedChatRuntimeProviderProps) {
  // `null` = identity not resolved yet; '' = resolved but the hub reports no chat source
  // (chat unavailable on that platform); non-empty = the hub's `currentPlatform()`.
  const [serverSource, setServerSource] = useState<string | null>(null)

  const value = useMemo<ChatRuntime>(
    () => ({ ...runtime, source: serverSource ?? '' }),
    [runtime, serverSource],
  )

  return (
    <ChatRuntimeContext.Provider value={value}>
      <ChatSourceResolver onResolved={setServerSource} />
      {children}
    </ChatRuntimeContext.Provider>
  )
}

/**
 * Invisible resolver mounted UNDER the provisional provider so `useChatIdentity()` can
 * read `endpoints.identityUrl` from context. Reports the server `source` up once it
 * settles, then renders nothing. (`useChatIdentity` never throws — it falls back to anon
 * defaults with `source: null` on failure, which surfaces here as `''`.)
 */
function ChatSourceResolver({ onResolved }: { onResolved: (source: string) => void }) {
  const identity = useChatIdentity()
  useEffect(() => {
    if (!identity.isLoading) onResolved(identity.source ?? '')
  }, [identity.isLoading, identity.source, onResolved])
  return null
}
