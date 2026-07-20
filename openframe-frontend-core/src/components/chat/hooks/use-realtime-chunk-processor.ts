'use client'

/**
 * COMPAT WRAPPER (created Phase 3 of the chat unification): the legacy
 * chunk→callbacks hook, now a thin shell over the master stream reducer —
 * `decodeNatsChunk` → `createChatStreamReducer` → legacy callback dispatch.
 * The reducer emits `ChatReducerEffect`s whose names/args mirror
 * `RealtimeChunkCallbacks` 1:1; this file just forwards them. Consumers
 * (product-app tickets view) migrate to the reducer in Phase 4; this file is
 * deleted in Phase 6.
 */

import { useCallback, useEffect, useRef } from 'react'
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder'
import { createChatStreamReducer, type ChatStreamReducer } from '../stream/chat-stream-reducer'
import type {
  ChatApprovalStatus,
  UseRealtimeChunkProcessorOptions,
  UseRealtimeChunkProcessorReturn,
} from '../types'

export function useRealtimeChunkProcessor(
  options: UseRealtimeChunkProcessorOptions,
): UseRealtimeChunkProcessorReturn {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const reducerRef = useRef<ChatStreamReducer | null>(null)
  if (reducerRef.current === null) {
    reducerRef.current = createChatStreamReducer({
      transport: 'nats',
      batchApprovalsEnabled: options.batchApprovalsEnabled,
      displayApprovalTypes: options.displayApprovalTypes,
      approvalStatuses: options.approvalStatuses,
      isDirectMode: options.isDirectMode,
      crossMessageToolRouting: !!options.callbacks.onToolExecuted,
      callbacks: {
        onApprove: (id) => optionsRef.current.callbacks.onApprove?.(id),
        onReject: (id) => optionsRef.current.callbacks.onReject?.(id),
      },
      onEffect: ({ name, args }) => {
        const cbs = optionsRef.current.callbacks as Record<
          string,
          ((...a: unknown[]) => void) | undefined
        >
        // Legacy conditional: the cumulative post-APPROVAL_RESULT emit fires
        // only when the consumer did NOT wire onApprovalResolved.
        if (name === 'segments-after-approval-result') {
          if (!cbs.onApprovalResolved) cbs.onSegmentsUpdate?.(...args)
          return
        }
        cbs[name]?.(...args)
      },
    })
  }
  const reducer = reducerRef.current

  // Live per-render option sync (the legacy hook read these from options).
  reducer.syncApprovalStatuses(options.approvalStatuses ?? {})
  reducer.setDirectMode(options.isDirectMode ?? false)

  // Initialize once when initial state (resumed incomplete turn) arrives.
  const hasInitializedWithData = useRef(false)
  useEffect(() => {
    if (options.initialState && !hasInitializedWithData.current) {
      reducer.initializeWithState(null, options.initialState)
      hasInitializedWithData.current = true
    }
  }, [options.initialState, reducer])

  const processChunk = useCallback(
    (chunk: unknown) => {
      const event = decodeNatsChunk(chunk)
      if (event) reducer.apply(event)
    },
    [reducer],
  )

  const reset = useCallback(() => {
    reducer.reset()
    hasInitializedWithData.current = false
  }, [reducer])

  const updateApprovalStatus = useCallback(
    (requestId: string, status: ChatApprovalStatus, resolvedByName?: string | null) =>
      reducer.updateApprovalStatus(requestId, status, resolvedByName),
    [reducer],
  )

  return {
    processChunk,
    getSegments: reducer.getSegments,
    reset,
    updateApprovalStatus,
    getPendingApprovals: reducer.getPendingEscalated,
  }
}
