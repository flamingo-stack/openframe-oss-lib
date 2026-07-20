'use client'

/**
 * useChatStreamReducer — thin React wrapper over a `ChatDialogStore` side.
 *
 *   - `useSyncExternalStore` over the store (snapshot identity is stable
 *     between mutations, so untouched renders bail out);
 *   - APPEND-ONLY DELTA BATCHING: text-delta AND thinking-delta events are
 *     coalesced and applied ~once per animation frame, with a timer-based
 *     ≤50ms fallback (rAF pauses in background tabs). Anthropic emits 30-60
 *     deltas/sec; batching to ~UI rate avoids a re-render storm without a
 *     transport-side throttle.
 *   - Any NON-delta event force-flushes the pending batch first, so ordering
 *     is preserved and stream completion (`turn-end`, errors, approval
 *     frames) always lands on fully-applied delta state. Adapters whose
 *     transport has no terminal event (SSE) call `flushDeltas()` explicitly
 *     before their end-of-turn command.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { ChatStreamEvent, TextDeltaEvent, ThinkingDeltaEvent } from '../../../chat-protocol/events'
import {
  DEFAULT_DIALOG_SIDE,
  type ChatDialogSide,
  type ChatDialogStore,
} from './chat-dialog-store'
import type {
  ChatReducerState,
  ChatStreamReducer,
  ChatStreamReducerOptions,
} from './chat-stream-reducer'

const DELTA_FLUSH_FALLBACK_MS = 50

type DeltaEvent = TextDeltaEvent | ThinkingDeltaEvent

function isDeltaEvent(event: ChatStreamEvent): event is DeltaEvent {
  return event.type === 'text-delta' || event.type === 'thinking-delta'
}

export interface UseChatStreamReducerOptions {
  store: ChatDialogStore
  dialogId: string
  side?: ChatDialogSide
  /** Consulted once, when this (dialogId, side) reducer is first created. */
  createReducerOptions?: () => ChatStreamReducerOptions
}

export interface UseChatStreamReducerReturn {
  state: ChatReducerState
  /** Apply a decoded event (deltas are batched; everything else immediate). */
  applyEvent: (event: ChatStreamEvent) => void
  /** Synchronously apply any pending delta batch. */
  flushDeltas: () => void
  /** Run reducer commands (adapter-driven, non-wire mutations). */
  mutate: <T>(fn: (reducer: ChatStreamReducer) => T) => T
  reducer: ChatStreamReducer
}

export function useChatStreamReducer({
  store,
  dialogId,
  side = DEFAULT_DIALOG_SIDE,
  createReducerOptions,
}: UseChatStreamReducerOptions): UseChatStreamReducerReturn {
  const optionsRef = useRef(createReducerOptions)
  optionsRef.current = createReducerOptions

  // Ensure the reducer exists before the first snapshot read.
  const reducer = store.getReducer(dialogId, side, () => optionsRef.current?.() ?? {})

  const getSnapshot = useCallback(() => store.getSnapshot(dialogId, side), [store, dialogId, side])
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // ── Delta batch ──────────────────────────────────────────────────────────
  const pendingRef = useRef<DeltaEvent[]>([])
  const pendingKeyRef = useRef<{ dialogId: string; side: ChatDialogSide }>({ dialogId, side })
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushDeltas = useCallback(() => {
    if (rafRef.current !== null) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    if (pending.length === 0) return
    pendingRef.current = []
    const key = pendingKeyRef.current
    for (const delta of pending) {
      store.apply(key.dialogId, key.side, delta)
    }
  }, [store])

  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null || timerRef.current !== null) return
    if (typeof requestAnimationFrame === 'function') {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        flushDeltas()
      })
    }
    // Timer fallback ALWAYS armed: rAF pauses in background tabs, and a
    // hidden chat panel must still keep its thread current.
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      flushDeltas()
    }, DELTA_FLUSH_FALLBACK_MS)
  }, [flushDeltas])

  const applyEvent = useCallback(
    (event: ChatStreamEvent) => {
      // A pending batch belonging to a previous (dialogId, side) must land
      // on ITS reducer before we start queueing for the new one.
      if (
        pendingKeyRef.current.dialogId !== dialogId ||
        pendingKeyRef.current.side !== side
      ) {
        flushDeltas()
        pendingKeyRef.current = { dialogId, side }
      }
      if (isDeltaEvent(event)) {
        const pending = pendingRef.current
        const tail = pending[pending.length - 1]
        // Coalesce consecutive same-type (and same-leading) deltas — the
        // reducer's append semantics distribute over concatenation.
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
        scheduleFlush()
        return
      }
      // Non-delta events flush the batch first (ordering), then apply
      // synchronously — completion state always lands on flushed deltas.
      flushDeltas()
      store.apply(dialogId, side, event)
    },
    [store, dialogId, side, flushDeltas, scheduleFlush],
  )

  // Flush on unmount so a torn-down panel doesn't drop its tail deltas.
  useEffect(() => flushDeltas, [flushDeltas])

  const mutate = useCallback(
    <T,>(fn: (reducer: ChatStreamReducer) => T): T => store.mutate(dialogId, side, fn),
    [store, dialogId, side],
  )

  return useMemo(
    () => ({ state, applyEvent, flushDeltas, mutate, reducer }),
    [state, applyEvent, flushDeltas, mutate, reducer],
  )
}
