/**
 * THE chat thread store: every web chat's threads (OpenFrame Mingo and its tickets, the Fae client, the lib's own NATS
 * engine) live in one of these. The reducers of a `ChatDialogStore` own ALL message accumulation; this owns what a host
 * needs around them: one stateful decoder per key, delta batching, history hydration, LRU eviction that loses nothing,
 * and a snapshot a view subscribes to.
 *
 * It is framework-free and lives as long as its creator keeps it, which is the point: a module-level store survives the
 * panel that shows it unmounting, so a chat reopened mid-turn shows the turn instead of an empty thread. `useChatThread`
 * is its React binding; a host with its own store (zustand) takes snapshots through `onSnapshot` instead.
 *
 * A thread is `ChatMessage[]`, the reducer's own objects by reference: an unchanged reducer snapshot short-circuits, and
 * an unchanged message is the reducer's object. Break either and every inline card remounts on each chunk.
 *
 * RETENTION FOLLOWS WHAT IS DISPLAYED. The dialog store evicts least-recently-used reducers past its cap unless a key is
 * retained. Hosts declare the displayed key(s) with `setActiveKeys`; everything else falls back to LRU recency plus the
 * store's own guard, which never evicts a live stream. Pinning every key ever seen would make memory track dialogs
 * visited and defeat the cap.
 *
 * EVICTION OF A NON-DISPLAYED KEY IS SAFE because the dialog store publishes it (`onEvict`, injected here, which is why
 * `createStore` is a factory): the whole `EvictedReducerState` is parked and replayed into the replacement reducer by the
 * next `getReducer`, before anything reads it. The thread alone is not enough: a recreated reducer starts with no approval
 * statuses and no sequence cursor, so a resolved approval would re-render actionable and a catch-up replay would apply
 * events twice. Parking is unconditional for that reason.
 *
 * DELTA BATCHING is the lib's framework-free `createDeltaBatcher`, the one implementation (shared with
 * `useChatStreamReducer`): consecutive same-type deltas coalesce and land about once per frame. `push` returns false for a
 * non-delta entry, which the store then flushes and applies itself, so ordering is preserved.
 */

import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { createMingoDecoder, type MingoDecoder } from '../../../chat-protocol/message-decoder';
import type { ChatStreamEntry } from '../../../chat-protocol/ui-chunks';
import {
  createChatDialogStore,
  DEFAULT_DIALOG_SIDE,
  type ChatDialogSide,
  type ChatDialogStore,
  type CreateChatDialogStoreOptions,
  type EvictedReducerState,
} from '../stream/chat-dialog-store';
import type { ChatReducerState, ChatStreamReducer, ChatStreamReducerOptions } from '../stream/chat-stream-reducer';
import { createDeltaBatcher, type DeltaBatcher, type DeltaEntry } from '../stream/delta-batcher';
import type { ChatApprovalStatus } from '../types';
import type { StreamingPhase } from '../types/unified-chat-state.types';
import { extractIncompleteTailState } from '../utils/extract-incomplete-message-state';

/** One snapshot of a thread. */
export interface ChatThreadSnapshot {
  /** The thread. Reference-stable while the reducer's thread is untouched. */
  messages: ChatMessage[];
  phase: StreamingPhase;
  /** Id of the assistant bubble an open stream writes into (a history merge leaves it alone). */
  streamingId: string | null;
  /** The reducer's whole state, for what a host reads beside the thread (token usage, approvals, the model). */
  state: ChatReducerState;
}

export interface ChatThreadStoreConfig<K extends string> {
  /**
   * Build the dialog store. A factory, because the thread store injects its own `onEvict` at creation: a finished store
   * handed in would leave every host free to forget it. Default: `createChatDialogStore`.
   */
  createStore?: (storeOptions: CreateChatDialogStoreOptions) => ChatDialogStore;
  /**
   * A key's (dialogId, side). INVARIANT: a key maps to the SAME pair for the store's lifetime; the retain handles, the
   * snapshot cache and the parked re-seeds are looked up by key and resolved through this lazily. Encode any varying
   * part in the key itself. Default: the key is the dialog id, on the default side.
   */
  identityFor?: (key: K) => { dialogId: string; side: ChatDialogSide };
  /** Reducer options, consulted ONLY when a key's reducer is first created. */
  options?: (key: K) => ChatStreamReducerOptions;
  /** Called on every CHANGED snapshot, for a host that keeps its own store. `subscribe` serves React. */
  onSnapshot?: (key: K, snapshot: ChatThreadSnapshot) => void;
  /**
   * Keys a non-delta entry landing on `key` can also change, through the dialog store's cross-key projections (an
   * approval resolved by its id, a tool's run by its call id). A ticket's two sides name each other; independent dialogs
   * name none. They are created before the entry lands and re-synced after it.
   */
  siblingKeys?: (key: K) => readonly K[];
}

/** Options of `hydrate`. */
export interface ChatThreadHydrateOptions {
  /**
   * Whether a catch-up replay is expected to follow (default true). The adopt-once flag is only safe while a replay is
   * actually inbound: left armed, the NEXT genuine turn would adopt (overwrite) a completed bubble. It is therefore
   * DISARMED on the first applied entry that is not a `start`. Pass false for a hydration that is not a fresh subscribe
   * (a page, an idle refetch, a re-seed after eviction).
   */
  expectingReplay?: boolean;
}

/** One key's handle, curried and memoized: identity-stable until the key is evicted or dropped. */
export interface BoundChatThread {
  /** The key this handle is bound to. */
  key: string;
  /** One raw chunk, through the key's ONE stateful decoder, which lives exactly as long as the key's sequence does. */
  decode: (raw: unknown) => ChatStreamEntry;
  apply: (entry: ChatStreamEntry) => void;
  hydrate: (messages: readonly ChatMessage[], options?: ChatThreadHydrateOptions) => void;
  mutate: (fn: (reducer: ChatStreamReducer) => void) => void;
  /** MERGE (what the stream learned wins): see `ChatThreadStore.mergeApprovalStatuses`. */
  mergeApprovalStatuses: (statuses: Record<string, string>) => void;
  /**
   * How many times THIS key's reducer has been evicted and replaced. A new handle is built on every eviction, so a
   * changed epoch is what tells a React consumer to redo the one-shot work it did against the previous reducer (the
   * persisted approval statuses, an unfinished turn's busy phase).
   */
  evictionEpoch: number;
}

/** What `pushOptimisticSend` draws. */
export interface ChatOptimisticSend {
  /** The host's own bubble (name, avatar, context chips). Without one the reducer draws its own user row. */
  message?: ChatMessage;
  /** A hidden send draws no bubble. */
  hidden?: boolean;
}

export interface ChatThreadStore<K extends string> {
  /** The dialog store underneath, built by `createStore` with this store's `onEvict` wired in. */
  store: ChatDialogStore;
  /**
   * THE history-hydration door, the only way a fetched thread enters a reducer. Restoring a turn takes three steps that
   * only work together: the thread, an unfinished tail's busy phase, and the adopt-once flag so a replayed `start`
   * re-streams into the partial bubble instead of opening one beside it. While the reducer has a turn open, only the
   * thread is written and adoption is disarmed.
   */
  hydrate: (key: K, messages: readonly ChatMessage[], options?: ChatThreadHydrateOptions) => void;
  /** The user's decision on a card: flips it, and cancels an adopt-once (the backend answers by STARTING a turn). */
  updateApprovalStatus: (key: K, requestId: string, status: ChatApprovalStatus, resolvedByName?: string | null) => void;
  /** Run reducer commands (non-wire mutations), then sync. Lands the delta batch first. */
  mutate: <T>(key: K, fn: (reducer: ChatStreamReducer) => T) => T;
  /** Read-modify-write on the thread. `op` returning its input unchanged is a no-op. */
  mutateThread: (key: K, op: (messages: ChatMessage[]) => ChatMessage[]) => void;
  /** Replace the row carrying `message.id`, else append. */
  upsertMessage: (key: K, message: ChatMessage) => void;
  /** Shallow-patch the row carrying `id`. No-op when it is absent. */
  patchMessage: (key: K, id: string, updates: Partial<ChatMessage>) => void;
  /** Drop the row carrying `id`. No-op when it is absent. */
  removeMessage: (key: K, id: string) => void;
  /** Prepend an older history page, optionally patching the row that straddles the page boundary. */
  prependWithBoundaryMerge: (
    key: K,
    newMessages: ChatMessage[],
    boundaryMessageId?: string,
    boundaryUpdates?: Partial<ChatMessage>,
  ) => void;
  /** A host typing indicator onto the phase: only 'idle' rises to 'thinking' (an open stream keeps the phase), off is idle. */
  setTyping: (key: K, typing: boolean) => void;
  /** Merge a host's PERSISTED approval statuses; what the stream learned wins (the reducer's precedence). */
  mergeApprovalStatuses: (key: K, statuses: Record<string, string>) => void;
  /**
   * The user's own send, THROUGH the reducer, so the reducer records the echo it expects and consumes the backend's
   * MESSAGE_REQUEST echo itself (one-shot, text-matched). With a host bubble the reducer's generic rows are swapped for
   * it and the phase stays the host's (it drives its own indicator); without one the reducer's user row, placeholder and
   * 'thinking' phase stand.
   */
  pushOptimisticSend: (key: K, text: string, send?: ChatOptimisticSend) => void;
  /** The key's curried handle, memoized. */
  bind: (key: K) => BoundChatThread;
  /** The keys on screen: exactly those are pinned against eviction. Idempotent. */
  setActiveKeys: (keys: readonly K[]) => void;
  /** Land what the delta batcher holds, so a read of the thread is the thread (a history merge reads after this). */
  flush: () => void;
  /** Drop a key's reducer, snapshot and decoder. The next use starts a fresh sequence the host seeds. */
  drop: (key: K) => void;
  /** Every key this store has seen and not dropped. */
  knownKeys: () => K[];
  /** The key's latest snapshot (cached: the same object until the thread changes). */
  snapshotOf: (key: K) => ChatThreadSnapshot;
  /** Listen to every snapshot change, any key. */
  subscribe: (listener: () => void) => () => void;
  /** The (dialogId, side) a key is kept under in `store`. */
  identityOf: (key: K) => { dialogId: string; side: ChatDialogSide };
}

const defaultIdentity = (key: string) => ({ dialogId: key, side: DEFAULT_DIALOG_SIDE });

export function createChatThreadStore<K extends string>(config: ChatThreadStoreConfig<K> = {}): ChatThreadStore<K> {
  const {
    createStore = createChatDialogStore,
    identityFor = defaultIdentity as (key: K) => { dialogId: string; side: ChatDialogSide },
    options = () => ({}),
    onSnapshot,
    siblingKeys,
  } = config;

  const knownKeys = new Set<K>();
  const lastSyncedState = new Map<K, ChatReducerState>();
  const snapshotByKey = new Map<K, ChatThreadSnapshot>();
  const listeners = new Set<() => void>();
  const boundByKey = new Map<K, BoundChatThread>();
  const decoderByKey = new Map<K, MingoDecoder>();
  const activeKeys = new Set<K>();
  const reseedByKey = new Map<K, EvictedReducerState>();
  const evictionEpochByKey = new Map<K, number>();
  /** Keys whose reducer holds an armed adopt-once flag, waiting for the replayed `start` `hydrate` armed it for. */
  const awaitingAdopt = new Set<K>();

  /** The inverse of `identityFor`, over the known keys: only to read the store's eviction signal back as a key. */
  function keyForIdentity(dialogId: string, side: ChatDialogSide): K | undefined {
    for (const key of knownKeys) {
      const identity = identityFor(key);
      if (identity.dialogId === dialogId && identity.side === side) return key;
    }
    return undefined;
  }

  const store = createStore({
    onEvict: (dialogId, side, parked) => {
      const key = keyForIdentity(dialogId, side);
      if (key === undefined) return;
      // Parked, not re-seeded: `onEvict` fires from inside the store's `getReducer`, before the replacement exists. This
      // store's own `getReducer` seeds it. Unconditional: statuses, the seq cursor and the armed echoes are worth parking
      // even when the thread is empty.
      reseedByKey.set(key, parked);
      // Bump before dropping the handle: the next `bind` builds one with the new epoch, which re-arms consumers.
      evictionEpochByKey.set(key, (evictionEpochByKey.get(key) ?? 0) + 1);
      boundByKey.delete(key);
      lastSyncedState.delete(key);
    },
  });

  // The batcher applies against the key it FLUSHED, which on a key change is the PREVIOUS key. `applyOne` records it and
  // `onFlushed` (explicit flushes and the scheduled ones alike) re-projects exactly that key.
  let flushedKey: K | null = null;

  const batcher: DeltaBatcher<K> = createDeltaBatcher<K>({
    applyOne: (delta: DeltaEntry, key: K | undefined) => {
      if (key === undefined) return;
      flushedKey = key;
      const { dialogId, side } = identityFor(key);
      // Through this store's `getReducer`, which consumes a parked re-seed: a buffered key is still 'idle', hence
      // evictable, and its buffer must not land in a fresh EMPTY reducer.
      getReducer(key);
      store.apply(dialogId, side, delta);
    },
    onFlushed: () => {
      if (flushedKey === null) return;
      const key = flushedKey;
      flushedKey = null;
      sync(key);
    },
  });

  function flush(): void {
    batcher.flush();
  }

  function getReducer(key: K): ChatStreamReducer {
    knownKeys.add(key);
    const { dialogId, side } = identityFor(key);
    const reducer = store.getReducer(dialogId, side, () => options(key));
    // The first look at an evicted key's replacement: restore the parked state before any caller reads it.
    const parked = reseedByKey.get(key);
    if (parked !== undefined) {
      reseedByKey.delete(key);
      reducer.initializeWithState(parked.messages.length > 0 ? parked.messages : null, {
        approvalStatuses: parked.approvalStatuses,
        lastAppliedSeq: parked.lastAppliedSeq,
        pendingEchoes: parked.pendingEchoes,
      });
    }
    return reducer;
  }

  function pushRetention(): void {
    store.setRetained([...activeKeys].map(key => identityFor(key)));
  }

  function setActiveKeys(keys: readonly K[]): void {
    activeKeys.clear();
    for (const key of keys) activeKeys.add(key);
    pushRetention();
  }

  /** The snapshot of a state, cached per key by the state's identity: one object until the thread changes. */
  function snapshotFor(key: K, state: ChatReducerState): ChatThreadSnapshot {
    const cached = snapshotByKey.get(key);
    if (cached?.state === state) return cached;
    const { messages } = state;
    const phase = state.streamingPhase;
    const last = messages[messages.length - 1];
    const streamingId = phase === 'streaming' && last?.role === 'assistant' ? last.id : null;
    const snapshot = { messages, phase, streamingId, state };
    snapshotByKey.set(key, snapshot);
    return snapshot;
  }

  function sync(key: K): void {
    getReducer(key);
    const { dialogId, side } = identityFor(key);
    const state = store.getSnapshot(dialogId, side);
    if (lastSyncedState.get(key) === state) return;
    lastSyncedState.set(key, state);
    onSnapshot?.(key, snapshotFor(key, state));
    for (const listener of listeners) listener();
  }

  /** A pure read (React calls it while rendering): it creates nothing and tells nobody. */
  function snapshotOf(key: K): ChatThreadSnapshot {
    const { dialogId, side } = identityFor(key);
    return snapshotFor(key, store.getSnapshot(dialogId, side));
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  /** Clears both halves of adopt-once, inside the caller's `mutate`; the set alone cannot say the flag is spent. */
  function disarmAdopt(key: K, reducer: ChatStreamReducer): void {
    awaitingAdopt.delete(key);
    reducer.armAdoptTrailingAssistant(false);
  }

  function hydrate(key: K, messages: readonly ChatMessage[], hydrateOptions?: ChatThreadHydrateOptions): void {
    // The one incompleteness rule: the trailing assistant run still unfinished (a pending approval, a tool running, an
    // open compaction). Its extras raise the busy phase when the work is the agent's.
    const extras = extractIncompleteTailState(messages);
    let armAdopt = extras !== undefined && hydrateOptions?.expectingReplay !== false;

    mutate(key, reducer => {
      // A turn the reducer is streaming owns its bubble. 'streaming' exactly: 'thinking' is also what an agent-busy tail
      // restores with no turn open, and a second hydrate of that tail must seed and arm like the first.
      const turnOpen = reducer.state.streamingPhase === 'streaming';
      reducer.initializeWithState([...messages]);
      if (turnOpen) {
        armAdopt = false;
        disarmAdopt(key, reducer);
        return;
      }
      if (extras) reducer.initializeWithState(null, extras);
      reducer.armAdoptTrailingAssistant(armAdopt);
    });

    if (armAdopt) awaitingAdopt.add(key);
    else awaitingAdopt.delete(key);
  }

  function updateApprovalStatus(
    key: K,
    requestId: string,
    status: ChatApprovalStatus,
    resolvedByName?: string | null,
  ): void {
    mutate(key, reducer => {
      disarmAdopt(key, reducer);
      reducer.projectApprovalResolution(requestId, status, resolvedByName);
    });
  }

  function apply(key: K, entry: ChatStreamEntry): void {
    // Adopt-once has a ONE-ENTRY life: anything but a `start` arriving first means no replay is re-streaming the turn.
    if (awaitingAdopt.has(key) && !entry.chunks.some(chunk => chunk.type === 'start')) {
      mutate(key, reducer => {
        disarmAdopt(key, reducer);
      });
    }
    // ORDER IS LOAD-BEARING: a pending batch lands BEFORE `getReducer(key)`, or resolving a new key could evict the
    // pending key's reducer and replay its text into a fresh one. `push` performs the key-change flush.
    const queued = batcher.push(entry, key);
    getReducer(key);
    if (queued) return;
    batcher.flush();
    // Non-delta entries are the only ones projected across keys: siblings exist before, and re-sync after.
    const siblings = siblingKeys?.(key) ?? [];
    for (const sibling of siblings) {
      if (sibling !== key) getReducer(sibling);
    }
    const { dialogId, side } = identityFor(key);
    store.apply(dialogId, side, entry);
    sync(key);
    for (const sibling of siblings) {
      if (sibling !== key) sync(sibling);
    }
  }

  function mutate<T>(key: K, fn: (reducer: ChatStreamReducer) => T): T {
    flush();
    getReducer(key);
    const { dialogId, side } = identityFor(key);
    const result = store.mutate(dialogId, side, fn);
    sync(key);
    return result;
  }

  function mutateThread(key: K, op: (messages: ChatMessage[]) => ChatMessage[]): void {
    mutate(key, reducer => {
      const current = reducer.state.messages;
      const next = op(current);
      if (next === current) return;
      reducer.setMessages(next);
    });
  }

  function upsertMessage(key: K, message: ChatMessage): void {
    mutateThread(key, current => {
      const idx = current.findIndex(m => m.id === message.id);
      if (idx === -1) return [...current, message];
      const updated = [...current];
      updated[idx] = message;
      return updated;
    });
  }

  function patchMessage(key: K, id: string, updates: Partial<ChatMessage>): void {
    mutateThread(key, current => {
      const idx = current.findIndex(m => m.id === id);
      if (idx === -1) return current;
      const updated = [...current];
      updated[idx] = { ...updated[idx], ...updates };
      return updated;
    });
  }

  function removeMessage(key: K, id: string): void {
    mutateThread(key, current => {
      const filtered = current.filter(m => m.id !== id);
      return filtered.length === current.length ? current : filtered;
    });
  }

  function prependWithBoundaryMerge(
    key: K,
    newMessages: ChatMessage[],
    boundaryMessageId?: string,
    boundaryUpdates?: Partial<ChatMessage>,
  ): void {
    mutateThread(key, current => {
      let messages = current;
      if (boundaryMessageId && boundaryUpdates) {
        const idx = messages.findIndex(m => m.id === boundaryMessageId);
        if (idx !== -1) {
          messages = [...messages];
          messages[idx] = { ...messages[idx], ...boundaryUpdates };
        }
      }
      return newMessages.length > 0 ? [...newMessages, ...messages] : messages;
    });
  }

  function setTyping(key: K, typing: boolean): void {
    mutate(key, reducer => {
      if (!typing) {
        reducer.setPhase('idle');
        return;
      }
      if (reducer.state.streamingPhase === 'idle') reducer.setPhase('thinking');
    });
  }

  function mergeApprovalStatuses(key: K, statuses: Record<string, string>): void {
    mutate(key, reducer => {
      reducer.mergeApprovalStatuses(statuses as Record<string, ChatApprovalStatus>);
    });
  }

  function pushOptimisticSend(key: K, text: string, send: ChatOptimisticSend = {}): void {
    mutate(key, reducer => {
      const { messages, streamingPhase } = reducer.state;
      reducer.pushOptimisticSend(text, send.hidden ?? false);
      if (!send.message) return;
      reducer.setMessages(send.hidden ? messages : [...messages, send.message]);
      reducer.setPhase(streamingPhase);
    });
  }

  function decoderOf(key: K): MingoDecoder {
    const known = decoderByKey.get(key);
    if (known) return known;
    const decoder = createMingoDecoder();
    decoderByKey.set(key, decoder);
    return decoder;
  }

  function bind(key: K): BoundChatThread {
    const existing = boundByKey.get(key);
    if (existing) return existing;
    const bound: BoundChatThread = {
      key,
      decode: raw => decoderOf(key).decode(raw),
      apply: entry => apply(key, entry),
      hydrate: (messages, hydrateOptions) => hydrate(key, messages, hydrateOptions),
      mutate: fn => {
        mutate(key, fn);
      },
      mergeApprovalStatuses: statuses => mergeApprovalStatuses(key, statuses),
      evictionEpoch: evictionEpochByKey.get(key) ?? 0,
    };
    boundByKey.set(key, bound);
    return bound;
  }

  function drop(key: K): void {
    boundByKey.delete(key);
    // Land and cancel first: another key's batch would be stranded, and this key's must not fire after `remove`.
    flush();
    const { dialogId, side } = identityFor(key);
    // Release before `remove`, or the retain would pin a reducer this store no longer knows.
    if (activeKeys.delete(key)) pushRetention();
    store.remove(dialogId, side);
    lastSyncedState.delete(key);
    snapshotByKey.delete(key);
    // The sequence restarts with the reducer, and a decoder remembers the sequence it read.
    decoderByKey.delete(key);
    // A dropped key is gone on purpose: nothing parked by an earlier eviction may be replayed into the next reducer.
    reseedByKey.delete(key);
    evictionEpochByKey.delete(key);
    awaitingAdopt.delete(key);
    knownKeys.delete(key);
  }

  // `getReducer` and `sync` stay private: an outside `getReducer` would consume a parked re-seed without the `sync`
  // that publishes it.
  return {
    store,
    hydrate,
    updateApprovalStatus,
    mutate,
    mutateThread,
    upsertMessage,
    patchMessage,
    removeMessage,
    prependWithBoundaryMerge,
    setTyping,
    mergeApprovalStatuses,
    pushOptimisticSend,
    bind,
    setActiveKeys,
    flush,
    drop,
    knownKeys: () => [...knownKeys],
    snapshotOf,
    subscribe,
    identityOf: identityFor,
  };
}
