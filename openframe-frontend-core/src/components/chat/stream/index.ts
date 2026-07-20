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
  type ChatDialogSide,
  type ChatDialogStore,
} from './chat-dialog-store'

export {
  useChatStreamReducer,
  type UseChatStreamReducerOptions,
  type UseChatStreamReducerReturn,
} from './use-chat-stream-reducer'
