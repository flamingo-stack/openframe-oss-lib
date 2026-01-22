/**
 * Message-related types
 * Contains all message structures, segments, and content types
 */

import type { AssistantType, ChatApprovalStatus, MessageOwner } from './chat.types'

// ========== Message Type Definitions ==========

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  EXECUTING_TOOL: 'EXECUTING_TOOL',
  EXECUTED_TOOL: 'EXECUTED_TOOL',
  APPROVAL_REQUEST: 'APPROVAL_REQUEST',
  APPROVAL_RESULT: 'APPROVAL_RESULT',
  ERROR: 'ERROR',
  MESSAGE_START: 'MESSAGE_START',
  MESSAGE_END: 'MESSAGE_END',
  MESSAGE_REQUEST: 'MESSAGE_REQUEST',
  AI_METADATA: 'AI_METADATA',
} as const

export type MessageType = typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE]

// ========== Tool Execution Types ==========

export interface ToolExecutionData {
  type: 'EXECUTING_TOOL' | 'EXECUTED_TOOL'
  integratedToolType: string
  toolFunction: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
}

// ========== Approval Request Types ==========

export interface ApprovalRequestData {
  command: string
  explanation?: string
  icon?: React.ReactNode
  requestId?: string
  approvalRequestId?: string
  approvalType?: string
}

export interface ApprovalResultData {
  approvalRequestId: string
  approved: boolean
  approvalType?: string
}

// ========== Message Segment Types ==========

export type TextSegment = {
  type: 'text'
  text: string
}

export type ToolExecutionSegment = {
  type: 'tool_execution'
  data: ToolExecutionData
}

export type ApprovalRequestSegment = {
  type: 'approval_request'
  data: ApprovalRequestData & { approvalType?: string }
  status?: ChatApprovalStatus
  onApprove?: (requestId?: string) => void
  onReject?: (requestId?: string) => void
}

export type MessageSegment = TextSegment | ToolExecutionSegment | ApprovalRequestSegment

export type MessageContent = string | MessageSegment[]

// ========== Message Data Types (from GraphQL/API) ==========

export interface MessageDataBase {
  type: MessageType
}

export interface TextMessageData extends MessageDataBase {
  type: 'TEXT'
  text?: string
}

export interface ExecutingToolMessageData extends MessageDataBase {
  type: 'EXECUTING_TOOL'
  integratedToolType?: string
  toolFunction?: string
  parameters?: Record<string, any>
}

export interface ExecutedToolMessageData extends MessageDataBase {
  type: 'EXECUTED_TOOL'
  integratedToolType?: string
  toolFunction?: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
}

export interface ApprovalRequestMessageData extends MessageDataBase {
  type: 'APPROVAL_REQUEST'
  approvalRequestId?: string
  approvalType?: string
  command?: string
  explanation?: string
}

export interface ApprovalResultMessageData extends MessageDataBase {
  type: 'APPROVAL_RESULT'
  approvalRequestId?: string
  approved?: boolean
  approvalType?: string
}

export interface ErrorMessageData extends MessageDataBase {
  type: 'ERROR'
  error?: string
  details?: string
}

export interface AIMetadataMessageData extends MessageDataBase {
  type: 'AI_METADATA'
  modelName?: string
  providerName?: string
  provider?: string
  contextWindow?: number
}

export type MessageData =
  | TextMessageData
  | ExecutingToolMessageData
  | ExecutedToolMessageData
  | ApprovalRequestMessageData
  | ApprovalResultMessageData
  | ErrorMessageData
  | AIMetadataMessageData

// ========== Historical Message Types ==========

export interface HistoricalMessage {
  id: string
  dialogId?: string
  chatType?: string
  createdAt: string
  owner?: MessageOwner
  messageData?: MessageData | MessageData[]
}

// ========== Processed Message Types ==========

export interface ProcessedMessage {
  id: string
  role: 'user' | 'assistant' | 'error'  // Limited to display roles
  content: MessageContent
  name?: string
  assistantType?: AssistantType
  timestamp: Date
  avatar?: string
}

// ========== Base Message Interface ==========

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'  // Limited to display roles
  content: MessageContent
  name?: string
  assistantType?: AssistantType
  timestamp?: Date
  avatar?: string | null
}