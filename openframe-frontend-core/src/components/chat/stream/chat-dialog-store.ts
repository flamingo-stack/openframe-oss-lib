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
  /** Referentially-stable snapshot for `useSyncExternalStore`. */
  getSnapshot(dialogId: string, side?: ChatDialogSide): ChatReducerState
  /** Drop a side's reducer (or every side of the dialog when omitted). */
  remove(dialogId: string, side?: ChatDialogSide): void
}

export const DEFAULT_DIALOG_SIDE: ChatDialogSide = 'main'

const KEY_SEP = '\u0000'
const keyOf = (dialogId: string, side: ChatDialogSide) => `${dialogId}${KEY_SEP}${side}`

export function createChatDialogStore(): ChatDialogStore {
  const reducers = new Map<string, ChatStreamReducer>()
  const listeners = new Set<() => void>()

  function notify(): void {
    for (const listener of listeners) listener()
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

  function getSnapshot(
    dialogId: string,
    side: ChatDialogSide = DEFAULT_DIALOG_SIDE,
  ): ChatReducerState {
    return getReducer(dialogId, side).state
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

  return { getReducer, apply, mutate, subscribe, getSnapshot, remove }
}
