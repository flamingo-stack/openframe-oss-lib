'use client';

/**
 * useChatHistoryHydration: mount-time rebuild of the chat message list from
 * the SERVER-side conversation store (the `chat_conversations` /
 * `chat_messages` SSOT behind `GET <chatStreamUrl>/history`).
 *
 * The client persists ONLY the server-issued conversation id (see
 * `chat-conversation-storage.ts`); this hook turns that id back into the
 * messages it holds, each a row as `messageOfStoredRow` reads it.
 *
 * Failure semantics: a fetch/parse failure simply leaves the UI empty: the
 * SERVER still resolves full history for the next turn (it re-reads
 * `chat_messages` by conversation id on every send), so conversation context
 * is never lost when hydration misses.
 */

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { messageOfStoredRow } from '../../../chat-protocol/message-decoder';
import { isRecord, unwrapEnvelope } from '../../../chat-protocol/wire-narrow';
import { embedAuthedFetch } from '../../../utils/embed-authed-fetch';

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
  /** The adapter's injection primitive (replace-or-prepend). */
  hydrateMessages: (history: ChatMessage[]) => void;
  /** The server answered OK and reported the id as NOT READABLE by this caller
   *  (`found: false`) — it no longer exists, or is no longer ours (e.g. the
   *  thread was claimed by an account and this browser is now signed out).
   *  Distinct from a fetch FAILURE, which keeps the id so a transient outage
   *  never loses context, and from a legitimately EMPTY but owned thread, which
   *  also keeps it. A host that persists the id should drop it here — otherwise
   *  every later turn streams an answer the server refuses to record. */
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
  hydrateMessages,
  onOrphanedConversation,
}: UseChatHistoryHydrationArgs): UseChatHistoryHydrationResult {
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const hydratedKeyRef = useRef<string | null>(null);
  // Monotonic run id: only the LATEST hydration owns the loading flag, so a
  // slow superseded run resolving after a newer one started cannot clear the
  // skeleton out from under it. (Same guard `useManagedDialogList` uses.)
  const runIdRef = useRef(0);

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
    let completed = false;
    const runId = ++runIdRef.current;
    const isCurrentRun = () => runIdRef.current === runId;
    setIsHydratingHistory(true);
    // Self-contained: try/catch/finally below, and every state write is gated
    // on `cancelled` so a superseded effect can't hydrate the new conversation.
    void (async () => {
      try {
        const res = await embedAuthedFetch(`${historyUrl}?conversationId=${encodeURIComponent(conversationId)}`, {
          method: 'GET',
        });
        if (!res.ok) {
          // Releases the once-guard exactly like the catch below — this path
          // returns BEFORE it, and a transient 429/5xx must not mark the
          // conversation hydrated for the rest of the mount. `isCurrentRun` so
          // a superseded run can't release a key its replacement re-claimed
          // (same key string, different run).
          if (isCurrentRun() && hydratedKeyRef.current === key) hydratedKeyRef.current = null;
          return;
        }
        // `.json()` is `any` — this is untrusted wire, so narrow it rather than
        // asserting the shape we hope for.
        const payload: unknown = await res.json().catch(() => null);
        const body = unwrapEnvelope(payload);
        const rawRows = isRecord(body) ? body.messages : undefined;
        // Non-object rows are DROPPED, not carried into the loop below: a single
        // `null` row must not abandon the hydration wholesale and render an EMPTY
        // conversation on refresh. Skipping the bad row keeps every good one.
        const rows: Array<Record<string, unknown>> = Array.isArray(rawRows) ? rawRows.filter(isRecord) : [];
        if (cancelled) return;
        if (rows.length === 0) {
          // `found === false` = unknown or foreign id → the stored id is dead.
          // An owned-but-empty thread (`found === true`, or a server that
          // predates the flag) keeps it.
          const found = isRecord(body) ? body.found : undefined;
          if (found === false) onOrphanedConversation?.(conversationId);
          return;
        }
        const hydrated: ChatMessage[] = [];
        for (const row of rows) {
          // TODO(CU-17tkuw635xx): an old hub's row has no id of its own.
          const message = messageOfStoredRow(row, `hydrated-${String(row.seq ?? hydrated.length)}`);
          if (message) hydrated.push(message);
        }
        if (cancelled || hydrated.length === 0) return;
        hydrateMessages(hydrated);
      } catch {
        // Fetch failed — start empty; the server still owns history (above).
        // Release the once-guard so re-selecting the conversation retries
        // (a transient 429/5xx must not mark it hydrated for the mount).
        if (isCurrentRun() && hydratedKeyRef.current === key) hydratedKeyRef.current = null;
      } finally {
        completed = true;
        // Only the latest run owns the flag (React no-ops updates after unmount).
        if (isCurrentRun()) setIsHydratingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
      // An INCOMPLETE run must hand the key back, or a re-run for the SAME key
      // (a mode toggle flipping `active`, a StrictMode remount) early-returns
      // on the guard, drops the in-flight response and never refetches — the
      // thread would render empty for the rest of the mount while the server
      // keeps answering from history the user cannot see.
      if (!completed && isCurrentRun() && hydratedKeyRef.current === key) hydratedKeyRef.current = null;
      // Release the skeleton unless a newer run has already claimed it (that
      // run raises the flag itself and owns clearing it).
      if (isCurrentRun()) setIsHydratingHistory(false);
    };
    // `conversationId` is the real re-run trigger (dialog switch).
  }, [active, source, historyUrl, conversationId, hydrateMessages, onOrphanedConversation]);

  return { isHydratingHistory, hydratedKeyRef };
}
