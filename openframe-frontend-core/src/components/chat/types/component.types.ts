/**
 * Component prop types
 */

import type { ButtonHTMLAttributes, ComponentType, HTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { AssistantType, AuthorType, ChatApprovalStatus, ConnectionStatus } from './chat.types'
import type { ApprovalRequestData, Message, MessageSegment, ToolExecutionData } from './message.types'

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
}

export interface ChatMessageListRef {
  scrollToBottom: (smooth?: boolean) => void
  getScrollPosition: () => { scrollTop: number; scrollHeight: number; clientHeight: number }
  setScrollPosition: (position: { scrollTop: number }) => void
}

// ========== Chat Input Props ==========

export interface SlashCommandSummary {
  id: string
  description: string
  /** Optional `[arg-name]` hint shown after the command id in autocomplete,
   *  e.g. `/podcasts [title or id]`. Per 2026 best practice (Codex CLI /
   *  Claude Code SDK argument-hint frontmatter). */
  argumentHint?: string
  /** Opaque source id (e.g. `'podcasts'`, `'clickup-roadmap'`) — resolved
   *  by the consumer-provided `resolveSourceIcon` callback into an icon
   *  + label so the autocomplete row carries the same visual identity as
   *  the empty-state chip. When the resolver returns undefined OR this
   *  field is missing, the row renders without an icon (fallback). */
  primarySourceId?: string
  /** When true, the row's "Find" action button is shown. False/undefined
   *  hides it (singular ILIKE-by-name doesn't apply to the command). */
  supportsSingular?: boolean
}

/** Icon + label pair returned by the consumer's `resolveSourceIcon`. The
 *  Icon is a React component (lucide-react or UI-Kit shape); the label
 *  is the human-readable source name (e.g. "Podcasts", "ClickUp Roadmap"). */
export interface SlashCommandSourceMeta {
  Icon: ComponentType<{ className?: string }>
  label: string
}

export interface SlashCommandsProp {
  /** DocSource identifier for the registry lookup. Kept as a plain string so
   *  the OSS lib doesn't import hub-internal types. */
  source: string
  /** Server-side fetch — typically wraps `GET /api/docs/commands`. The hub
   *  provides this; the OSS-lib has no knowledge of hub route paths. */
  fetchCommands: (
    source: string,
    prefix: string,
    signal?: AbortSignal,
  ) => Promise<SlashCommandSummary[]>
  /** Optional: resolve a `primarySourceId` to an icon + label pair so the
   *  autocomplete row carries the same visual identity as the empty-state
   *  chip for that source. Hub provides this by looking up
   *  `RAG_SOURCE_DISPLAY[sourceId]`. Returns undefined for unknown ids;
   *  the row falls back to no-icon rendering. */
  resolveSourceIcon?: (sourceId: string) => SlashCommandSourceMeta | undefined
  /** Optional Recent action — fires when the user clicks the "Recent"
   *  button on an autocomplete row. The hub maps this to
   *  `chatInputRef.current.submit(`/${cmd.id}`)` (auto-send the bare
   *  command). When undefined, the Recent button is not rendered. */
  onActionRecent?: (cmd: SlashCommandSummary) => void
  /** Optional Search action — fires when the user clicks "Search". The hub
   *  maps this to `chatInputRef.current.setValue(`/${cmd.id} `)`. When
   *  undefined, the Search button is not rendered. */
  onActionSearch?: (cmd: SlashCommandSummary) => void
  /** Optional Find action — fires when the user clicks "Find". The hub
   *  maps this to `chatInputRef.current.setValueAndCursor` to pre-fill
   *  `/<cmd> ""` and land the cursor between quotes. The button only
   *  renders when BOTH `onActionFind` is provided AND the command's
   *  `supportsSingular` flag is true. */
  onActionFind?: (cmd: SlashCommandSummary) => void
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

export interface ToolExecutionDisplayProps extends ButtonHTMLAttributes<HTMLButtonElement> {
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