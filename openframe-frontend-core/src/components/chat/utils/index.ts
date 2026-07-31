/**
 * Message processing utilities
 * Export all utilities for processing chat messages
 */

// Chunk parsing utilities
export {
  parseChunkToAction,
  isControlChunk,
  isErrorChunk,
  isMetadataChunk,
  extractTextFromChunk,
} from './chunk-parser'

// Segment accumulator
export {
  MessageSegmentAccumulator,
  createMessageSegmentAccumulator,
  type AccumulatorCallbacks,
} from './message-segment-accumulator'

// Historical message processing
export {
  processHistoricalMessages,
  extractErrorMessages,
  processHistoricalMessagesWithErrors,
} from './process-historical-messages'

// Incomplete message state extraction
export {
  extractIncompleteMessageState,
} from './extract-incomplete-message-state'

// History <-> realtime reconciliation
export {
  mergeHistoryWithRealtime,
  computeHistoryPrepend,
  flattenMessagePagesChronological,
  maxPersistedStreamSeq,
  SYNTHETIC_REALTIME_ID_PREFIXES,
  type MergeableChatMessage,
  type HistoryMergeInput,
  type HistoryPrependResult,
} from './history-merge'

// Tool call helpers
export { getCommandText } from './tool-call-helpers'

// Chat-side click + navigation helpers
export { CHIP_ACTION_BUTTON_CLASS } from './chip-action-class'
export { chatChipClass, type ChipClassOptions } from './chip-styles'
export {
  NEW_TAB_FEATURES,
  isModifierClick,
  stripSameOriginToPath,
  resolveExternalNavigation,
  type ExternalNavResolution,
} from './chat-nav-resolution'
export {
  handleChatNavClick,
  type ChatNavClickInput,
} from './nav-click-handler'
// The unified navigation-execution primitive — single source of truth for
// new-tab/same-tab + internal/external + embed/host + the runtime→router→window
// fallback. Every surface routes through it (handleChatNavClick is now a wrapper).
export {
  executeNavigation,
  executeNavigationImperative,
  type ExecuteNavigationClickArgs,
  type ExecuteNavigationImperativeArgs,
  type NavClickEvent,
} from './execute-navigation'
export {
  computeIsNewTab,
  newTabAnchorAttrs,
  buildAnchorProps,
} from './nav-anchor-props'
export { isCrossOriginUrl } from './is-cross-origin-url'
export {
  decideNewTab,
  type DecideNewTabInput,
  type NavSurface,
  type RuntimeMode,
} from './decide-new-tab'

// Chat-proxy auth (localStorage adapter + fetch wrapper)
export {
  getChatProxyAuth,
  getPersistedProxyEmail,
  setChatProxyAuth,
  clearChatProxyAuth,
  applyProxyAuth,
  type ChatProxyAuth,
} from './chat-proxy-auth-storage'
export { chatAuthedFetch } from './chat-authed-fetch'

// Pure content helpers
export { flattenAssistantContent } from './flatten-assistant-content'
export {
  SCROLL_ANCHOR,
  type ScrollAnchor,
  SCROLL_ANCHOR_WIRE_KEY,
  parseScrollAnchor,
} from './scroll-anchor'
export {
  AUTO_CONTINUATION_DIRECTIVE_PREFIX,
  buildAutoContinuationDirective,
  type BuildAutoContinuationOptions,
} from './auto-continuation-directive'

// Slash-command + dispatch (lib-portable subset)
export {
  type WireCommandOverride,
  parseWireCommandOverride,
  sanitizeTitleForChat,
  formatSingularLookupInvocation,
  type CommandOverride,
  extractEntityIdFilter,
  buildDiscussAddendum,
} from './slash-dispatch-utils'

// Chat-attachment markdown formatter + strip parser
export {
  CHAT_ATTACHMENT_VIEW_URL_PREFIX,
  CHAT_ATTACHMENT_VIEW_TOKEN_QUERY_PARAM,
  ANTHROPIC_SUPPORTED_IMAGE_MIME,
  type ChatAttachment,
  buildChatAttachmentViewUrl,
  escapeMarkdownInline,
  formatChatAttachmentMarkdownForBubble,
  CHAT_ATTACHMENT_VIEW_URL_PREFIX_REGEX_ESCAPED,
  CHAT_ATTACHMENT_MARKDOWN_PATTERN,
  stripChatAttachmentMarkdown,
} from './chat-attachment-markdown'

// External app deep-links (chat surfaces)
export { clickupTaskUrl } from './external-app-urls'

// Agent status → color scheme
export { type ColorScheme, getStatusColorScheme } from './agent-status-message'

// ClickUp task-type label + canonical custom_item_id map
export { getTaskTypeLabel, CUSTOM_ITEM_ID } from './clickup-task-type-utils'

// Compact-card class constants + safe-href guard
export {
  COMPACT_CARD_OUTER,
  COMPACT_CARD_OUTER_STATIC,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_ICON_SLOT,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE_ROW,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_SUBTITLE,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_META_ROW,
  COMPACT_CARD_ROW_FILLER,
  safeHref,
} from './compact-card-classes'

// Icon + source registries (chat surfaces). The icon-registry file is
// the SINGLE source of truth for all icon-name → React-component lookup
// across the lib + the hub — kebab-case keys, with PascalCase aliases
// routed through `normalizeIconKey()` for DB columns that store
// component-style names (e.g. social_platforms.icon_name).
export {
  ICON_REGISTRY,
  getIconComponent,
  normalizeIconKey,
  getDynamicIcon,
  type DynamicIconSize,
} from './icon-registry'
// Library icon resolver — `icons-v2-generated`-backed, shared by the chat
// empty-state chips, the slash-command autocomplete, AND the admin icon picker
// (`ICON_OPTIONS`), so picked icons always display.
export {
  resolveIcon,
  ICON_ALIASES,
  ICON_OPTIONS,
  type IconComponent,
  type IconOption,
} from './icon-library'
export {
  SOURCE_ICON_NAMES,
  getSourceIconName,
  SOURCE_LABELS_BY_TABLE,
  getSourceLabel,
  DEFAULT_DOCUMENT_TYPE_TO_TABLE_ID,
  defaultTableIdForDocumentType,
} from './source-icons'
export {
  type SourceRowInput,
  type SourceRowContext,
  type SourceRowCTA,
  resolveSourceRowCTA,
  resolveSourceIcon,
} from './source-row-cta'

export * from './scripted-stream'
