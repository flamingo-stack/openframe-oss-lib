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
import type { UseRealtimeChunkProcessorReturn, UseRealtimeChunkProcessorOptions, ChatApprovalStatus, PendingToolCallData, MessageSegment, SegmentsUpdateMetadata } from '../types'
import { getCommandText } from '../utils/tool-call-helpers'

// Actions allowed through once the dialog is in direct mode. Everything else is
// an AI-assistant chunk and gets dropped — an allowlist so any future assistant
// action is blocked by default.
const DIRECT_MODE_ALLOWED = new Set(['direct_message', 'message_request', 'system', 'dialog_closed'])

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
    // Owned by the consumer (e.g. oss-tenant chat client / openframe-frontend
    // tickets view). Default ON so consumers that haven't wired the flag yet
    // get the new batch UI; pass `false` explicitly to fall back to legacy.
    batchApprovalsEnabled = true,
    isDirectMode = false,
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

  // Direct-mode barrier: once engaged, AI-assistant chunks are dropped. Engaged
  // by the host flag (optimistic) or by an in-order DIRECT_MESSAGE chunk.
  const directModeFlagRef = useRef(isDirectMode)
  const sawDirectMessageRef = useRef(false)
  // One-shot teardown guard for the barrier. Busy state can be asserted
  // OUTSIDE an open stream (onAgentBusy on tool/approval chunks), so the
  // teardown must fire once even when isInStreamRef is false — otherwise a
  // human takeover right after an approval leaves the consumer's composer
  // locked forever (all releasing AI chunks get dropped by the barrier).
  const directTeardownFiredRef = useRef(false)
  useEffect(() => {
    directModeFlagRef.current = isDirectMode
  }, [isDirectMode])

  // Track pending escalated approvals (single or batch)
  const pendingEscalatedRef = useRef<
    Map<string, { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }>
  >(new Map())

  const processChunk = useCallback(
    (chunk: unknown) => {
      const action = parseChunkToAction(chunk)
      if (!action) return

      const accumulator = accumulatorRef.current

      // streamSeq of the chunk currently being processed (JetStream only).
      // Only content emissions below carry it through to the host, so the
      // streaming bubble is stamped with the highest CONTENT seq it saw — the
      // non-persisted MESSAGE_END / TOKEN_USAGE chunks never reach emitSegments.
      const streamSeq =
        chunk && typeof chunk === 'object' && typeof (chunk as { streamSeq?: unknown }).streamSeq === 'number'
          ? (chunk as { streamSeq: number }).streamSeq
          : undefined
      const emitSegments = (s: MessageSegment[], meta?: SegmentsUpdateMetadata) =>
        callbacks.onSegmentsUpdate?.(s, streamSeq != null ? { ...meta, streamSeq } : meta)

      if (action.action === 'direct_message') sawDirectMessageRef.current = true

      if ((directModeFlagRef.current || sawDirectMessageRef.current) && !DIRECT_MODE_ALLOWED.has(action.action)) {
        // Hard stop: tear down AI activity exactly once so the typing
        // indicator, composer lock, and half-rendered bubble clear, then drop
        // the chunk. Fires even when no stream is open — an onAgentBusy lock
        // (approved commands executing post-MESSAGE_END) has no other release
        // once the barrier starts dropping the continuation chunks.
        if (isInStreamRef.current || !directTeardownFiredRef.current) {
          isInStreamRef.current = false
          directTeardownFiredRef.current = true
          callbacks.onStreamEnd?.()
          accumulator.resetSegments()
        }
        return
      }

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
            emitSegments(segments)
          } else {
            emitSegments([{ type: 'text', text: action.text }], { append: true })
          }
          break
        }

        case 'thinking': {
          const segments = accumulator.appendThinking(action.text)
          if (isInStreamRef.current || !hasEverStreamedRef.current) {
            emitSegments(segments)
          } else {
            emitSegments([{ type: 'thinking', text: action.text }], { append: true })
          }
          break
        }

        case 'tool_execution': {
          // A starting tool run means the agent's turn is in progress even
          // when this lands after MESSAGE_END (approved commands execute
          // between the approval bubble and the continuation stream).
          if (action.segment.data.type === 'EXECUTING_TOOL') {
            callbacks.onAgentBusy?.()
          }
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
          //
          // KNOWN EDGE (accepted): a slow async batch tool whose EXECUTED
          // lands only AFTER the continuation stream's MESSAGE_START takes
          // this path too — the freshly reset accumulator has no batch
          // segment to merge into, so the chunk renders as a standalone card
          // in the new bubble while the prior batch card's executions slot
          // stays 'executing' until the next history refetch. Routing such
          // chunks cross-message would reintroduce the retry hazard above;
          // revisit only if the backend confirms batch executions can
          // overlap the continuation stream.
          const segments = accumulator.addToolExecution(action.segment)
          emitSegments(segments)
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
            emitSegments(segments)
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
            emitSegments(segments)
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
          emitSegments(segments)
          break
        }

        case 'approval_result': {
          const { requestId, approved, approvalType, resolvedByName } = action
          // Approved → the agent resumes to execute the command(s); surface
          // busy immediately so the composer locks before EXECUTING_TOOL
          // lands. Rejection keeps the input free — the user may want to
          // type a correction right away.
          if (approved) callbacks.onAgentBusy?.()
          const escalatedData = pendingEscalatedRef.current.get(requestId)
          const status: ChatApprovalStatus = approved ? 'approved' : 'rejected'

          if (escalatedData) {
            pendingEscalatedRef.current.delete(requestId)
            callbacks.onEscalatedApprovalResult?.(requestId, approved, {
              command: escalatedData.command,
              explanation: escalatedData.explanation,
              approvalType: escalatedData.approvalType,
            })

            // The escalated card was never displayed inline, so this emit is
            // what surfaces it after resolution. In-stream the cumulative
            // array is correct; post-MESSAGE_END the accumulator was RESET,
            // so a cumulative (replace-mode) emit would wipe the trailing
            // bubble down to the lone card — emit only the resolved card(s)
            // as an append instead. Store hosts upsert batches by request id,
            // so a replayed append stays idempotent.
            const emitResolved = (segments: MessageSegment[]) => {
              if (isInStreamRef.current) {
                emitSegments(segments)
                return
              }
              const delta = segments.filter(
                (s) =>
                  (s.type === 'approval_request' && s.data.requestId === requestId) ||
                  (s.type === 'approval_batch' && s.data.approvalRequestId === requestId),
              )
              emitSegments(delta, { append: true })
            }

            if (escalatedData.toolCalls && escalatedData.toolCalls.length > 0) {
              if (batchApprovalsEnabled) {
                const segments = accumulator.addApprovalBatch(
                  requestId,
                  escalatedData.approvalType,
                  escalatedData.toolCalls,
                  status,
                  undefined,
                  resolvedByName,
                )
                emitResolved(segments)
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
                emitResolved(segments)
              }
            } else {
              const segments = accumulator.addApprovalRequest(
                requestId,
                escalatedData.command,
                escalatedData.explanation,
                escalatedData.approvalType,
                status,
              )
              emitResolved(segments)
            }
          } else {
            // Always keep the in-memory accumulator in sync so a following
            // text/tool chunk replays the resolved status into the message.
            accumulator.updateApprovalStatus(requestId, status, resolvedByName)
            // When the consumer wires cross-message resolution via
            // `onApprovalResolved`, skip `onSegmentsUpdate` here: this path
            // routes through `ensureAssistantMessage` + `updateStreamingMessageSegments`,
            // which adopts/creates an assistant bubble and replays the
            // accumulator's segments into it — turning a status flip into a
            // bubble overwrite that wipes the original card.
            if (!callbacks.onApprovalResolved) {
              emitSegments(accumulator.getSegments())
            }
          }
          callbacks.onApprovalResolved?.(requestId, status, approvalType, resolvedByName)
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
          emitSegments(segments)
          callbacks.onError?.(action.error, message)
          break
        }

        case 'system': {
          callbacks.onSystemMessage?.(action.text, { streamSeq })
          break
        }

        case 'direct_message': {
          callbacks.onDirectMessage?.(action.text, {
            ownerType: action.ownerType,
            displayName: action.displayName,
            userId: action.userId,
            streamSeq,
          })
          break
        }

        case 'message_request':
          callbacks.onUserMessage?.(action.text, {
            ownerType: action.ownerType,
            displayName: action.displayName,
            userId: action.userId,
            streamSeq,
            contextItems: action.contextItems,
          })
          break

        case 'token_usage':
          callbacks.onTokenUsage?.(action.data)
          break

        case 'context_compaction_start': {
          const standalone = !isInStreamRef.current
          const segments = accumulator.addContextCompaction()
          emitSegments(segments, standalone ? { append: true, isCompacting: true } : undefined)
          break
        }

        case 'context_compaction_end': {
          const standalone = !isInStreamRef.current
          const segments = accumulator.completeContextCompaction(action.summary)
          emitSegments(segments, standalone ? { append: true, isCompacting: true } : undefined)
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
    [callbacks, displayApprovalTypes, approvalStatuses, initialState]
  )

  const getSegments = useCallback(() => {
    return accumulatorRef.current.getSegments()
  }, [])

  const reset = useCallback(() => {
    accumulatorRef.current.reset()
    pendingEscalatedRef.current.clear()
    hasInitializedWithData.current = false
    sawDirectMessageRef.current = false
    directTeardownFiredRef.current = false
    // Stream-state flags are per-dialog too. Leaking them across a reset
    // made the next dialog's cold-start chunks take the post-stream append
    // path (hasEverStreamed stuck true) — which consumers may silently drop
    // when no assistant bubble exists yet — and left tool/compaction routing
    // thinking a stream was still open (isInStream stuck true).
    isInStreamRef.current = false
    hasEverStreamedRef.current = false
  }, [])

  const updateApprovalStatus = useCallback(
    (requestId: string, status: ChatApprovalStatus, resolvedByName?: string | null) => {
      return accumulatorRef.current.updateApprovalStatus(requestId, status, resolvedByName)
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
