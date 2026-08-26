'use client'

/**
 * useChatHistoryHydration — mount-time rebuild of the chat message list from
 * the SERVER-side conversation store (the `chat_conversations` /
 * `chat_messages` SSOT behind `GET <chatStreamUrl>/history`).
 *
 * The client persists ONLY the server-issued conversation id (see
 * `chat-conversation-storage.ts`); this hook turns that id back into rendered
 * history: message bubbles and the send counter. Inline entity cards need no
 * per-row metadata — they hydrate by id from the `[card://…]` markers in the
 * message content via the card fetch path.
 *
 * Failure semantics: a fetch/parse failure simply leaves the UI empty — the
 * SERVER still resolves full history for the next turn (it re-reads
 * `chat_messages` by conversation id on every send), so conversation context
 * is never lost when hydration misses.
 */

import { useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Message } from './use-chat'
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch'
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../utils/auto-continuation-directive'

export interface UseChatHistoryHydrationArgs {
  /** Mirrors the adapter's `active` gate — an idle (Mingo-mode) mount never fetches. */
  active: boolean
  /** Chat source (= platform); part of the once-per-conversation guard key. */
  source: string
  /** Resolved history endpoint (`<chatStreamUrl>/history` by default). */
  historyUrl: string
  /** The server-issued conversation id (null = nothing to hydrate). */
  conversationIdRef: MutableRefObject<string | null>
  /** User-send counter — set to the hydrated user-turn count so the next
   *  live send lands on the following `sendIdx`. */
  sendCountRef: MutableRefObject<number>
  /** `useChat`'s injection primitive (replace-or-prepend). */
  hydrateMessages: (
    history: Message[],
    /** Per-send "Sources used" chips restored from the persisted audit copy
     *  (`[sendIdx, sources[]]` entries for the reducer's sourcesMap). */
    sourcesSeed?: Array<[number, unknown[]]>,
  ) => void
  /** Invalidates the adapter's `latestMeta` memo after hydration lands. */
  bumpMetaTick: () => void
}

export interface UseChatHistoryHydrationResult {
  /** True while the rebuild request is in flight. */
  isHydratingHistory: boolean
  /** Once-per-`source:conversationId` guard. The adapter's `clearMessages`
   *  resets it to null alongside the stored id (a fresh conversation has no
   *  server history to fetch). */
  hydratedKeyRef: MutableRefObject<string | null>
}

export function useChatHistoryHydration({
  active,
  source,
  historyUrl,
  conversationIdRef,
  sendCountRef,
  hydrateMessages,
  bumpMetaTick,
}: UseChatHistoryHydrationArgs): UseChatHistoryHydrationResult {
  const [isHydratingHistory, setIsHydratingHistory] = useState(false)
  const hydratedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!active) return
    // No stored conversation id → nothing to hydrate (fresh visitor / after
    // "new chat"); the first send establishes the conversation server-side.
    const conversationId = conversationIdRef.current
    if (!conversationId) return
    const key = `${source}:${conversationId}`
    if (hydratedKeyRef.current === key) return
    hydratedKeyRef.current = key
    let cancelled = false
    setIsHydratingHistory(true)
    ;(async () => {
      try {
        const res = await embedAuthedFetch(
          `${historyUrl}?conversationId=${encodeURIComponent(conversationId)}`,
          { method: 'GET' },
        )
        if (!res.ok) return
        const payload = await res.json().catch(() => null)
        // route-base successResponse envelope ({ data }) with a raw-body fallback.
        const body = (payload?.data ?? payload) as
          | { messages?: Array<Record<string, unknown>> }
          | null
        const rows = Array.isArray(body?.messages) ? body!.messages! : []
        if (cancelled || rows.length === 0) return
        const hydrated: Message[] = []
        // Per-send "Sources used" chips, restored from the persisted audit
        // copy the history route projects as `sources` on assistant rows —
        // seeded into the reducer's sourcesMap so chips survive a refresh
        // exactly like live turns. Keyed by send index (last row wins).
        const sourcesSeed = new Map<number, unknown[]>()
        let userTurns = 0
        for (const row of rows) {
          const role =
            row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null
          if (!role) continue
          const content = typeof row.content === 'string' ? row.content : ''
          // The approval placeholder ('') and the server-built auto-continuation
          // directive are part of the LLM history but never rendered.
          const hidden =
            role === 'user' &&
            (content === '' || content.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX))
          if (role === 'user') {
            userTurns += 1
          }
          if (role === 'assistant' && Array.isArray(row.sources) && row.sources.length > 0) {
            sourcesSeed.set(Math.max(0, userTurns - 1), row.sources as unknown[])
          }
          hydrated.push({
            id: `hydrated-${String(row.seq ?? hydrated.length)}`,
            role,
            content,
            ...(typeof row.created_at === 'string'
              ? { timestamp: new Date(row.created_at) }
              : {}),
            ...(hidden ? { hidden: true } : {}),
          } as Message)
        }
        if (cancelled || hydrated.length === 0) return
        sendCountRef.current = userTurns
        hydrateMessages(hydrated, Array.from(sourcesSeed.entries()))
        bumpMetaTick()
      } catch {
        // Fetch failed — start empty; the server still owns history (above).
      } finally {
        if (!cancelled) setIsHydratingHistory(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // Refs are stable across renders — the effect keys on the identity-ish deps only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, source, historyUrl, hydrateMessages, bumpMetaTick])

  return { isHydratingHistory, hydratedKeyRef }
}
