'use client'

/**
 * Hook for processing real-time NATS chunks
 * Provides a consistent interface for handling streaming messages
 */

import { useCallback, useRef, useEffect } from 'react'
import { parseChunkToAction } from '../utils/chunk-parser'
import {
  MessageSegmentAccumulator,
  createMessageSegmentAccumulator,
} from '../utils/message-segment-accumulator'
import { MESSAGE_TYPE } from '../types'
import type { UseRealtimeChunkProcessorReturn, UseRealtimeChunkProcessorOptions, ChatApprovalStatus, PendingToolCallData } from '../types'
import { getCommandText } from '../utils/tool-call-helpers'

/**
 * Hook for processing real-time NATS chunks into message segments
 */
export function useRealtimeChunkProcessor(
  options: UseRealtimeChunkProcessorOptions
): UseRealtimeChunkProcessorReturn {
  const {
    callbacks,
    displayApprovalTypes = ['CLIENT'],
    approvalStatuses = {},
    initialState,
    enableThinking = false,
    // Owned by the consumer (e.g. oss-tenant chat client / openframe-frontend
    // tickets view). Default ON so consumers that haven't wired the flag yet
    // get the new batch UI; pass `false` explicitly to fall back to legacy.
    batchApprovalsEnabled = true,
  } = options

  const accumulatorRef = useRef<MessageSegmentAccumulator>(
    createMessageSegmentAccumulator({
      onApprove: callbacks.onApprove,
      onReject: callbacks.onReject,
    })
  )

  const hasInitializedWithData = useRef(false)

  // Initialize accumulator when we get initial state data
  useEffect(() => {
    if (initialState && !hasInitializedWithData.current) {
      accumulatorRef.current.initializeWithState(initialState)

      if (initialState.escalatedApprovals) {
        pendingEscalatedRef.current = new Map(initialState.escalatedApprovals)

        initialState.escalatedApprovals.forEach((data, requestId) => {
          callbacks.onEscalatedApproval?.(requestId, data)
        })
      }

      // Resumed dialog: a MESSAGE_START already fired server-side. Treat
      // subsequent continuation chunks (after the next MESSAGE_END) as
      // post-stream so they append into the existing bubble instead of
      // replacing its content via the cold-start cumulative path.
      hasEverStreamedRef.current = true
      hasInitializedWithData.current = true
    }
  }, [initialState, callbacks])

  const isInStreamRef = useRef(false)
  // Distinguishes post-MESSAGE_END continuation (append into prior bubble)
  // from cold-start before any MESSAGE_START (cumulative; otherwise
  // appendSegmentsToLastAssistant silently drops the chunk when no
  // assistant bubble exists yet). Flipped true on MESSAGE_START and on
  // resumed-dialog initializeWithState.
  const hasEverStreamedRef = useRef(false)

  // Track pending escalated approvals (single or batch)
  const pendingEscalatedRef = useRef<
    Map<string, { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }>
  >(new Map())

  const processChunk = useCallback(
    (chunk: unknown) => {
      if (
        !enableThinking &&
        chunk &&
        typeof chunk === 'object' &&
        (chunk as { type?: string }).type === MESSAGE_TYPE.THINKING
      ) {
        return
      }

      const action = parseChunkToAction(chunk)
      if (!action) return

      const accumulator = accumulatorRef.current

      switch (action.action) {
        case 'message_start':
          isInStreamRef.current = true
          hasEverStreamedRef.current = true
          callbacks.onStreamStart?.()
          accumulator.resetSegments()
          break

        case 'message_end':
          isInStreamRef.current = false
          callbacks.onStreamEnd?.()
          accumulator.resetSegments()
          break

        case 'metadata':
          callbacks.onMetadata?.(action)
          break

        case 'text': {
          const segments = accumulator.appendText(action.text)
          // Append-mode only for *true* post-stream continuation (after a
          // MESSAGE_END we actually saw). Cold-start chunks (no prior
          // MESSAGE_START) emit cumulative segments so the consumer can
          // spawn the first assistant bubble — otherwise appendSegmentsToLastAssistant
          // silently drops the chunk when no last assistant exists.
          if (isInStreamRef.current || !hasEverStreamedRef.current) {
            callbacks.onSegmentsUpdate?.(segments)
          } else {
            callbacks.onSegmentsUpdate?.([{ type: 'text', text: action.text }], { append: true })
          }
          break
        }

        case 'thinking': {
          const segments = accumulator.appendThinking(action.text)
          if (isInStreamRef.current || !hasEverStreamedRef.current) {
            callbacks.onSegmentsUpdate?.(segments)
          } else {
            callbacks.onSegmentsUpdate?.([{ type: 'thinking', text: action.text }], { append: true })
          }
          break
        }

        case 'tool_execution': {
          // Post-MESSAGE_END tool chunks (cancellations / async batch
          // results for a batch in a prior bubble) flow only through the
          // cross-message updater. Skipping the accumulator avoids
          // pushing a standalone segment that the next text chunk would
          // replay into a new bubble.
          if (!isInStreamRef.current && callbacks.onToolExecuted) {
            callbacks.onToolExecuted(action.segment)
            break
          }
          // In-stream: accumulator-driven update of the streaming bubble
          // is the source of truth. Don't fire onToolExecuted here — its
          // cross-message scan is first-match-wins and could touch a
          // same-execId segment in a prior bubble (agent retry case).
          const segments = accumulator.addToolExecution(action.segment)
          callbacks.onSegmentsUpdate?.(segments)
          break
        }

        case 'approval_request': {
          const { requestId, command, explanation, approvalType } = action

          if (displayApprovalTypes.includes(approvalType)) {
            // Display directly
            const status = approvalStatuses[requestId] || 'pending'
            const segments = accumulator.addApprovalRequest(
              requestId,
              command,
              explanation,
              approvalType,
              status as ChatApprovalStatus
            )
            callbacks.onSegmentsUpdate?.(segments)
          } else {
            // Track as escalated
            pendingEscalatedRef.current.set(requestId, { command, explanation, approvalType })
            callbacks.onEscalatedApproval?.(requestId, { command, explanation, approvalType })
          }
          break
        }

        case 'approval_batch': {
          const { requestId, approvalType, toolCalls } = action
          const status = (approvalStatuses[requestId] || 'pending') as ChatApprovalStatus

          if (!displayApprovalTypes.includes(approvalType)) {
            // Escalated: keep batch context locally for replay on result; surface a
            // summary command via the legacy escalation callback.
            const required = toolCalls.find((c) => c.requiresApproval) ?? toolCalls[0]
            const summary = required ? getCommandText(required) : `Batch of ${toolCalls.length} tool calls`
            pendingEscalatedRef.current.set(requestId, {
              command: summary,
              explanation: required?.toolExplanation,
              approvalType,
              toolCalls,
            })
            callbacks.onEscalatedApproval?.(requestId, {
              command: summary,
              explanation: required?.toolExplanation,
              approvalType,
            })
            break
          }

          if (batchApprovalsEnabled) {
            const segments = accumulator.addApprovalBatch(requestId, approvalType, toolCalls, status)
            callbacks.onSegmentsUpdate?.(segments)
            break
          }

          // Flag OFF — unfold batch into N legacy approval cards. They share
          // `requestId`, so a click on any will approve the whole batch via a
          // single backend call, and the resulting APPROVAL_RESULT chunk will
          // flip status on every matching segment (see updateApprovalStatus).
          let segments = accumulator.getSegments()
          for (const call of toolCalls) {
            if (!call.requiresApproval) continue
            segments = accumulator.addApprovalRequest(
              requestId,
              getCommandText(call),
              call.toolExplanation,
              approvalType,
              status,
            )
          }
          callbacks.onSegmentsUpdate?.(segments)
          break
        }

        case 'approval_result': {
          const { requestId, approved, approvalType } = action
          const escalatedData = pendingEscalatedRef.current.get(requestId)
          const status: ChatApprovalStatus = approved ? 'approved' : 'rejected'

          if (escalatedData) {
            pendingEscalatedRef.current.delete(requestId)
            callbacks.onEscalatedApprovalResult?.(requestId, approved, {
              command: escalatedData.command,
              explanation: escalatedData.explanation,
              approvalType: escalatedData.approvalType,
            })

            if (escalatedData.toolCalls && escalatedData.toolCalls.length > 0) {
              if (batchApprovalsEnabled) {
                const segments = accumulator.addApprovalBatch(
                  requestId,
                  escalatedData.approvalType,
                  escalatedData.toolCalls,
                  status,
                )
                callbacks.onSegmentsUpdate?.(segments)
              } else {
                let segments = accumulator.getSegments()
                for (const call of escalatedData.toolCalls) {
                  if (!call.requiresApproval) continue
                  segments = accumulator.addApprovalRequest(
                    requestId,
                    getCommandText(call),
                    call.toolExplanation,
                    escalatedData.approvalType,
                    status,
                  )
                }
                callbacks.onSegmentsUpdate?.(segments)
              }
            } else {
              const segments = accumulator.addApprovalRequest(
                requestId,
                escalatedData.command,
                escalatedData.explanation,
                escalatedData.approvalType,
                status,
              )
              callbacks.onSegmentsUpdate?.(segments)
            }
          } else {
            // Always keep the in-memory accumulator in sync so a following
            // text/tool chunk replays the resolved status into the message.
            accumulator.updateApprovalStatus(requestId, status)
            // When the consumer wires cross-message resolution via
            // `onApprovalResolved`, skip `onSegmentsUpdate` here: this path
            // routes through `ensureAssistantMessage` + `updateStreamingMessageSegments`,
            // which adopts/creates an assistant bubble and replays the
            // accumulator's segments into it — turning a status flip into a
            // bubble overwrite that wipes the original card.
            if (!callbacks.onApprovalResolved) {
              callbacks.onSegmentsUpdate?.(accumulator.getSegments())
            }
          }
          callbacks.onApprovalResolved?.(requestId, status, approvalType)
          break
        }

        case 'error': {
          let message: string | undefined
          if ('details' in action && action?.details) {
            try {
              message = JSON.parse(action.details)?.error?.message
            } catch {
              message = action.details
            }
          }
          const segments = accumulator.addError(action.error, message)
          callbacks.onSegmentsUpdate?.(segments)
          callbacks.onError?.(action.error, message)
          break
        }

        case 'system': {
          callbacks.onSystemMessage?.(action.text)
          break
        }

        case 'direct_message': {
          callbacks.onDirectMessage?.(action.text, {
            ownerType: action.ownerType,
            displayName: action.displayName,
          })
          break
        }

        case 'message_request':
          callbacks.onUserMessage?.(action.text, {
            ownerType: action.ownerType,
            displayName: action.displayName,
          })
          break

        case 'token_usage':
          callbacks.onTokenUsage?.(action.data)
          break

        case 'context_compaction_start': {
          const standalone = !isInStreamRef.current
          const segments = accumulator.addContextCompaction()
          callbacks.onSegmentsUpdate?.(segments, standalone ? { append: true, isCompacting: true } : undefined)
          break
        }

        case 'context_compaction_end': {
          const standalone = !isInStreamRef.current
          const segments = accumulator.completeContextCompaction(action.summary)
          callbacks.onSegmentsUpdate?.(segments, standalone ? { append: true, isCompacting: true } : undefined)
          break
        }

        case 'dialog_closed':
          callbacks.onDialogClosed?.()
          break

        default:
          // Unknown action - ignore
          break
      }
    },
    [callbacks, displayApprovalTypes, approvalStatuses, initialState, enableThinking]
  )

  const getSegments = useCallback(() => {
    return accumulatorRef.current.getSegments()
  }, [])

  const reset = useCallback(() => {
    accumulatorRef.current.reset()
    pendingEscalatedRef.current.clear()
    hasInitializedWithData.current = false
  }, [])

  const updateApprovalStatus = useCallback(
    (requestId: string, status: ChatApprovalStatus) => {
      return accumulatorRef.current.updateApprovalStatus(requestId, status)
    },
    []
  )

  const getPendingApprovals = useCallback(() => {
    return new Map(pendingEscalatedRef.current)
  }, [])

  return {
    processChunk,
    getSegments,
    reset,
    updateApprovalStatus,
    getPendingApprovals,
  }
}
