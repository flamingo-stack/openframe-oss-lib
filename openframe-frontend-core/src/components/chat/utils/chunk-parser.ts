/**
 * Utilities for parsing NATS chunks into structured actions
 */

import { MESSAGE_TYPE, type ChunkData, type ParsedChunkAction, type ToolExecutionSegment } from '../types'

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
      
    case MESSAGE_TYPE.EXECUTING_TOOL:
      return {
        action: 'tool_execution',
        segment: {
          type: 'tool_execution',
          data: {
            type: 'EXECUTING_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            parameters: data.parameters,
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
            parameters: data.parameters,
            result: data.result,
            success: data.success,
          }
        }
      }
      
    case MESSAGE_TYPE.APPROVAL_REQUEST:
      return {
        action: 'approval_request',
        requestId: data.approvalRequestId || data.approval_request_id || '',
        command: data.command || '',
        explanation: data.explanation,
        approvalType: data.approvalType || 'USER',
      }
      
    case MESSAGE_TYPE.APPROVAL_RESULT:
      return {
        action: 'approval_result',
        requestId: data.approvalRequestId || data.approval_request_id || '',
        approved: data.approved === true,
        approvalType: data.approvalType || 'CLIENT',
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
      }
      
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
