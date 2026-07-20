/**
 * createChatDialogStore — framework-free registry of `ChatStreamReducer`
 * instances keyed by `(dialogId, side)`. Reducer state PERSISTS across
 * component unmounts (the store outlives React), and the store is the
 * `useSyncExternalStore` source for the `useChatStreamReducer` wrapper.
 *
 * CROSS-SIDE PROJECTION: exactly two operations fan out across sides of the
 * same dialogId —
 *   1. approval RESOLUTION by requestId (`approval-resolved` events), and
 *   2. tool-execution MERGE by execId (`tool-execution` events)
 * — implemented as idempotent pure projections over the other side's state
 * (recomputed from state, never re-injected into the other side's seq
 * stream; per-side seq gates stay untouched). Everything else — text,
 * thinking, participant rows — is strictly per-side.
 *
 * LIFECYCLE / MEMORY: the reducer map is LRU-capped (`maxReducers`, default
 * `DEFAULT_MAX_REDUCERS`) and evicted through the same path as `remove()`.
 * Without a cap an agent cycling hundreds of dialogs would retain a reducer
 * (thread + accumulator) per dialog for the process's lifetime; under SSR,
 * where the store is module-scoped, that growth is shared across every
 * request. `getSnapshot` is PURE — it never creates an entry — and
 * `getServerSnapshot` always returns the shared frozen `EMPTY_STATE`.
 */

import {
  createChatStreamReducer,
  type ChatReducerState,
  type ChatStreamReducer,
  type ChatStreamReducerOptions,
} from './chat-stream-reducer'
import type { ChatStreamEvent } from '../../../chat-protocol/events'

export type ChatDialogSide = string

export interface ChatDialogStore {
  /** Create-or-get the reducer for `(dialogId, side)`. `createOptions` is
   *  consulted ONLY when the instance is first created. */
  getReducer(
    dialogId: string,
    side?: ChatDialogSide,
    createOptions?: () => ChatStreamReducerOptions,
  ): ChatStreamReducer
  /** Apply one event to a side, then fan out the cross-side projections to
   *  the other sides of the same dialog. */
  apply(dialogId: string, side: ChatDialogSide, event: ChatStreamEvent): void
  /** Run adapter commands against a reducer; subscribers are notified. */
  mutate<T>(dialogId: string, side: ChatDialogSide, fn: (reducer: ChatStreamReducer) => T): T
  subscribe(listener: () => void): () => void
  /**
   * Referentially-stable snapshot for `useSyncExternalStore`. PURE — an
   * unknown key returns the shared frozen `EMPTY_STATE` rather than
   * creating a reducer (a create-on-read would let SSR renders accumulate
   * reducers in a process-global map, and would make React's snapshot read
   * a mutation).
   */
  getSnapshot(dialogId: string, side?: ChatDialogSide): ChatReducerState
  /** `useSyncExternalStore`'s server getter — always `EMPTY_STATE`. There is
   *  no per-request store on the server, so a live thread cannot be rendered
   *  server-side; the client hydrates from the real reducer. */
  getServerSnapshot(): ChatReducerState
  /** Drop a side's reducer (or every side of the dialog when omitted). */
  remove(dialogId: string, side?: ChatDialogSide): void
}

export const DEFAULT_DIALOG_SIDE: ChatDialogSide = 'main'

/** Most-recently-used reducer keys retained before eviction. Ten covers
 *  every realistic multi-panel / dialog-switching session while bounding an
 *  agent that cycles hundreds of dialogs. */
export const DEFAULT_MAX_REDUCERS = 10

export interface CreateChatDialogStoreOptions {
  /** LRU cap on retained reducers (keys are `(dialogId, side)` pairs).
   *  Values < 1 are clamped to 1. Default `DEFAULT_MAX_REDUCERS`. */
  maxReducers?: number
}

/** Shared, frozen "no reducer for this key" snapshot. ONE instance, so
 *  repeated `getSnapshot` reads of an absent key are referentially stable
 *  for `useSyncExternalStore`. */
const EMPTY_STATE: ChatReducerState = Object.freeze({
  messages: Object.freeze([]) as unknown as ChatReducerState['messages'],
  streamingPhase: 'idle',
  turnMeta: Object.freeze({
    meta: new Map(),
    sources: new Map(),
    refs: new Map(),
    sendCount: 0,
  }) as ChatReducerState['turnMeta'],
  dialogTokenUsage: null,
  liveModel: null,
  approvalStatuses: Object.freeze({}) as ChatReducerState['approvalStatuses'],
}) as ChatReducerState

const KEY_SEP = '\u0000'
const keyOf = (dialogId: string, side: ChatDialogSide) => `${dialogId}${KEY_SEP}${side}`

export function createChatDialogStore(
  options: CreateChatDialogStoreOptions = {},
): ChatDialogStore {
  const maxReducers = Math.max(1, options.maxReducers ?? DEFAULT_MAX_REDUCERS)
  // Insertion order IS the LRU order: `touch` re-inserts at the tail, so the
  // FIRST key is always the least-recently-used one.
  const reducers = new Map<string, ChatStreamReducer>()
  const listeners = new Set<() => void>()

  function notify(): void {
    for (const listener of listeners) listener()
  }

  /** Mark `key` most-recently-used. */
  function touch(key: string): void {
    const reducer = reducers.get(key)
    if (reducer === undefined) return
    reducers.delete(key)
    reducers.set(key, reducer)
  }

  /** Evict least-recently-used keys down to the cap, through the same drop
   *  path as `remove()`. Returns true when anything was evicted. */
  function evictExcess(): boolean {
    let evicted = false
    while (reducers.size > maxReducers) {
      const oldest = reducers.keys().next()
      if (oldest.done) break
      reducers.delete(oldest.value)
      evicted = true
    }
    return evicted
  }

  function getReducer(
    dialogId: string,
    side: ChatDialogSide = DEFAULT_DIALOG_SIDE,
    createOptions?: () => ChatStreamReducerOptions,
  ): ChatStreamReducer {
    const key = keyOf(dialogId, side)
    let reducer = reducers.get(key)
    if (!reducer) {
      const base = createOptions?.() ?? {}
      const userOnChange = base.onChange
      reducer = createChatStreamReducer({
        ...base,
        onChange: () => {
          userOnChange?.()
          notify()
        },
      })
      reducers.set(key, reducer)
      if (evictExcess()) notify()
    } else {
      touch(key)
    }
    return reducer
  }

  function otherSides(dialogId: string, side: ChatDialogSide): ChatStreamReducer[] {
    const prefix = `${dialogId}${KEY_SEP}`
    const selfKey = keyOf(dialogId, side)
    const out: ChatStreamReducer[] = []
    for (const [key, reducer] of reducers) {
      if (key !== selfKey && key.startsWith(prefix)) out.push(reducer)
    }
    return out
  }

  function apply(dialogId: string, side: ChatDialogSide, event: ChatStreamEvent): void {
    const reducer = getReducer(dialogId, side)
    reducer.apply(event)

    // Cross-side fan-out — the ONLY two operations that cross sides.
    if (event.type === 'approval-resolved' && event.requestId) {
      for (const other of otherSides(dialogId, side)) {
        other.projectApprovalResolution(event.requestId, event.status, event.resolvedByName)
      }
    } else if (event.type === 'tool-execution') {
      for (const other of otherSides(dialogId, side)) {
        other.projectToolExecution({ type: 'tool_execution', data: event.data })
      }
    }
  }

  function mutate<T>(
    dialogId: string,
    side: ChatDialogSide,
    fn: (reducer: ChatStreamReducer) => T,
  ): T {
    return fn(getReducer(dialogId, side))
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  /** PURE read — deliberately does NOT go through `getReducer`, which would
   *  insert into the module-lived map on every miss (unbounded growth under
   *  SSR) and make a React snapshot read mutate the store. Callers that need
   *  a reducer to exist call `getReducer` explicitly first (the
   *  `useChatStreamReducer` hook does exactly that, during render). */
  function getSnapshot(
    dialogId: string,
    side: ChatDialogSide = DEFAULT_DIALOG_SIDE,
  ): ChatReducerState {
    return reducers.get(keyOf(dialogId, side))?.state ?? EMPTY_STATE
  }

  function getServerSnapshot(): ChatReducerState {
    return EMPTY_STATE
  }

  function remove(dialogId: string, side?: ChatDialogSide): void {
    if (side !== undefined) {
      reducers.delete(keyOf(dialogId, side))
    } else {
      const prefix = `${dialogId}${KEY_SEP}`
      for (const key of [...reducers.keys()]) {
        if (key.startsWith(prefix)) reducers.delete(key)
      }
    }
    notify()
  }

  return {
    getReducer,
    apply,
    mutate,
    subscribe,
    getSnapshot,
    getServerSnapshot,
    remove,
  }
}
