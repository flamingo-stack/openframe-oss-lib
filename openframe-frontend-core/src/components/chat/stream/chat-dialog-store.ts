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
 *
 * EVICTION SAFETY (LRU recency alone is NOT liveness):
 *   1. RETAINED keys are never evicted. `retain(dialogId, side)` returns a
 *      release fn; the `useChatStreamReducer` hook calls it for as long as it
 *      is mounted, so a quiet-but-visible panel can't be dropped just because
 *      ten other keys were touched. NON-React hosts must call it too.
 *   2. A reducer whose `streamingPhase !== 'idle'` is never evicted — dropping
 *      mid-turn would recreate an EMPTY reducer on the next `getReducer`
 *      while the host's seq cursor still says "caught up", i.e. the thread
 *      visually vanishes with no path back.
 *   3. Eviction hands the host the dropped instance's PARKED state
 *      (`onEvict(..., { messages, approvalStatuses, lastAppliedSeq,
 *      pendingEchoes })`). A recreated reducer is pristine, so re-seeding
 *      messages alone would
 *      resurrect resolved approvals as actionable and reset the seq gate to
 *      `-Infinity`; the parked payload is what makes the round-trip lossless.
 *   4. Eviction NEVER notifies synchronously. `getReducer` is called during
 *      render (by the hook), and notifying there means updating other
 *      components mid-render. The notify is deferred to a microtask.
 */

import {
  createChatStreamReducer,
  type ChatReducerState,
  type ChatStreamReducer,
  type ChatStreamReducerOptions,
  type PendingEcho,
} from './chat-stream-reducer'
import type { ChatStreamEvent } from '../../../chat-protocol/events'

export type ChatDialogSide = string

/** Factory for a key's reducer options, consulted ONCE at creation. A plain
 *  `() => options` thunk remains assignable. */
export type CreateReducerOptionsFn = (
  dialogId: string,
  side: ChatDialogSide,
) => ChatStreamReducerOptions

export interface ChatDialogStore {
  /** Create-or-get the reducer for `(dialogId, side)`. `createOptions` is
   *  consulted ONLY when the instance is first created. */
  getReducer(
    dialogId: string,
    side?: ChatDialogSide,
    createOptions?: CreateReducerOptionsFn,
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
  /**
   * PIN `(dialogId, side)` against LRU eviction while a consumer is live.
   * Returns the release fn (idempotent; refcounted, so nested retains are
   * safe). Creation is NOT implied — retaining an absent key simply means the
   * key is protected once it exists.
   */
  retain(dialogId: string, side?: ChatDialogSide): () => void
  /**
   * POLICY retain: keep exactly `keys` pinned by this store-level set and
   * release every key the set previously pinned. Independent of the refcounted
   * `retain()` handles a host's components hold — the two compose.
   *
   * Exists because "retain this set, release the rest" is generic store
   * policy that every multi-panel host otherwise re-derives (diffing its own
   * key list against a map of release fns). Retains BEFORE releasing, so a key
   * present in both the old and the new set never momentarily drops to zero
   * retains and becomes evictable mid-swap.
   */
  setRetained(keys: Array<{ dialogId: string; side?: ChatDialogSide }>): void
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
  /**
   * Options applied to any reducer this store creates WITHOUT an explicit
   * per-call `createOptions` — i.e. every reducer first materialized by
   * `apply()` or `mutate()`. Hosts with non-default reducer semantics
   * (`ownEchoIncludesAdmin`, `selfUserId`, approve/reject `callbacks`, …)
   * MUST set this: creation options are consulted once, so a bare
   * apply-created instance would keep those semantics missing for its whole
   * lifetime, including for a later `getReducer(..., options)` caller.
   */
  defaultCreateOptions?: CreateReducerOptionsFn
  /**
   * Called when LRU eviction actually DROPS a key. The store knows this
   * exactly; without publishing it, hosts are left inferring eviction by
   * comparing reducer OBJECT IDENTITY across `getReducer` calls and then
   * suppressing the "pristine empty" snapshot that a silently-recreated
   * reducer returns — archaeology about a fact this callback states outright.
   *
   * Fires only for LRU eviction. Host-initiated `remove()` needs no
   * notification: the caller already knows which key it dropped.
   *
   * Called AFTER the key is gone, from `getReducer` (i.e. potentially during a
   * React render) — treat it as a "schedule a refetch/rehydrate" signal, not a
   * place to set state synchronously.
   *
   * `parked` carries the dropped reducer's non-refetchable state so the host
   * can restore it on the recreated instance (`initializeWithState(messages,
   * { approvalStatuses, lastAppliedSeq, pendingEchoes })`). Refetching
   * messages alone is NOT
   * equivalent: a recreated reducer starts with `approvalStatuses = {}` and
   * `lastAppliedSeq = -Infinity`, so a resolved approval whose APPROVAL_RESULT
   * row is not in the refetched history page re-renders as ACTIONABLE (the
   * exact hazard `resetForDialogSwitch` preserves that map to avoid), and a
   * replay from the host's own cursor re-applies events the dropped instance
   * had already consumed.
   */
  onEvict?: (
    dialogId: string,
    side: ChatDialogSide,
    parked: EvictedReducerState,
  ) => void
}

/**
 * Snapshot of an LRU-evicted reducer's state, captured just before the
 * instance is dropped. Everything here either cannot be refetched
 * (`lastAppliedSeq`) or is not reliably present in a refetched history page
 * (`approvalStatuses`); `messages` rides along so a host that keeps its own
 * copy does not have to.
 */
export interface EvictedReducerState {
  messages: ChatReducerState['messages']
  approvalStatuses: ChatReducerState['approvalStatuses']
  /** `-Infinity` when the instance never applied a seq-carrying event. */
  lastAppliedSeq: number
  /**
   * Optimistic-echo entries still armed at eviction time. A key dropped
   * between `pushOptimisticSend` and its `MESSAGE_REQUEST` echo would
   * otherwise leave the recreated reducer with nothing armed, and the echo
   * renders a DUPLICATE user bubble. Replay via
   * `initializeWithState(messages, { pendingEchoes })`; the reducer drops
   * entries already past `OWN_ECHO_AUTHOR_TTL_MS`. Empty for a key with no
   * send in flight (the common case).
   */
  pendingEchoes: readonly PendingEcho[]
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

/** Shared frozen empty list for a key with no send in flight. */
const EMPTY_PENDING_ECHOES: readonly PendingEcho[] = Object.freeze([])

const KEY_SEP = '\u0000'
const keyOf = (dialogId: string, side: ChatDialogSide) => `${dialogId}${KEY_SEP}${side}`

export function createChatDialogStore(
  options: CreateChatDialogStoreOptions = {},
): ChatDialogStore {
  const maxReducers = Math.max(1, options.maxReducers ?? DEFAULT_MAX_REDUCERS)
  const defaultCreateOptions = options.defaultCreateOptions
  const onEvict = options.onEvict
  // Insertion order IS the LRU order: `touch` re-inserts at the tail, so the
  // FIRST key is always the least-recently-used one.
  const reducers = new Map<string, ChatStreamReducer>()
  const listeners = new Set<() => void>()
  /** key → live retain count (see EVICTION SAFETY #1). */
  const retained = new Map<string, number>()

  function notify(): void {
    for (const listener of listeners) listener()
  }

  /** Notify OUTSIDE the current task — `getReducer` (and therefore eviction)
   *  runs during React's render phase. See EVICTION SAFETY #4. */
  function notifyDeferred(): void {
    if (typeof queueMicrotask === 'function') queueMicrotask(notify)
    else Promise.resolve().then(notify)
  }

  /** Mark `key` most-recently-used. */
  function touch(key: string): void {
    const reducer = reducers.get(key)
    if (reducer === undefined) return
    reducers.delete(key)
    reducers.set(key, reducer)
  }

  /** A key is evictable only when nothing pins it and its turn is finished. */
  function isEvictable(key: string): boolean {
    if ((retained.get(key) ?? 0) > 0) return false
    const reducer = reducers.get(key)
    return reducer === undefined || reducer.state.streamingPhase === 'idle'
  }

  /** Evict least-recently-used EVICTABLE keys down to the cap, through the
   *  same drop path as `remove()`. Protected keys (retained / mid-stream) are
   *  skipped, so the map can legitimately sit above `maxReducers` for as long
   *  as that many live threads exist. Returns true when anything was
   *  evicted.
   *
   *  `protectKey` is the key `getReducer` JUST inserted. It is unretained (the
   *  hook retains in an effect, i.e. after render) and idle, so without this
   *  guard a full map of protected older keys would walk the loop all the way
   *  to the tail and drop the brand-new entry — `getReducer` would return a
   *  DETACHED reducer whose mutations no snapshot can ever see (`getSnapshot`
   *  is a pure map read, so that key returns `EMPTY_STATE` forever). */
  function evictExcess(protectKey?: string): boolean {
    let evicted = false
    let overBy = reducers.size - maxReducers
    if (overBy <= 0) return false
    for (const key of [...reducers.keys()]) {
      if (overBy <= 0) break
      if (key === protectKey) continue
      if (!isEvictable(key)) continue
      // Capture BEFORE the drop — after `delete` the instance is unreachable
      // and its approval statuses / seq cursor would be lost with it.
      const dropped = onEvict ? reducers.get(key) : undefined
      reducers.delete(key)
      evicted = true
      overBy -= 1
      if (onEvict) {
        const sep = key.indexOf(KEY_SEP)
        onEvict(key.slice(0, sep), key.slice(sep + 1), {
          messages: dropped?.state.messages ?? EMPTY_STATE.messages,
          approvalStatuses: dropped?.state.approvalStatuses ?? EMPTY_STATE.approvalStatuses,
          lastAppliedSeq: dropped?.getLastAppliedSeq() ?? Number.NEGATIVE_INFINITY,
          pendingEchoes: dropped?.getPendingEchoes() ?? EMPTY_PENDING_ECHOES,
        })
      }
    }
    return evicted
  }

  function getReducer(
    dialogId: string,
    side: ChatDialogSide = DEFAULT_DIALOG_SIDE,
    createOptions?: CreateReducerOptionsFn,
  ): ChatStreamReducer {
    const key = keyOf(dialogId, side)
    let reducer = reducers.get(key)
    if (!reducer) {
      // `apply()` / `mutate()` can be the FIRST toucher of a key (an event for
      // a dialog no component has rendered yet). Without the store-level
      // default they would create a reducer missing the host's
      // `ownEchoIncludesAdmin` / `callbacks` / `batchApprovalsEnabled`, and a
      // later `getReducer(..., options)` would hand back that mis-configured
      // instance (create-options are consulted at creation only).
      const base = (createOptions ?? defaultCreateOptions)?.(dialogId, side) ?? {}
      const userOnChange = base.onChange
      reducer = createChatStreamReducer({
        ...base,
        onChange: () => {
          userOnChange?.()
          notify()
        },
      })
      reducers.set(key, reducer)
      if (evictExcess(key)) notifyDeferred()
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

  /** Notifies only when something was ACTUALLY dropped — an unconditional
   *  notify wakes every subscriber for a no-op removal, and the snapshot each
   *  would read is byte-identical.
   *
   *  Deliberately does NOT touch `retained` / `policyRetains`. A retain is a
   *  claim on the KEY, not on the instance (`retain()` never implies creation),
   *  and `remove()` is routinely followed by a re-render that recreates the key
   *  — a still-mounted consumer must keep protecting it across that round trip.
   *  Dropping the counter here would also desync the outstanding release
   *  closures: with two live retainers, the first release would decrement from
   *  the `?? 1` fallback straight to 0 and unpin a key the second consumer is
   *  still holding. The entries are bounded by live retainers (never by removed
   *  dialogs) and are deleted when the last release runs. */
  function remove(dialogId: string, side?: ChatDialogSide): void {
    let removed = false
    if (side !== undefined) {
      removed = reducers.delete(keyOf(dialogId, side))
    } else {
      const prefix = `${dialogId}${KEY_SEP}`
      for (const key of [...reducers.keys()]) {
        if (key.startsWith(prefix) && reducers.delete(key)) removed = true
      }
    }
    if (removed) notify()
  }

  function retainKey(key: string): () => void {
    retained.set(key, (retained.get(key) ?? 0) + 1)
    let released = false
    return () => {
      if (released) return
      released = true
      const next = (retained.get(key) ?? 1) - 1
      if (next <= 0) retained.delete(key)
      else retained.set(key, next)
    }
  }

  function retain(dialogId: string, side: ChatDialogSide = DEFAULT_DIALOG_SIDE): () => void {
    return retainKey(keyOf(dialogId, side))
  }

  /** Store-level policy retains, keyed the same way. Held separately from the
   *  per-consumer `retain()` handles so the two never clobber each other. */
  const policyRetains = new Map<string, () => void>()

  function setRetained(keys: Array<{ dialogId: string; side?: ChatDialogSide }>): void {
    const next = new Set(keys.map((k) => keyOf(k.dialogId, k.side ?? DEFAULT_DIALOG_SIDE)))
    // Retain the additions BEFORE releasing the removals: a key in both sets is
    // simply left alone, and nothing in the new set is ever unpinned in between.
    for (const key of next) {
      if (!policyRetains.has(key)) policyRetains.set(key, retainKey(key))
    }
    for (const [key, release] of [...policyRetains]) {
      if (next.has(key)) continue
      release()
      policyRetains.delete(key)
    }
  }

  return {
    getReducer,
    apply,
    mutate,
    subscribe,
    getSnapshot,
    getServerSnapshot,
    remove,
    retain,
    setRetained,
  }
}
