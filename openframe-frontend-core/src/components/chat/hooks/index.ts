'use client';

export * from './use-chunk-catchup';
export * from './use-collapsible';
export * from './use-scripted-stream';
export * from './use-jetstream-dialog-subscription';
export * from './use-nats-dialog-subscription';

// Chat hooks migrated from hub `hooks/*` (Task #7).
export * from './use-slash-commands';
export * from './use-empty-state-config';
export * from './use-chat-attachments';
export * from './use-chat-attachment-image-gallery';
export * from './use-chat-identity';
export * from './use-chat-card-item';
export * from './use-close-on-navigation';
export * from './use-what-to-ask';

// useChat + useSSE — ported from hub `hooks/useChat.ts` + `hooks/useSSE.ts`
// minus the MockChatService + useChatConfig dependencies (which stay in
// hub-only code).
export * from './use-chat';
export * from './use-sse';

// Unified chat surface — single public hook + two transport adapters.
// Consumers typically use `useUnifiedChat({ modes, activeMode })`; the
// adapter hooks are exposed for advanced cases where direct transport
// access is needed..
export * from './use-sse-chat-adapter';
export * from './use-nats-chat-adapter';
// Shared dialog-list state machine behind both adapters' managed modes.
export * from './use-managed-dialog-list';
// Reference latch for host-supplied inline objects used as memo dependencies.
export * from './use-stable-shallow';
export * from './use-unified-chat';

// useProxiedImageUrl — runtime-driven hook wrapping pure
// `getProxiedImageUrl`. Reads proxy prefix + skip-domain list from
// `ChatRuntime.endpoints`, so hub vs. embedders share one image-proxy
// resolver.
export * from './use-proxied-image-url';
export {
  ASK_PROMPTS_DEFAULT_COUNT,
  assistantAvailable,
  buildAskPromptsUrl,
  useAskPrompts,
  useAssistantOpen,
  useAskSurface,
  type AskPromptsResponse,
  type UseAskPromptsOptions,
  type UseAskPromptsResult,
  type UseAskSurfaceOptions,
  type UseAskSurfaceResult,
} from './use-ask-prompts';
export type { SlashCommandActionId, SlashCommandSummaryAction, SlashCommandSummary } from '../types/component.types';
export type { Message } from '../types/message.types';
export {
  appendToTrailingAssistant,
  applyToolExecutionToMessages,
  upsertTrailingCompaction,
} from '../stream/message-mutations';
export type { FetchDialogsParams, FetchDialogsResult } from '../types/unified-chat-state.types';
export type { ChatTurnMeta } from '../stream/chat-stream-reducer';
export type { ChatSource } from '../types/message.types';
export type { StreamingPhase } from '../types/unified-chat-state.types';
