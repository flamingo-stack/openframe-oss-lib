'use client'

export * from './use-chunk-catchup'
export * from './use-collapsible'
export * from './use-jetstream-dialog-subscription'
export * from './use-nats-dialog-subscription'
export * from './use-realtime-chunk-processor'

// Chat hooks migrated from hub `hooks/*` (Task #7).
export * from './use-slash-commands'
export * from './use-chat-attachments'
export * from './use-chat-attachment-image-gallery'
export * from './use-chat-identity'
export * from './use-chat-card-item'
export * from './use-close-on-navigation'

// useChat + useSSE — ported from hub `hooks/useChat.ts` + `hooks/useSSE.ts`
// minus the MockChatService + useChatConfig dependencies (which stay in
// hub-only code).
export * from './use-chat'
export * from './use-sse'

// Unified chat surface — single public hook + two transport adapters.
// Consumers typically use `useUnifiedChat({ modes, activeMode })`; the
// adapter hooks are exposed for advanced cases where direct transport
// access is needed. `useEmbeddedChat` is the legacy SSE alias.
export * from './use-sse-chat-adapter'
export * from './use-nats-chat-adapter'
export * from './use-unified-chat'
export * from './use-embedded-chat'

// useProxiedImageUrl — runtime-driven hook wrapping pure
// `getProxiedImageUrl`. Reads proxy prefix + skip-domain list from
// `ChatRuntime.endpoints`, so hub vs. embedders share one image-proxy
// resolver.
export * from './use-proxied-image-url'
