/**
 * Chat stream module — ONE master reader for every chat event source
 * (SSE decoder, NATS chunk decoder, historical replay). See
 * `chat-stream-reducer.ts` for the architecture note.
 *
 * NOTE: the pure message-mutation helpers (`appendToTrailingAssistant`,
 * `applyToolExecutionToMessages`, …) are intentionally NOT star-exported
 * here — their legacy public home is `use-nats-chat-adapter`, which
 * re-exports them from `./message-mutations`; exporting the same bindings
 * from two star-exported barrels would make them ambiguous and drop them
 * from the chat barrel entirely.
 */

export {
  createChatStreamReducer,
  createEmptyTurnMeta,
  type BeginSseSendOptions,
  type ChatReducerEffect,
  type ChatReducerState,
  type ChatStreamReducer,
  type ChatStreamReducerOptions,
  type ChatTurnMetaState,
  type EscalatedApprovalData,
  type InitializeExtras,
} from './chat-stream-reducer'

export {
  createChatDialogStore,
  DEFAULT_DIALOG_SIDE,
  DEFAULT_MAX_REDUCERS,
  type ChatDialogSide,
  type ChatDialogStore,
  type CreateChatDialogStoreOptions,
  type EvictedReducerState,
} from './chat-dialog-store'

// Framework-free delta batching — shared with NON-React hosts that drive a
// reducer straight from a transport (they must NOT re-implement it).
// `isDeltaEvent` + `DELTA_FLUSH_FALLBACK_MS` are deliberately NOT re-exported:
// they are internals of the batcher (its own tests import them from the
// module), and no consumer needs to classify or re-time deltas by hand.
export {
  createDeltaBatcher,
  type CreateDeltaBatcherOptions,
  type DeltaBatcher,
  type DeltaEvent,
} from './delta-batcher'

export {
  useChatStreamReducer,
  type UseChatStreamReducerOptions,
  type UseChatStreamReducerReturn,
} from './use-chat-stream-reducer'
