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

/** What the realtime accumulator needs to RESUME an unfinished turn. */
export interface IncompleteMessageState {
  existingSegments?: MessageSegment[]
  pendingApprovals?: Map<string, PendingApproval>
  executingTools?: Map<string, ExecutingToolState>
}

/**
 * Extract incomplete message state from the last historical assistant message
 * Used to initialize realtime chunk processor when continuing an incomplete message
 */
export function extractIncompleteMessageState(
  lastMessage: ProcessedMessage | undefined
): IncompleteMessageState | undefined {
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

/**
 * THREAD-level generalization of `extractIncompleteMessageState`: given a
 * processed thread, look at the TRAILING RUN of consecutive assistant
 * messages (not just the very last row), flatten it to one segment list, and
 * ask the single-message extractor whether that tail is unfinished.
 *
 * Why the run and not the last row: the backend can split one logical turn
 * across several assistant messages (a preamble bubble, then the approval
 * card, then the continuation). The unfinished artifact — a pending approval,
 * an EXECUTING_TOOL with no result, an open compaction — can therefore sit in
 * an EARLIER bubble of the same trailing run, and a last-row-only check
 * reports "complete" while the turn is very much still in flight.
 *
 * SSOT for every "is the tail incomplete?" question — the NATS adapter (which
 * used to inline the single-row check) and hosts replaying a stored thread
 * both call this instead of re-deriving the walk.
 *
 * A trailing non-assistant row (user / error) means the last turn closed →
 * `undefined`.
 */
export function extractIncompleteTailState(
  messages: readonly ProcessedMessage[] | undefined,
): IncompleteMessageState | undefined {
  if (!messages || messages.length === 0) return undefined

  // Walk back over the trailing consecutive assistant run.
  let start = messages.length
  while (start > 0 && messages[start - 1]?.role === 'assistant') start -= 1
  if (start === messages.length) return undefined

  const segments: MessageSegment[] = []
  for (let i = start; i < messages.length; i += 1) {
    const content = messages[i]?.content
    // A string-content assistant row is a plain-text bubble with nothing to
    // resume; skip it rather than aborting — a later row in the same run may
    // still hold the unfinished segment.
    if (Array.isArray(content)) segments.push(...(content as MessageSegment[]))
  }
  if (segments.length === 0) return undefined

  // Reuse the single-message extractor verbatim by handing it a synthetic
  // assistant row carrying the flattened run — one incompleteness rule set,
  // not two.
  return extractIncompleteMessageState({
    ...messages[messages.length - 1],
    role: 'assistant',
    content: segments,
  } as ProcessedMessage)
}