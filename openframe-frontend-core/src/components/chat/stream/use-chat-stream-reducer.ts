'use client';

/**
 * useChatStreamReducer — thin React wrapper over a `ChatDialogStore` side.
 *
 *   - `useSyncExternalStore` over the store (snapshot identity is stable
 *     between mutations, so untouched renders bail out);
 *   - APPEND-ONLY DELTA BATCHING: delegated wholesale to the framework-free
 *     `createDeltaBatcher` (same module) so a non-React host can share the
 *     exact same coalescing/flush policy instead of re-implementing it.
 *   - Any NON-delta event force-flushes the pending batch first, so ordering
 *     is preserved and stream completion (`turn-end`, errors, approval
 *     frames) always lands on fully-applied delta state. Adapters whose
 *     transport has no terminal event (SSE) call `flushDeltas()` explicitly
 *     before their end-of-turn command.
 */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ChatStreamEvent } from '../../../chat-protocol/events';
import { DEFAULT_DIALOG_SIDE, type ChatDialogSide, type ChatDialogStore } from './chat-dialog-store';
import type { ChatReducerState, ChatStreamReducer, ChatStreamReducerOptions } from './chat-stream-reducer';
import { createDeltaBatcher, type DeltaBatcher } from './delta-batcher';

interface DialogKey {
  store: ChatDialogStore;
  dialogId: string;
  side: ChatDialogSide;
}

export interface UseChatStreamReducerOptions {
  store: ChatDialogStore;
  dialogId: string;
  side?: ChatDialogSide;
  /** Consulted once, when this (dialogId, side) reducer is first created. */
  createReducerOptions?: () => ChatStreamReducerOptions;
}

export interface UseChatStreamReducerReturn {
  state: ChatReducerState;
  /** Apply a decoded event (deltas are batched; everything else immediate). */
  applyEvent: (event: ChatStreamEvent) => void;
  /** Synchronously apply any pending delta batch. */
  flushDeltas: () => void;
  /** Run reducer commands (adapter-driven, non-wire mutations). */
  mutate: <T>(fn: (reducer: ChatStreamReducer) => T) => T;
  reducer: ChatStreamReducer;
}

export function useChatStreamReducer({
  store,
  dialogId,
  side = DEFAULT_DIALOG_SIDE,
  createReducerOptions,
}: UseChatStreamReducerOptions): UseChatStreamReducerReturn {
  // Ensure the reducer exists before the first snapshot read. `createOptions`
  // is consulted synchronously inside this call and only when the instance is
  // first created, so the prop is read directly — a latest-ref would be
  // indirection with nothing to stabilise.
  const reducer = store.getReducer(dialogId, side, () => createReducerOptions?.() ?? {});

  const getSnapshot = useCallback(() => store.getSnapshot(dialogId, side), [store, dialogId, side]);
  // Distinct server getter: `getSnapshot` is a pure read of a CLIENT-lived
  // map, so reusing it for SSR would render a per-request-meaningless value
  // (and, before it was made pure, silently accumulate reducers per request).
  const getServerSnapshot = useCallback(() => store.getServerSnapshot(), [store]);
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Pin this key for as long as the hook is mounted, so the store's LRU can
  // never evict a reducer a live panel is rendering.
  useEffect(() => store.retain(dialogId, side), [store, dialogId, side]);

  // ── Delta batch ──────────────────────────────────────────────────────────
  // Identity-stable routing token: the batcher compares keys with `Object.is`
  // and flushes the pending batch against the PREVIOUS key when it changes, so
  // this must only get a new identity when the routing VALUES change. The
  // store travels in the key rather than in a latest-ref because it is part of
  // that routing decision: queued deltas belong to the store they were queued
  // for, and a mid-turn store swap must flush them there, not re-target them.
  const key = useMemo<DialogKey>(() => ({ store, dialogId, side }), [store, dialogId, side]);

  // Created once and owned for the hook's lifetime; `useState`'s lazy
  // initialiser is the supported way to build that without writing to a ref
  // during render.
  const [batcher] = useState<DeltaBatcher<DialogKey>>(() =>
    createDeltaBatcher<DialogKey>({
      applyOne: (event, k) => {
        if (k) k.store.apply(k.dialogId, k.side, event);
      },
    }),
  );

  const flushDeltas = useCallback(() => batcher.flush(), [batcher]);

  const applyEvent = useCallback(
    (event: ChatStreamEvent) => {
      // `push` flushes on key change and returns false for non-delta events;
      // those flush the batch first (ordering) and apply synchronously, so
      // completion state always lands on fully-applied deltas.
      if (batcher.push(event, key)) return;
      batcher.flush();
      key.store.apply(key.dialogId, key.side, event);
    },
    [batcher, key],
  );

  // Flush on unmount so a torn-down panel doesn't drop its tail deltas.
  useEffect(() => () => batcher.dispose(), [batcher]);

  const mutate = useCallback(
    <T>(fn: (reducer: ChatStreamReducer) => T): T => store.mutate(dialogId, side, fn),
    [store, dialogId, side],
  );

  return useMemo(
    () => ({ state, applyEvent, flushDeltas, mutate, reducer }),
    [state, applyEvent, flushDeltas, mutate, reducer],
  );
}
