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

// ========== Author Type Definitions ==========

export const AUTHOR_TYPE = {
  USER: 'user',
  ADMIN: 'admin',
  FAE: 'fae',
  MINGO: 'mingo',
  SYSTEM: 'system',
} as const

export type AuthorType = typeof AUTHOR_TYPE[keyof typeof AUTHOR_TYPE]

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
  user?: {
    id: string
    firstName?: string
    lastName?: string
  }
}

// ========== ChatRef-key construction ==========

/**
 * Canonical key shape for the `chatRefs` map carried on every Message —
 * `${docType}:${externalId}`. The chat-message renderer looks up inline
 * `[card://<type>:<id>]` markers via this same key shape, so keeping the
 * construction in one place avoids divergence between the writer
 * (server-driven attach in decision_resolved handler) and the readers
 * (renderingPlan in chat-message-enhanced).
 *
 * Pure function — no runtime cost vs. inline template literal — but the
 * call-site reads as "the chat-ref key for this ref" rather than as a
 * generic string-concat, which is what the eye is hunting for when
 * scanning the file for ref-keyed logic.
 */
export function buildChatRefKey(docType: string, externalId: string): string {
  return `${docType}:${externalId}`
}

// ========== Content-shape helpers ==========

import type { MessageContent, MessageSegment } from './message.types'

/** Helper function to check if content is structured (segment array). */
export function isStructuredContent(content: MessageContent): content is MessageSegment[] {
  return Array.isArray(content)
}

/** Normalize either a string or segment array into a uniform segment array. */
export function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

// ========== SSE event data shapes (wire shapes) ==========

export interface TextEventData {
  type: 'TEXT'
  text: string
}

export interface ToolExecutionEventData {
  type: 'EXECUTING_TOOL' | 'EXECUTED_TOOL'
  integratedToolType: string
  toolFunction: string
  parameters?: Record<string, any>
  result?: string
  success?: boolean
}

export type SSEEventData = TextEventData | ToolExecutionEventData

// ========== Quick-action chip shape ==========

export interface QuickAction {
  id: string
  text: string
}
