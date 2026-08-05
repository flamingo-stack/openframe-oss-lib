/**
 * Message processing and transformation types
 * Contains types for message parsing, accumulation, and processing
 */

import type { MessageSegment, PendingToolCallData, ExecutingToolState } from './message.types'
import type { ChatApprovalStatus, AssistantType } from './chat.types'
import type { ChunkData } from './network.types'

// NOTE: the `ParsedChunkAction` union that used to live here was DELETED
// alongside the legacy `chunk-parser`. The wire → normalized-event
// vocabulary is now `ChatStreamEvent` in `src/chat-protocol/events.ts`,
// produced by `decodeNatsChunk`.

// ========== Accumulator State ==========

export interface PendingApproval {
  command: string
  explanation?: string
  approvalType: string
}

export interface AccumulatorState {
  segments: MessageSegment[]
  pendingApprovals: Map<string, PendingApproval>
  executingTools: Map<string, ExecutingToolState>
  escalatedApprovals?: Map<
    string,
    { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
  >
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
  /**
   * Consumer-owned. Forwarded by the host app (e.g. oss-tenant chat client
   * reads its `'batch-approvals'` feature flag and passes it down). The lib
   * defaults to legacy single-card rendering when this is omitted — it will
   * not enable the batch UI on its own.
   */
  batchApprovalsEnabled?: boolean
}

// NOTE: `ChunkProcessorOptions` (the options bag of the deleted
// `ChunkProcessor`) and `MessageTransformer` were DELETED — both were left
// behind by the chunk-processor removal with zero references in lib, hub, or
// app.

// ========== Message Transformation Types ==========

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