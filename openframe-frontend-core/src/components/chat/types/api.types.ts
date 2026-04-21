/**
 * API and hook types
 * Contains types for API interactions and React hooks
 */

import type { ChunkData, NatsMessageType, FetchChunksFunction } from './network.types'
import type { ChatType, ChatApprovalStatus } from './chat.types'
import type { MessageSegment, TokenUsageData } from './message.types'

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
    executingTools?: Map<string, { integratedToolType: string; toolFunction: string; parameters?: Record<string, any> }>
    /** Escalated approvals */
    escalatedApprovals?: Map<string, { command: string; explanation?: string; approvalType: string }>
  }
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
  getPendingApprovals: () => Map<string, { command: string; explanation?: string; approvalType: string }>
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