'use client'

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

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { ChatStreamEvent } from '../../../chat-protocol/events'
import {
  DEFAULT_DIALOG_SIDE,
  type ChatDialogSide,
  type ChatDialogStore,
} from './chat-dialog-store'
import { createDeltaBatcher, type DeltaBatcher } from './delta-batcher'
import type {
  ChatReducerState,
  ChatStreamReducer,
  ChatStreamReducerOptions,
} from './chat-stream-reducer'

interface DialogKey {
  dialogId: string
  side: ChatDialogSide
}

/** QueryClient when a provider is mounted, null otherwise. The chat shell
 *  does not REQUIRE react-query (a provider-less embedder can still chat) —
 *  but when cards are in play a provider is always present (their
 *  `useChatCardItem` hard-depends on it), so mutation invalidation works
 *  exactly where it matters. Unconditional hook call → order-stable. */
function useOptionalQueryClient(): QueryClient | null {
  try {
    return useQueryClient()
  } catch {
    return null
  }
}

/** A confirmed tool action mutated this entity — mark every cached card
 *  row for that id stale so receipt cards (and any earlier card of the
 *  same entity in the transcript) refetch the post-mutation state.
 *  Without this, `useChatCardItem`'s 5-min staleTime serves the
 *  PRE-mutation row: observed live 2026-08-18 as a "NEW" badge on a
 *  ticket the receipt itself said was just CLOSED. */
function invalidateMutatedEntityCards(queryClient: QueryClient | null, event: ChatStreamEvent): void {
  if (!queryClient) return
  if (event.type !== 'approval-resolved' || event.status !== 'approved') return
  const mutatedId = (event.result as { ticket_id?: string } | undefined)?.ticket_id
  if (!mutatedId) return
  void queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === 'chat-card-item' && q.queryKey[2] === mutatedId,
  })
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
  // Distinct server getter: `getSnapshot` is a pure read of a CLIENT-lived
  // map, so reusing it for SSR would render a per-request-meaningless value
  // (and, before it was made pure, silently accumulate reducers per request).
  const getServerSnapshot = useCallback(() => store.getServerSnapshot(), [store])
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Pin this key for as long as the hook is mounted, so the store's LRU can
  // never evict a reducer a live panel is rendering.
  useEffect(() => store.retain(dialogId, side), [store, dialogId, side])

  // ── Delta batch ──────────────────────────────────────────────────────────
  // Identity-stable key object: the batcher compares keys with `Object.is`,
  // so it must only change when the (dialogId, side) VALUES change.
  const keyRef = useRef<DialogKey>({ dialogId, side })
  if (keyRef.current.dialogId !== dialogId || keyRef.current.side !== side) {
    keyRef.current = { dialogId, side }
  }
  const storeRef = useRef(store)
  storeRef.current = store

  const batcherRef = useRef<DeltaBatcher<DialogKey> | null>(null)
  if (batcherRef.current === null) {
    batcherRef.current = createDeltaBatcher<DialogKey>({
      applyOne: (event, key) => {
        if (key) storeRef.current.apply(key.dialogId, key.side, event)
      },
    })
  }
  const batcher = batcherRef.current

  const flushDeltas = useCallback(() => batcher.flush(), [batcher])

  const queryClient = useOptionalQueryClient()
  const applyEvent = useCallback(
    (event: ChatStreamEvent) => {
      // `push` flushes on key change and returns false for non-delta events;
      // those flush the batch first (ordering) and apply synchronously, so
      // completion state always lands on fully-applied deltas.
      if (batcher.push(event, keyRef.current)) return
      batcher.flush()
      store.apply(dialogId, side, event)
      // Post-apply side effect: an approved tool action invalidates the
      // mutated entity's cached card rows (see helper above). Runs at the
      // applyEvent boundary so BOTH transports (SSE + NATS) get it.
      invalidateMutatedEntityCards(queryClient, event)
    },
    [batcher, store, dialogId, side, queryClient],
  )

  // Flush on unmount so a torn-down panel doesn't drop its tail deltas.
  useEffect(() => () => batcher.dispose(), [batcher])

  const mutate = useCallback(
    <T,>(fn: (reducer: ChatStreamReducer) => T): T => store.mutate(dialogId, side, fn),
    [store, dialogId, side],
  )

  return useMemo(
    () => ({ state, applyEvent, flushDeltas, mutate, reducer }),
    [state, applyEvent, flushDeltas, mutate, reducer],
  )
}
