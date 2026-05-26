/**
 * API and hook types
 * Contains types for API interactions and React hooks
 */

import type { ChunkData, NatsMessageType, FetchChunksFunction } from './network.types'
import type { ChatType, ChatApprovalStatus } from './chat.types'
import type {
  MessageSegment,
  PendingToolCallData,
  TokenUsageData,
  ExecutingToolState,
  ToolExecutionSegment,
} from './message.types'

// ========== Hook Options ==========

export interface UseChunkCatchupOptions {
  dialogId: string | null
  onChunkReceived: (chunk: ChunkData, messageType: NatsMessageType) => void
  /**
   * Chat types to fetch during catchup
   * Default: ['CLIENT_CHAT']
   */
  chatTypes?: ChatType[]
  /**
   * Custom function to fetch chunks from the API
   * If not provided, a default implementation using fetch will be used
   */
  fetchChunks?: FetchChunksFunction
}

export interface UseNatsDialogSubscriptionOptions {
  enabled: boolean
  dialogId: string | null
  /**
   * NATS topics to subscribe to
   * Default: ['message']
   */
  topics?: NatsMessageType[]
  onEvent?: (payload: unknown, messageType: NatsMessageType) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onSubscribed?: () => void
  /** Called on disconnect, before nats.ws attempts reconnection. Use to refresh auth (cookies/tokens). */
  onBeforeReconnect?: () => Promise<void> | void
  /**
   * Function to get the NATS WebSocket URL
   */
  getNatsWsUrl: () => string | null
  /**
   * NATS client configuration options
   */
  clientConfig?: {
    name?: string
    user?: string
    pass?: string
  }
  /**
   * Reconnection backoff tuning. All fields optional; omitted values fall back to NETWORK_CONFIG defaults.
   * Schedule: the first `fastRetries` attempts use `fastRetryDelayMs`, then exponential
   * `initialDelayMs * multiplier ** (attempt - fastRetries)` capped at `maxDelayMs`. ±50% jitter is
   * always applied on top.
   */
  reconnectionBackoff?: {
    /** Attempts to fire at `fastRetryDelayMs` before exponential phase kicks in. Default: 0. */
    fastRetries?: number
    /** Delay used during the fast-retry phase. Default: NETWORK_CONFIG.RETRY_INITIAL_DELAY_MS. */
    fastRetryDelayMs?: number
    /** Base delay for the exponential phase. Default: NETWORK_CONFIG.RETRY_INITIAL_DELAY_MS. */
    initialDelayMs?: number
    /** Upper cap on any single retry delay. Default: NETWORK_CONFIG.RETRY_MAX_DELAY_MS. */
    maxDelayMs?: number
    /** Per-attempt multiplier during exponential phase. Default: NETWORK_CONFIG.RETRY_BACKOFF_MULTIPLIER. */
    multiplier?: number
  }
}

// ========== Hook Return Types ==========

export interface UseChunkCatchupReturn {
  catchUpChunks: (fromSequenceId?: number | null) => Promise<void>
  processChunk: (chunk: ChunkData, messageType: NatsMessageType, forceProcess?: boolean) => boolean
  resetChunkTracking: () => void
  startInitialBuffering: () => void
  isBufferingActive: () => boolean
  processedCount: number
  /** Reset internal guards and re-run catch-up from the last known sequence ID. Use after reconnection to fetch missed messages. */
  resetAndCatchUp: () => Promise<void>
}

export interface UseNatsDialogSubscriptionReturn {
  isConnected: boolean
  isSubscribed: boolean
  /** Incremented each time the NATS client reconnects after a disconnect. Starts at 0. */
  reconnectionCount: number
}

export interface UseJetStreamDialogSubscriptionOptions {
  enabled: boolean
  dialogId: string | null
  /** JetStream stream name. Default: 'CHAT_CHUNKS'. */
  streamName?: string
  /** Single topic to subscribe to. */
  topic: NatsMessageType
  /**
   * Resume from this JetStream sequence + 1. When null/undefined, the consumer starts with
   * DeliverPolicy.New (live tail only).
   */
  optStartSeq?: number | null
  onEvent?: (payload: unknown, messageType: NatsMessageType) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onSubscribed?: () => void
  /** Called on disconnect, before reconnect attempt. Use to refresh auth. */
  onBeforeReconnect?: () => Promise<void> | void
  /** Build the NATS WebSocket URL (or null when not yet available). */
  getNatsWsUrl: () => string | null
  clientConfig?: {
    name?: string
    user?: string
    pass?: string
  }
  reconnectionBackoff?: {
    fastRetries?: number
    fastRetryDelayMs?: number
    initialDelayMs?: number
    maxDelayMs?: number
    multiplier?: number
  }
  /** Consumer inactivity threshold in ms before NATS auto-cleans it. Default: 5 minutes. */
  inactiveThresholdMs?: number
}

export interface UseJetStreamDialogSubscriptionReturn {
  isConnected: boolean
  isSubscribed: boolean
  /** Incremented each time the underlying NATS connection reconnects. Starts at 0. */
  reconnectionCount: number
  /** Highest JetStream stream sequence observed so far (null before first delivery). */
  currentStreamSeq: number | null
}

export interface SegmentsUpdateMetadata {
  /** Segments should be appended to the last assistant message */
  append?: boolean
  /** The update was triggered by context compaction */
  isCompacting?: boolean
}

export interface RealtimeChunkCallbacks {
  /** Called when MESSAGE_START is received */
  onStreamStart?: () => void
  /** Called when MESSAGE_END is received */
  onStreamEnd?: () => void
  /** Called when AI_METADATA is received */
  onMetadata?: (metadata: { modelDisplayName: string; modelName: string; providerName: string; contextWindow: number }) => void
  /** Called when segments are updated */
  onSegmentsUpdate?: (segments: MessageSegment[], metadata?: SegmentsUpdateMetadata) => void
  /** Called when an error is received */
  onError?: (error: string, details?: string) => void
  /** Called when a user message request is received (echo) */
  onUserMessage?: (text: string, metadata?: { ownerType?: string; displayName?: string }) => void
  /** Called when TOKEN_USAGE chunk is received with token stats */
  onTokenUsage?: (data: TokenUsageData) => void
  /** Called when a direct message is received (immediately displayed) */
  onDirectMessage?: (text: string, metadata?: { ownerType?: string; displayName?: string }) => void
  /** Called when a system message is received (e.g. "User joined the chat") */
  onSystemMessage?: (text: string) => void
  /** Callback for approval actions */
  onApprove?: (requestId?: string) => Promise<void> | void
  /** Callback for rejection actions */
  onReject?: (requestId?: string) => Promise<void> | void
  /** Called when a non-client approval request is received (for escalation) */
  onEscalatedApproval?: (requestId: string, data: { command: string; explanation?: string; approvalType: string }) => void
  /** Called when an escalated approval result is received */
  onEscalatedApprovalResult?: (requestId: string, approved: boolean, data: { command: string; explanation?: string; approvalType: string }) => void
  /**
   * Called whenever an `APPROVAL_RESULT` chunk is processed. Fires in addition
   * to the accumulator's in-message status flip so consumers can find the
   * matching `approval_request` / `approval_batch` segment in an *earlier*
   * message bubble (e.g. when a user-interrupted approval is resolved while
   * a new assistant message is streaming). Idempotent — safe to no-op if no
   * matching segment is found dialog-wide.
   */
  onApprovalResolved?: (requestId: string, status: ChatApprovalStatus, approvalType: string) => void
  /**
   * Called whenever an `EXECUTED_TOOL` chunk is processed. Lets consumers
   * merge the result into the originating `EXECUTING_TOOL` (or batch
   * `executions[execId]`) segment in an earlier message bubble when the tool
   * outlived its message scope. Idempotent.
   */
  onToolExecuted?: (segment: ToolExecutionSegment) => void
  /** Called when a DIALOG_CLOSED chunk is received */
  onDialogClosed?: () => void
}

export interface UseRealtimeChunkProcessorOptions {
  callbacks: RealtimeChunkCallbacks
  /**
   * Filter approval types that should be displayed directly
   * Others will trigger onEscalatedApproval
   * Default: ['CLIENT']
   */
  displayApprovalTypes?: string[]
  /**
   * Map of existing approval statuses
   */
  approvalStatuses?: Record<string, ChatApprovalStatus>
  /**
   * Initialize accumulator with existing state from incomplete historical message
   * Used to continue building messages across page refreshes or reconnections
   */
  initialState?: {
    /** Existing segments to continue building upon */
    existingSegments?: MessageSegment[]
    /** Pending approvals that haven't been resolved */
    pendingApprovals?: Map<string, { command: string; explanation?: string; approvalType: string }>
    /** Executing tools waiting for completion */
    executingTools?: Map<string, ExecutingToolState>
    /** Escalated approvals */
    escalatedApprovals?: Map<
      string,
      { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
    >
  }
  /**
   * When true, THINKING chunks are processed into thinking segments. When false
   * (default), they are dropped before parsing — they never enter the
   * accumulator or store.
   */
  enableThinking?: boolean
  /**
   * Consumer-owned (e.g. set in `openframe-oss-tenant` chat client via the
   * `'batch-approvals'` feature flag and forwarded here). The lib does NOT
   * default this to a batch-on behavior — when omitted it falls back to the
   * legacy single-card rendering.
   *
   * When true: `APPROVAL_REQUEST` chunks containing `toolCalls[]` are rendered
   * as a single batch card. When false / omitted: the batch is split into N
   * legacy approval cards (one per tool that requires approval), all sharing
   * the same `approvalRequestId`. Tools with `requiresApproval=false` are
   * dropped from the UI in the unfolded mode.
   */
  batchApprovalsEnabled?: boolean
}

export interface UseRealtimeChunkProcessorReturn {
  /** Process a single chunk */
  processChunk: (chunk: unknown) => void
  /** Get current segments */
  getSegments: () => MessageSegment[]
  /** Reset the accumulator */
  reset: () => void
  /** Update approval status for a request */
  updateApprovalStatus: (requestId: string, status: ChatApprovalStatus) => MessageSegment[]
  /** Get pending approval requests */
  getPendingApprovals: () => Map<
    string,
    { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
  >
}

// ========== API Request Types ==========

export interface ChatAPIRequest {
  dialogId: string
  message: string
  metadata?: Record<string, any>
}

export interface ChatAPIResponse {
  success: boolean
  messageId?: string
  error?: string
}

export interface DialogCreateRequest {
  name?: string
  metadata?: Record<string, any>
}

export interface DialogCreateResponse {
  id: string
  name?: string
  createdAt: string
}

export interface DialogListRequest {
  page?: number
  pageSize?: number
  orderBy?: 'createdAt' | 'updatedAt' | 'name'
  orderDirection?: 'asc' | 'desc'
}

export interface DialogListResponse {
  dialogs: Array<{
    id: string
    name?: string
    createdAt: string
    updatedAt?: string
    lastMessage?: string
    messageCount?: number
  }>
  total: number
  page: number
  pageSize: number
}

// ========== Approval API Types ==========

export interface ApprovalRequest {
  requestId: string
  approved: boolean
  reason?: string
}

export interface ApprovalResponse {
  success: boolean
  error?: string
}

// ========== Settings API Types ==========

export interface ChatSettings {
  assistantName?: string
  assistantType?: string
  avatarUrl?: string
  autoScroll?: boolean
  soundEnabled?: boolean
  notificationsEnabled?: boolean
}

export interface UpdateSettingsRequest {
  settings: Partial<ChatSettings>
}

export interface UpdateSettingsResponse {
  success: boolean
  settings?: ChatSettings
  error?: string
}