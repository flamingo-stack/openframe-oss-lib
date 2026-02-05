/**
 * Utility for extracting incomplete message state from historical messages
 * Used to continue building messages across realtime connections
 */

import type {
  ProcessedMessage,
  MessageSegment,
  PendingApproval,
} from '../types'

/**
 * Extract incomplete message state from the last historical assistant message
 * Used to initialize realtime chunk processor when continuing an incomplete message
 */
export function extractIncompleteMessageState(
  lastMessage: ProcessedMessage | undefined
): {
  existingSegments?: MessageSegment[]
  pendingApprovals?: Map<string, PendingApproval>
  executingTools?: Map<string, { integratedToolType: string; toolFunction: string; parameters?: Record<string, any> }>
} | undefined {
  if (!lastMessage || lastMessage.role !== 'assistant' || typeof lastMessage.content === 'string') {
    return undefined
  }

  const segments = lastMessage.content as MessageSegment[]
  const pendingApprovals = new Map<string, PendingApproval>()
  const executingTools = new Map<string, { integratedToolType: string; toolFunction: string; parameters?: Record<string, any> }>()
  let hasIncompleteState = false

  segments.forEach(segment => {
    switch (segment.type) {
      case 'tool_execution':
        if (segment.data.type === 'EXECUTING_TOOL') {
          const toolKey = `${segment.data.integratedToolType}-${segment.data.toolFunction}`
          executingTools.set(toolKey, {
            integratedToolType: segment.data.integratedToolType,
            toolFunction: segment.data.toolFunction,
            parameters: segment.data.parameters,
          })
          hasIncompleteState = true
        }
        break

      case 'approval_request':
        if (segment.status === 'pending' && segment.data.requestId) {
          pendingApprovals.set(segment.data.requestId, {
            command: segment.data.command,
            explanation: segment.data.explanation,
            approvalType: segment.data.approvalType || 'CLIENT',
          })
          hasIncompleteState = true
        }
        break
    }
  })

  if (!hasIncompleteState) {
    return undefined
  }

  return {
    existingSegments: segments,
    pendingApprovals: pendingApprovals.size > 0 ? pendingApprovals : undefined,
    executingTools: executingTools.size > 0 ? executingTools : undefined,
  }
}