import type { ReactNode } from 'react'
import { APPROVAL_STATUS, type ApprovalBatchData, type ChatApprovalStatus } from '../../chat/types'

export type NotificationVariant = 'default' | 'success' | 'warning' | 'error' | 'info'

export type NotificationSeverity = 'INFO' | 'WARNING' | 'DANGER'

export interface Notification {
  id: string
  variant?: NotificationVariant
  title: ReactNode
  description?: ReactNode
  createdAt: number
  read?: boolean
  settled?: boolean
  severity?: NotificationSeverity
  category?: string
  meta?: Record<string, unknown>
  onClick?: () => void
}

export type AddNotificationInput =
  Omit<Notification, 'id' | 'createdAt' | 'read' | 'settled'> & {
    id?: string
    createdAt?: number
    read?: boolean
  }

/** Per-notification tile renderer; return a node to override the default `NotificationTile`, or `undefined` to fall back. */
export type RenderNotificationTile = (
  notification: Notification,
  helpers: { onComplete: (id: string) => void; onSettle: (id: string) => void; liveDurationMs?: number },
) => ReactNode

/** Discriminator carried in `notification.meta.contextType` for Mingo approval requests. */
export const ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE = 'ADMIN_APPROVAL_REQUEST'

/** A single planned tool invocation awaiting approval. */
export interface ApprovalToolCallMeta {
  toolExecutionRequestId?: string | null
  toolName: string
  toolTitle?: string | null
  toolExplanation?: string | null
  toolType?: string | null
  requiresApproval?: boolean
  approvalType?: string | null
  toolCallArguments?: Record<string, unknown> | null
}

/** Approval payload stashed in `notification.meta` for an `ADMIN_APPROVAL_REQUEST` notification. */
export interface ApprovalNotificationMeta {
  approvalRequestId: string
  dialogId?: string | null
  ticketId?: string | null
  approvalType?: string | null
  /** Backend `ApprovalResolution`: PENDING | APPROVED | REJECTED | CANCELLED. Null until resolved. */
  resolution?: string | null
  /** Display name of the user who resolved the request; null until resolved (or for system actions). */
  resolvedByName?: string | null
  toolCalls: ApprovalToolCallMeta[]
}

export function isApprovalNotification(notification: Notification): boolean {
  return notification.meta?.contextType === ADMIN_APPROVAL_REQUEST_CONTEXT_TYPE
}

/** Safely read the approval payload off a notification; returns null when absent or malformed. */
export function getApprovalMeta(notification: Notification): ApprovalNotificationMeta | null {
  if (!isApprovalNotification(notification)) return null
  const meta = notification.meta
  const approvalRequestId = meta?.approvalRequestId
  const toolCalls = meta?.toolCalls
  if (typeof approvalRequestId !== 'string' || !Array.isArray(toolCalls)) return null
  return {
    approvalRequestId,
    dialogId: (meta?.dialogId as string | undefined) ?? null,
    ticketId: (meta?.ticketId as string | undefined) ?? null,
    approvalType: (meta?.approvalType as string | undefined) ?? null,
    resolution: (meta?.resolution as string | undefined) ?? null,
    resolvedByName: (meta?.resolvedByName as string | undefined) ?? null,
    toolCalls: toolCalls as ApprovalToolCallMeta[],
  }
}

/** Map the backend `ApprovalResolution` carried on a notification to a tile/batch status. */
export function resolutionToStatus(resolution: unknown): ChatApprovalStatus {
  switch (typeof resolution === 'string' ? resolution.toUpperCase() : undefined) {
    case 'APPROVED':
      return APPROVAL_STATUS.APPROVED
    case 'REJECTED':
      return APPROVAL_STATUS.REJECTED
    case 'CANCELLED':
      return APPROVAL_STATUS.CANCELLED
    default:
      return APPROVAL_STATUS.PENDING
  }
}

/** Build the `ApprovalBatchMessage` data payload from an approval notification's meta. */
export function approvalMetaToBatchData(approval: ApprovalNotificationMeta): ApprovalBatchData {
  return {
    approvalRequestId: approval.approvalRequestId,
    approvalType: approval.approvalType ?? '',
    toolCalls: approval.toolCalls.map((tc, index) => ({
      toolExecutionRequestId: tc.toolExecutionRequestId ?? `${approval.approvalRequestId}:${index}`,
      toolName: tc.toolName,
      toolTitle: tc.toolTitle ?? undefined,
      toolExplanation: tc.toolExplanation ?? undefined,
      toolType: tc.toolType ?? undefined,
      requiresApproval: tc.requiresApproval ?? true,
      approvalType: tc.approvalType ?? null,
      toolCallArguments: tc.toolCallArguments ?? null,
    })),
  }
}
