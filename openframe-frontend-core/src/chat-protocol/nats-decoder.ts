/**
 * NATS chunk → normalized `ChatStreamEvent` decoder.
 *
 * THE live NATS reading path — the ONLY chunk parser in the codebase. Every
 * consumer (this lib's `useNatsChatAdapter`, the hub, the product app) feeds
 * raw chunks through `decodeNatsChunk` into `createChatStreamReducer`. The
 * legacy `components/chat/utils/chunk-parser.ts` (`parseChunkToAction`) that
 * this module superseded was DELETED — do not reintroduce a second decoder.
 *
 * Chunks map onto the transport-agnostic event union, with the JetStream
 * `streamSeq` lifted into the `seq` envelope (the reducer's idempotency gate
 * keys off it).
 *
 * Behavior is pinned by `__tests__/nats-decoder-golden.test.ts`.
 *
 * Server-safe: no React, no browser APIs.
 */

import { MESSAGE_TYPE } from '../components/chat/types/message.types';
import type { AskOptionData } from '../components/chat/types/message.types';
import { ESCALATION_STATE, escalationResolvedStatus } from './events';
import type { ApprovalToolCall, ChatStreamEvent } from './events';
import { sourceMetadataEvent } from './source-metadata';

/** Minimal structural view of a NATS chunk (see `ChunkData` in
 *  `src/components/chat/types/network.types.ts`). */
type NatsChunk = Record<string, unknown>;

/** Narrow an unknown wire value to something with string-keyed properties. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Wire string field, or `undefined` when the backend sent anything else. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Wire string field with a default — replaces the old `data.x || 'y'`, which
 *  also let non-strings through under an `any` chunk type. */
function strOr(value: unknown, fallback = ''): string {
  const s = str(value);
  return s ? s : fallback;
}

/** Wire number field with a default. */
function numOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

/** Coerce the wire's `toolCalls[]` into the batch-approval shape, dropping
 *  non-object entries and defaulting every field. */
function normalizeToolCalls(raw: unknown): ApprovalToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map(item => ({
    toolExecutionRequestId: String(item.toolExecutionRequestId ?? ''),
    toolName: String(item.toolName ?? ''),
    toolTitle: typeof item.toolTitle === 'string' ? item.toolTitle : undefined,
    toolExplanation: typeof item.toolExplanation === 'string' ? item.toolExplanation : undefined,
    toolType: typeof item.toolType === 'string' ? item.toolType : undefined,
    requiresApproval: item.requiresApproval === true,
    approvalType: typeof item.approvalType === 'string' ? item.approvalType : null,
    toolCallArguments: isRecord(item.toolCallArguments) ? item.toolCallArguments : null,
  }));
}

/** Coerce the wire's ask `options[]` into the card's row shape. Rows without a
 *  usable `label` are dropped: the label is what gets SENT when the row is
 *  picked, so a blank one would post an empty reply. */
export function normalizeAskOptions(raw: unknown): AskOptionData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map(item => ({
      label: typeof item.label === 'string' ? item.label.trim() : '',
      description: typeof item.description === 'string' ? item.description : undefined,
    }))
    .filter(option => option.label.length > 0);
}

/**
 * Parse one raw NATS chunk into a normalized event. Returns `null` for
 * unknown/malformed chunks — an unrecognized `type`, a missing required
 * field, or a non-object payload are all tolerated as no-ops rather than
 * throwing, so a backend that adds a chunk type can't break the stream.
 */
export function decodeNatsChunk(chunk: unknown): ChatStreamEvent | null {
  if (!chunk || typeof chunk !== 'object') return null;

  const data = chunk as NatsChunk;
  const type = String(data.type || '');
  // JetStream stream sequence → the generic `seq` envelope.
  const seq: { seq?: number } = typeof data.streamSeq === 'number' ? { seq: data.streamSeq } : {};

  switch (type) {
    case MESSAGE_TYPE.MESSAGE_START:
      return { type: 'turn-start', ...seq };

    case MESSAGE_TYPE.MESSAGE_END:
      return { type: 'turn-end', ...seq };

    case MESSAGE_TYPE.AI_METADATA: {
      const providerName = data.providerName || data.provider;
      if (typeof data.modelName === 'string' && typeof providerName === 'string') {
        return {
          type: 'metadata',
          modelLabel: str(data.modelDisplayName),
          modelName: data.modelName,
          provider: providerName,
          contextWindowMaxTokens: typeof data.contextWindow === 'number' ? data.contextWindow : 0,
          ...seq,
        };
      }
      return null;
    }

    case MESSAGE_TYPE.TEXT:
      if (typeof data.text === 'string') {
        return { type: 'text-delta', text: data.text, ...seq };
      }
      return null;

    case MESSAGE_TYPE.THINKING:
      if (typeof data.text === 'string') {
        return { type: 'thinking-delta', text: data.text, ...seq };
      }
      return null;

    case MESSAGE_TYPE.GUIDE:
    case MESSAGE_TYPE.SOURCES: {
      const event = sourceMetadataEvent(data.payload);
      return event ? { ...event, ...seq } : null;
    }

    // An ask card is only an ask card with something to pick: a question and at
    // least one option. Anything less is dropped rather than rendered as an
    // empty card the user can't answer — the backend already falls back to a
    // complete hardcoded card when the model returns a partial one.
    case MESSAGE_TYPE.ASK: {
      const question = typeof data.question === 'string' ? data.question.trim() : '';
      const options = normalizeAskOptions(data.options);
      if (!question || options.length === 0) return null;
      return {
        type: 'ask',
        ...(typeof data.text === 'string' && data.text ? { text: data.text } : {}),
        question,
        options,
        ...seq,
      };
    }

    case MESSAGE_TYPE.EXECUTING_TOOL:
      return {
        type: 'tool-execution',
        data: {
          type: 'EXECUTING_TOOL',
          integratedToolType: strOr(data.integratedToolType),
          toolFunction: strOr(data.toolFunction),
          toolTitle: typeof data.title === 'string' ? data.title : undefined,
          // The human-readable "why this tool is running" line rendered inside
          // the tool card. It rides ONLY the EXECUTING chunk — the EXECUTED one
          // never carries it, and the accumulator's merge preserves whatever
          // the EXECUTING segment held. Dropping it here therefore blanks the
          // card for the whole lifetime of the run.
          toolExplanation: typeof data.toolExplanation === 'string' ? data.toolExplanation : undefined,
          parameters: isRecord(data.parameters) ? data.parameters : undefined,
          toolExecutionRequestId:
            typeof data.toolExecutionRequestId === 'string' ? data.toolExecutionRequestId : undefined,
        },
        ...seq,
      };

    case MESSAGE_TYPE.EXECUTED_TOOL:
      return {
        type: 'tool-execution',
        data: {
          type: 'EXECUTED_TOOL',
          integratedToolType: strOr(data.integratedToolType),
          toolFunction: strOr(data.toolFunction),
          toolTitle: typeof data.title === 'string' ? data.title : undefined,
          parameters: isRecord(data.parameters) ? data.parameters : undefined,
          result: str(data.result),
          success: typeof data.success === 'boolean' ? data.success : undefined,
          toolExecutionRequestId:
            typeof data.toolExecutionRequestId === 'string' ? data.toolExecutionRequestId : undefined,
        },
        ...seq,
      };

    case MESSAGE_TYPE.APPROVAL_REQUEST: {
      const requestId = strOr(data.approvalRequestId) || strOr(data.approval_request_id);
      const approvalType = strOr(data.approvalType, 'USER');
      const toolCalls = normalizeToolCalls(data.toolCalls);

      if (toolCalls.length > 0) {
        return { type: 'approval-request', requestId, approvalType, toolCalls, ...seq };
      }

      return {
        type: 'approval-request',
        requestId,
        approvalType,
        command: strOr(data.command),
        explanation: str(data.explanation),
        ...seq,
      };
    }

    case MESSAGE_TYPE.APPROVAL_RESULT: {
      // Realtime chunks carry the resolver's name as `displayName`; the
      // persisted GraphQL message exposes the same value as
      // `resolvedByName`. Accept either so realtime and history-replay
      // render "by {name}" identically.
      const resolvedByName =
        typeof data.resolvedByName === 'string'
          ? data.resolvedByName
          : typeof data.displayName === 'string'
            ? data.displayName
            : undefined;
      return {
        type: 'approval-resolved',
        requestId: strOr(data.approvalRequestId) || strOr(data.approval_request_id),
        status: data.approved === true ? 'approved' : 'rejected',
        approvalType: strOr(data.approvalType, 'CLIENT'),
        resolvedByName,
        ...seq,
      };
    }

    case MESSAGE_TYPE.ESCALATION_OFFER: {
      const offerId = typeof data.offerId === 'string' ? data.offerId : '';
      if (!offerId) return null;
      if (data.state === ESCALATION_STATE.PENDING) {
        return {
          type: 'escalation-offer',
          offerId,
          text: typeof data.text === 'string' ? data.text : '',
          origin: typeof data.origin === 'string' ? data.origin : undefined,
          ...seq,
        };
      }
      const status = escalationResolvedStatus(data.state);
      if (!status) return null;
      // Same realtime/history field split as APPROVAL_RESULT: the chunk names
      // the resolver `displayName`, the persisted row `resolvedByName`.
      return {
        type: 'escalation-offer-resolved',
        offerId,
        status,
        resolvedByName:
          typeof data.resolvedByName === 'string'
            ? data.resolvedByName
            : typeof data.displayName === 'string'
              ? data.displayName
              : undefined,
        ...seq,
      };
    }

    case MESSAGE_TYPE.TICKET_ESCALATED: {
      const ticketId = typeof data.ticketId === 'string' ? data.ticketId : '';
      const reason = typeof data.reason === 'string' ? data.reason : '';
      // Both are non-null on the wire; a payload missing either is malformed
      // rather than a variant to render.
      if (!ticketId || !reason) return null;
      return {
        type: 'ticket-escalated',
        ticketId,
        reason,
        ticketNumber: typeof data.ticketNumber === 'number' ? data.ticketNumber : undefined,
        text: typeof data.text === 'string' ? data.text : undefined,
        ...seq,
      };
    }

    case MESSAGE_TYPE.TICKET_EVENT: {
      // `kind` is the only required field, and deliberately an OPEN string:
      // unknown kinds must render (as a neutral line), not be dropped.
      const kind = typeof data.kind === 'string' ? data.kind.trim() : '';
      if (!kind) return null;
      // This chunk names its own JetStream sequence `sequenceId` in the
      // payload (the persisted row's `lastChunkStreamSeq` equals it — the
      // dedupe key). Prefer the transport-stamped `streamSeq` envelope like
      // every other chunk; fall back to the payload copy when absent.
      const eventSeq: { seq?: number } =
        seq.seq !== undefined ? seq : typeof data.sequenceId === 'number' ? { seq: data.sequenceId } : {};
      return {
        type: 'ticket-event',
        kind,
        actorId: typeof data.actorId === 'string' ? data.actorId : undefined,
        actorName: typeof data.actorName === 'string' ? data.actorName : undefined,
        actorType: typeof data.actorType === 'string' ? data.actorType : undefined,
        reason: typeof data.reason === 'string' && data.reason.trim() ? data.reason : undefined,
        targetStatusKind:
          typeof data.targetStatusKind === 'string' && data.targetStatusKind.trim() ? data.targetStatusKind : undefined,
        ...eventSeq,
      };
    }

    case MESSAGE_TYPE.ERROR:
      return {
        type: 'error',
        title: strOr(data.error, 'An error occurred'),
        details: str(data.details),
        ...seq,
      };

    case MESSAGE_TYPE.MESSAGE_REQUEST:
      return {
        type: 'participant',
        kind: 'message-request',
        text: String(data.text || ''),
        ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        userId: typeof data.userId === 'string' ? data.userId : undefined,
        // Wire shape carries no label; fall back to the id (parity with
        // the history path in `process-historical-messages.ts`).
        contextItems: Array.isArray(data.contextItems)
          ? (data.contextItems as Array<{ type?: unknown; id?: unknown }>)
              .filter(it => typeof it?.type === 'string' && typeof it?.id === 'string')
              .map(it => ({
                type: it.type as string,
                id: it.id as string,
                label: it.id as string,
              }))
          : undefined,
        ...seq,
      };

    case MESSAGE_TYPE.TOKEN_USAGE:
      return {
        type: 'token-usage',
        inputTokensSize: numOr(data.inputTokensSize),
        outputTokensSize: numOr(data.outputTokensSize),
        totalTokensSize: numOr(data.totalTokensSize),
        contextSize: numOr(data.contextSize),
        ...seq,
      };

    case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
      return { type: 'compaction', phase: 'start', ...seq };

    case MESSAGE_TYPE.CONTEXT_COMPACTION_END:
      return {
        type: 'compaction',
        phase: 'end',
        summary: typeof data.text === 'string' ? data.text : undefined,
        ...seq,
      };

    case MESSAGE_TYPE.SYSTEM:
      if (typeof data.text === 'string') {
        return { type: 'participant', kind: 'system', text: data.text, ...seq };
      }
      return null;

    case MESSAGE_TYPE.DIRECT_MESSAGE:
      if (typeof data.text === 'string') {
        return {
          type: 'participant',
          kind: 'direct-message',
          text: data.text,
          ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
          displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
          userId: typeof data.userId === 'string' ? data.userId : undefined,
          ...seq,
        };
      }
      return null;

    case MESSAGE_TYPE.DIALOG_CLOSED:
      return { type: 'dialog-closed', ...seq };

    default:
      return null;
  }
}
