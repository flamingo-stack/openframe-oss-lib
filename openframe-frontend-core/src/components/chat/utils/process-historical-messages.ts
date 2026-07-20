/**
 * Utility for processing historical messages from GraphQL/API into
 * display-ready format.
 *
 * Phase 3 of the chat unification reduced this file to DECODE + ENVELOPE:
 *
 *   - `decodeHistoricalMessageData` maps one persisted `MessageData` item
 *     into the shared `ChatStreamEvent` vocabulary (historical items share
 *     the MESSAGE_TYPE vocabulary with NATS chunks but are NOT full chunk
 *     envelopes — e.g. compaction summaries ride in `summary`, not `text`,
 *     and APPROVAL_RESULT rows carry `resolvedByName` directly);
 *   - `applyHistoryEvent` replays each decoded event into the shared
 *     per-turn kernel (`MessageSegmentAccumulator` — the same kernel the
 *     master `createChatStreamReducer` instantiates) with the
 *     history-specific approval semantics (display-all default, pending
 *     tracking + `flushPendingApprovals`, `approvalStatuses` overrides);
 *   - the ENVELOPE (user/assistant flush-grouping, OWNER_TYPE author /
 *     display-name / avatar resolution, standalone SYSTEM handling,
 *     per-message contextItems mapping, per-turn streamSeq MAX) lives ONCE
 *     in `processHistory` — the previous near-duplicate second copy was
 *     deleted (`processHistoricalMessagesWithErrors` is an alias; the two
 *     snapshots were byte-identical).
 *
 * Adapters then feed the processed rows into the reducer via
 * `initializeWithState` (see `useNatsChatAdapter.loadDialogHistory`).
 */

import {
  MESSAGE_TYPE,
  OWNER_TYPE,
  type AuthorType,
  type ChatApprovalStatus,
  type HistoricalMessage,
  type PendingToolCallData,
  type ProcessedMessage,
  type MessageProcessingOptions,
  type MessageData,
  type MessageOwner,
} from '../types'
import type { ChatStreamEvent } from '../../../chat-protocol/events'
import { MessageSegmentAccumulator, createMessageSegmentAccumulator } from './message-segment-accumulator'
import { getCommandText } from './tool-call-helpers'

function getOwnerDisplayName(owner?: MessageOwner): string {
  if (owner?.type === OWNER_TYPE.ADMIN && owner.user) {
    const { firstName, lastName } = owner.user
    const name = [firstName, lastName].filter(Boolean).join(' ')
    if (name) return name
  }
  return owner?.type === OWNER_TYPE.ADMIN ? 'Admin' : 'You'
}

/** Per-message author avatar (e.g. an admin's profile photo) when the owner
 *  carries one. `imageUrl` may be relative; the host resolves it downstream. */
function getOwnerAvatar(owner?: MessageOwner): string | undefined {
  return owner?.user?.image?.imageUrl ?? undefined
}

function pushStandaloneMessages(
  processedMessages: ProcessedMessage[],
  msg: HistoricalMessage,
  messageDataArray: MessageData[],
): void {
  messageDataArray.forEach((data) => {
    if (data.type === MESSAGE_TYPE.SYSTEM && 'text' in data && data.text) {
      processedMessages.push({
        id: msg.id,
        role: 'user',
        content: '',
        name: data.text,
        authorType: 'system',
        timestamp: new Date(msg.createdAt),
        ...(typeof msg.lastChunkStreamSeq === 'number' ? { streamSeq: msg.lastChunkStreamSeq } : {}),
      })
    }
  })
}

// =============================================================================
// Decode — persisted MessageData item → shared ChatStreamEvent vocabulary
// =============================================================================

/**
 * Map one persisted `MessageData` item to a normalized `ChatStreamEvent`.
 * Thin shim over the NATS chunk decoder's core mapping — the differences
 * are exactly the persisted-row divergences from the realtime envelope:
 *
 *   - compaction summaries arrive in `summary` (realtime: `text`);
 *   - APPROVAL_RESULT rows carry `resolvedByName` (realtime chunks carry
 *     the resolver's name as `displayName`);
 *   - `approvalType` defaults to 'CLIENT' (legacy history parity;
 *     realtime defaults APPROVAL_REQUEST to 'USER');
 *   - batch `toolCalls` pass through verbatim (already the persisted
 *     `PendingToolCallData` shape — no normalization pass).
 *
 * Returns `null` for rows the assistant-turn path doesn't decode (SYSTEM
 * is handled by the envelope's standalone path; user TEXT rows are handled
 * by the envelope's user path).
 */
export function decodeHistoricalMessageData(data: MessageData): ChatStreamEvent | null {
  switch (data.type) {
    case MESSAGE_TYPE.TEXT:
      if ('text' in data && data.text) {
        return { type: 'text-delta', text: data.text }
      }
      return null

    case MESSAGE_TYPE.THINKING:
      if ('text' in data && data.text) {
        return { type: 'thinking-delta', text: data.text }
      }
      return null

    case MESSAGE_TYPE.EXECUTING_TOOL:
      if ('integratedToolType' in data) {
        return {
          type: 'tool-execution',
          data: {
            type: 'EXECUTING_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            toolTitle: typeof data.title === 'string' ? data.title : undefined,
            parameters: data.parameters,
            toolExecutionRequestId: data.toolExecutionRequestId,
          },
        }
      }
      return null

    case MESSAGE_TYPE.EXECUTED_TOOL:
      if ('integratedToolType' in data) {
        return {
          type: 'tool-execution',
          data: {
            type: 'EXECUTED_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            toolTitle: typeof data.title === 'string' ? data.title : undefined,
            parameters: data.parameters,
            result: data.result,
            success: data.success,
            toolExecutionRequestId: data.toolExecutionRequestId,
          },
        }
      }
      return null

    case MESSAGE_TYPE.APPROVAL_REQUEST:
      if ('approvalRequestId' in data && data.approvalRequestId) {
        return {
          type: 'approval-request',
          requestId: data.approvalRequestId,
          approvalType: data.approvalType || 'CLIENT',
          command: data.command || '',
          explanation: data.explanation,
          ...(Array.isArray(data.toolCalls) ? { toolCalls: data.toolCalls } : {}),
        }
      }
      return null

    case MESSAGE_TYPE.APPROVAL_RESULT:
      if ('approvalRequestId' in data && data.approvalRequestId) {
        return {
          type: 'approval-resolved',
          requestId: data.approvalRequestId,
          status: data.approved ? 'approved' : 'rejected',
          approvalType: data.approvalType,
          resolvedByName: 'resolvedByName' in data ? data.resolvedByName : undefined,
        }
      }
      return null

    case MESSAGE_TYPE.ERROR:
      if ('error' in data) {
        return {
          type: 'error',
          title: data.error || 'An error occurred',
          details: 'details' in data ? data.details : undefined,
        }
      }
      return null

    case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
      return { type: 'compaction', phase: 'start' }

    case MESSAGE_TYPE.CONTEXT_COMPACTION_END:
      return {
        type: 'compaction',
        phase: 'end',
        summary: 'summary' in data && typeof data.summary === 'string' ? data.summary : undefined,
      }

    case MESSAGE_TYPE.SYSTEM:
      if ('text' in data && data.text) {
        return { type: 'participant', kind: 'system', text: data.text }
      }
      return null

    default:
      // Unknown message type — ignore.
      return null
  }
}

// =============================================================================
// Replay — decoded event → per-turn kernel (history approval semantics)
// =============================================================================

type EscalatedApprovals = Map<
  string,
  { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
>

/**
 * Replay one decoded event into the shared per-turn segment kernel with the
 * HISTORY approval semantics (an omitted `displayApprovalTypes` means
 * "display every approval type" — the original history behavior; the
 * realtime reducer defaults to `['CLIENT']`).
 */
function applyHistoryEvent(
  event: ChatStreamEvent,
  accumulator: MessageSegmentAccumulator,
  approvalStatuses: Record<string, string>,
  options: MessageProcessingOptions,
  escalatedApprovals?: EscalatedApprovals,
): void {
  // batchApprovalsEnabled is owned by the consumer (oss-tenant chat client /
  // openframe-frontend tickets). Defaults to ON so consumers that haven't
  // wired the flag yet get the batch UI; pass `false` to force legacy.
  const { displayApprovalTypes, batchApprovalsEnabled = true } = options

  switch (event.type) {
    case 'text-delta':
      accumulator.appendText(event.text)
      break

    case 'thinking-delta':
      accumulator.appendThinking(event.text)
      break

    case 'tool-execution':
      accumulator.addToolExecution({ type: 'tool_execution', data: event.data })
      break

    case 'approval-request': {
      const approvalType = event.approvalType || 'CLIENT'
      const toolCalls = event.toolCalls as PendingToolCallData[] | undefined
      const isBatch = !!toolCalls && toolCalls.length > 0

      if (!displayApprovalTypes || displayApprovalTypes.includes(approvalType)) {
        if (isBatch) {
          const status = (approvalStatuses[event.requestId] as ChatApprovalStatus) || 'pending'
          if (batchApprovalsEnabled) {
            accumulator.addApprovalBatch(event.requestId, approvalType, toolCalls!, status)
          } else {
            // Flag OFF — unfold batch into N legacy approval cards (same id).
            for (const call of toolCalls!) {
              if (!call.requiresApproval) continue
              accumulator.addApprovalRequest(
                event.requestId,
                getCommandText(call),
                call.toolExplanation,
                approvalType,
                status,
              )
            }
          }
        } else {
          // The resolution may already be known to the consumer (realtime
          // flipped it and fed it back via `approvalStatuses`) while the
          // matching APPROVAL_RESULT row is absent from the fetched history
          // pages. Without this, the single-approval path tracks it as
          // pending and `flushPendingApprovals()` resurrects it as a stale
          // sticky card on every history re-process. Mirror the batch path
          // and honor `approvalStatuses`.
          const resolvedStatus = approvalStatuses[event.requestId] as ChatApprovalStatus | undefined
          if (resolvedStatus === 'approved' || resolvedStatus === 'rejected') {
            accumulator.addApprovalRequest(
              event.requestId,
              event.command || '',
              event.explanation,
              approvalType,
              resolvedStatus,
            )
          } else {
            accumulator.trackApprovalRequest(event.requestId, {
              command: event.command || '',
              explanation: event.explanation,
              approvalType,
            })
          }
        }
      } else {
        escalatedApprovals?.set(event.requestId, {
          command: event.command || '',
          explanation: event.explanation,
          approvalType,
          ...(isBatch ? { toolCalls } : {}),
        })
      }
      break
    }

    case 'approval-resolved': {
      const requestId = event.requestId
      if (!requestId) break
      const existingStatus = approvalStatuses[requestId] as ChatApprovalStatus | undefined
      const status: ChatApprovalStatus = existingStatus || event.status
      const resolvedByName = event.resolvedByName
      const escalatedData = escalatedApprovals?.get(requestId)

      if (escalatedData?.toolCalls && escalatedData.toolCalls.length > 0) {
        if (batchApprovalsEnabled) {
          accumulator.addApprovalBatch(
            requestId,
            escalatedData.approvalType,
            escalatedData.toolCalls,
            status,
            undefined,
            resolvedByName,
          )
        } else {
          for (const call of escalatedData.toolCalls) {
            if (!call.requiresApproval) continue
            accumulator.addApprovalRequest(
              requestId,
              getCommandText(call),
              call.toolExplanation,
              escalatedData.approvalType,
              status,
            )
          }
        }
        escalatedApprovals?.delete(requestId)
        break
      }

      if (escalatedData) {
        accumulator.trackApprovalRequest(requestId, {
          command: escalatedData.command,
          explanation: escalatedData.explanation,
          approvalType: escalatedData.approvalType,
        })
        escalatedApprovals?.delete(requestId)
      }

      // If a segment with this id is already present (batch or legacy), just
      // flip its status. updateApprovalStatus matches both `approval_batch`
      // and `approval_request` segments.
      const before = accumulator.getSegments()
      const after = accumulator.updateApprovalStatus(requestId, status, resolvedByName)
      const updatedExisting = before.some((s, i) => after[i] !== s)
      if (updatedExisting) break

      accumulator.processApprovalResult(
        requestId,
        status === 'approved',
        event.approvalType || 'USER',
      )
      break
    }

    case 'error': {
      let message: string | undefined
      if (event.details) {
        try {
          message = JSON.parse(event.details)?.error?.message
        } catch {
          message = event.details
        }
      }
      accumulator.addError(event.title, message)
      break
    }

    case 'compaction':
      if (event.phase === 'start') {
        accumulator.addContextCompaction()
      } else {
        accumulator.completeContextCompaction(event.summary)
      }
      break

    default:
      // Participant/system rows are envelope concerns; everything else is
      // realtime-only vocabulary that never appears in persisted rows.
      break
  }
}

// =============================================================================
// Envelope — ONE implementation (previous duplicate deleted)
// =============================================================================

/**
 * Result type for historical message processing
 */
export interface ProcessHistoricalMessagesResult {
  messages: ProcessedMessage[]
  escalatedApprovals: EscalatedApprovals
}

/**
 * Process an array of historical messages into display-ready format
 */
export function processHistoricalMessages(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {},
): ProcessHistoricalMessagesResult {
  const {
    assistantName = 'Fae',
    assistantType = 'fae',
    assistantAvatar,
    onApprove,
    onReject,
    chatTypeFilter,
    approvalStatuses = {},
    // An omitted option means "display every approval type" — the original
    // history semantics. Deliberately NOT defaulted to the realtime
    // reducer's ['CLIENT']: consumers that pass a wider list to their
    // realtime path but omit it on the history path would silently lose
    // pending non-CLIENT approval cards on every reload/reconnect refetch
    // (they also ignore `escalatedApprovals`). Realtime/history parity is
    // opt-in: pass the same explicit list to both.
    displayApprovalTypes,
    batchApprovalsEnabled,
  } = options

  const processedMessages: ProcessedMessage[] = []
  const accumulator = createMessageSegmentAccumulator({ onApprove, onReject })
  const escalatedApprovals: EscalatedApprovals = new Map()

  let currentAssistantId: string | null = null
  let currentAssistantTimestamp: Date | null = null
  let lastAssistantId: string | null = null
  // MAX persisted seq across the rows grouped into the current assistant turn
  // — carried onto the flushed message's streamSeq for per-role merge coverage.
  let currentAssistantStreamSeq: number | undefined

  /**
   * Flush the current assistant message to processedMessages.
   * Uses the LAST message ID in the group for stable React keys across page boundaries.
   */
  const flushAssistantMessage = () => {
    const idToUse = lastAssistantId || currentAssistantId
    if (idToUse && accumulator.hasContent()) {
      processedMessages.push({
        id: idToUse,
        role: 'assistant',
        content: accumulator.getSegments(),
        name: assistantName,
        assistantType,
        authorType: assistantType as AuthorType,
        timestamp: currentAssistantTimestamp || new Date(),
        avatar: assistantAvatar,
        ...(currentAssistantStreamSeq !== undefined ? { streamSeq: currentAssistantStreamSeq } : {}),
      })
      accumulator.resetSegments()
    }
    // Reset grouping identity + seq UNCONDITIONALLY — even on an EMPTY flush (an
    // assistant turn whose only data was a filtered/escalated approval renders
    // nothing, so `hasContent()` is false and nothing is pushed). Left inside
    // the push-block, a stale id/timestamp and (worse) a stale
    // `currentAssistantStreamSeq` bleed into the NEXT assistant turn: `!currentAssistantId`
    // stays false so it keeps the old id/timestamp, and `Math.max` inflates its
    // streamSeq — which then over-covers synthetics in the history merge.
    currentAssistantId = null
    currentAssistantTimestamp = null
    lastAssistantId = null
    currentAssistantStreamSeq = undefined
  }

  messages.forEach((msg, index) => {
    // Filter by chat type if specified
    if (chatTypeFilter && msg.chatType !== chatTypeFilter) return

    const messageDataArray = Array.isArray(msg.messageData)
      ? msg.messageData
      : msg.messageData
      ? [msg.messageData]
      : []

    const hasStandaloneData = messageDataArray.some((data) =>
      data.type === MESSAGE_TYPE.SYSTEM
    )
    if (hasStandaloneData) {
      flushAssistantMessage()
      pushStandaloneMessages(processedMessages, msg, messageDataArray)
      return
    }

    const isUserMessage =
      msg.owner?.type === OWNER_TYPE.CLIENT || msg.owner?.type === OWNER_TYPE.ADMIN

    if (isUserMessage) {
      flushAssistantMessage()

      const userAuthorType: AuthorType = msg.owner?.type === OWNER_TYPE.ADMIN ? 'admin' : 'user'
      messageDataArray.forEach((data) => {
        if (data.type === MESSAGE_TYPE.TEXT && 'text' in data && data.text) {
          // `TextData.contextItems` (server: `[{ type, id }]`) — the entity
          // context the user attached to this message. Surface it so the bubble
          // renders its chip strip from history (no label on the wire → fall
          // back to the id, matching the realtime path).
          const rawContext = (data as { contextItems?: Array<{ type?: unknown; id?: unknown }> }).contextItems
          const contextItems = Array.isArray(rawContext)
            ? rawContext
                .filter((c) => typeof c?.type === 'string' && typeof c?.id === 'string')
                .map((c) => ({ type: c.type as string, id: c.id as string, label: c.id as string }))
            : undefined
          processedMessages.push({
            id: msg.id,
            role: 'user',
            content: data.text,
            name: getOwnerDisplayName(msg.owner),
            avatar: getOwnerAvatar(msg.owner),
            authorType: userAuthorType,
            timestamp: new Date(msg.createdAt),
            ...(contextItems && contextItems.length > 0 ? { contextItems } : {}),
            ...(typeof msg.lastChunkStreamSeq === 'number' ? { streamSeq: msg.lastChunkStreamSeq } : {}),
          })
        }
      })
    } else {
      if (!currentAssistantId) {
        currentAssistantId = msg.id
        currentAssistantTimestamp = new Date(msg.createdAt)
      }
      lastAssistantId = msg.id
      if (typeof msg.lastChunkStreamSeq === 'number') {
        currentAssistantStreamSeq =
          currentAssistantStreamSeq === undefined
            ? msg.lastChunkStreamSeq
            : Math.max(currentAssistantStreamSeq, msg.lastChunkStreamSeq)
      }

      messageDataArray.forEach((data) => {
        const event = decodeHistoricalMessageData(data)
        if (!event) return
        applyHistoryEvent(
          event,
          accumulator,
          approvalStatuses,
          { displayApprovalTypes, batchApprovalsEnabled },
          escalatedApprovals,
        )
      })

      // Check if we should flush (next message is from user or last message)
      const nextMsg = messages[index + 1]
      const isLastMessage = index === messages.length - 1
      const nextIsFromUser =
        nextMsg &&
        (nextMsg.owner?.type === OWNER_TYPE.CLIENT || nextMsg.owner?.type === OWNER_TYPE.ADMIN)

      if (isLastMessage || nextIsFromUser) {
        flushAssistantMessage()
      }
    }
  })

  flushAssistantMessage()

  const pendingApprovalSegments = accumulator.flushPendingApprovals()
  if (pendingApprovalSegments.length > 0) {
    processedMessages.push({
      id: `pending-approvals-${Date.now()}`,
      role: 'assistant',
      content: pendingApprovalSegments,
      name: assistantName,
      assistantType,
      timestamp: new Date(),
      avatar: assistantAvatar,
    })
  }

  return {
    messages: processedMessages,
    escalatedApprovals: escalatedApprovals
  }
}

/**
 * Extract error messages from historical messages
 * Returns a separate array of error messages that should be displayed
 */
export function extractErrorMessages(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {}
): ProcessedMessage[] {
  const { assistantName = 'Fae', assistantType = 'fae', assistantAvatar, chatTypeFilter } = options

  const errorMessages: ProcessedMessage[] = []

  messages.forEach((msg) => {
    if (chatTypeFilter && msg.chatType !== chatTypeFilter) return

    const messageDataArray = Array.isArray(msg.messageData)
      ? msg.messageData
      : msg.messageData
      ? [msg.messageData]
      : []

    messageDataArray.forEach((data) => {
      if (data.type === MESSAGE_TYPE.ERROR) {
        errorMessages.push({
          id: `${msg.id}-error`,
          role: 'error',
          content: 'error' in data && data.error ? data.error : 'An error occurred',
          name: assistantName,
          assistantType,
          timestamp: new Date(msg.createdAt),
          avatar: assistantAvatar,
        })
      }
    })
  })

  return errorMessages
}

/**
 * Process messages and include error messages in the correct order.
 *
 * HISTORICAL ALIAS: this was a byte-identical second copy of
 * `processHistoricalMessages` (both goldens snapshot identical output on the
 * same corpus). The duplicate envelope was deleted in Phase 3 — kept as an
 * alias for the established import sites.
 */
export const processHistoricalMessagesWithErrors = processHistoricalMessages
