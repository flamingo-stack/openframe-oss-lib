'use client';

// Chat components exports
import { createElement, forwardRef, lazy, Suspense, useEffect, useState } from 'react';
import { afterPageLoad } from '../../utils/after-page-load';
import type { EmbeddableChatHandle, EmbeddableChatProps } from './embeddable-chat';
import { ASK_AI_OPEN_EVENTS, holdAskAiOpens } from './utils/ask-ai-events';
export * from './approval-request-message';
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
export * from './chat-turn';
export * from './chat-message-skeleton';

export * from './quick-action-chip';
export * from './ask-prompts';
export * from './assistant-ask-prompts';
export * from './quick-action-marquee';
export * from './quick-action-wall';
export * from './chat-ticket-list';
export * from './chat-typing-indicator';
export * from './tool-execution-display';
export * from './tool-call-blocks';
export * from './mingo-onboarding-card';
export * from './mingo-onboarding-card-skeleton';
export * from './mingo-welcome';
export * from './guide-welcome';
export * from './msp-organization-card';
export * from './msp-organization-card-skeleton';
export * from './guide-mode-banner';
export * from './mingo-chat-history';
export * from './mingo-archive-list';
export * from './composer-sheet';
export * from './mingo-chat-header';
export * from './mingo-chat-rail';
export { MingoChatSearchModal, type MingoChatSearchModalProps } from './mingo-chat-history-section';
export * from './mingo-history-rail';
export * from './mingo-chat-modals';
export * from './chat-header-icon-button';
export * from './chat-header-search-field';
export * from './chat-panel-header';
export * from './chat-composer';
export * from './chat-context-picker';
export * from './chat-context-memory-bar';
export * from './context-items-list';
export * from './chat-archive-page';
export { ChatListLoadError, type MingoDialogStatus, type MingoHistoryScope } from './mingo-chat-list-shared';
export * from './model-display';
export * from './chat-sidebar';
export * from './chat-nav-sidebar';
export * from './chat-list-empty-state';
export * from './chat-top-navigation';
export * from './onboarding-carousel';
export type { ChatRef } from './chat-ref.types';
export { remarkCardLinks } from './remark-card-links';
export { remarkMentionChips } from './remark-mention-chips';

// Card-supporting UI migrated from hub `components/shared/*` + `components/blog/*`
export {
  NavLinkAnchorViaRuntime,
  type NavLinkAnchorViaRuntimeProps,
  type NavLinkViaRuntimeInput,
  type NavLinkViaRuntimeProps,
  useNavLinkViaRuntime,
} from './nav-link-anchor-via-runtime';
export { SourceActionButton, type SourceActionButtonProps, type SourceActionDensity } from './source-action-button';
export {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
  type ChatAttachmentAddButtonProps,
  type ChatAttachmentChipStripProps,
  type StagedAttachment,
  CHAT_ATTACHMENT_MIME_TYPES,
  CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER,
} from './chat-attachment-bar';

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

// Chat utilities
export * from './utils';

// EmbeddableChat — THE chat. Hosts mount it once at the root after providing a
// <ChatRuntimeContext.Provider>. Its module is loaded on its own (`lazy`), and
// only once the page has loaded and the browser is idle (`afterPageLoad`), or at
// once when something asks for it (an open event, `open` or `defaultOpen`): a
// chat that starts closed must not download and run beside the page's first
// paint, which is what slowed every page's LCP on phones. An open sent before it
// has loaded is held and delivered (`ask-ai-events`).
export type { ChatPrefillDraft, EmbeddableChatHandle, EmbeddableChatProps } from './embeddable-chat';
const LoadedEmbeddableChat = lazy(() =>
  import('./embeddable-chat').then(module => ({ default: module.EmbeddableChat })),
);
export const EmbeddableChat = forwardRef<EmbeddableChatHandle, EmbeddableChatProps>((props, ref) => {
  const [loadRequested, setLoadRequested] = useState(false);
  const load = loadRequested || Boolean(props.open) || Boolean(props.defaultOpen);
  useEffect(() => holdAskAiOpens(), []);
  useEffect(() => {
    if (load) return undefined;
    const start = () => setLoadRequested(true);
    for (const name of ASK_AI_OPEN_EVENTS) window.addEventListener(name, start);
    const cancel = afterPageLoad(start);
    return () => {
      cancel();
      for (const name of ASK_AI_OPEN_EVENTS) window.removeEventListener(name, start);
    };
  }, [load]);
  if (!load) return null;
  return createElement(Suspense, { fallback: null }, createElement(LoadedEmbeddableChat, { ...props, ref }));
});
EmbeddableChat.displayName = 'EmbeddableChat';
export { MINGO_V2_RAIL_WIDTH, MINGO_V2_SPLIT_WIDTH } from './chat-dimensions';
export { ASK_AI_OPEN_EVENT, ASK_AI_OPEN_EVENTS, ASK_AI_OPEN_WITH_REF_EVENT } from './utils/ask-ai-events';
export { chatDayLabel } from './utils/chat-day-label';
export * from './proxy-credentials-panel';
