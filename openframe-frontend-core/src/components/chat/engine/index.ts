'use client';

/**
 * THE chat engine every web chat runs on: one thread store, one chunk processor, one React binding. A host keeps only
 * its transport (NATS WebSocket, JetStream, the Tauri bridge, the hub's SSE) and its configuration.
 */

export {
  createChatThreadStore,
  type BoundChatThread,
  type ChatOptimisticSend,
  type ChatThreadHydrateOptions,
  type ChatThreadSnapshot,
  type ChatThreadStore,
  type ChatThreadStoreConfig,
} from './chat-thread-store';
export {
  chatThreadReducerOptions,
  type ChatModelMetadata,
  type ChatThreadReducerOptionsConfig,
} from './chat-thread-reducer-options';
export {
  observeChatEntry,
  threadEntryOf,
  useChatChunkProcessor,
  type ChatChunkObservers,
  type ChatDirectMessageRules,
  type UseChatChunkProcessorOptions,
} from './use-chat-chunk-processor';
export { useChatThread } from './use-chat-thread';
export {
  jetStreamLiveTail,
  natsWsLiveTail,
  type ChatHistoryBackend,
  type ChatLiveTailOptions,
  type ChatNatsConnection,
  type ChatTransport,
  type FetchDialogMessagesParams,
  type FetchDialogMessagesResult,
  type UseChatLiveTail,
} from './chat-transport';
export { useChatEngine, type UseChatEngineConfig, type UseChatEngineOptions } from './use-chat-engine';
export {
  createMingoGraphqlHistory,
  type MingoGraphqlHistoryOptions,
  type MingoGraphqlPost,
} from './mingo-graphql-history';
