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
  createMingoGraphqlHistory,
  type MingoGraphqlHistoryOptions,
  type MingoGraphqlPost,
} from './mingo-graphql-history';
