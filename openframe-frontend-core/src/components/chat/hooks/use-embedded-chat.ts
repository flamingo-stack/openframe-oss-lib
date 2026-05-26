'use client'

/**
 * Backward-compatibility shim.
 *
 * The canonical SSE/Guide-mode chat adapter has been renamed to
 * `useSseChatAdapter` and moved to `./use-sse-chat-adapter`. This module
 * re-exports it under the legacy `useEmbeddedChat` name plus the legacy
 * options type, so external consumers and barrel imports keep working
 * without churn.
 *
 * Internal lib code should import directly from `./use-sse-chat-adapter`.
 * This shim will be removed once all external consumers migrate to the
 * unified `useChat({ mode })` entry point.
 */

export {
  useSseChatAdapter as useEmbeddedChat,
  type UseSseChatAdapterOptions as UseEmbeddedChatOptions,
  type ChatSource,
  type DocChatMessage,
  type DocSource,
  type ChatTurnMeta,
  type StreamingPhase,
} from './use-sse-chat-adapter'
