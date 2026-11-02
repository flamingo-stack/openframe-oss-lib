/**
 * createDeltaBatcher: framework-free, append-only batching of the `text-delta` / `reasoning-delta` entries.
 *
 * WHY THIS IS SHARED (and not a hook-private detail): every host that drives a
 * `ChatStreamReducer` from a raw transport needs the SAME batching, and a
 * copy-paste of it drifts. The React wrapper (`useChatStreamReducer`) and any
 * non-React mirror in a product app both consume this one implementation.
 *
 * Behaviour:
 *   - `push(entry, key)` queues an entry that is one delta and returns true; anything else
 *     returns false so the caller can flush + apply it synchronously (ordering:
 *     completion state must always land on fully-applied deltas).
 *   - CONSECUTIVE deltas of one wire id are COALESCED into one entry (a delta's
 *     append semantics distribute over concatenation), so a 60-delta/sec turn
 *     costs ONE `applyOne` per frame instead of 60.
 *   - A flush is scheduled on `requestAnimationFrame` when available, with a
 *     timer fallback that is ALWAYS armed (rAF pauses in background tabs, and a
 *     hidden chat panel must still keep its thread current).
 *   - `key` is an opaque routing token handed back to `applyOne`. When it
 *     changes, the pending batch is flushed against the PREVIOUS key first, so
 *     deltas never land on the wrong dialog/side.
 */

import type { ChatStreamEntry, UiChunk } from '../../../chat-protocol/ui-chunks';

export const DELTA_FLUSH_FALLBACK_MS = 50;

export type DeltaChunk = Extract<UiChunk, { type: 'text-delta' | 'reasoning-delta' }>;

/** An entry that is one delta and nothing else. */
export interface DeltaEntry {
  seq?: number;
  chunks: [DeltaChunk];
}

export function isDeltaEntry(entry: ChatStreamEntry): entry is DeltaEntry {
  if (entry.chunks.length !== 1) return false;
  const { type } = entry.chunks[0];
  return type === 'text-delta' || type === 'reasoning-delta';
}

export interface CreateDeltaBatcherOptions<K> {
  /** Apply one (possibly coalesced) delta entry against `key`'s reducer. */
  applyOne: (entry: DeltaEntry, key: K | undefined) => void;
  /** Called after a flush that applied at least one delta. */
  onFlushed?: (appliedCount: number) => void;
  /** Timer fallback in ms (default `DELTA_FLUSH_FALLBACK_MS`). */
  fallbackMs?: number;
}

export interface DeltaBatcher<K = unknown> {
  /**
   * Queue `entry` when it is one delta (returns true). Anything else is NOT
   * queued and returns false: the caller flushes and applies it itself.
   */
  push(entry: ChatStreamEntry, key?: K): boolean;
  /** Synchronously apply the pending batch and cancel any scheduled flush. */
  flush(): void;
  /** Flush and release timers: call on teardown so tail deltas aren't lost. */
  dispose(): void;
  /** Queued (post-coalescing) delta count. Test/diagnostic surface. */
  readonly pendingCount: number;
}

export function createDeltaBatcher<K = unknown>({
  applyOne,
  onFlushed,
  fallbackMs = DELTA_FLUSH_FALLBACK_MS,
}: CreateDeltaBatcherOptions<K>): DeltaBatcher<K> {
  let pending: DeltaEntry[] = [];
  let pendingKey: K | undefined;
  let hasKey = false;
  let raf: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancelScheduled(): void {
    if (raf !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = null;
    }
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function flush(): void {
    cancelScheduled();
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    const key = pendingKey;
    for (const delta of batch) applyOne(delta, key);
    onFlushed?.(batch.length);
  }

  function schedule(): void {
    if (raf !== null || timer !== null) return;
    if (typeof requestAnimationFrame === 'function') {
      raf = requestAnimationFrame(() => {
        raf = null;
        flush();
      });
    }
    // Timer fallback ALWAYS armed: rAF pauses in background tabs.
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, fallbackMs);
  }

  return {
    push(entry, key) {
      // A pending batch belonging to a previous key must land on ITS reducer
      // before we start queueing for the new one.
      if (!hasKey || !Object.is(pendingKey, key)) {
        flush();
        pendingKey = key;
        hasKey = true;
      }
      if (!isDeltaEntry(entry)) return false;
      const tail = pending[pending.length - 1];
      // NEVER coalesce a delta whose seq does not ADVANCE past the tail's.
      // Coalescing stamps the merged entry with the LAST pushed seq, so a
      // redelivered / out-of-order delta arriving inside one frame would both
      // concatenate its text (the reducer never sees it as a duplicate) and
      // REWIND the batch's seq below an already-applied one. Pushing it as its
      // own entry hands it to the reducer intact, where the `seq <=
      // lastAppliedSeq` gate drops it: the batcher must not depend on hosts
      // gating at dispatch.
      // A seq-LESS tail is not "always advancing": merging a seq-BEARING delta
      // onto it stamps the merged entry with that seq, which the reducer's gate
      // then treats as the batch's position, and a redelivered delta could rewind
      // it. Coalesce onto a seq-less tail only when the incoming delta is
      // likewise seq-less (a uniformly seq-less stream, e.g. the hub's).
      const seqAdvances = tail?.seq == null ? entry.seq == null : entry.seq != null && entry.seq > tail.seq;
      const [delta] = entry.chunks;
      if (tail && seqAdvances && tail.chunks[0].type === delta.type && tail.chunks[0].id === delta.id) {
        pending[pending.length - 1] = {
          ...tail,
          chunks: [{ ...tail.chunks[0], delta: tail.chunks[0].delta + delta.delta }],
          ...(entry.seq != null ? { seq: entry.seq } : {}),
        };
      } else {
        pending.push({ ...entry });
      }
      schedule();
      return true;
    },
    flush,
    dispose() {
      flush();
      cancelScheduled();
    },
    get pendingCount() {
      return pending.length;
    },
  };
}
