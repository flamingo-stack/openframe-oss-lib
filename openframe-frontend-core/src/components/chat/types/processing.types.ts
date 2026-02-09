/**
 * Message processing and transformation types
 * Contains types for message parsing, accumulation, and processing
 */

import type { MessageSegment, ProcessedMessage, ToolExecutionSegment } from './message.types'
import type { ChatApprovalStatus, AssistantType } from './chat.types'
import type { ChunkData, NatsMessageType } from './network.types'

// ========== Parsed Chunk Result Types ==========

export type ParsedChunkAction =
  | { action: 'message_start' }
  | { action: 'message_end' }
  | { action: 'error'; error: string; details?: string }
  | { action: 'metadata'; modelName: string; providerName: string; contextWindow: number }
  | { action: 'text'; text: string }
  | { action: 'tool_execution'; segment: ToolExecutionSegment }
  | { action: 'approval_request'; requestId: string; command: string; explanation?: string; approvalType: string }
  | { action: 'approval_result'; requestId: string; approved: boolean; approvalType: string }
  | { action: 'message_request'; text: string }

// ========== Accumulator State ==========

export interface PendingApproval {
  command: string
  explanation?: string
  approvalType: string
}

export interface AccumulatorState {
  segments: MessageSegment[]
  currentTextBuffer: string
  pendingApprovals: Map<string, PendingApproval>
  executingTools: Map<string, { 
    integratedToolType: string
    toolFunction: string
    parameters?: Record<string, any>
  }>
  escalatedApprovals?: Map<string, { command: string; explanation?: string; approvalType: string }>
}

// ========== Message Processing Options ==========

export interface MessageProcessingOptions {
  /** Assistant name to use (default: 'Fae') */
  assistantName?: string
  /** Assistant type for styling (default: 'fae') */
  assistantType?: AssistantType
  /** Avatar URL for assistant messages */
  assistantAvatar?: string
  /** Callback for approval actions */
  onApprove?: (requestId?: string) => Promise<void> | void
  /** Callback for rejection actions */
  onReject?: (requestId?: string) => Promise<void> | void
  /** Filter by chat type (e.g., 'CLIENT_CHAT') */
  chatTypeFilter?: string
  /** Map of approval statuses by request ID */
  approvalStatuses?: Record<string, ChatApprovalStatus>
  /** Approval types to display directly (others get escalated) - defaults to all types */
  displayApprovalTypes?: string[]
}

// ========== Chunk Processing Types ==========

export interface ChunkProcessor {
  processChunk: (chunk: ChunkData, messageType: NatsMessageType) => ParsedChunkAction | null
  reset: () => void
}

export interface ChunkProcessorOptions {
  onMessageStart?: () => void
  onMessageEnd?: () => void
  onError?: (error: string, details?: string) => void
  onText?: (text: string) => void
  onToolExecution?: (segment: MessageSegment) => void
  onApprovalRequest?: (data: any) => void
  onApprovalResult?: (data: any) => void
  onMetadata?: (data: any) => void
}

// ========== Message Transformation Types ==========

export interface MessageTransformer {
  transform: (input: any) => ProcessedMessage | null
  batch: (inputs: any[]) => ProcessedMessage[]
}

export interface TransformationOptions {
  preserveOriginal?: boolean
  mergeSegments?: boolean
  formatTimestamp?: boolean
  includeMetadata?: boolean
}

// ========== Stream Processing Types ==========

export interface StreamProcessor {
  start: () => void
  stop: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  getState: () => StreamState
}

export interface StreamState {
  isActive: boolean
  isPaused: boolean
  messagesProcessed: number
  chunksBuffered: number
  lastProcessedAt?: Date
  errors: Array<{ timestamp: Date; error: string }>
}

// ========== Buffer Management Types ==========

export interface BufferManager {
  add: (chunk: ChunkData) => void
  flush: () => ChunkData[]
  clear: () => void
  size: () => number
  isEmpty: () => boolean
  isFull: () => boolean
}

export interface BufferOptions {
  maxSize?: number
  flushInterval?: number
  onFlush?: (chunks: ChunkData[]) => void
  onOverflow?: (droppedChunks: ChunkData[]) => void
}