'use client'

// Chat components exports
export * from './approval-request-message'
export * from './approval-batch-message'
export * from './context-compaction-display'
export * from './expand-chevron'
export * from './thinking-display'
export * from './error-message-display'
export * from './chat-container'
export * from './chat-input'
export * from './slash-command-suggestions'
export * from './chat-message-enhanced'
export * from './chat-message-list'

export * from './chat-quick-action'
export * from './chat-ticket-list'
export * from './chat-typing-indicator'
export * from './tool-execution-display'
export * from './tool-call-blocks'
export * from './model-display'
export * from './chat-sidebar'
export type { ChatRef } from './chat-ref.types'
export { remarkCardLinks } from './remark-card-links'

// Card-supporting UI migrated from hub `components/shared/*` + `components/blog/*`
export {
  NavLinkAnchorViaRuntime,
  type NavLinkAnchorViaRuntimeProps,
} from './nav-link-anchor-via-runtime'
export {
  SourceActionButton,
  type SourceActionButtonProps,
  type SourceActionDensity,
} from './source-action-button'
export {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
  type ChatAttachmentAddButtonProps,
  type ChatAttachmentChipStripProps,
  type StagedAttachment,
  CHAT_ATTACHMENT_MIME_TYPES,
  CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER,
} from './chat-attachment-bar'

// Entity-cards (12 refactored + 4 moved + supporting primitives)
export * from './entity-cards'

// Chat types and constants
export * from './types'

// Chat hooks
export * from './hooks'

// Chat utilities
export * from './utils'

// EmbeddableChat — full chat orchestrator (lib-portable port of hub's
// `<GlobalAskAI>`). Hosts mount it once at the root after providing a
// <ChatRuntimeContext.Provider>.
export { EmbeddableChat, type EmbeddableChatProps } from './embeddable-chat'
