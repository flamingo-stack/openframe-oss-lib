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
import { ESCALATION_STATE, GUIDE_ORIGIN, escalationResolvedStatus } from './events';
import type { ApprovalToolCall, ChatStreamEvent } from './events';
import { escapeThinkingTags, mapLeadingFrame } from './leading-frames';

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

// `GUIDE_ORIGIN` moved to `./events`, beside the `GuideOrigin` type it is the
// only value of — the SSE half reads it too, so it never belonged to the NATS
// decoder. Re-exported here because that is the import path consumers know.
export { GUIDE_ORIGIN } from './events';

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
 * Events whose meaning belongs to the AGENT's dialog rather than to the guide
 * turn embedded inside it. The hub emits its own copies of these, and the Mingo
 * dialog already has authoritative ones: letting the hub's through would
 * double-count the dialog's tokens or fight the agent's own phase chunks.
 *
 * Note this is a DENYLIST, and that is the point. `./leading-frames` is the ONE
 * place a hub frame kind is taught to the client; whatever it learns to emit —
 * including kinds that do not exist yet — must reach a Mingo dialog without a
 * second edit here. An allowlist would silently swallow every card the hub adds
 * next, and the guide half would quietly lag the guide chat.
 */
const AGENT_OWNED_EVENTS: ReadonlySet<ChatStreamEvent['type']> = new Set([
  'usage',
  'token-usage',
  'status',
  'compaction',
  'participant',
  'dialog-closed',
]);

/** Event types that declare `origin` (see `GuideOrigin`). Data rather than a
 *  branch per type, so a future hub card opts in by adding the field to its
 *  interface and its name here — the pass-through below needs no edit. */
const ORIGIN_BEARING_EVENTS: ReadonlySet<ChatStreamEvent['type']> = new Set(['approval-request', 'approval-resolved']);

/**
 * Adapt ONE Product Guide event to the NATS kernel.
 *
 * The guide half of a Mingo dialog is the hub's own stream, so it is decoded by
 * the shared table in `./leading-frames` and then passed through here — the ONE
 * place that reconciles the two kernels. Both entry points use it: frames
 * re-streamed by the agent inside `GUIDE` chunks, and the SSE response of the
 * hub's confirm-tool route, which a host replays into the same dialog.
 *
 * Pass-through is the DEFAULT; only these rules alter an event, and each exists
 * because the two kernels genuinely disagree:
 *
 *   - `text-delta` becomes `guide-delta`: the body of a guide turn belongs
 *     inside the "OpenFrame Guide" card, and a `text` segment would strand part
 *     of the same answer outside it.
 *   - thinking is escaped HERE. The SSE kernel escapes `<` on the way in, the
 *     NATS kernel does not, and the guide's thinking is full of XML-ish tokens
 *     that would otherwise render as markup.
 *   - `metadata` survives ONLY to carry `conversationId`, which the hub mints
 *     and every confirm-tool call must quote back. Everything else on that
 *     frame (the hub's model, routing) is dropped: `applyNats` rebuilds the
 *     dialog's live model from a metadata event, so letting it through would
 *     relabel a Mingo turn with the hub's model, and a routing frame — which
 *     carries no model at all — would blank the badge mid-answer.
 *   - dialog-level events stop here (`AGENT_OWNED_EVENTS`).
 *
 * Everything else crosses over as the hub typed it, gaining only `origin`.
 * `approvalType` in particular stays the TOOL NAME, exactly as in the hub's own
 * chat: the NATS kernel gates approvals on approval TIER and escalates the rest,
 * which is an agent-side concept a hub proposal has no tier for. Rewriting the
 * tool name into a fake tier to slip past that gate would make the guide half of
 * the stream diverge from the guide chat itself.
 */
export function guideEventForNats(event: ChatStreamEvent): ChatStreamEvent | null {
  switch (event.type) {
    case 'text-delta':
      return { type: 'guide-delta', text: event.text };
    case 'thinking-delta':
      return { type: 'thinking-delta', text: escapeThinkingTags(event.text) };
    case 'metadata':
      return typeof event.conversationId === 'string' && event.conversationId
        ? { type: 'metadata', conversationId: event.conversationId, origin: GUIDE_ORIGIN }
        : null;
    default:
      if (AGENT_OWNED_EVENTS.has(event.type)) return null;
      return ORIGIN_BEARING_EVENTS.has(event.type) ? ({ ...event, origin: GUIDE_ORIGIN } as ChatStreamEvent) : event;
  }
}

/**
 * Decode one re-streamed Product Guide frame (a `GUIDE` chunk's `payload`) into
 * a NATS event. The frame grammar is decoded by the shared table, never by a
 * second copy here; the kernel reconciliation is `guideEventForNats`.
 */
export function guideFrameEvent(frame: Record<string, unknown>): ChatStreamEvent | null {
  const events: ChatStreamEvent[] = [];
  // Every branch of the table pushes at most one event, so the first is the one.
  mapLeadingFrame(frame, events);
  const event = events[0];
  return event ? guideEventForNats(event) : null;
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

    // Two shapes share this chunk type. `text` is the answer body the agent
    // streams (and persists). `payload` is a Product Guide frame re-streamed
    // verbatim from the hub — decoded through the shared frame table, with the
    // narrowing `guideFrameEvent` documents.
    case MESSAGE_TYPE.GUIDE: {
      if (typeof data.text === 'string') {
        return { type: 'guide-delta', text: data.text, ...seq };
      }
      const frame = data.payload;
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) return null;
      const event = guideFrameEvent(frame as Record<string, unknown>);
      if (!event) return null;
      return { ...event, ...seq };
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
