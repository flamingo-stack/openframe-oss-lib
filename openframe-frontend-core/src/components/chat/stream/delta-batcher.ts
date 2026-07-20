/**
 * createDeltaBatcher — framework-free, append-only batching of `text-delta`
 * and `thinking-delta` events.
 *
 * WHY THIS IS SHARED (and not a hook-private detail): every host that drives a
 * `ChatStreamReducer` from a raw transport needs the SAME batching, and a
 * copy-paste of it drifts. The React wrapper (`useChatStreamReducer`) and any
 * non-React mirror in a product app both consume this one implementation.
 *
 * Behaviour:
 *   - `push(event, key)` queues delta events and returns true; anything else
 *     returns false so the caller can flush + apply it synchronously (ordering:
 *     completion state must always land on fully-applied deltas).
 *   - CONSECUTIVE same-type deltas are COALESCED into one event (the reducer's
 *     append semantics distribute over concatenation), so a 60-delta/sec turn
 *     costs ONE `applyOne` per frame instead of 60. `text-delta` additionally
 *     requires a matching `leading` flag before coalescing.
 *   - A flush is scheduled on `requestAnimationFrame` when available, with a
 *     timer fallback that is ALWAYS armed (rAF pauses in background tabs, and a
 *     hidden chat panel must still keep its thread current).
 *   - `key` is an opaque routing token handed back to `applyOne`. When it
 *     changes, the pending batch is flushed against the PREVIOUS key first, so
 *     deltas never land on the wrong dialog/side.
 */

import type { ChatStreamEvent, TextDeltaEvent, ThinkingDeltaEvent } from '../../../chat-protocol/events'

export const DELTA_FLUSH_FALLBACK_MS = 50

export type DeltaEvent = TextDeltaEvent | ThinkingDeltaEvent

export function isDeltaEvent(event: ChatStreamEvent): event is DeltaEvent {
  return event.type === 'text-delta' || event.type === 'thinking-delta'
}

export interface CreateDeltaBatcherOptions<K> {
  /** Apply one (possibly coalesced) delta against `key`'s reducer. */
  applyOne: (event: DeltaEvent, key: K | undefined) => void
  /** Called after a flush that applied at least one delta. */
  onFlushed?: (appliedCount: number) => void
  /** Timer fallback in ms (default `DELTA_FLUSH_FALLBACK_MS`). */
  fallbackMs?: number
}

export interface DeltaBatcher<K = unknown> {
  /**
   * Queue `event` when it is a delta (returns true). Non-delta events are NOT
   * queued and return false — the caller flushes and applies them itself.
   */
  push(event: ChatStreamEvent, key?: K): boolean
  /** Synchronously apply the pending batch and cancel any scheduled flush. */
  flush(): void
  /** Flush and release timers — call on teardown so tail deltas aren't lost. */
  dispose(): void
  /** Queued (post-coalescing) delta count. Test/diagnostic surface. */
  readonly pendingCount: number
}

export function createDeltaBatcher<K = unknown>({
  applyOne,
  onFlushed,
  fallbackMs = DELTA_FLUSH_FALLBACK_MS,
}: CreateDeltaBatcherOptions<K>): DeltaBatcher<K> {
  let pending: DeltaEvent[] = []
  let pendingKey: K | undefined
  let hasKey = false
  let raf: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancelScheduled(): void {
    if (raf !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf)
      raf = null
    }
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function flush(): void {
    cancelScheduled()
    if (pending.length === 0) return
    const batch = pending
    pending = []
    const key = pendingKey
    for (const delta of batch) applyOne(delta, key)
    onFlushed?.(batch.length)
  }

  function schedule(): void {
    if (raf !== null || timer !== null) return
    if (typeof requestAnimationFrame === 'function') {
      raf = requestAnimationFrame(() => {
        raf = null
        flush()
      })
    }
    // Timer fallback ALWAYS armed: rAF pauses in background tabs.
    timer = setTimeout(() => {
      timer = null
      flush()
    }, fallbackMs)
  }

  return {
    push(event, key) {
      // A pending batch belonging to a previous key must land on ITS reducer
      // before we start queueing for the new one.
      if (!hasKey || !Object.is(pendingKey, key)) {
        flush()
        pendingKey = key
        hasKey = true
      }
      if (!isDeltaEvent(event)) return false
      const tail = pending[pending.length - 1]
      if (
        tail &&
        tail.type === event.type &&
        (tail.type !== 'text-delta' ||
          (tail as TextDeltaEvent).leading === (event as TextDeltaEvent).leading)
      ) {
        pending[pending.length - 1] = {
          ...tail,
          text: tail.text + event.text,
          ...(event.seq != null ? { seq: event.seq } : {}),
        } as DeltaEvent
      } else {
        pending.push({ ...event })
      }
      schedule()
      return true
    },
    flush,
    dispose() {
      flush()
      cancelScheduled()
    },
    get pendingCount() {
      return pending.length
    },
  }
}
