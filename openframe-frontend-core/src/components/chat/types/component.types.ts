/**
 * Component prop types
 */

import type { ComponentType, HTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { AssistantType, AuthorType, ChatApprovalStatus, ConnectionStatus } from './chat.types'
import type { ApprovalRequestData, Message, MessageSegment, ToolExecutionData } from './message.types'
import type { ChatRef } from '../chat-ref.types'

// ========== Chat Container Props ==========

export interface ChatContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

// ========== Chat Header Props ==========

export interface ChatHeaderTicketInfo {
  title: React.ReactNode
  meta?: React.ReactNode
  status?: string
}

export interface ChatHeaderProps extends HTMLAttributes<HTMLDivElement> {
  userName?: string
  userTitle?: string
  userAvatar?: string
  userIcon?: React.ReactNode
  onSettingsClick?: () => void
  onNewChat?: () => void
  onClose?: () => void
  onBack?: () => void
  showNewChat?: boolean
  connectionStatus?: ConnectionStatus
  serverUrl?: string | null
  headerActions?: React.ReactNode
  ticketInfo?: ChatHeaderTicketInfo
}

// ========== Connection Indicator Props ==========

export interface ConnectionIndicatorProps {
  status: ConnectionStatus
}

// ========== Chat Message Enhanced Props ==========

export interface ChatMessageEnhancedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  role: 'user' | 'assistant' | 'error'
  content: string | MessageSegment[]
  name?: string
  assistantType?: AssistantType
  authorType?: AuthorType
  assistantIcon?: React.ReactNode
  avatar?: string | null
  timestamp?: Date
  showAvatar?: boolean
  isTyping?: boolean
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  /**
   * Per-row metadata for inline entity-card rendering (v6.1 §B.2.6+§B.2.7).
   * Keyed by `<documentType>:<primaryKey>`. When present AND
   * `renderEntityCard` is also provided, text segments are passed through
   * the `remarkCardLinks` plugin and `[card://<type>:<id>]` markers
   * expand into the host's chosen inline component. When unset (or
   * `renderEntityCard` unset), messages render as plain markdown.
   */
  chatRefs?: Record<string, ChatRef>
  /**
   * Host-provided renderer for inline entity cards (v6.1 §B.2.7 — DRY
   * duplications #2). The OSS-lib delegates all entity-specific rendering
   * (type→icon mapping, hover-card chrome, action buttons, slash-command
   * gating) to the host so the library stays free of app-specific
   * knowledge.
   *
   * Return `null` for any ref the host can't render — the renderer falls
   * back to plain text title-only.
   */
  renderEntityCard?: (reference: ChatRef) => React.ReactNode
  /**
   * Host-provided anchor component for markdown links. When supplied, the
   * `<a>` override in the markdown renderer delegates to this component
   * so the host's unified click rule (e.g. `useNavLink`) owns routing
   * for every link in the message — same-origin → soft RSC nav,
   * cross-origin → new tab, modifier-clicks defer to the browser.
   *
   * Implemented as a component (not a callback) so the host can call its
   * own routing hooks (`useRouter`, doc-tree context, etc.) inside the
   * rendered link. When unset, the OSS-lib falls back to a built-in
   * cross-origin heuristic (same-tab same-origin + `target="_blank"`
   * cross-origin) — duplicated logic, kept for back-compat with hosts
   * that haven't migrated to the prop yet.
   *
   * `card://` markers are still intercepted by the override BEFORE this
   * component runs, so the host need not handle them.
   */
  NavLinkAnchor?: React.ComponentType<{
    href: string
    className?: string
    children?: React.ReactNode
  } & Record<string, unknown>>
}

// ========== Chat Message List Props ==========

export interface ChatMessageListProps extends HTMLAttributes<HTMLDivElement> {
  messages: Message[]
  dialogId?: string
  isLoading?: boolean
  isTyping?: boolean
  typingMessage?: string
  smoothScroll?: boolean
  autoScroll?: boolean
  showAvatars?: boolean
  contentClassName?: string
  assistantType?: AssistantType
  assistantIcon?: React.ReactNode
  pendingApprovals?: MessageSegment[]
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  // Infinite scroll for loading older messages
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
  /** Host-provided renderer for inline entity cards. Forwarded verbatim
   *  to every message's ChatMessageEnhanced. v6.1 §B.2.7. */
  renderEntityCard?: (reference: ChatRef) => React.ReactNode
  /** Host-provided anchor for markdown links. Forwarded verbatim to every
   *  message's ChatMessageEnhanced. Owns the unified click rule
   *  (same-origin soft nav, cross-origin new tab). */
  NavLinkAnchor?: React.ComponentType<{
    href: string
    className?: string
    children?: React.ReactNode
  } & Record<string, unknown>>
}

export interface ChatMessageListRef {
  scrollToBottom: (smooth?: boolean) => void
  getScrollPosition: () => { scrollTop: number; scrollHeight: number; clientHeight: number }
  setScrollPosition: (position: { scrollTop: number }) => void
}

// ========== Chat Input Props ==========

/** Action ids — the dispatch BEHAVIORS exposed by a slash command's UI
 *  affordances. The host (e.g. multi-platform-hub) owns the mapping
 *  from id → input-buffer mutation:
 *
 *   - `browse`  : submit `/<id>` bare → top-N items / canonical doc.
 *   - `search`  : prefill `/<id> ` → user types FTS query.
 *   - `find`    : prefill `/<id> ""` (cursor between quotes) → singular
 *                 lookup (ILIKE).
 *   - `display` : prefill `/<id> display ""` (cursor between quotes) →
 *                 server-side intercept reads the matched row's raw
 *                 markdown body verbatim into the chat (no LLM turn).
 *
 *  Mirrors the server-side `SlashCommandActionId` union; kept as a
 *  string-literal union (not enum) so JSON wire shape is stable. */
export type SlashCommandActionId = 'browse' | 'search' | 'find' | 'display'

/** Resolved action affordance — `label` is ALWAYS populated by the
 *  server (override OR default). The OSS-lib renders directly without
 *  label-resolution branching — single source of truth lives in the
 *  hub's `slash-commands-config.ts`. */
export interface SlashCommandSummaryAction {
  id: SlashCommandActionId
  label: string
}

export interface SlashCommandSummary {
  id: string
  description: string
  /** Optional `[arg-name]` hint shown after the command id in autocomplete,
   *  e.g. `/podcasts [title or id]`. Per 2026 best practice (Codex CLI /
   *  Claude Code SDK argument-hint frontmatter). */
  argumentHint?: string
  /** Opaque source id (e.g. `'podcasts'`, `'clickup-roadmap'`) — resolved
   *  by the consumer-provided `resolveSourceIcon` callback into an icon
   *  so the autocomplete row carries the same visual identity as the
   *  empty-state chip. When the resolver returns undefined OR this
   *  field is missing, the row renders without an icon (fallback). */
  primarySourceId?: string
  /** Human-readable command label (e.g. "My Tickets", "Product Releases").
   *  When set, the dropdown row renders this as the bold heading instead
   *  of the raw `primarySourceId` slug. Single source of truth: same
   *  field that backs the empty-state chip's title. Falls back to the
   *  `primarySourceId` slug when undefined. */
  label?: string
  /** Action affordances declared by the server-side registry. The
   *  dropdown row renders one button per entry, in array order. Empty
   *  array = no buttons (degenerate; servers should always declare
   *  ≥1 action). Single source of truth — same array drives the
   *  empty-state chip on the host side via the synchronous registry. */
  actions: SlashCommandSummaryAction[]
}

/** Icon + label pair returned by the consumer's `resolveSourceIcon`. The
 *  Icon is a React component (lucide-react or UI-Kit shape); the label
 *  is the human-readable source name (e.g. "Podcasts", "ClickUp Roadmap"). */
export interface SlashCommandSourceMeta {
  Icon: ComponentType<{ className?: string }>
  label: string
}

export interface SlashCommandsProp {
  /** Server-side fetch — typically wraps `GET /api/docs/commands`. The hub
   *  provides this; the OSS-lib has no knowledge of hub route paths. The
   *  chat source is resolved server-side from the calling deployment, so
   *  this callback does NOT take a `source` parameter — passing one would
   *  let a tampered client request a different platform's commands. */
  fetchCommands: (
    prefix: string,
    signal?: AbortSignal,
  ) => Promise<SlashCommandSummary[]>
  /** Optional: resolve a `primarySourceId` to an icon + label pair so the
   *  autocomplete row carries the same visual identity as the empty-state
   *  chip for that source. The host provides this by looking up the
   *  table's icon name and resolving to a React component. Returns
   *  undefined for unknown ids; the row falls back to no-icon rendering. */
  resolveSourceIcon?: (sourceId: string) => SlashCommandSourceMeta | undefined
  /** Generic action handler — fires when the user clicks any of the
   *  command's declared action buttons (Recent / Search / Find / …).
   *  The host owns the mapping from `actionId` to the chat-input-ref
   *  mutation:
   *    - 'browse' → `chatInputRef.current.submit(`/${cmd.id}`)`
   *    - 'search' → `chatInputRef.current.setValue(`/${cmd.id} `)`
   *    - 'find'   → `chatInputRef.current.setValueAndCursor(...)`
   *  When undefined, no action buttons are rendered (the row is still
   *  clickable for the default select behavior). */
  onAction?: (cmd: SlashCommandSummary, actionId: SlashCommandActionId) => void
}

export interface ChatInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  onSend?: (message: string) => void
  onStop?: () => void | Promise<void>
  sending?: boolean
  awaitingResponse?: boolean
  reserveAvatarOffset?: boolean
  disabled?: boolean
  maxRows?: number
  showSendButton?: boolean
  sendButtonLabel?: string
  /** When provided, shows a slash-command autocomplete dropdown when the
   *  user's text starts with `/`. The dropdown uses UI-Kit `<Card>` + button
   *  primitives (no raw HTML elements) and ODS tokens for theming.
   *  Backward compat: omit to disable autocomplete entirely. */
  slashCommands?: SlashCommandsProp
}

export interface ChatInputRef {
  focus: () => void
  blur: () => void
  clear: () => void
  setValue: (value: string) => void
  getValue: () => string
  /** Set the input value AND position the textarea caret at the given
   *  zero-based offset. Used by the empty-state quick-action "Find"
   *  button that pre-fills `/<cmd> ""` and lands the cursor between
   *  the quotes so the user can immediately start typing the title. */
  setValueAndCursor: (value: string, cursorOffset: number) => void
  /** Set the input value and immediately fire `onSend` with the new
   *  value (subject to the same `sending`/`disabled` guards as a
   *  manual click). Used by the empty-state quick-action "Recent"
   *  button to dispatch `/<cmd>` in one click without forcing the
   *  user to press Enter. */
  submit: (value: string) => void
}

// ========== Chat Typing Indicator Props ==========

export interface ChatTypingIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  text?: string
  name?: string
  dotClassName?: string
}

// ========== Tool Execution Display Props ==========

export interface ToolExecutionDisplayProps extends HTMLAttributes<HTMLDivElement> {
  message: ToolExecutionData
}

// ========== Approval Request Message Props ==========

export interface ApprovalRequestMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: ApprovalRequestData
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
  status?: ChatApprovalStatus
  disabled?: boolean
}

// ========== Error Message Display Props ==========

export interface ErrorMessageDisplayProps extends HTMLAttributes<HTMLDivElement> {
  title: string
  details?: string
}

// ========== Context Compaction Display Props ==========

export interface ContextCompactionDisplayProps extends HTMLAttributes<HTMLDivElement> {
  status: 'started' | 'completed'
}

// ========== Thinking Display Props ==========

export interface ThinkingDisplayProps extends HTMLAttributes<HTMLDivElement> {
  text: string
  isStreaming?: boolean
}

// ========== Model Display Props ==========

export interface ModelDisplayProps extends HTMLAttributes<HTMLDivElement> {
  provider?: string
  modelName?: string
  displayName?: string
  contextWindow?: number
  usedTokens?: number
  showIcon?: boolean
  /**
   * Per-call token breakdown for the hover-tooltip (v6.1 §A.3). When
   * provided alongside non-empty fields, the entire ModelDisplay is
   * wrapped in a HoverCard trigger that surfaces "Answer model + each
   * helper" rows on hover. Use this for chat surfaces that aggregate a
   * Sonnet answer with Haiku helpers (query rewriter / classifier /
   * summarizer). Absent → renders the bare display unchanged
   * (backward-compatible — every existing caller keeps working).
   */
  breakdown?: ModelUsageBreakdown
  /**
   * Cache-hit % across the answer call's input + cached + creation
   * tokens. Surfaced in the breakdown tooltip's footer. Drives a
   * "cache savings" summary line.
   */
  hitRatePct?: number
  /**
   * Answer call's input tokens — surfaced in the breakdown tooltip's
   * "Answer model" row alongside outputTokens. `usedTokens` (sum) is
   * still the right prop for the inline "X / Y" display; this pair
   * powers the per-row split inside the tooltip.
   */
  inputTokens?: number
  /** Answer call's output tokens — pairs with `inputTokens`. */
  outputTokens?: number
}

/**
 * Cross-call token breakdown captured by the chat route across all
 * Claude calls in a turn (Sonnet answer + Haiku rewriter + Haiku
 * classifier + Haiku summarizer). Every field is optional — chats that
 * skip a helper (e.g., short-conversation summarizer-skipped path) omit
 * the field, and the tooltip just doesn't render that row.
 */
export interface ModelUsageBreakdown {
  haikuRewriter?: { input: number; output: number }
  haikuClassifier?: { input: number; output: number }
  haikuSummarizer?: { input: number; output: number }
}

// ========== Chat Quick Action Props ==========

export interface ChatQuickActionProps extends HTMLAttributes<HTMLButtonElement> {
  text: string
  icon?: React.ReactNode
  onAction?: (text: string) => void
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  /** Whether this action should show the hint animation */
  isHintActive?: boolean
  /** Callback when user clicks the action - stops hint */
  onHintInteraction?: () => void
  disabled?: boolean
  loading?: boolean
}

// ========== Dialog Item Props ==========

export interface DialogItem {
  id: string
  title: string
  lastMessage?: string
  timestamp?: Date | string
  isActive?: boolean
  unreadMessagesCount?: number
}

// ========== Chat Sidebar Props ==========

export interface ChatSidebarProps extends HTMLAttributes<HTMLDivElement> {
  onNewChat?: () => void
  onDialogSelect?: (dialogId: string) => void
  dialogs?: DialogItem[]
  activeDialogId?: string
  isLoading?: boolean
  isCreatingDialog?: boolean
  children?: React.ReactNode
  // Infinite scroll props
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

// ========== Dialog List Item Props ==========

export interface DialogListItemProps extends HTMLAttributes<HTMLDivElement> {
  dialog: DialogItem
  isActive?: boolean
  onDialogSelect?: (dialogId: string) => void
}