/**
 * Shared types for dialog chat functionality
 * Used by both client (openframe-chat) and admin (mingo) applications
 */

// ========== Chunk Data Types ==========

export interface ChunkData {
  sequenceId?: number
  type: string
  text?: string
  integratedToolType?: string
  toolFunction?: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
  error?: string
  details?: string
  approvalRequestId?: string
  approval_request_id?: string
  approvalType?: string
  command?: string
  explanation?: string
  approved?: boolean
  modelName?: string
  providerName?: string
  provider?: string
  contextWindow?: number
  [key: string]: any
}

export interface BufferedChunk {
  chunk: ChunkData
  messageType: NatsMessageType
}

// ========== NATS Types ==========

export type NatsMessageType = 'message' | 'admin-message'

export type NatsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'closed' | 'error'

// ========== Message Types ==========

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

// ========== Chat Types ==========

export const CHAT_TYPE = {
  CLIENT: 'CLIENT_CHAT',
  ADMIN: 'ADMIN_AI_CHAT',
} as const

export type ChatType = typeof CHAT_TYPE[keyof typeof CHAT_TYPE]

// ========== Owner Types ==========

export const OWNER_TYPE = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
  ASSISTANT: 'ASSISTANT',
} as const

export type OwnerType = typeof OWNER_TYPE[keyof typeof OWNER_TYPE]

// ========== Approval Types ==========

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type ChatApprovalStatus = typeof APPROVAL_STATUS[keyof typeof APPROVAL_STATUS]

// ========== Network Config ==========

export const NETWORK_CONFIG = {
  SHARED_CLOSE_DELAY_MS: 3000,
  CONNECT_TIMEOUT_MS: 10_000,
  RECONNECT_TIME_WAIT_MS: 2000,
  PING_INTERVAL_MS: 30_000,
  MAX_PING_OUT: 3,
  DEFAULT_MESSAGE_LIMIT: 50,
  POLL_MESSAGE_LIMIT: 10,
} as const

// ========== Fetch Chunks Function Type ==========

export type FetchChunksFunction = (
  dialogId: string,
  chatType: ChatType,
  fromSequenceId?: number | null
) => Promise<ChunkData[]>

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
}

export interface UseNatsDialogSubscriptionReturn {
  isConnected: boolean
  isSubscribed: boolean
}
