/**
 * Message-related types
 * Contains all message structures, segments, and content types
 */

import type { AssistantType, AuthorType, ChatApprovalStatus, MessageOwner } from './chat.types'

// ========== Message Type Definitions ==========

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  THINKING: 'THINKING',
  EXECUTING_TOOL: 'EXECUTING_TOOL',
  EXECUTED_TOOL: 'EXECUTED_TOOL',
  APPROVAL_REQUEST: 'APPROVAL_REQUEST',
  APPROVAL_RESULT: 'APPROVAL_RESULT',
  ERROR: 'ERROR',
  MESSAGE_START: 'MESSAGE_START',
  MESSAGE_END: 'MESSAGE_END',
  MESSAGE_REQUEST: 'MESSAGE_REQUEST',
  AI_METADATA: 'AI_METADATA',
  TOKEN_USAGE: 'TOKEN_USAGE',
  CONTEXT_COMPACTION_START: 'CONTEXT_COMPACTION_START',
  CONTEXT_COMPACTION_END: 'CONTEXT_COMPACTION_END',
  DIRECT_MESSAGE: 'DIRECT_MESSAGE',
  SYSTEM: 'SYSTEM',
  DIALOG_CLOSED: 'DIALOG_CLOSED',
} as const

export type MessageType = typeof MESSAGE_TYPE[keyof typeof MESSAGE_TYPE]

// ========== Scroll Anchor (per-message render hint) ==========

/** Per-message viewport-positioning hint sent on the per-turn metadata
 *  leading frame at the START of every assistant response. The chat
 *  message-list reads it to override the default `use-stick-to-bottom`
 *  tail behaviour for a single message. Field is OPTIONAL — when omitted
 *  (or set to `'bottom'`) the chat tails as today. Only `'top'` opts in
 *  to the alternative behaviour (used by display-action answers whose
 *  body is a long article and should be read top-down). */
export const SCROLL_ANCHOR = { TOP: 'top', BOTTOM: 'bottom' } as const

export type ScrollAnchor = typeof SCROLL_ANCHOR[keyof typeof SCROLL_ANCHOR]

// ========== Tool Execution Types ==========

export interface ToolExecutionData {
  type: 'EXECUTING_TOOL' | 'EXECUTED_TOOL'
  integratedToolType: string
  toolFunction: string
  /** Backend-issued human-readable title (mirrors `PendingToolCallData.toolTitle`). */
  toolTitle?: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
  /**
   * Backend-issued id (matches `PendingToolCallData.toolExecutionRequestId`).
   * When present, lets the accumulator merge this execution event into the
   * matching approval batch row instead of emitting a standalone segment.
   */
  toolExecutionRequestId?: string
}

/**
 * Snapshot of an in-flight tool kept between the `EXECUTING_TOOL` and
 * `EXECUTED_TOOL` events. The backend only sends `toolTitle` on
 * `EXECUTING_TOOL`; carrying this state lets the accumulator restore it onto
 * the merged `EXECUTED_TOOL` segment instead of falling back to the raw
 * `toolFunction`.
 */
export interface ExecutingToolState {
  integratedToolType: string
  toolFunction: string
  /** Mirrors {@link ToolExecutionData.toolTitle}; absent on `EXECUTED_TOOL`. */
  toolTitle?: string
  parameters?: Record<string, any>
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

/**
 * Single tool call inside a batch approval request.
 * Mirrors backend PendingToolCallDto.
 */
export interface PendingToolCallData {
  toolExecutionRequestId: string
  toolName: string
  toolTitle?: string
  toolExplanation?: string
  toolType?: string
  requiresApproval: boolean
  approvalType?: string | null
  toolCallArguments?: Record<string, any> | null
}

/**
 * Per-tool execution state inside an approval batch.
 * Populated by EXECUTING_TOOL / EXECUTED_TOOL chunks that carry a
 * `toolExecutionRequestId` matching one of the batch's tool calls.
 */
export interface ApprovalBatchExecutionState {
  status: 'executing' | 'done'
  result?: string
  success?: boolean
}

export interface ApprovalBatchData {
  approvalRequestId: string
  /** Highest approval type required across the batch (e.g. ADMIN beats CLIENT). */
  approvalType: string
  toolCalls: PendingToolCallData[]
  /**
   * Keyed by `PendingToolCallData.toolExecutionRequestId`. Absent before
   * approval; rows without an entry render as "queued" (loader) once the
   * batch itself is approved.
   */
  executions?: Record<string, ApprovalBatchExecutionState>
}

// ========== Message Segment Types ==========

export type TextSegment = {
  type: 'text'
  text: string
}

export type ThinkingSegment = {
  type: 'thinking'
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
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
}

export type ApprovalBatchSegment = {
  type: 'approval_batch'
  data: ApprovalBatchData
  status?: ChatApprovalStatus
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
}

export type ErrorSegment = {
  type: 'error'
  title: string
  details?: string
}

export type ContextCompactionSegment = {
  type: 'context_compaction'
  status: 'started' | 'completed'
  summary?: string
}

export type MessageSegment = TextSegment | ThinkingSegment | ToolExecutionSegment | ApprovalRequestSegment | ApprovalBatchSegment | ErrorSegment | ContextCompactionSegment

export type MessageContent = string | MessageSegment[]

// ========== Message Data Types (from GraphQL/API) ==========

export interface MessageDataBase {
  type: MessageType
}

export interface TextMessageData extends MessageDataBase {
  type: 'TEXT'
  text?: string
}

export interface ThinkingMessageData extends MessageDataBase {
  type: 'THINKING'
  text?: string
}

export interface ExecutingToolMessageData extends MessageDataBase {
  type: 'EXECUTING_TOOL'
  integratedToolType?: string
  toolFunction?: string
  /** Backend-issued human-readable title (wire field, mirrors `ChunkData.title`). */
  title?: string
  parameters?: Record<string, any>
  toolExecutionRequestId?: string
}

export interface ExecutedToolMessageData extends MessageDataBase {
  type: 'EXECUTED_TOOL'
  integratedToolType?: string
  toolFunction?: string
  /** Backend-issued human-readable title (wire field, mirrors `ChunkData.title`). */
  title?: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
  toolExecutionRequestId?: string
}

export interface ApprovalRequestMessageData extends MessageDataBase {
  type: 'APPROVAL_REQUEST'
  approvalRequestId?: string
  approvalType?: string
  command?: string
  explanation?: string
  /** Present when the approval is a batch of tool calls (new format). */
  toolCalls?: PendingToolCallData[]
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

export interface TokenUsageData {
  inputTokensSize: number
  outputTokensSize: number
  totalTokensSize: number
  contextSize: number
}

export interface SystemMessageData extends MessageDataBase {
  type: 'SYSTEM'
  text?: string
}

export interface ContextCompactionStartMessageData extends MessageDataBase {
  type: 'CONTEXT_COMPACTION_START'
}

export interface ContextCompactionEndMessageData extends MessageDataBase {
  type: 'CONTEXT_COMPACTION_END'
  summary?: string
}

export type MessageData =
  | TextMessageData
  | ThinkingMessageData
  | ExecutingToolMessageData
  | ExecutedToolMessageData
  | ApprovalRequestMessageData
  | ApprovalResultMessageData
  | ErrorMessageData
  | AIMetadataMessageData
  | SystemMessageData
  | ContextCompactionStartMessageData
  | ContextCompactionEndMessageData

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
  authorType?: AuthorType
  timestamp: Date
  avatar?: string
}

// ========== Base Message Interface ==========

import type { ChatRef as MessageChatRef } from '../chat-ref.types'

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'error'  // Limited to display roles
  content: MessageContent
  name?: string
  assistantType?: AssistantType
  authorType?: AuthorType
  timestamp?: Date
  avatar?: string | null
  /** Per-row metadata for inline entity-card rendering on this message
   *  (v6.1 §B.2.6). Keyed by `<documentType>:<primaryKey>`. Optional —
   *  user messages and legacy turns omit this field. The host's
   *  `renderEntityCard` callback resolves keys to inline components. */
  chatRefs?: Record<string, MessageChatRef>
  /** Per-message viewport-positioning hint. OPTIONAL — when omitted (the
   *  default for every LLM Q&A / browse / search / find / Discuss path)
   *  the chat tails as today via `use-stick-to-bottom`. Only `'top'` opts
   *  in to the alternative top-anchor behaviour (display-action answers
   *  whose body is a long article). The server is the sole decision-
   *  maker — set on the metadata leading frame. */
  scrollAnchor?: ScrollAnchor
}