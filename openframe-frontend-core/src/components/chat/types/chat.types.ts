/**
 * Core chat types and enums
 */

// ========== Chat Type Definitions ==========

export const CHAT_TYPE = {
  CLIENT: 'CLIENT_CHAT',
  ADMIN: 'ADMIN_AI_CHAT',
} as const

export type ChatType = typeof CHAT_TYPE[keyof typeof CHAT_TYPE]

// ========== Owner Type Definitions ==========

export const OWNER_TYPE = {
  CLIENT: 'CLIENT',
  ADMIN: 'ADMIN',
  ASSISTANT: 'ASSISTANT',
} as const

export type OwnerType = typeof OWNER_TYPE[keyof typeof OWNER_TYPE]

// ========== Role Definitions ==========

export const MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  ERROR: 'error',
  SYSTEM: 'system',
} as const

export type MessageRole = typeof MESSAGE_ROLE[keyof typeof MESSAGE_ROLE]

// ========== Assistant Type Definitions ==========

export const ASSISTANT_TYPE = {
  FAE: 'fae',
  MINGO: 'mingo',
} as const

export type AssistantType = typeof ASSISTANT_TYPE[keyof typeof ASSISTANT_TYPE]

// ========== Approval Status Definitions ==========

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

export type ChatApprovalStatus = typeof APPROVAL_STATUS[keyof typeof APPROVAL_STATUS]

// ========== Connection Status Definitions ==========

export const CONNECTION_STATUS = {
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  CLOSED: 'closed',
  ERROR: 'error',
} as const

export type ConnectionStatus = typeof CONNECTION_STATUS[keyof typeof CONNECTION_STATUS]

// ========== Message Owner Interface ==========

export interface MessageOwner {
  type: OwnerType
  machineId?: string
  userId?: string
  model?: string
}
