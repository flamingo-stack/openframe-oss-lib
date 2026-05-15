/**
 * Utility for extracting incomplete message state from historical messages
 * Used to continue building messages across realtime connections
 */

import type {
  ProcessedMessage,
  MessageSegment,
  PendingApproval,
  ExecutingToolState,
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
  executingTools?: Map<string, ExecutingToolState>
} | undefined {
  if (!lastMessage || lastMessage.role !== 'assistant' || typeof lastMessage.content === 'string') {
    return undefined
  }

  const segments = lastMessage.content as MessageSegment[]
  const pendingApprovals = new Map<string, PendingApproval>()
  const executingTools = new Map<string, ExecutingToolState>()
  let hasIncompleteState = false

  segments.forEach(segment => {
    switch (segment.type) {
      case 'tool_execution':
        if (segment.data.type === 'EXECUTING_TOOL') {
          const toolKey =
            segment.data.toolExecutionRequestId ||
            `${segment.data.integratedToolType}-${segment.data.toolFunction}`
          executingTools.set(toolKey, {
            integratedToolType: segment.data.integratedToolType,
            toolFunction: segment.data.toolFunction,
            toolTitle: segment.data.toolTitle,
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

      case 'approval_batch': {
        // Treat a batch as in-progress until every tool call has a
        // `done` execution OR the batch was rejected. Otherwise the realtime
        // accumulator won't hold the segment and post-approval EXECUTED_TOOL
        // chunks won't be able to merge into it via `applyExecutionToBatch`.
        const allDone =
          !!segment.data.executions &&
          segment.data.toolCalls.every(
            (c) => segment.data.executions?.[c.toolExecutionRequestId]?.status === 'done',
          )
        if (segment.status !== 'rejected' && !allDone) {
          hasIncompleteState = true
        }
        break
      }

      case 'context_compaction':
        if (segment.status === 'started') {
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