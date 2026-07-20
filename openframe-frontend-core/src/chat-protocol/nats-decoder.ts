/**
 * NATS chunk → normalized `ChatStreamEvent` decoder.
 *
 * A reshape of `src/components/chat/utils/chunk-parser.ts`'s
 * `parseChunkToAction` into the transport-agnostic event union, with the
 * JetStream `streamSeq` lifted into the `seq` envelope. DORMANT for now —
 * nothing consumes it yet; Phase 3 of the chat unification wires the
 * reducer to it and deletes `parseChunkToAction`. Until then
 * `chunk-parser.ts` stays untouched and remains the live path.
 *
 * Server-safe: no React, no browser APIs.
 */

import { MESSAGE_TYPE } from '../components/chat/types/message.types'
import type { ApprovalToolCall, ChatStreamEvent } from './events'

/** Minimal structural view of a NATS chunk (see `ChunkData` in
 *  `src/components/chat/types/network.types.ts`). */
type NatsChunk = Record<string, any>

/** Mirror of `chunk-parser.ts`'s `normalizeToolCalls` (not exported
 *  there; duplicated verbatim until Phase 3 deletes the legacy parser). */
function normalizeToolCalls(raw: unknown): ApprovalToolCall[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object')
    .map((item) => ({
      toolExecutionRequestId: String(item.toolExecutionRequestId ?? ''),
      toolName: String(item.toolName ?? ''),
      toolTitle: typeof item.toolTitle === 'string' ? item.toolTitle : undefined,
      toolExplanation:
        typeof item.toolExplanation === 'string' ? item.toolExplanation : undefined,
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
 * Parse one raw NATS chunk into a normalized event. Returns `null` for
 * unknown/malformed chunks (same tolerance as `parseChunkToAction`).
 */
export function decodeNatsChunk(chunk: unknown): ChatStreamEvent | null {
  if (!chunk || typeof chunk !== 'object') return null

  const data = chunk as NatsChunk
  const type = String(data.type || '')
  // JetStream stream sequence → the generic `seq` envelope.
  const seq: { seq?: number } =
    typeof data.streamSeq === 'number' ? { seq: data.streamSeq } : {}

  switch (type) {
    case MESSAGE_TYPE.MESSAGE_START:
      return { type: 'turn-start', ...seq }

    case MESSAGE_TYPE.MESSAGE_END:
      return { type: 'turn-end', ...seq }

    case MESSAGE_TYPE.AI_METADATA: {
      const providerName = data.providerName || data.provider
      if (typeof data.modelName === 'string' && typeof providerName === 'string') {
        return {
          type: 'metadata',
          modelLabel: data.modelDisplayName,
          modelName: data.modelName,
          provider: providerName,
          contextWindowMaxTokens:
            typeof data.contextWindow === 'number' ? data.contextWindow : 0,
          ...seq,
        }
      }
      return null
    }

    case MESSAGE_TYPE.TEXT:
      if (typeof data.text === 'string') {
        return { type: 'text-delta', text: data.text, ...seq }
      }
      return null

    case MESSAGE_TYPE.THINKING:
      if (typeof data.text === 'string') {
        return { type: 'thinking-delta', text: data.text, ...seq }
      }
      return null

    case MESSAGE_TYPE.EXECUTING_TOOL:
      return {
        type: 'tool-execution',
        data: {
          type: 'EXECUTING_TOOL',
          integratedToolType: data.integratedToolType || '',
          toolFunction: data.toolFunction || '',
          toolTitle: typeof data.title === 'string' ? data.title : undefined,
          parameters: data.parameters,
          toolExecutionRequestId:
            typeof data.toolExecutionRequestId === 'string'
              ? data.toolExecutionRequestId
              : undefined,
        },
        ...seq,
      }

    case MESSAGE_TYPE.EXECUTED_TOOL:
      return {
        type: 'tool-execution',
        data: {
          type: 'EXECUTED_TOOL',
          integratedToolType: data.integratedToolType || '',
          toolFunction: data.toolFunction || '',
          toolTitle: typeof data.title === 'string' ? data.title : undefined,
          parameters: data.parameters,
          result: data.result,
          success: data.success,
          toolExecutionRequestId:
            typeof data.toolExecutionRequestId === 'string'
              ? data.toolExecutionRequestId
              : undefined,
        },
        ...seq,
      }

    case MESSAGE_TYPE.APPROVAL_REQUEST: {
      const requestId = data.approvalRequestId || data.approval_request_id || ''
      const approvalType = data.approvalType || 'USER'
      const toolCalls = normalizeToolCalls(data.toolCalls)

      if (toolCalls.length > 0) {
        return { type: 'approval-request', requestId, approvalType, toolCalls, ...seq }
      }

      return {
        type: 'approval-request',
        requestId,
        approvalType,
        command: data.command || '',
        explanation: data.explanation,
        ...seq,
      }
    }

    case MESSAGE_TYPE.APPROVAL_RESULT: {
      // Realtime chunks carry the resolver's name as `displayName`; the
      // persisted GraphQL message exposes the same value as
      // `resolvedByName`. Accept either (parity with parseChunkToAction).
      const resolvedByName =
        typeof data.resolvedByName === 'string'
          ? data.resolvedByName
          : typeof data.displayName === 'string'
            ? data.displayName
            : undefined
      return {
        type: 'approval-resolved',
        requestId: data.approvalRequestId || data.approval_request_id || '',
        status: data.approved === true ? 'approved' : 'rejected',
        approvalType: data.approvalType || 'CLIENT',
        resolvedByName,
        ...seq,
      }
    }

    case MESSAGE_TYPE.ERROR:
      return {
        type: 'error',
        title: data.error || 'An error occurred',
        details: data.details,
        ...seq,
      }

    case MESSAGE_TYPE.MESSAGE_REQUEST:
      return {
        type: 'participant',
        kind: 'message-request',
        text: String(data.text || ''),
        ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        userId: typeof data.userId === 'string' ? data.userId : undefined,
        // Wire shape carries no label; fall back to the id (parity with
        // parseChunkToAction + process-historical-messages).
        contextItems: Array.isArray(data.contextItems)
          ? (data.contextItems as Array<{ type?: unknown; id?: unknown }>)
              .filter((it) => typeof it?.type === 'string' && typeof it?.id === 'string')
              .map((it) => ({
                type: it.type as string,
                id: it.id as string,
                label: it.id as string,
              }))
          : undefined,
        ...seq,
      }

    case MESSAGE_TYPE.TOKEN_USAGE:
      return {
        type: 'token-usage',
        inputTokensSize: data.inputTokensSize ?? 0,
        outputTokensSize: data.outputTokensSize ?? 0,
        totalTokensSize: data.totalTokensSize ?? 0,
        contextSize: data.contextSize ?? 0,
        ...seq,
      }

    case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
      return { type: 'compaction', phase: 'start', ...seq }

    case MESSAGE_TYPE.CONTEXT_COMPACTION_END:
      return {
        type: 'compaction',
        phase: 'end',
        summary: typeof data.text === 'string' ? data.text : undefined,
        ...seq,
      }

    case MESSAGE_TYPE.SYSTEM:
      if (typeof data.text === 'string') {
        return { type: 'participant', kind: 'system', text: data.text, ...seq }
      }
      return null

    case MESSAGE_TYPE.DIRECT_MESSAGE:
      if (typeof data.text === 'string') {
        return {
          type: 'participant',
          kind: 'direct-message',
          text: data.text,
          ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
          displayName:
            typeof data.displayName === 'string' ? data.displayName : undefined,
          userId: typeof data.userId === 'string' ? data.userId : undefined,
          ...seq,
        }
      }
      return null

    case MESSAGE_TYPE.DIALOG_CLOSED:
      return { type: 'dialog-closed', ...seq }

    default:
      return null
  }
}
