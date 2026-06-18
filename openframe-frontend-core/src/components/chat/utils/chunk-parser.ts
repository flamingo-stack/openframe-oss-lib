/**
 * Utilities for parsing NATS chunks into structured actions
 */

import { MESSAGE_TYPE, type ChunkData, type ParsedChunkAction, type ToolExecutionSegment, type PendingToolCallData } from '../types'

function normalizeToolCalls(raw: unknown): PendingToolCallData[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item) => ({
      toolExecutionRequestId: String(item.toolExecutionRequestId ?? ''),
      toolName: String(item.toolName ?? ''),
      toolTitle: typeof item.toolTitle === 'string' ? item.toolTitle : undefined,
      toolExplanation: typeof item.toolExplanation === 'string' ? item.toolExplanation : undefined,
      toolType: typeof item.toolType === 'string' ? item.toolType : undefined,
      requiresApproval: item.requiresApproval === true,
      approvalType: typeof item.approvalType === 'string' ? item.approvalType : null,
      toolCallArguments:
        item.toolCallArguments && typeof item.toolCallArguments === 'object'
          ? (item.toolCallArguments as Record<string, any>)
          : null,
    }))
}

/**
 * Parse a raw NATS chunk into a structured action
 */
export function parseChunkToAction(chunk: unknown): ParsedChunkAction | null {
  if (!chunk || typeof chunk !== 'object') return null
  
  const data = chunk as ChunkData
  const type = String(data.type || '')

  switch (type) {
    case MESSAGE_TYPE.MESSAGE_START:
      return { action: 'message_start' }
      
    case MESSAGE_TYPE.MESSAGE_END:
      return { action: 'message_end' }
      
    case MESSAGE_TYPE.AI_METADATA: {
      const providerName = data.providerName || data.provider
      if (typeof data.modelName === 'string' && typeof providerName === 'string') {
        return {
          action: 'metadata',
          modelDisplayName: data.modelDisplayName,
          modelName: data.modelName,
          providerName,
          contextWindow: typeof data.contextWindow === 'number' ? data.contextWindow : 0,
        }
      }
      return null
    }
    
    case MESSAGE_TYPE.TEXT:
      if (typeof data.text === 'string') {
        return { action: 'text', text: data.text }
      }
      return null

    case MESSAGE_TYPE.THINKING:
      if (typeof data.text === 'string') {
        return { action: 'thinking', text: data.text }
      }
      return null

    case MESSAGE_TYPE.EXECUTING_TOOL:
      return {
        action: 'tool_execution',
        segment: {
          type: 'tool_execution',
          data: {
            type: 'EXECUTING_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            toolTitle: typeof data.title === 'string' ? data.title : undefined,
            parameters: data.parameters,
            toolExecutionRequestId: typeof data.toolExecutionRequestId === 'string' ? data.toolExecutionRequestId : undefined,
          }
        }
      }

    case MESSAGE_TYPE.EXECUTED_TOOL:
      return {
        action: 'tool_execution',
        segment: {
          type: 'tool_execution',
          data: {
            type: 'EXECUTED_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            toolTitle: typeof data.title === 'string' ? data.title : undefined,
            parameters: data.parameters,
            result: data.result,
            success: data.success,
            toolExecutionRequestId: typeof data.toolExecutionRequestId === 'string' ? data.toolExecutionRequestId : undefined,
          }
        }
      }
      
    case MESSAGE_TYPE.APPROVAL_REQUEST: {
      const requestId = data.approvalRequestId || data.approval_request_id || ''
      const approvalType = data.approvalType || 'USER'
      const toolCalls = normalizeToolCalls(data.toolCalls)

      if (toolCalls.length > 0) {
        return {
          action: 'approval_batch',
          requestId,
          approvalType,
          toolCalls,
        }
      }

      return {
        action: 'approval_request',
        requestId,
        command: data.command || '',
        explanation: data.explanation,
        approvalType,
      }
    }
      
    case MESSAGE_TYPE.APPROVAL_RESULT: {
      // The realtime NATS chunk carries the resolver's name as `displayName`; the
      // persisted GraphQL message exposes the same value as `resolvedByName`. Accept
      // either so realtime and history-replay render "by {name}" identically.
      const resolvedByName =
        typeof data.resolvedByName === 'string'
          ? data.resolvedByName
          : typeof data.displayName === 'string'
            ? data.displayName
            : undefined
      return {
        action: 'approval_result',
        requestId: data.approvalRequestId || data.approval_request_id || '',
        approved: data.approved === true,
        approvalType: data.approvalType || 'CLIENT',
        resolvedByName,
      }
    }
      
    case MESSAGE_TYPE.ERROR:
      return {
        action: 'error',
        error: data.error || 'An error occurred',
        details: data.details,
      }
      
    case MESSAGE_TYPE.MESSAGE_REQUEST:
      return {
        action: 'message_request',
        text: String(data.text || ''),
        ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        userId: typeof data.userId === 'string' ? data.userId : undefined,
        // Entity-context refs the user attached to this message (backend
        // `MESSAGE_REQUEST` chunk → `contextItems: [{ type, id }]`). The wire
        // shape carries no label; the host resolves display text + icon.
        contextItems: Array.isArray(data.contextItems)
          ? (data.contextItems as Array<{ type?: unknown; id?: unknown }>)
              .filter((it) => typeof it?.type === 'string' && typeof it?.id === 'string')
              .map((it) => ({ type: it.type as string, id: it.id as string }))
          : undefined,
      }

    case MESSAGE_TYPE.TOKEN_USAGE:
      return {
        action: 'token_usage',
        data: {
          inputTokensSize: data.inputTokensSize ?? 0,
          outputTokensSize: data.outputTokensSize ?? 0,
          totalTokensSize: data.totalTokensSize ?? 0,
          contextSize: data.contextSize ?? 0,
        },
      }

    case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
      return { action: 'context_compaction_start' }

    case MESSAGE_TYPE.CONTEXT_COMPACTION_END:
      return {
        action: 'context_compaction_end',
        summary: typeof data.text === 'string' ? data.text : undefined,
      }

    case MESSAGE_TYPE.SYSTEM:
      if (typeof data.text === 'string') {
        return { action: 'system', text: data.text }
      }
      return null

    case MESSAGE_TYPE.DIRECT_MESSAGE:
      if (typeof data.text === 'string') {
        return {
          action: 'direct_message',
          text: data.text,
          ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
          displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
          userId: typeof data.userId === 'string' ? data.userId : undefined,
        }
      }
      return null

    case MESSAGE_TYPE.DIALOG_CLOSED:
      return { action: 'dialog_closed' }

    default:
      return null
  }
}

/**
 * Check if a chunk represents a control message (start/end)
 */
export function isControlChunk(chunk: unknown): boolean {
  if (!chunk || typeof chunk !== 'object') return false
  const data = chunk as ChunkData
  const type = String(data.type || '')
  return type === MESSAGE_TYPE.MESSAGE_START || type === MESSAGE_TYPE.MESSAGE_END
}

/**
 * Check if a chunk represents an error
 */
export function isErrorChunk(chunk: unknown): boolean {
  if (!chunk || typeof chunk !== 'object') return false
  const data = chunk as ChunkData
  return data.type === MESSAGE_TYPE.ERROR
}

/**
 * Check if a chunk represents metadata
 */
export function isMetadataChunk(chunk: unknown): boolean {
  if (!chunk || typeof chunk !== 'object') return false
  const data = chunk as ChunkData
  return data.type === MESSAGE_TYPE.AI_METADATA
}

/**
 * Extract text content from a chunk if it's a text chunk
 */
export function extractTextFromChunk(chunk: unknown): string | null {
  if (!chunk || typeof chunk !== 'object') return null
  const data = chunk as ChunkData
  if (data.type === MESSAGE_TYPE.TEXT && typeof data.text === 'string') {
    return data.text
  }
  return null
}
