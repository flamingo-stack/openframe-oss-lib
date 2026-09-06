'use client';

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

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { isRecord, unwrapEnvelope } from '../../../chat-protocol/wire-narrow';
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch';
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../utils/auto-continuation-directive';
import type { Message } from './use-chat';

export interface UseChatHistoryHydrationArgs {
  /** Mirrors the adapter's `active` gate — an idle (Mingo-mode) mount never fetches. */
  active: boolean;
  /** Chat source (= platform); part of the once-per-conversation guard key. */
  source: string;
  /** Resolved history endpoint (`<chatStreamUrl>/history` by default). */
  historyUrl: string;
  /** The server-issued conversation id (null = nothing to hydrate). A VALUE,
   *  not a ref: switching conversations (`selectDialog`) must re-run the
   *  fetch, so the id is an effect dependency. */
  conversationId: string | null;
  /** User-send counter — set to the hydrated user-turn count so the next
   *  live send lands on the following `sendIdx`. */
  sendCountRef: MutableRefObject<number>;
  /** `useChat`'s injection primitive (replace-or-prepend). */
  hydrateMessages: (
    history: Message[],
    /** Per-send "Sources used" chips restored from the persisted audit copy
     *  (`[sendIdx, sources[]]` entries for the reducer's sourcesMap). */
    sourcesSeed?: Array<[number, unknown[]]>,
  ) => void;
  /** Invalidates the adapter's `latestMeta` memo after hydration lands. */
  bumpMetaTick: () => void;
  /** The server answered OK with ZERO rows for this id — it does not exist any
   *  more, or is no longer ours (e.g. the thread was claimed by an account
   *  after sign-in and this browser is now signed out). Distinct from a fetch
   *  FAILURE, which keeps the id so a transient outage never loses context.
   *  A host that persists the id should drop it here — otherwise every later
   *  turn streams an answer the server refuses to record. */
  onOrphanedConversation?: (conversationId: string) => void;
}

export interface UseChatHistoryHydrationResult {
  /** True while the rebuild request is in flight. */
  isHydratingHistory: boolean;
  /** Once-per-`source:conversationId` guard. The adapter's `clearMessages`
   *  resets it to null alongside the stored id (a fresh conversation has no
   *  server history to fetch). */
  hydratedKeyRef: MutableRefObject<string | null>;
}

export function useChatHistoryHydration({
  active,
  source,
  historyUrl,
  conversationId,
  sendCountRef,
  hydrateMessages,
  bumpMetaTick,
  onOrphanedConversation,
}: UseChatHistoryHydrationArgs): UseChatHistoryHydrationResult {
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // The flag is owned by the fetch below and released in its `finally`; the
    // CLEANUP releases it for every early exit and for a superseded run.
    // `conversationId` is a DEPENDENCY (a dialog switch must re-fetch), so that
    // path is reachable in normal use: before this, "new chat" or archiving the
    // open thread mid-fetch left the flag stuck true forever and the panel
    // wedged on a message skeleton.
    if (!active || !conversationId) return () => setIsHydratingHistory(false);
    const key = `${source}:${conversationId}`;
    if (hydratedKeyRef.current === key) return () => setIsHydratingHistory(false);
    hydratedKeyRef.current = key;
    let cancelled = false;
    setIsHydratingHistory(true);
    // Self-contained: try/catch/finally below, and every state write is gated
    // on `cancelled` so a superseded effect can't hydrate the new conversation.
    void (async () => {
      try {
        const res = await embedAuthedFetch(`${historyUrl}?conversationId=${encodeURIComponent(conversationId)}`, {
          method: 'GET',
        });
        if (!res.ok) return;
        // `.json()` is `any` — this is untrusted wire, so narrow it rather than
        // asserting the shape we hope for.
        const payload: unknown = await res.json().catch(() => null);
        const body = unwrapEnvelope(payload);
        const rawRows = isRecord(body) ? body.messages : undefined;
        // Non-object rows are DROPPED, not carried into the loop below. The
        // loop reads `row.role` unguarded, so a single `null` row threw a
        // TypeError that the effect's outer `catch` swallowed — abandoning the
        // hydration wholesale and rendering an EMPTY conversation on refresh.
        // Skipping the bad row keeps every good one.
        const rows: Array<Record<string, unknown>> = Array.isArray(rawRows) ? rawRows.filter(isRecord) : [];
        if (cancelled) return;
        if (rows.length === 0) {
          // A well-formed EMPTY history: the id is gone or not ours.
          onOrphanedConversation?.(conversationId);
          return;
        }
        const hydrated: Message[] = [];
        // Per-send "Sources used" chips, restored from the persisted audit
        // copy the history route projects as `sources` on assistant rows —
        // seeded into the reducer's sourcesMap so chips survive a refresh
        // exactly like live turns. Keyed by send index (last row wins).
        const sourcesSeed = new Map<number, unknown[]>();
        let userTurns = 0;
        for (const row of rows) {
          const role = row.role === 'assistant' ? 'assistant' : row.role === 'user' ? 'user' : null;
          if (!role) continue;
          const content = typeof row.content === 'string' ? row.content : '';
          // The approval placeholder ('') and the server-built auto-continuation
          // directive are part of the LLM history but never rendered.
          const hidden = role === 'user' && (content === '' || content.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX));
          if (role === 'user') {
            userTurns += 1;
          }
          if (role === 'assistant' && Array.isArray(row.sources) && row.sources.length > 0) {
            sourcesSeed.set(Math.max(0, userTurns - 1), row.sources as unknown[]);
          }
          hydrated.push({
            id: `hydrated-${String(row.seq ?? hydrated.length)}`,
            role,
            content,
            ...(typeof row.created_at === 'string' ? { timestamp: new Date(row.created_at) } : {}),
            ...(hidden ? { hidden: true } : {}),
          });
        }
        if (cancelled || hydrated.length === 0) return;
        sendCountRef.current = userTurns;
        hydrateMessages(hydrated, Array.from(sourcesSeed.entries()));
        bumpMetaTick();
      } catch {
        // Fetch failed — start empty; the server still owns history (above).
        // Release the once-guard so re-selecting the conversation retries
        // (a transient 429/5xx must not mark it hydrated for the mount).
        if (hydratedKeyRef.current === key) hydratedKeyRef.current = null;
      } finally {
        // Unconditional: a superseded run re-sets it synchronously on its own
        // pass, and React no-ops state updates after unmount.
        setIsHydratingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
      // A superseded run must not leave the skeleton up; the replacement run
      // re-raises the flag itself when it starts fetching.
      setIsHydratingHistory(false);
    };
    // `sendCountRef` is a ref: a stable identity, so listing it costs nothing;
    // `conversationId` is the real re-run trigger (dialog switch).
  }, [active, source, historyUrl, conversationId, hydrateMessages, bumpMetaTick, onOrphanedConversation, sendCountRef]);

  return { isHydratingHistory, hydratedKeyRef };
}
