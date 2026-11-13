/**
 * Chat stream module: ONE master reader for every chat source (the hub's stream, a NATS chunk, a replayed history). See
 * `chat-stream-reducer.ts` for the architecture note.
 */

export {
  createChatStreamReducer,
  type BeginSseSendOptions,
  type ChatReducerEffect,
  type ChatReducerState,
  type ChatStreamReducer,
  type ChatStreamReducerOptions,
  type InitializeExtras,
  type PendingEcho,
} from './chat-stream-reducer';

export {
  createChatDialogStore,
  DEFAULT_DIALOG_SIDE,
  DEFAULT_MAX_REDUCERS,
  MAX_PENDING_RETAIN_KEYS,
  type ChatDialogSide,
  type ChatDialogStore,
  type CreateChatDialogStoreOptions,
  type EvictedReducerState,
} from './chat-dialog-store';

// Framework-free delta batching — shared with NON-React hosts that drive a
// reducer straight from a transport (they must NOT re-implement it).
// `isDeltaEntry` + `DELTA_FLUSH_FALLBACK_MS` are deliberately NOT re-exported:
// they are internals of the batcher (its own tests import them from the
// module), and no consumer needs to classify or re-time deltas by hand.
export {
  createDeltaBatcher,
  type CreateDeltaBatcherOptions,
  type DeltaBatcher,
  type DeltaEntry,
} from './delta-batcher';
