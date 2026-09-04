/**
 * Utility for processing historical messages from GraphQL/API into
 * display-ready format.
 *
 * Phase 3 of the chat unification reduced this file to DECODE + ENVELOPE:
 *
 *   - `decodeHistoricalMessageData` maps one persisted `MessageData` item
 *     into the shared `ChatStreamEvent` vocabulary (historical items share
 *     the MESSAGE_TYPE vocabulary with NATS chunks but are NOT full chunk
 *     envelopes — e.g. compaction summaries ride in `summary`, not `text`,
 *     and APPROVAL_RESULT rows carry `resolvedByName` directly);
 *   - `applyHistoryEvent` replays each decoded event into the shared
 *     per-turn kernel (`MessageSegmentAccumulator` — the same kernel the
 *     master `createChatStreamReducer` instantiates) with the
 *     history-specific approval semantics (display-all default, pending
 *     tracking + `flushPendingApprovals`, `approvalStatuses` overrides);
 *   - the ENVELOPE (user/assistant flush-grouping, OWNER_TYPE author /
 *     display-name / avatar resolution, standalone SYSTEM handling,
 *     per-message contextItems mapping, per-turn streamSeq MAX) lives ONCE
 *     in `processHistory` — the previous near-duplicate second copy was
 *     deleted (`processHistoricalMessagesWithErrors` is an alias; the two
 *     snapshots were byte-identical).
 *
 * Adapters then feed the processed rows into the reducer via
 * `initializeWithState` (see `useNatsChatAdapter.loadDialogHistory`).
 */

import {
  ESCALATION_STATE,
  errorDetailsMessage,
  escalationResolvedStatus,
  type ChatStreamEvent,
} from '../../../chat-protocol/events';
// One normalizer for ask rows, shared with the live decoder — history and the
// stream must agree on which options are usable.
import { decodeNatsChunk, normalizeAskOptions } from '../../../chat-protocol/nats-decoder';
import type { ChatRef } from '../chat-ref.types';
import { applyApprovalStatusToSegment } from '../stream/message-mutations';
import {
  MESSAGE_TYPE,
  OWNER_TYPE,
  type AuthorType,
  type ChatApprovalStatus,
  type HistoricalMessage,
  type PendingToolCallData,
  type ProcessedMessage,
  type MessageProcessingOptions,
  type MessageData,
  type MessageOwner,
  type ChatSource,
} from '../types';
import { approvalDisplaysInline } from './approval-display';
import { mergeChatRefs, mergeChatSources } from './chat-source-metadata';
import { type MessageSegmentAccumulator, createMessageSegmentAccumulator } from './message-segment-accumulator';
import { getCommandText } from './tool-call-helpers';

function getOwnerDisplayName(owner?: MessageOwner): string {
  if (owner?.type === OWNER_TYPE.ADMIN && owner.user) {
    const { firstName, lastName } = owner.user;
    const name = [firstName, lastName].filter(Boolean).join(' ');
    if (name) return name;
  }
  return owner?.type === OWNER_TYPE.ADMIN ? 'Admin' : 'You';
}

/** Per-message author avatar (e.g. an admin's profile photo) when the owner
 *  carries one. `imageUrl` may be relative; the host resolves it downstream. */
function getOwnerAvatar(owner?: MessageOwner): string | undefined {
  return owner?.user?.image?.imageUrl ?? undefined;
}

function pushStandaloneMessages(
  processedMessages: ProcessedMessage[],
  msg: HistoricalMessage,
  messageDataArray: MessageData[],
): void {
  messageDataArray.forEach(data => {
    if (data.type === MESSAGE_TYPE.SYSTEM && 'text' in data && data.text) {
      processedMessages.push({
        id: msg.id,
        role: 'user',
        content: '',
        name: data.text,
        authorType: 'system',
        timestamp: new Date(msg.createdAt),
        ...(typeof msg.lastChunkStreamSeq === 'number' ? { streamSeq: msg.lastChunkStreamSeq } : {}),
      });
    }
  });
}

// =============================================================================
// Decode — persisted MessageData item → shared ChatStreamEvent vocabulary
// =============================================================================

/**
 * Map one persisted `MessageData` item to a normalized `ChatStreamEvent`.
 * Thin shim over the NATS chunk decoder's core mapping — the differences
 * are exactly the persisted-row divergences from the realtime envelope:
 *
 *   - compaction summaries arrive in `summary` (realtime: `text`);
 *   - APPROVAL_RESULT rows carry `resolvedByName` (realtime chunks carry
 *     the resolver's name as `displayName`);
 *   - `approvalType` defaults to 'CLIENT' (legacy history parity;
 *     realtime defaults APPROVAL_REQUEST to 'USER');
 *   - batch `toolCalls` pass through verbatim (already the persisted
 *     `PendingToolCallData` shape — no normalization pass).
 *
 * Returns `null` for rows the assistant-turn path doesn't decode (SYSTEM
 * is handled by the envelope's standalone path; user TEXT rows are handled
 * by the envelope's user path).
 */
export function decodeHistoricalMessageData(data: MessageData): ChatStreamEvent | null {
  switch (data.type) {
    case MESSAGE_TYPE.TEXT:
      if ('text' in data && data.text) {
        return { type: 'text-delta', text: data.text };
      }
      return null;

    case MESSAGE_TYPE.THINKING:
      if ('text' in data && data.text) {
        return { type: 'thinking-delta', text: data.text };
      }
      return null;

    case MESSAGE_TYPE.GUIDE:
    case MESSAGE_TYPE.SOURCES:
      return decodeNatsChunk({ type: data.type, payload: data.payload });

    // Same completeness gate as the live decoder (`decodeNatsChunk`): a
    // persisted row without a question or without options is not a card the
    // user can answer, so it replays as nothing rather than as empty chrome.
    case MESSAGE_TYPE.ASK: {
      if (!('question' in data)) return null;
      const question = typeof data.question === 'string' ? data.question.trim() : '';
      const options = normalizeAskOptions(data.options);
      if (!question || options.length === 0) return null;
      return {
        type: 'ask',
        ...(data.text ? { text: data.text } : {}),
        question,
        options,
      };
    }

    case MESSAGE_TYPE.EXECUTING_TOOL:
      if ('integratedToolType' in data) {
        return {
          type: 'tool-execution',
          data: {
            type: 'EXECUTING_TOOL',
            integratedToolType: data.integratedToolType || '',
            toolFunction: data.toolFunction || '',
            toolTitle: typeof data.title === 'string' ? data.title : undefined,
            // Same contract as the NATS decoder: the explanation line rides the
            // EXECUTING chunk only, so a history replay that drops it renders
            // an empty tool card even though the live stream showed one.
            toolExplanation: typeof data.toolExplanation === 'string' ? data.toolExplanation : undefined,
            parameters: data.parameters,
            toolExecutionRequestId: data.toolExecutionRequestId,
          },
        };
      }
      return null;

    case MESSAGE_TYPE.EXECUTED_TOOL:
      if ('integratedToolType' in data) {
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
            toolExecutionRequestId: data.toolExecutionRequestId,
          },
        };
      }
      return null;

    case MESSAGE_TYPE.APPROVAL_REQUEST:
      if ('approvalRequestId' in data && data.approvalRequestId) {
        return {
          type: 'approval-request',
          requestId: data.approvalRequestId,
          approvalType: data.approvalType || 'CLIENT',
          command: data.command || '',
          explanation: data.explanation,
          ...(Array.isArray(data.toolCalls) ? { toolCalls: data.toolCalls } : {}),
        };
      }
      return null;

    case MESSAGE_TYPE.APPROVAL_RESULT:
      if ('approvalRequestId' in data && data.approvalRequestId) {
        return {
          type: 'approval-resolved',
          requestId: data.approvalRequestId,
          status: data.approved ? 'approved' : 'rejected',
          approvalType: data.approvalType,
          resolvedByName: 'resolvedByName' in data ? data.resolvedByName : undefined,
        };
      }
      return null;

    case MESSAGE_TYPE.ESCALATION_OFFER: {
      if (!('offerId' in data) || !data.offerId) return null;
      if (data.state === ESCALATION_STATE.PENDING) {
        return {
          type: 'escalation-offer',
          offerId: data.offerId,
          text: data.text || '',
          origin: data.origin,
        };
      }
      const status = escalationResolvedStatus(data.state);
      if (!status) return null;
      return {
        type: 'escalation-offer-resolved',
        offerId: data.offerId,
        status,
        resolvedByName: data.resolvedByName,
      };
    }

    case MESSAGE_TYPE.TICKET_ESCALATED:
      if ('ticketId' in data && data.ticketId && data.reason) {
        return {
          type: 'ticket-escalated',
          ticketId: data.ticketId,
          reason: data.reason,
          ticketNumber: data.ticketNumber,
          text: data.text,
        };
      }
      return null;

    // Same completeness gate as the live decoder: `kind` (an OPEN string —
    // unknown kinds render as a neutral line) is the only required field.
    // Field names match the chunk, so ONE mapping covers both paths; the
    // typeof gates also fold the row's GraphQL nulls to undefined.
    case MESSAGE_TYPE.TICKET_EVENT: {
      const kind = 'kind' in data && typeof data.kind === 'string' ? data.kind.trim() : '';
      if (!kind) return null;
      return {
        type: 'ticket-event',
        kind,
        actorId: typeof data.actorId === 'string' ? data.actorId : undefined,
        actorName: typeof data.actorName === 'string' ? data.actorName : undefined,
        actorType: typeof data.actorType === 'string' ? data.actorType : undefined,
        reason: typeof data.reason === 'string' && data.reason.trim() ? data.reason : undefined,
        targetStatusKind:
          typeof data.targetStatusKind === 'string' && data.targetStatusKind.trim() ? data.targetStatusKind : undefined,
      };
    }

    case MESSAGE_TYPE.ERROR:
      if ('error' in data) {
        return {
          type: 'error',
          title: data.error || 'An error occurred',
          details: 'details' in data ? data.details : undefined,
        };
      }
      return null;

    case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
      return { type: 'compaction', phase: 'start' };

    case MESSAGE_TYPE.CONTEXT_COMPACTION_END:
      return {
        type: 'compaction',
        phase: 'end',
        summary: 'summary' in data && typeof data.summary === 'string' ? data.summary : undefined,
      };

    case MESSAGE_TYPE.SYSTEM:
      if ('text' in data && data.text) {
        return { type: 'participant', kind: 'system', text: data.text };
      }
      return null;

    default:
      // Unknown message type — ignore.
      return null;
  }
}

// =============================================================================
// Replay — decoded event → per-turn kernel (history approval semantics)
// =============================================================================

type EscalatedApprovals = Map<
  string,
  { command: string; explanation?: string; approvalType: string; toolCalls?: PendingToolCallData[] }
>;

/**
 * Terminal escalation-offer resolutions collected while walking history, so
 * they can be applied to ALREADY-FLUSHED bubbles after the walk. The offer
 * row and its resolution row are separated by the user message that caused
 * SUPERSEDED, which puts them in different assistant envelopes — by the time
 * the resolution is read, the accumulator holding the card has been reset.
 */
type OfferResolutions = Map<string, { status: ChatApprovalStatus; resolvedByName?: string | null }>;

/**
 * Replay one decoded event into the shared per-turn segment kernel with the
 * HISTORY approval semantics (an omitted `displayApprovalTypes` means
 * "display every approval type" — the original history behavior; the
 * realtime reducer defaults to `['CLIENT']`).
 */
function applyHistoryEvent(
  event: ChatStreamEvent,
  accumulator: MessageSegmentAccumulator,
  approvalStatuses: Record<string, string>,
  options: MessageProcessingOptions,
  escalatedApprovals?: EscalatedApprovals,
  offerResolutions?: OfferResolutions,
  rowCreatedAt?: Date,
  rowStreamSeq?: number,
): void {
  // batchApprovalsEnabled is owned by the consumer (oss-tenant chat client /
  // openframe-frontend tickets). Defaults to ON so consumers that haven't
  // wired the flag yet get the batch UI; pass `false` to force legacy.
  const { displayApprovalTypes, batchApprovalsEnabled = true, escalationOfferStates } = options;

  switch (event.type) {
    case 'escalation-offer':
      // Always a real segment, never the tracked/flushed treatment single
      // approvals get: the offer belongs inline where it was posted.
      accumulator.addEscalationOffer(
        event.offerId,
        event.text,
        event.origin,
        escalationOfferStates?.[event.offerId] ?? 'pending',
      );
      break;

    case 'ticket-escalated':
      accumulator.addTicketEscalated({
        ticketId: event.ticketId,
        ticketNumber: event.ticketNumber,
        reason: event.reason,
        text: event.text,
      });
      break;

    // `rowStreamSeq` re-stamps the event's JetStream sequence (the persisted
    // row's `lastChunkStreamSeq` - `messageData` itself does not carry it).
    // The store's `ticket-event:<seq>` upsert key is the ONLY join between
    // this hydrated segment and a catch-up/stale-consumer replay of the same
    // chunk; a seq-less segment never joins, so the replayed copy rendered as
    // a second identical card (the resolve/reopen duplication). The payload
    // fallback in `addTicketEvent` cannot own that case: a COMPLETE hydrated
    // tail seeds no accumulator, so the twins only ever meet in the store.
    case 'ticket-event':
      // `rowCreatedAt` is the persisted row's own time - without it the card
      // renders the enclosing assistant bubble's timestamp, i.e. the FIRST
      // row of the turn, and every lifecycle card reads the same stale time.
      accumulator.addTicketEvent(
        {
          kind: event.kind,
          actorId: event.actorId,
          actorName: event.actorName,
          actorType: event.actorType,
          reason: event.reason,
          targetStatusKind: event.targetStatusKind,
        },
        rowStreamSeq,
        rowCreatedAt,
      );
      break;

    case 'escalation-offer-resolved':
      // Recorded, not applied here: `applyOfferResolutions` runs after every
      // flush and covers the same-bubble case as well as the cross-bubble one.
      offerResolutions?.set(event.offerId, {
        status: event.status,
        resolvedByName: event.resolvedByName,
      });
      break;

    case 'text-delta':
      accumulator.appendText(event.text);
      break;

    case 'thinking-delta':
      accumulator.appendThinking(event.text);
      break;

    // Mirror of the live path: the intro sentence replays as answer text in
    // front of the card, so a reloaded thread reads exactly like the stream did.
    case 'ask':
      if (event.text) accumulator.appendText(event.text);
      accumulator.addAsk(event.question, event.options);
      break;

    case 'tool-execution':
      accumulator.addToolExecution({ type: 'tool_execution', data: event.data });
      break;

    case 'approval-request': {
      const approvalType = event.approvalType || 'CLIENT';
      const toolCalls = event.toolCalls;
      const isBatch = !!toolCalls && toolCalls.length > 0;
      // Same rule the live kernels use — a card must not change where it
      // renders just because the page was reloaded and it came back through
      // history instead of the stream.
      if (approvalDisplaysInline(approvalType, displayApprovalTypes)) {
        if (isBatch) {
          const status = (approvalStatuses[event.requestId] as ChatApprovalStatus) || 'pending';
          if (batchApprovalsEnabled) {
            accumulator.addApprovalBatch(event.requestId, approvalType, toolCalls, status, undefined, undefined);
          } else {
            // Flag OFF — unfold batch into N legacy approval cards (same id).
            for (const call of toolCalls) {
              if (!call.requiresApproval) continue;
              accumulator.addApprovalRequest(
                event.requestId,
                getCommandText(call),
                call.toolExplanation,
                approvalType,
                status,
                undefined,
              );
            }
          }
        } else {
          // The resolution may already be known to the consumer (realtime
          // flipped it and fed it back via `approvalStatuses`) while the
          // matching APPROVAL_RESULT row is absent from the fetched history
          // pages. Without this, the single-approval path tracks it as
          // pending and `flushPendingApprovals()` resurrects it as a stale
          // sticky card on every history re-process. Mirror the batch path
          // and honor `approvalStatuses`.
          const resolvedStatus = approvalStatuses[event.requestId] as ChatApprovalStatus | undefined;
          const isResolved = resolvedStatus === 'approved' || resolvedStatus === 'rejected';
          if (isResolved) {
            accumulator.addApprovalRequest(
              event.requestId,
              event.command || '',
              event.explanation,
              approvalType,
              resolvedStatus ?? 'pending',
              event.fields,
            );
          } else {
            accumulator.trackApprovalRequest(event.requestId, {
              command: event.command || '',
              explanation: event.explanation,
              approvalType,
              fields: event.fields,
            });
          }
        }
      } else {
        escalatedApprovals?.set(event.requestId, {
          command: event.command || '',
          explanation: event.explanation,
          approvalType,
          ...(isBatch ? { toolCalls } : {}),
        });
      }
      break;
    }

    case 'approval-resolved': {
      const requestId = event.requestId;
      if (!requestId) break;
      const existingStatus = approvalStatuses[requestId] as ChatApprovalStatus | undefined;
      const status: ChatApprovalStatus = existingStatus || event.status;
      const resolvedByName = event.resolvedByName;
      const escalatedData = escalatedApprovals?.get(requestId);

      if (escalatedData?.toolCalls && escalatedData.toolCalls.length > 0) {
        if (batchApprovalsEnabled) {
          accumulator.addApprovalBatch(
            requestId,
            escalatedData.approvalType,
            escalatedData.toolCalls,
            status,
            undefined,
            resolvedByName,
          );
        } else {
          for (const call of escalatedData.toolCalls) {
            if (!call.requiresApproval) continue;
            accumulator.addApprovalRequest(
              requestId,
              getCommandText(call),
              call.toolExplanation,
              escalatedData.approvalType,
              status,
            );
          }
        }
        escalatedApprovals?.delete(requestId);
        break;
      }

      if (escalatedData) {
        accumulator.trackApprovalRequest(requestId, {
          command: escalatedData.command,
          explanation: escalatedData.explanation,
          approvalType: escalatedData.approvalType,
        });
        escalatedApprovals?.delete(requestId);
      }

      // If a segment with this id is already present (batch or legacy), just
      // flip its status. updateApprovalStatus matches both `approval_batch`
      // and `approval_request` segments.
      const before = accumulator.getSegments();
      const after = accumulator.updateApprovalStatus(requestId, status, resolvedByName);
      const updatedExisting = before.some((s, i) => after[i] !== s);
      if (updatedExisting) break;

      accumulator.processApprovalResult(requestId, status === 'approved', event.approvalType || 'USER');
      break;
    }

    case 'error': {
      // Shared with the live path in `chat-stream-reducer` — one decoder so a
      // card cannot read one way live and another on refresh.
      accumulator.addError(event.title, errorDetailsMessage(event.details));
      break;
    }

    case 'compaction':
      if (event.phase === 'start') {
        accumulator.addContextCompaction();
      } else {
        accumulator.completeContextCompaction(event.summary);
      }
      break;

    default:
      // Participant/system rows are envelope concerns; everything else is
      // realtime-only vocabulary that never appears in persisted rows.
      break;
  }
}

// =============================================================================
// Envelope — ONE implementation (previous duplicate deleted)
// =============================================================================

/**
 * Result type for historical message processing
 */
export interface ProcessHistoricalMessagesResult {
  messages: ProcessedMessage[];
  escalatedApprovals: EscalatedApprovals;
}

/**
 * Process an array of historical messages into display-ready format
 */
export function processHistoricalMessages(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {},
): ProcessHistoricalMessagesResult {
  const {
    assistantName = 'Fae',
    assistantType = 'fae',
    assistantAvatar,
    onApprove,
    onReject,
    chatTypeFilter,
    approvalStatuses = {},
    // An omitted option means "display every approval type" — the original
    // history semantics. Deliberately NOT defaulted to the realtime
    // reducer's ['CLIENT']: consumers that pass a wider list to their
    // realtime path but omit it on the history path would silently lose
    // pending non-CLIENT approval cards on every reload/reconnect refetch
    // (they also ignore `escalatedApprovals`). Realtime/history parity is
    // opt-in: pass the same explicit list to both.
    displayApprovalTypes,
    batchApprovalsEnabled,
    escalationOfferStates,
    onEscalationApprove,
    onEscalationReject,
  } = options;

  const processedMessages: ProcessedMessage[] = [];
  const accumulator = createMessageSegmentAccumulator({
    onApprove,
    onReject,
    onEscalationApprove,
    onEscalationReject,
  });
  const escalatedApprovals: EscalatedApprovals = new Map();
  const offerResolutions: OfferResolutions = new Map();

  let currentAssistantId: string | null = null;
  let currentAssistantTimestamp: Date | null = null;
  let lastAssistantId: string | null = null;
  // MAX persisted seq across the rows grouped into the current assistant turn
  // — carried onto the flushed message's streamSeq for per-role merge coverage.
  let currentAssistantStreamSeq: number | undefined;
  let currentAssistantSources: ChatSource[] | undefined;
  let currentAssistantRefs: ChatRef[] | undefined;

  /**
   * Flush the current assistant message to processedMessages.
   * Uses the LAST message ID in the group for stable React keys across page boundaries.
   */
  const flushAssistantMessage = () => {
    const idToUse = lastAssistantId || currentAssistantId;
    if (idToUse && accumulator.hasContent()) {
      processedMessages.push({
        id: idToUse,
        role: 'assistant',
        content: accumulator.getSegments(),
        name: assistantName,
        assistantType,
        authorType: assistantType,
        timestamp: currentAssistantTimestamp || new Date(),
        avatar: assistantAvatar,
        ...(currentAssistantSources ? { sources: currentAssistantSources } : {}),
        ...(currentAssistantRefs ? { refs: currentAssistantRefs } : {}),
        ...(currentAssistantStreamSeq !== undefined ? { streamSeq: currentAssistantStreamSeq } : {}),
      });
      accumulator.resetSegments();
    }
    // Reset grouping identity + seq UNCONDITIONALLY — even on an EMPTY flush (an
    // assistant turn whose only data was a filtered/escalated approval renders
    // nothing, so `hasContent()` is false and nothing is pushed). Left inside
    // the push-block, a stale id/timestamp and (worse) a stale
    // `currentAssistantStreamSeq` bleed into the NEXT assistant turn: `!currentAssistantId`
    // stays false so it keeps the old id/timestamp, and `Math.max` inflates its
    // streamSeq — which then over-covers synthetics in the history merge.
    currentAssistantId = null;
    currentAssistantTimestamp = null;
    lastAssistantId = null;
    currentAssistantStreamSeq = undefined;
    currentAssistantSources = undefined;
    currentAssistantRefs = undefined;
  };

  messages.forEach((msg, index) => {
    // Filter by chat type if specified
    if (chatTypeFilter && msg.chatType !== chatTypeFilter) return;

    const messageDataArray = Array.isArray(msg.messageData)
      ? msg.messageData
      : msg.messageData
        ? [msg.messageData]
        : [];

    const hasStandaloneData = messageDataArray.some(data => data.type === MESSAGE_TYPE.SYSTEM);
    if (hasStandaloneData) {
      flushAssistantMessage();
      pushStandaloneMessages(processedMessages, msg, messageDataArray);
      return;
    }

    const isUserMessage = msg.owner?.type === OWNER_TYPE.CLIENT || msg.owner?.type === OWNER_TYPE.ADMIN;

    if (isUserMessage) {
      flushAssistantMessage();

      const userAuthorType: AuthorType = msg.owner?.type === OWNER_TYPE.ADMIN ? 'admin' : 'user';
      messageDataArray.forEach(data => {
        if (data.type === MESSAGE_TYPE.TEXT && 'text' in data && data.text) {
          // `TextData.contextItems` (server: `[{ type, id }]`) — the entity
          // context the user attached to this message. Surface it so the bubble
          // renders its chip strip from history (no label on the wire → fall
          // back to the id, matching the realtime path).
          const rawContext = (data as { contextItems?: Array<{ type?: unknown; id?: unknown }> }).contextItems;
          const contextItems = Array.isArray(rawContext)
            ? rawContext
                .filter(c => typeof c?.type === 'string' && typeof c?.id === 'string')
                .map(c => ({ type: c.type as string, id: c.id as string, label: c.id as string }))
            : undefined;
          processedMessages.push({
            id: msg.id,
            role: 'user',
            content: data.text,
            name: getOwnerDisplayName(msg.owner),
            avatar: getOwnerAvatar(msg.owner),
            authorType: userAuthorType,
            timestamp: new Date(msg.createdAt),
            ...(contextItems && contextItems.length > 0 ? { contextItems } : {}),
            ...(typeof msg.lastChunkStreamSeq === 'number' ? { streamSeq: msg.lastChunkStreamSeq } : {}),
          });
        }
      });
    } else {
      if (!currentAssistantId) {
        currentAssistantId = msg.id;
        currentAssistantTimestamp = new Date(msg.createdAt);
      }
      lastAssistantId = msg.id;
      if (typeof msg.lastChunkStreamSeq === 'number') {
        currentAssistantStreamSeq =
          currentAssistantStreamSeq === undefined
            ? msg.lastChunkStreamSeq
            : Math.max(currentAssistantStreamSeq, msg.lastChunkStreamSeq);
      }

      messageDataArray.forEach(data => {
        const event = decodeHistoricalMessageData(data);
        if (!event) return;
        if (event.type === 'sources') {
          currentAssistantSources = mergeChatSources(currentAssistantSources, event.sources);
          if (event.refs) currentAssistantRefs = mergeChatRefs(currentAssistantRefs, event.refs);
          return;
        }
        applyHistoryEvent(
          event,
          accumulator,
          approvalStatuses,
          { displayApprovalTypes, batchApprovalsEnabled, escalationOfferStates },
          escalatedApprovals,
          offerResolutions,
          new Date(msg.createdAt),
          // TICKET_EVENT chunks are standalone, one per row, so the row seq IS
          // the event seq - but vouch for that only when the row holds exactly
          // one entry: a bundled row's `lastChunkStreamSeq` belongs to its LAST
          // chunk and could stamp the wrong event.
          messageDataArray.length === 1 && typeof msg.lastChunkStreamSeq === 'number'
            ? msg.lastChunkStreamSeq
            : undefined,
        );
      });

      // Check if we should flush (next message is from user or last message)
      const nextMsg = messages[index + 1];
      const isLastMessage = index === messages.length - 1;
      const nextIsFromUser =
        nextMsg && (nextMsg.owner?.type === OWNER_TYPE.CLIENT || nextMsg.owner?.type === OWNER_TYPE.ADMIN);

      if (isLastMessage || nextIsFromUser) {
        flushAssistantMessage();
      }
    }
  });

  flushAssistantMessage();

  const pendingApprovalSegments = accumulator.flushPendingApprovals();
  if (pendingApprovalSegments.length > 0) {
    processedMessages.push({
      id: `pending-approvals-${Date.now()}`,
      role: 'assistant',
      content: pendingApprovalSegments,
      name: assistantName,
      assistantType,
      timestamp: new Date(),
      avatar: assistantAvatar,
    });
  }

  const resolvedMessages = applyOfferResolutions(processedMessages, offerResolutions);

  return {
    messages: resolvedMessages,
    escalatedApprovals: escalatedApprovals,
  };
}

/**
 * Flip escalation-offer cards that were flushed into an EARLIER bubble than
 * their resolution row. Returns a new list (unchanged bubbles keep their
 * identity, so the array is only rebuilt when something actually flipped).
 * Uses the same `applyApprovalStatusToSegment` rule as the live projection so
 * the two paths cannot drift.
 */
function applyOfferResolutions(
  processedMessages: ProcessedMessage[],
  offerResolutions: OfferResolutions,
): ProcessedMessage[] {
  if (offerResolutions.size === 0) return processedMessages;

  return processedMessages.map(msg => {
    if (!Array.isArray(msg.content)) return msg;
    let changed = false;
    const content = msg.content.map(segment => {
      if (segment.type !== 'escalation_offer') return segment;
      const resolution = offerResolutions.get(segment.data.offerId);
      if (!resolution) return segment;
      const next = applyApprovalStatusToSegment(
        segment,
        segment.data.offerId,
        resolution.status,
        resolution.resolvedByName,
      );
      if (next !== segment) changed = true;
      return next;
    });
    return changed ? { ...msg, content } : msg;
  });
}

/**
 * Extract error messages from historical messages
 * Returns a separate array of error messages that should be displayed
 */
export function extractErrorMessages(
  messages: HistoricalMessage[],
  options: MessageProcessingOptions = {},
): ProcessedMessage[] {
  const { assistantName = 'Fae', assistantType = 'fae', assistantAvatar, chatTypeFilter } = options;

  const errorMessages: ProcessedMessage[] = [];

  messages.forEach(msg => {
    if (chatTypeFilter && msg.chatType !== chatTypeFilter) return;

    const messageDataArray = Array.isArray(msg.messageData)
      ? msg.messageData
      : msg.messageData
        ? [msg.messageData]
        : [];

    messageDataArray.forEach(data => {
      if (data.type === MESSAGE_TYPE.ERROR) {
        errorMessages.push({
          id: `${msg.id}-error`,
          role: 'error',
          content: 'error' in data && data.error ? data.error : 'An error occurred',
          name: assistantName,
          assistantType,
          timestamp: new Date(msg.createdAt),
          avatar: assistantAvatar,
        });
      }
    });
  });

  return errorMessages;
}

/**
 * Process messages and include error messages in the correct order.
 *
 * HISTORICAL ALIAS: this was a byte-identical second copy of
 * `processHistoricalMessages` (both goldens snapshot identical output on the
 * same corpus). The duplicate envelope was deleted in Phase 3 — kept as an
 * alias for the established import sites.
 */
export const processHistoricalMessagesWithErrors = processHistoricalMessages;
