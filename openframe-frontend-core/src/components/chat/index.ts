'use client';

// Chat components exports
export * from './approval-batch-message';
export * from './escalation-offer-message';
export * from './ticket-escalated-message';
export * from './ticket-event-message';
export * from './system-event-message';
export * from './ai-assistant-info';
export * from './chat-appearance-context';
export * from './context-compaction-display';
export * from './expand-chevron';
export * from './thinking-display';
export * from './ask-display';
export * from './suggestions-display';
export * from './error-message-display';
export * from './chat-container';
export * from './chat-input';
export * from './slash-command-suggestions';
export * from './chat-message-enhanced';
export * from './chat-message-list';
export * from './chat-message-row';
// What the user said, as a bubble: for a surface that draws a user's line outside a thread (the hero's scene).
export { CHAT_MESSAGE_USER_BUBBLE_CLASS } from './chat-message-layout';
export * from './chat-turn';
export { CHAT_MESSAGE_LIST_SKELETON_MESSAGES } from './chat-message-skeleton';

export * from './quick-action-chip';
export * from './ask-prompts';
export * from './assistant-ask-prompts';
export * from './quick-action-marquee';
export * from './quick-action-wall';
export * from './mingo-quick-action-wall';
export * from './quick-action-row';
export * from './mingo-edge-light';
export * from './chat-ticket-list';
export * from './chat-typing-indicator';
export * from './tool-execution-display';
export * from './tool-call-blocks';
export * from './mingo-onboarding-card';
export * from './mingo-welcome';
export * from './guide-welcome';
export * from './msp-organization-card';
export * from './guide-mode-banner';
export * from './mingo-chat-history';
export * from './mingo-archive-list';
export * from './composer-sheet';
export * from './mingo-chat-header';
export * from './mingo-chat-rail';
export { MingoChatSearchModal, type MingoChatSearchModalProps } from './mingo-chat-history-section';
export * from './mingo-history-rail';
export * from './mingo-chat-modals';
export * from './chat-header-search-field';
export * from './chat-panel-header';
export * from './chat-composer';
export * from './chat-context-picker';
export * from './chat-context-memory-bar';
export * from './context-items-list';
export * from './chat-archive-page';
export { ChatListLoadError, type MingoDialogStatus, type MingoHistoryScope } from './mingo-chat-list-shared';
export * from './model-display';
export * from './usage/chat-usage';
export * from './usage/chat-usage-panel';
export * from './chat-sidebar';
export * from './chat-nav-sidebar';
export * from './chat-list-empty-state';
export * from './chat-top-navigation';
export * from './onboarding-carousel';
export type { ChatRef } from './chat-ref.types';

// Card-supporting UI migrated from hub `components/shared/*` + `components/blog/*`
export {
  NavLinkAnchorViaRuntime,
  type NavLinkAnchorViaRuntimeProps,
  type NavLinkViaRuntimeInput,
  type NavLinkViaRuntimeProps,
  type NavigateViaRuntimeInput,
  useNavigateViaRuntime,
  useNavLinkViaRuntime,
} from './nav-link-anchor-via-runtime';
export { SourceActionButton, type SourceActionButtonProps, type SourceActionDensity } from './source-action-button';
export {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
  type ChatAttachmentAddButtonProps,
  type ChatAttachmentChipStripProps,
} from './chat-attachment-bar';
// OpenFrame (Mingo, Fae) attachments: the composer's tile, tray, notes, counter, attach button and drop overlay, and a
// sent message's files.
export * from './openframe-attach-button';
export * from './openframe-attachment-counter';
export * from './openframe-attachment-notes';
export * from './openframe-attachment-tile';
export * from './openframe-attachment-tray';
export * from './openframe-drop-overlay';
export * from './openframe-message-attachments';

// Entity-cards (12 refactored + 4 moved + supporting primitives)
export * from './entity-cards';

// Chat types and constants
export * from './types';

// Chat hooks
export * from './hooks';

// Chat stream module — master reducer + dialog store + React wrapper
// (Phase 3 of the chat unification; ONE accumulation path for SSE + NATS
// + history replay).
export * from './stream';

// THE chat engine: one thread store, one chunk processor, one React binding, for every web chat.
export * from './engine';

// Chat utilities
export * from './utils';

export type { ChatPrefillDraft, EmbeddableChatHandle, EmbeddableChatProps } from './embeddable-chat';
export { EmbeddableChat } from './embeddable-chat-loader';
export { MINGO_V2_RAIL_WIDTH, MINGO_V2_SPLIT_WIDTH } from './chat-dimensions';
export {
  ASK_AI_OPEN_EVENT,
  ASK_AI_OPEN_EVENTS,
  ASK_AI_OPEN_WITH_REF_EVENT,
  ASK_AI_TRIGGER_ATTRIBUTE,
} from './utils/ask-ai-events';
export { chatDayLabel } from './utils/chat-day-label';
export * from './proxy-credentials-panel';
export { InlineChip, INLINE_CHIP_LINKED_CLASS, type InlineChipAnchor } from './inline-chip';
export { ChatMessageSources } from './chat-message-sources';
export { RecordActionsProvider, type RecordActionHandlers, useRecordActions } from './record-actions';
