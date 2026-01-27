/**
 * Component prop types
 */

import type { HTMLAttributes, TextareaHTMLAttributes } from 'react'
import type { Message, MessageSegment, ApprovalRequestData, ToolExecutionData } from './message.types'
import type { AssistantType, ConnectionStatus, ChatApprovalStatus } from './chat.types'

// ========== Chat Container Props ==========

export interface ChatContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

// ========== Chat Header Props ==========

export interface ChatHeaderProps extends HTMLAttributes<HTMLDivElement> {
  userName?: string
  userTitle?: string
  userAvatar?: string
  onSettingsClick?: () => void
  onNewChat?: () => void
  showNewChat?: boolean
  connectionStatus?: ConnectionStatus
  serverUrl?: string | null
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
  avatar?: string | null
  timestamp?: Date
  showAvatar?: boolean
  isTyping?: boolean
  onApprove?: (requestId?: string) => void
  onReject?: (requestId?: string) => void
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
  pendingApprovals?: MessageSegment[]
  onApprove?: (requestId?: string) => void
  onReject?: (requestId?: string) => void
}

export interface ChatMessageListRef {
  scrollToBottom: (smooth?: boolean) => void
  getScrollPosition: () => { scrollTop: number; scrollHeight: number; clientHeight: number }
  setScrollPosition: (position: { scrollTop: number }) => void
}

// ========== Chat Input Props ==========

export interface ChatInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onSubmit'> {
  onSend?: (message: string) => void
  sending?: boolean
  awaitingResponse?: boolean
  reserveAvatarOffset?: boolean
  disabled?: boolean
  maxRows?: number
  showSendButton?: boolean
  sendButtonLabel?: string
}

export interface ChatInputRef {
  focus: () => void
  blur: () => void
  clear: () => void
  setValue: (value: string) => void
  getValue: () => string
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
  isExpanded?: boolean
  onToggleExpand?: () => void
}

// ========== Approval Request Message Props ==========

export interface ApprovalRequestMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: ApprovalRequestData
  onApprove?: (requestId?: string) => void
  onReject?: (requestId?: string) => void
  status?: ChatApprovalStatus
  disabled?: boolean
}

// ========== Model Display Props ==========

export interface ModelDisplayProps extends HTMLAttributes<HTMLDivElement> {
  provider?: string
  modelName?: string
  displayName?: string
  contextWindow?: number
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