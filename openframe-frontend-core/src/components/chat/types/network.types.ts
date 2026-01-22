/**
 * Network and communication types
 * Contains types for NATS, WebSocket, and network configuration
 */

import type { ChatType } from './chat.types'

// ========== NATS Types ==========

export type NatsMessageType = 'message' | 'admin-message'

export type NatsConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'closed' | 'error'

// ========== Network Configuration ==========

export const NETWORK_CONFIG = {
  SHARED_CLOSE_DELAY_MS: 3000,
  CONNECT_TIMEOUT_MS: 10_000,
  RECONNECT_TIME_WAIT_MS: 2000,
  PING_INTERVAL_MS: 30_000,
  MAX_PING_OUT: 3,
  DEFAULT_MESSAGE_LIMIT: 50,
  POLL_MESSAGE_LIMIT: 10,
} as const

export type NetworkConfig = typeof NETWORK_CONFIG

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

// ========== WebSocket Types ==========

export interface WebSocketMessage {
  type: string
  payload: any
  timestamp?: string
  id?: string
}

export interface WebSocketConfig {
  url: string
  protocols?: string | string[]
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onOpen?: (event: Event) => void
  onClose?: (event: CloseEvent) => void
  onError?: (event: Event) => void
  onMessage?: (event: MessageEvent) => void
}

// ========== Fetch Functions ==========

export type FetchChunksFunction = (
  dialogId: string,
  chatType: ChatType,
  fromSequenceId?: number | null
) => Promise<ChunkData[]>

// ========== Network Response Types ==========

export interface NetworkResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T = any> extends NetworkResponse<T> {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

// ========== API Error Types ==========

export interface NetworkError {
  code: string
  message: string
  details?: any
  timestamp: string
}