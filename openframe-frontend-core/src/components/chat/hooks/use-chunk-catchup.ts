'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  type ChunkData,
  type BufferedChunk,
  type NatsMessageType,
  type ChatType,
  type UseChunkCatchupOptions,
  type UseChunkCatchupReturn,
  CHAT_TYPE,
  MESSAGE_TYPE,
} from '../types';

/**
 * Creates a unique key for sequence tracking
 */
function makeSeqKey(messageType: NatsMessageType, chunkType: string, sequenceId: number): string {
  return `${messageType}:${chunkType}:${sequenceId}`;
}

/**
 * Creates a unique key for batch deduplication
 */
function makeBatchDedupKey(item: BufferedChunk): string {
  const seq = item.chunk.sequenceId ?? 'na';
  const type = typeof item.chunk.type === 'string' ? item.chunk.type : 'na';
  const text = typeof item.chunk.text === 'string' ? item.chunk.text : '';
  const integratedToolType = typeof item.chunk.integratedToolType === 'string' ? item.chunk.integratedToolType : '';
  const toolFunction = typeof item.chunk.toolFunction === 'string' ? item.chunk.toolFunction : '';
  const approvalRequestId =
    typeof item.chunk.approvalRequestId === 'string'
      ? item.chunk.approvalRequestId
      : typeof item.chunk.approval_request_id === 'string'
        ? item.chunk.approval_request_id
        : '';

  return `${item.messageType}:${seq}:${type}:${text}:${integratedToolType}:${toolFunction}:${approvalRequestId}`;
}

/**
 * Determines the message type for a given chat type
 */
function getChatTypeMessageType(chatType: ChatType): NatsMessageType {
  return chatType === CHAT_TYPE.ADMIN ? 'admin-message' : 'message';
}

/**
 * Hook for managing chunk catchup during dialog loading.
 *
 * This hook handles:
 * - Buffering NATS chunks that arrive during catchup
 * - Fetching historical chunks from the API
 * - Deduplicating and ordering chunks
 * - Processing chunks in the correct order
 */
export function useChunkCatchup({
  dialogId,
  onChunkReceived,
  chatTypes = [CHAT_TYPE.CLIENT],
  fetchChunks,
}: UseChunkCatchupOptions): UseChunkCatchupReturn {
  const processedSequenceKeys = useRef<Set<string>>(new Set());
  const lastSequenceId = useRef<number | null>(null);
  // Per-messageType resume checkpoints. The legacy Redis transport keeps an
  // INDEPENDENT sequence counter per (dialog, chatType), so resuming every
  // stream from the single global `lastSequenceId` would permanently skip
  // the slower stream's newer chunks (one stream at seq 100, the other at
  // 20 → resuming both from 100 loses the second stream's 21+).
  const lastSequenceIdByType = useRef<Map<NatsMessageType, number>>(new Map());

  // Identity of the catch-up run that currently OWNS the cycle (`null` = idle).
  // Deliberately a token, not a boolean: `resetChunkTracking` releases the lock
  // unconditionally and is followed straight away by a fresh `catchUpChunks()`,
  // so a second run legitimately starts while the first is still awaiting its
  // fetch — for the SAME dialog id whenever the host re-activates or re-opens
  // the conversation it was already on (`active` flipped off/on, dialog id
  // X → null → X). The dialog-identity staleness gate below cannot tell those
  // two runs apart, so without an identity the older run would finalize the
  // NEWER run's cycle, drain its buffer and hand its lock away. Every write
  // this callback performs after an `await` therefore asks "do I still own the
  // cycle?" by comparing against this token.
  const catchupRun = useRef<object | null>(null);
  const lastFetchParams = useRef<{ dialogId: string; fromSequenceId?: number | null } | null>(null);
  // A catch-up requested while another fetch is in flight (double reconnect,
  // reconnect during the initial catchup). Queued instead of dropped: the old
  // behaviour returned early and the stale fetch's completion marked catchup
  // done, so the new gap was never fetched — a permanent transcript hole.
  // Scoped to its originating dialog — a rerun must never apply one dialog's
  // offset to another after a switch.
  const pendingCatchupRef = useRef<{ dialogId: string; fromSequenceId?: number | null } | null>(null);

  // Buffer for NATS chunks that arrive during catchup
  const chunkBuffer = useRef<BufferedChunk[]>([]);
  const bufferUntilInitialCatchupComplete = useRef(false);
  const hasCompletedInitialCatchup = useRef(false);

  // Latest-ref mirrors of the options, so the identity-stable callbacks below
  // never have to re-create themselves when a caller passes a fresh inline
  // function. Refreshed in an unconditional effect rather than in the render
  // body: React can discard a render attempt outright, and every reader here
  // is a chunk callback or an awaited continuation, which can only run after a
  // commit — so they still see current values.
  const dialogIdRef = useRef(dialogId);
  const chatTypesRef = useRef(chatTypes);
  const fetchChunksRef = useRef(fetchChunks);
  const onChunkReceivedRef = useRef(onChunkReceived);
  useEffect(() => {
    dialogIdRef.current = dialogId;
    chatTypesRef.current = chatTypes;
    fetchChunksRef.current = fetchChunks;
    onChunkReceivedRef.current = onChunkReceived;
  });

  const processChunk = useCallback(
    (chunk: ChunkData, messageType: NatsMessageType, forceProcess: boolean = false): boolean => {
      if (bufferUntilInitialCatchupComplete.current && !forceProcess) {
        chunkBuffer.current.push({ chunk, messageType });
        return true;
      }

      if (chunk.sequenceId !== undefined && chunk.sequenceId !== null) {
        const chunkType = typeof chunk.type === 'string' ? chunk.type : '';
        const key = makeSeqKey(messageType, chunkType, chunk.sequenceId);
        // A live chunk can also be in the catchup fetch result (published just
        // before the fetch resolved, delivered just after the flush). Without
        // this check the live path only RECORDED keys and never consulted
        // them, so the overlap rendered twice (duplicated text / tool cards).
        if (processedSequenceKeys.current.has(key)) return true;
        processedSequenceKeys.current.add(key);
        lastSequenceId.current = chunk.sequenceId;
        const prevTypeSeq = lastSequenceIdByType.current.get(messageType);
        if (prevTypeSeq === undefined || chunk.sequenceId > prevTypeSeq) {
          lastSequenceIdByType.current.set(messageType, chunk.sequenceId);
        }
      }

      onChunkReceivedRef.current(chunk, messageType);
      return true;
    },
    [],
  );

  /**
   * Flush buffered realtime chunks after catchup is complete
   */
  const flushBufferedRealtimeChunks = useCallback(() => {
    if (chunkBuffer.current.length === 0) return;
    const buffered = [...chunkBuffer.current];
    chunkBuffer.current = [];

    // Chunks WITHOUT a sequence id are live deliveries — the newest events.
    // Sorting them as seq 0 (the old behaviour) pushed them BEFORE history.
    buffered.sort((a, b) => {
      const seqA = a.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER;
      return seqA - seqB;
    });

    buffered.forEach(({ chunk, messageType }) => {
      processChunk(chunk, messageType, true);
    });
  }, [processChunk]);

  /**
   * Close the catch-up window: stop buffering, mark the cycle complete.
   *
   * Extracted because the same two-step transition is the terminal state of
   * four different exits from `catchUpChunks`, and because every one of them
   * happens AFTER an await — so each call site must first establish that this
   * run still owns the cycle (`catchupRun.current === run`). Finalizing from a
   * superseded run ends the newer run's buffering window early: its buffered
   * live chunks are flushed into the stale batch, and everything the newer
   * fetch later delivers sits at or below the seq cursor the flush just
   * advanced — which the reducer drops. That is silent content loss.
   */
  const completeCatchupWindow = useCallback(() => {
    bufferUntilInitialCatchupComplete.current = false;
    hasCompletedInitialCatchup.current = true;
  }, []);

  /**
   * Re-arm the cycle so a queued re-run is not rejected by its own guards.
   * Same ownership precondition as `completeCatchupWindow`.
   */
  const rearmForQueuedCatchup = useCallback(() => {
    hasCompletedInitialCatchup.current = false;
    lastFetchParams.current = null;
    bufferUntilInitialCatchupComplete.current = true;
  }, []);

  // Self-reference for the queued re-run inside `catchUpChunks` (a callback
  // cannot name itself inside its own `useCallback` initializer). Declared
  // ABOVE the callback so the reference is not a forward one; the ref is only
  // READ at runtime, and `.current` is assigned right after the callback exists.
  const catchUpChunksRef = useRef<typeof catchUpChunks | null>(null);

  /**
   * Fetch and process chunks from the API
   */
  const catchUpChunks = useCallback(
    async (fromSequenceId?: number | null) => {
      // Read through the refs, never the props: this callback is deliberately
      // stable, so the destructured `dialogId`/`chatTypes`/`fetchChunks` in its
      // closure are whatever they were on the render that created it. The
      // `current` prefix is load-bearing — it is the only thing telling a reader
      // which of the two values they are looking at.
      const currentDialogId = dialogIdRef.current;
      const currentChatTypes = chatTypesRef.current;
      const currentFetchChunks = fetchChunksRef.current;

      if (!currentDialogId) {
        return;
      }

      if (hasCompletedInitialCatchup.current) {
        // Safety valve: never leave the buffering flag stuck on a completed
        // catchup — buffered live chunks would otherwise queue forever and the
        // dialog would look frozen.
        if (bufferUntilInitialCatchupComplete.current) {
          bufferUntilInitialCatchupComplete.current = false;
          flushBufferedRealtimeChunks();
        }
        return;
      }

      if (catchupRun.current !== null) {
        // Queue instead of dropping — the in-flight fetch's finally block
        // re-runs catch-up with these params once it settles. An explicit
        // fromSequenceId wins; a queued INITIAL call (undefined) falls back to
        // the last seq seen so far (null on a fresh dialog → backend returns
        // everything, same as the original undefined semantics).
        pendingCatchupRef.current = {
          dialogId: currentDialogId,
          fromSequenceId: fromSequenceId ?? lastSequenceId.current,
        };
        return;
      }

      if (
        lastFetchParams.current &&
        lastFetchParams.current.dialogId === currentDialogId &&
        lastFetchParams.current.fromSequenceId === fromSequenceId
      ) {
        return;
      }

      if (!currentFetchChunks) {
        completeCatchupWindow();
        flushBufferedRealtimeChunks();
        return;
      }

      // Identity of THIS run, installed as the cycle lock. Every post-await
      // write below is gated on it still being the installed token.
      const run: object = {};
      catchupRun.current = run;
      lastFetchParams.current = { dialogId: currentDialogId, fromSequenceId };

      try {
        // Fetch chunks for all configured chat types
        const chunkPromises = currentChatTypes.map(async chatType => {
          try {
            // Resume each stream from ITS OWN checkpoint: the legacy Redis
            // transport numbers each (dialog, chatType) stream independently,
            // so passing one global offset to every type would skip the slower
            // stream's newer chunks. `undefined` (initial load) still fetches
            // everything; a type we've never seen resumes from null (= all
            // unsaved chunks) rather than borrowing another stream's offset.
            const typeFromSequenceId =
              fromSequenceId === undefined
                ? undefined
                : (lastSequenceIdByType.current.get(getChatTypeMessageType(chatType)) ?? null);
            const chunks = await currentFetchChunks(currentDialogId, chatType, typeFromSequenceId);
            const messageType = getChatTypeMessageType(chatType);
            return chunks.map(chunk => ({ chunk, messageType }));
          } catch (error) {
            console.error(`Failed to fetch ${chatType} chunks:`, error);
            return [];
          }
        });

        const allChunkResults = await Promise.all(chunkPromises);

        // STALENESS GATE — the FIRST thing after the await, because everything
        // below this line is bound to the CURRENTLY active dialog, not to the one
        // this fetch was issued for:
        //   - `onChunkReceivedRef.current` is reassigned every render, so it
        //     routes into whichever dialog's reducer is mounted now;
        //   - `processedSequenceKeys` / `lastSequenceId` / `lastSequenceIdByType`
        //     were re-armed by `resetChunkTracking` for the new dialog;
        //   - `chunkBuffer` holds the NEW dialog's buffered live deliveries;
        //   - `hasCompletedInitialCatchup` / `bufferUntilInitialCatchupComplete`
        //     govern the NEW dialog's buffering window.
        // So a fetch that resolved after a dialog switch used to write dialog A's
        // transcript into dialog B AND advance B's seq cursor to A's JetStream
        // sequence — and because the reducer drops any event at or below
        // `lastAppliedSeq`, an unrelated (higher) position permanently discards
        // B's own live chunks. Switching dialogs mid-fetch is the ordinary
        // interaction, not an edge case.
        //
        // The `finally` below already handles stale bookkeeping correctly (it
        // keeps the new dialog's cycle intact and only discards a pending entry
        // belonging to THIS dialog); it still runs on this early return. The
        // guard could not live there — by then the chunks had already been
        // applied.
        if (currentDialogId !== dialogIdRef.current) return;

        // SUPERSEDED GATE — the dialog id is not enough. `resetChunkTracking`
        // releases the lock and the very next statement in the adapter starts a
        // fresh `catchUpChunks()`, so two runs overlap for the SAME dialog id
        // whenever the host re-activates the conversation it was already on
        // (`active` off/on, or dialog id X → null → X) while this fetch is still
        // open. Both runs then pass the identity gate above. Applying this run's
        // now-older snapshot would advance the seq cursor past what the newer
        // run is about to deliver, and the reducer drops anything at or below
        // `lastAppliedSeq` — the newer chunks vanish from the transcript.
        // Dropping the superseded run loses nothing: the run that replaced it
        // was started by `resetChunkTracking`, which re-fetches from scratch.
        if (catchupRun.current !== run) return;

        const allCatchupChunks: BufferedChunk[] = allChunkResults.flat();

        if (allCatchupChunks.length === 0) {
          flushBufferedRealtimeChunks();
          completeCatchupWindow();
          return;
        }

        // Combine catchup chunks with buffered NATS chunks
        const bufferedNatsChunks = [...chunkBuffer.current];
        chunkBuffer.current = [];
        const allChunks = [...allCatchupChunks, ...bufferedNatsChunks];

        // Sort by sequence ID. Chunks without one are buffered live deliveries
        // (the newest events) — sort them AFTER history, not before it.
        allChunks.sort((a, b) => {
          const seqA = a.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER;
          const seqB = b.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER;
          return seqA - seqB;
        });

        // Deduplicate — only chunks that carry a sequence id. Id-less live
        // chunks get no key: two identical streaming deltas ("the ", "yes")
        // are distinct content, and collapsing them (the old behaviour, where
        // the key degraded to type+text) silently dropped text.
        const uniqueAllChunks: BufferedChunk[] = [];
        const seenInBatch = new Set<string>();
        for (const item of allChunks) {
          const hasSeq = item.chunk.sequenceId !== undefined && item.chunk.sequenceId !== null;
          if (hasSeq) {
            const k = makeBatchDedupKey(item);
            if (seenInBatch.has(k)) continue;
            seenInBatch.add(k);
          }
          uniqueAllChunks.push(item);
        }

        // Id-less chunks are buffered live deliveries (newer than anything the
        // fetch returned) — the boundary filters must KEEP them, not drop them.
        // Returns the chunk's seq, collapsing `undefined` to `null`. Reading it
        // into a local inside each filter is what lets the comparisons below
        // typecheck without a non-null assertion: a predicate call cannot
        // narrow `item.chunk.sequenceId` for the expression that follows it.
        const seqOf = (item: BufferedChunk): number | null => item.chunk.sequenceId ?? null;

        // Boundary detection runs PER messageType. In the legacy Redis
        // transport each (dialog, chatType) stream has its OWN independent
        // sequence counter, so a MESSAGE_END boundary found in one stream must
        // never truncate the other stream's chunks (tool/approval chunks of an
        // admin mirror used to vanish this way). With JetStream's global seqs
        // the per-type grouping is still correct — it just partitions the same
        // ordered list.
        const byType = new Map<NatsMessageType, BufferedChunk[]>();
        for (const item of uniqueAllChunks) {
          const list = byType.get(item.messageType);
          if (list) list.push(item);
          else byType.set(item.messageType, [item]);
        }

        const chunksToProcess: BufferedChunk[] = [];
        for (const items of byType.values()) {
          // Find the last complete message boundary within this stream.
          let lastMessageStartSeqId: number | null = null;
          let lastMessageEndSeqId: number | null = null;

          for (let i = items.length - 1; i >= 0; i--) {
            const seq = items[i].chunk.sequenceId;
            if (items[i].chunk.type === MESSAGE_TYPE.MESSAGE_END && seq !== undefined && seq !== null) {
              lastMessageEndSeqId = seq;
              break;
            }
          }

          for (let i = items.length - 1; i >= 0; i--) {
            const chunk = items[i].chunk;
            const seq = chunk.sequenceId;
            if (chunk.type === MESSAGE_TYPE.MESSAGE_START && seq !== undefined && seq !== null) {
              if (lastMessageEndSeqId === null || seq > lastMessageEndSeqId) {
                lastMessageStartSeqId = seq;
                break;
              }
            }
          }

          if (lastMessageStartSeqId !== null) {
            // Process from the last incomplete message
            const startSeq = lastMessageStartSeqId;
            chunksToProcess.push(
              ...items.filter(item => {
                const seq = seqOf(item);
                return seq === null || seq >= startSeq;
              }),
            );
          } else if (lastMessageEndSeqId !== null) {
            // Process only after the last complete message
            const endSeq = lastMessageEndSeqId;
            chunksToProcess.push(
              ...items.filter(item => {
                const seq = seqOf(item);
                return seq === null || seq > endSeq;
              }),
            );
          } else {
            // Process all
            chunksToProcess.push(...items);
          }
        }

        // Restore cross-stream order (concatenation above grouped by type).
        // Stable sort keeps per-type order; JetStream seqs interleave globally,
        // Redis-mode cross-type order is inherently undefined either way.
        chunksToProcess.sort((a, b) => {
          const seqA = a.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER;
          const seqB = b.chunk.sequenceId ?? Number.MAX_SAFE_INTEGER;
          return seqA - seqB;
        });

        // Process the chunks
        chunksToProcess.forEach(({ chunk, messageType }) => {
          if (chunk.sequenceId !== undefined && chunk.sequenceId !== null) {
            const chunkType = typeof chunk.type === 'string' ? chunk.type : '';
            const key = makeSeqKey(messageType, chunkType, chunk.sequenceId);
            if (processedSequenceKeys.current.has(key)) return;
            processedSequenceKeys.current.add(key);
            lastSequenceId.current = chunk.sequenceId;
            const prevTypeSeq = lastSequenceIdByType.current.get(messageType);
            if (prevTypeSeq === undefined || chunk.sequenceId > prevTypeSeq) {
              lastSequenceIdByType.current.set(messageType, chunk.sequenceId);
            }
          }
          onChunkReceivedRef.current(chunk, messageType);
        });

        completeCatchupWindow();
      } catch (error) {
        console.error('Error during chunk catchup:', error);
      } finally {
        // OWNERSHIP GATE — a run that no longer holds the lock was superseded by
        // `resetChunkTracking` + a newer `catchUpChunks()`, and every piece of
        // state below now belongs to that newer run: releasing the lock here
        // would let a THIRD catch-up start concurrently instead of queueing, and
        // the pending entry it would discard was queued by (and for) the newer
        // run. So a superseded run touches nothing at all.
        if (catchupRun.current === run) {
          // A fetch whose dialog is no longer active must not touch the NEW
          // dialog's cycle state — `resetChunkTracking` already re-armed the
          // flags for it, and finalizing the buffer here would corrupt the new
          // dialog's in-flight catch-up. That includes the pending queue: only
          // discard an entry that belongs to THIS stale dialog — a reconnect
          // during the new dialog's initial fetch queues an entry for the new
          // dialog, and wiping it here would silently drop that gap's re-fetch
          // (permanent transcript hole).
          if (currentDialogId !== dialogIdRef.current) {
            catchupRun.current = null;
            if (pendingCatchupRef.current?.dialogId === currentDialogId) {
              pendingCatchupRef.current = null;
            }
          } else {
            catchupRun.current = null;

            // A reset was requested mid-fetch: re-arm and re-run with the queued
            // params instead of finalizing on this (stale) fetch's results. The
            // success path above may have already flipped the completion flags —
            // reset them so the re-run isn't rejected by its own guards. A
            // pending entry from a DIFFERENT dialog is discarded, never replayed
            // against the current one.
            //
            // KNOWN LIMIT: the stale fetch may already have processed (and
            // flushed) chunks NEWER than the queued gap, so on an extreme
            // double-flap the gap's chunks can render after later ones — order
            // skew inside the bubble, but no content loss (strictly better than
            // the pre-fix permanent hole). Perfect ordering would require holding
            // the stale fetch's flush until the re-run completes, which isn't
            // worth the complexity for this corner.
            const pending = pendingCatchupRef.current;
            if (pending) {
              pendingCatchupRef.current = null;
              if (pending.dialogId === currentDialogId) {
                rearmForQueuedCatchup();
                // AWAIT the re-run (not fire-and-forget): callers chain their own
                // finally on this promise — the adapter lowers its onAgentBusy
                // suppression there, and a detached re-run would replay a dead
                // tail's EXECUTING chunk with suppression already off, locking
                // the composer with no MESSAGE_END ever coming.
                try {
                  await catchUpChunksRef.current?.(pending.fromSequenceId);
                } catch (rerunError) {
                  console.error('Queued catch-up re-run failed:', rerunError);
                }
              } else if (bufferUntilInitialCatchupComplete.current) {
                completeCatchupWindow();
                flushBufferedRealtimeChunks();
              }
            } else if (bufferUntilInitialCatchupComplete.current) {
              completeCatchupWindow();
              flushBufferedRealtimeChunks();
            }
          }
        }
      }
    },
    [flushBufferedRealtimeChunks, completeCatchupWindow, rearmForQueuedCatchup],
  );

  // Self-reference so a run can re-enter itself for a queued catch-up without
  // `catchUpChunks` having to depend on its own identity. Published from an
  // effect, not the render body — the only reader is an awaited continuation,
  // which is always past a commit.
  useEffect(() => {
    catchUpChunksRef.current = catchUpChunks;
  });

  /**
   * Reset all tracking state
   */
  const resetChunkTracking = useCallback(() => {
    processedSequenceKeys.current.clear();
    lastSequenceId.current = null;
    lastSequenceIdByType.current.clear();
    // Disown any run still awaiting its fetch. It cannot re-acquire the lock
    // (the next run installs its own token), so from here on it is a no-op —
    // that is the whole point of the token: the old code left `false` behind,
    // which is indistinguishable from "idle", so the superseded run went on to
    // finalize the NEW cycle and release its lock.
    catchupRun.current = null;
    lastFetchParams.current = null;
    pendingCatchupRef.current = null;
    chunkBuffer.current = [];
    bufferUntilInitialCatchupComplete.current = false;
    hasCompletedInitialCatchup.current = false;
  }, []);

  /**
   * Start buffering NATS chunks for initial catchup
   */
  const startInitialBuffering = useCallback(() => {
    // Idempotent: a second reconnect while a back-fill is already buffering
    // (its history refetch still awaiting) must NOT clear the live chunks
    // collected so far — only a fresh start owns the buffer.
    if (!bufferUntilInitialCatchupComplete.current) {
      chunkBuffer.current = [];
      bufferUntilInitialCatchupComplete.current = true;
    }
    hasCompletedInitialCatchup.current = false;
  }, []);

  /**
   * Check if buffering is currently active
   */
  const isBufferingActive = useCallback(() => bufferUntilInitialCatchupComplete.current, []);

  /**
   * Number of chunks de-duplicated so far. A GETTER, like `isBufferingActive`:
   * the count changes in chunk callbacks with no re-render behind it, so the
   * old snapshot-at-render-time `number` reported whatever the tally happened
   * to be at the last render and then silently went stale.
   */
  const processedCount = useCallback(() => processedSequenceKeys.current.size, []);

  /**
   * Reset internal guards and re-run catch-up from the last known sequence ID.
   * Use after reconnection to fetch any messages missed during the disconnect.
   */
  const resetAndCatchUp = useCallback(async () => {
    if (!dialogIdRef.current) return;
    const fromSeq = lastSequenceId.current;
    hasCompletedInitialCatchup.current = false;
    lastFetchParams.current = null;
    if (!bufferUntilInitialCatchupComplete.current) {
      // Starting buffering fresh — drop stale leftovers. When the CALLER
      // already armed buffering (e.g. `startInitialBuffering()` before an
      // async history refetch on reconnect), KEEP the chunks it collected:
      // clearing here would silently discard everything delivered during
      // that await.
      chunkBuffer.current = [];
      bufferUntilInitialCatchupComplete.current = true;
    }
    await catchUpChunks(fromSeq);
  }, [catchUpChunks]);

  return {
    catchUpChunks,
    processChunk,
    resetChunkTracking,
    startInitialBuffering,
    isBufferingActive,
    processedCount,
    resetAndCatchUp,
  };
}
