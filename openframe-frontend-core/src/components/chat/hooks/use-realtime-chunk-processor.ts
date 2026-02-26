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
import type { UseRealtimeChunkProcessorReturn, UseRealtimeChunkProcessorOptions, ChatApprovalStatus } from '../types'

/**
 * Hook for processing real-time NATS chunks into message segments
 */
export function useRealtimeChunkProcessor(
  options: UseRealtimeChunkProcessorOptions
): UseRealtimeChunkProcessorReturn {
  const { callbacks, displayApprovalTypes = ['CLIENT'], approvalStatuses = {}, initialState } = options

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

      hasInitializedWithData.current = true
    }
  }, [initialState, callbacks])

  // Track pending escalated approvals
  const pendingEscalatedRef = useRef<Map<string, { command: string; explanation?: string; approvalType: string }>>(
    new Map()
  )

  const processChunk = useCallback(
    (chunk: unknown) => {
      const action = parseChunkToAction(chunk)
      if (!action) return

      const accumulator = accumulatorRef.current

      switch (action.action) {
        case 'message_start':
          callbacks.onStreamStart?.()
          // Reset accumulator for new message
          accumulator.resetSegments()
          break

        case 'message_end':
          callbacks.onStreamEnd?.()
          break

        case 'metadata':
          callbacks.onMetadata?.(action)
          break

        case 'text': {
          const segments = accumulator.appendText(action.text)
          callbacks.onSegmentsUpdate?.(segments)
          break
        }

        case 'tool_execution': {
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

        case 'approval_result': {
          const { requestId, approved, approvalType } = action
          const escalatedData = pendingEscalatedRef.current.get(requestId)
          if (escalatedData) {
            pendingEscalatedRef.current.delete(requestId)
            callbacks.onEscalatedApprovalResult?.(requestId, approved, escalatedData)

            const segments = accumulator.addApprovalRequest(
              requestId,
              escalatedData.command,
              escalatedData.explanation,
              escalatedData.approvalType,
              approved ? 'approved' : 'rejected'
            )
            callbacks.onSegmentsUpdate?.(segments)
          } else {
            const segments = accumulator.updateApprovalStatus(
              requestId,
              approved ? 'approved' : 'rejected'
            )
            callbacks.onSegmentsUpdate?.(segments)
          }
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

        case 'message_request':
          callbacks.onUserMessage?.(action.text)
          break

        default:
          // Unknown action - ignore
          break
      }
    },
    [callbacks, displayApprovalTypes, approvalStatuses, initialState]
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
