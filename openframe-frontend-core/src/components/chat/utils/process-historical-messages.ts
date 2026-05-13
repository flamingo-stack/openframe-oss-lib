/**
 * Utility for processing historical messages from GraphQL/API
 * into display-ready format
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
      })
    }
  })
}

/**
 * Result type for historical message processing
 */
export interface ProcessHistoricalMessagesResult {
  messages: ProcessedMessage[]
  escalatedApprovals: Map<
    string,
    { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
  >
}

/**
 * Process an array of historical messages into display-ready format
 */
export function processHistoricalMessages(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {}
): ProcessHistoricalMessagesResult {
  const {
    assistantName = 'Fae',
    assistantType = 'fae',
    assistantAvatar,
    onApprove,
    onReject,
    chatTypeFilter,
    approvalStatuses = {},
    displayApprovalTypes,
  } = options

  const processedMessages: ProcessedMessage[] = []
  const accumulator = createMessageSegmentAccumulator({ onApprove, onReject })
  const escalatedApprovals = new Map<
    string,
    { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
  >()
  
  let currentAssistantId: string | null = null
  let currentAssistantTimestamp: Date | null = null
  let lastAssistantId: string | null = null

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
      })
      accumulator.resetSegments()
      currentAssistantId = null
      currentAssistantTimestamp = null
      lastAssistantId = null
    }
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
          processedMessages.push({
            id: msg.id,
            role: 'user',
            content: data.text,
            name: getOwnerDisplayName(msg.owner),
            authorType: userAuthorType,
            timestamp: new Date(msg.createdAt),
          })
        }
      })
    } else {
      if (!currentAssistantId) {
        currentAssistantId = msg.id
        currentAssistantTimestamp = new Date(msg.createdAt)
      }
      lastAssistantId = msg.id

      messageDataArray.forEach((data) => {
        processMessageData(data, accumulator, approvalStatuses, { displayApprovalTypes }, escalatedApprovals)
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
 * Process a single message data item into segments
 */
function processMessageData(
  data: MessageData,
  accumulator: MessageSegmentAccumulator,
  approvalStatuses: Record<string, string>,
  options: MessageProcessingOptions = {},
  escalatedApprovals?: Map<
    string,
    { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
  >
): void {
  // batchApprovalsEnabled is owned by the consumer (oss-tenant chat client /
  // openframe-frontend tickets). Defaults to ON so consumers that haven't
  // wired the flag yet get the batch UI; pass `false` to force legacy.
  const { displayApprovalTypes, batchApprovalsEnabled = true } = options
  switch (data.type) {
    case MESSAGE_TYPE.TEXT:
      if ('text' in data && data.text) {
        accumulator.appendText(data.text)
      }
      break

    case MESSAGE_TYPE.THINKING:
      if ('text' in data && data.text) {
        accumulator.appendThinking(data.text)
      }
      break

    case MESSAGE_TYPE.EXECUTING_TOOL:
      if ('integratedToolType' in data) {
        accumulator.addToolExecution({
          type: 'tool_execution',
          data: {
            type: 'EXECUTING_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            parameters: data.parameters,
            toolExecutionRequestId: data.toolExecutionRequestId,
          },
        })
      }
      break

    case MESSAGE_TYPE.EXECUTED_TOOL:
      if ('integratedToolType' in data) {
        accumulator.addToolExecution({
          type: 'tool_execution',
          data: {
            type: 'EXECUTED_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            parameters: data.parameters,
            result: data.result,
            success: data.success,
            toolExecutionRequestId: data.toolExecutionRequestId,
          },
        })
      }
      break

    case MESSAGE_TYPE.APPROVAL_REQUEST:
      if ('approvalRequestId' in data && data.approvalRequestId) {
        const approvalType = data.approvalType || 'CLIENT'
        const toolCalls: PendingToolCallData[] | undefined = Array.isArray(data.toolCalls)
          ? data.toolCalls
          : undefined
        const isBatch = !!toolCalls && toolCalls.length > 0

        if (!displayApprovalTypes || displayApprovalTypes.includes(approvalType)) {
          if (isBatch) {
            const status = (approvalStatuses[data.approvalRequestId] as ChatApprovalStatus) || 'pending'
            if (batchApprovalsEnabled) {
              accumulator.addApprovalBatch(data.approvalRequestId, approvalType, toolCalls!, status)
            } else {
              // Flag OFF — unfold batch into N legacy approval cards (same id).
              for (const call of toolCalls!) {
                if (!call.requiresApproval) continue
                accumulator.addApprovalRequest(
                  data.approvalRequestId,
                  getCommandText(call),
                  call.toolExplanation,
                  approvalType,
                  status,
                )
              }
            }
          } else {
            accumulator.trackApprovalRequest(data.approvalRequestId, {
              command: data.command || '',
              explanation: data.explanation,
              approvalType,
            })
          }
        } else {
          escalatedApprovals?.set(data.approvalRequestId, {
            command: data.command || '',
            explanation: data.explanation,
            approvalType,
            ...(isBatch ? { toolCalls } : {}),
          })
        }
      }
      break

    case MESSAGE_TYPE.APPROVAL_RESULT:
      if ('approvalRequestId' in data && data.approvalRequestId) {
        const existingStatus = approvalStatuses[data.approvalRequestId] as ChatApprovalStatus | undefined
        const status: ChatApprovalStatus = existingStatus || (data.approved ? 'approved' : 'rejected')
        const escalatedData = escalatedApprovals?.get(data.approvalRequestId)

        if (escalatedData?.toolCalls && escalatedData.toolCalls.length > 0) {
          if (batchApprovalsEnabled) {
            accumulator.addApprovalBatch(
              data.approvalRequestId,
              escalatedData.approvalType,
              escalatedData.toolCalls,
              status,
            )
          } else {
            for (const call of escalatedData.toolCalls) {
              if (!call.requiresApproval) continue
              accumulator.addApprovalRequest(
                data.approvalRequestId,
                getCommandText(call),
                call.toolExplanation,
                escalatedData.approvalType,
                status,
              )
            }
          }
          escalatedApprovals?.delete(data.approvalRequestId)
          break
        }

        if (escalatedData) {
          accumulator.trackApprovalRequest(data.approvalRequestId, {
            command: escalatedData.command,
            explanation: escalatedData.explanation,
            approvalType: escalatedData.approvalType,
          })
          escalatedApprovals?.delete(data.approvalRequestId)
        }

        // If a segment with this id is already present (batch or legacy), just flip its status.
        // updateApprovalStatus matches both `approval_batch` and `approval_request` segments.
        const before = accumulator.getSegments()
        const after = accumulator.updateApprovalStatus(data.approvalRequestId, status)
        const updatedExisting = before.some((s, i) => after[i] !== s)
        if (updatedExisting) break

        accumulator.processApprovalResult(
          data.approvalRequestId,
          status === 'approved',
          data.approvalType || 'USER'
        )
      }
      break

    case MESSAGE_TYPE.ERROR:
      if ('error' in data) {
        let message: string | undefined
        if ('details' in data && data?.details) {
          try {
            message = JSON.parse(data.details)?.error?.message
          } catch {
            message = data.details
          }
        }
        accumulator.addError(
          data.error || 'An error occurred',
          message
        )
      }
      break

    case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
      accumulator.addContextCompaction()
      break

    case MESSAGE_TYPE.CONTEXT_COMPACTION_END: {
      const summary = 'summary' in data && typeof data.summary === 'string' ? data.summary : undefined
      accumulator.completeContextCompaction(summary)
      break
    }

    default:
      // Unknown message type - ignore
      break
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
 * Process messages and include error messages in the correct order
 */
export function processHistoricalMessagesWithErrors(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {}
): ProcessHistoricalMessagesResult {
  const { chatTypeFilter, assistantName = 'Fae', assistantType = 'fae', assistantAvatar, onApprove, onReject, approvalStatuses = {}, displayApprovalTypes } = options

  const processedMessages: ProcessedMessage[] = []
  const accumulator = createMessageSegmentAccumulator({ onApprove, onReject })
  const escalatedApprovals = new Map<
    string,
    { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
  >()

  let currentAssistantId: string | null = null
  let currentAssistantTimestamp: Date | null = null
  let lastAssistantId: string | null = null

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
      })
      accumulator.resetSegments()
      currentAssistantId = null
      currentAssistantTimestamp = null
      lastAssistantId = null
    }
  }

  messages.forEach((msg, index) => {
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
          processedMessages.push({
            id: msg.id,
            role: 'user',
            content: data.text,
            name: getOwnerDisplayName(msg.owner),
            authorType: userAuthorType,
            timestamp: new Date(msg.createdAt),
          })
        }
      })
    } else {
      if (!currentAssistantId) {
        currentAssistantId = msg.id
        currentAssistantTimestamp = new Date(msg.createdAt)
      }
      lastAssistantId = msg.id

      messageDataArray.forEach((data) => {
        processMessageData(data, accumulator, approvalStatuses, { displayApprovalTypes }, escalatedApprovals)
      })

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
