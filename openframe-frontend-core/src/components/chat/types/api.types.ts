/**
 * API and hook types
 * Contains types for API interactions and React hooks
 */

import type { ChunkData, NatsMessageType, FetchChunksFunction } from './network.types'
import type { ChatType, ChatApprovalStatus } from './chat.types'
import type { MessageSegment } from './message.types'

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

export interface RealtimeChunkCallbacks {
  /** Called when MESSAGE_START is received */
  onStreamStart?: () => void
  /** Called when MESSAGE_END is received */
  onStreamEnd?: () => void
  /** Called when AI_METADATA is received */
  onMetadata?: (metadata: { modelName: string; providerName: string; contextWindow: number }) => void
  /** Called when segments are updated */
  onSegmentsUpdate?: (segments: MessageSegment[]) => void
  /** Called when an error is received */
  onError?: (error: string, details?: string) => void
  /** Called when a user message request is received (echo) */
  onUserMessage?: (text: string) => void
  /** Callback for approval actions */
  onApprove?: (requestId?: string) => Promise<void> | void
  /** Callback for rejection actions */
  onReject?: (requestId?: string) => Promise<void> | void
  /** Called when a non-client approval request is received (for escalation) */
  onEscalatedApproval?: (requestId: string, data: { command: string; explanation?: string; approvalType: string }) => void
  /** Called when an escalated approval result is received */
  onEscalatedApprovalResult?: (requestId: string, approved: boolean, data: { command: string; explanation?: string; approvalType: string }) => void
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