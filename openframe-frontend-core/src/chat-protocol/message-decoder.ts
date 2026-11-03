/**
 * The ONE decoder: every way a message reaches this library, read into the same `UiChunk`s and `ChatMessage`s, and
 * validated on the way in (a raw cast is how a rename used to fail silently).
 *
 *   - `createChatStreamReader(response)`: the hub's stream;
 *   - `createMingoDecoder()`: a NATS chunk and a GraphQL row, one stateful decoder per dialog;
 *   - `messageOfStoredRow(row)`: a row of the hub's history.
 *
 * During the window older backends answer too, and `./old-wire` reads what they say.
 * TODO(CU-17tkuw61kfy): the branches that reach it go at the cleanup.
 *
 * Server-safe: no React, no browser APIs beyond TextDecoder.
 */

import { MESSAGE_TYPE } from '../components/chat/types/message.types';
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../components/chat/utils/auto-continuation-directive';
import {
  parseMessageMetadata,
  parseStoredParts,
  textOfParts,
  type ChatApprovalDescriptor,
  type ChatMessage,
  type ChatMessageMetadata,
  type ChatSourcePart,
  type ChatToolMetadata,
} from './chat-message';
import {
  createOldFrameDecoder,
  createOldRunIds,
  createOldSourceIndex,
  createOldTextWriter,
  oldApprovalRequestId,
  oldDocSearchFields,
  oldGuidePayload,
  oldMentionsToRecordLinks,
  oldRecordCardsOf,
  oldSingleApprovalChunks,
  oldStoredRowMetadata,
  oldStoredRowToParts,
  oldVideoParts,
} from './old-wire';
import { normalizeRecordUris, normalizeSourceId, parseRecordHref } from './record-link';
import { createUiChunkDecoder, drainChunks, type ChatStreamEntry, type UiChunk } from './ui-chunks';
import { isRecord } from './wire-narrow';

// =============================================================================
// The hub's stream
// =============================================================================

/** What a body turned out to be. `old` keeps the old approval route: the old hub has no other. */
export type ChatStreamWire = 'ui' | 'old';

export interface ChatStreamReader {
  wire: ChatStreamWire;
  chunks: AsyncGenerator<UiChunk, void, undefined>;
}

const UI_STREAM_START = new TextEncoder().encode('data: ');

function emptyBody(): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({ start: controller => controller.close() });
}

/**
 * The stream behind a response, recognised by its FIRST BYTES: a body starting `data: ` is the UI stream, anything else
 * the old frames, whatever its `content-type`. The old hub already labels its frames `text/event-stream` on two routes,
 * and the native shell calls the gateway cross-origin, where a header of our own would need exposing.
 * TODO(CU-17tkuw61kfy): the cleanup deletes the branch.
 */
export async function createChatStreamReader(response: {
  body: ReadableStream<Uint8Array> | null;
}): Promise<ChatStreamReader> {
  const reader = (response.body ?? emptyBody()).getReader();
  const head: Uint8Array[] = [];
  let matched = 0;
  while (matched < UI_STREAM_START.length) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.length === 0) continue;
    head.push(value);
    for (const byte of value) {
      if (matched === UI_STREAM_START.length) break;
      if (byte !== UI_STREAM_START[matched]) {
        return { wire: 'old', chunks: drainChunks(reader, createOldFrameDecoder(), head) };
      }
      matched++;
    }
  }
  return { wire: 'ui', chunks: drainChunks(reader, createUiChunkDecoder(), head) };
}

// =============================================================================
// Mingo
// =============================================================================

/** What a GraphQL row knows that its `messageData` entry does not. */
export interface MingoRowContext {
  /** The row's `lastChunkStreamSeq`. Only an entry alone in its row may claim it. */
  seq?: number;
  /** The row's own time, ISO. */
  createdAt?: string;
}

export interface MingoDecoder {
  /**
   * One NATS chunk, or with `row` one entry of a persisted row: a persisted entry is whole, so what it opens it also
   * closes. `seq` is the JetStream `streamSeq`, the reducer's idempotency gate. Unknown or malformed input answers no
   * chunks: a backend that adds a type must not break the stream.
   *
   * A chunk at or below the highest sequence this decoder has read is a redelivery, and answers no chunks and moves no
   * state: what the reducer's gate would drop must not flush a text this decoder is holding. So a decoder lives exactly
   * as long as its reducer's sequence does: a host that resets the reducer makes a new decoder.
   */
  decode(raw: unknown, options?: { row?: MingoRowContext }): ChatStreamEntry;
  /** A turn with no chunk of its own to say it ended (rows of history): what it left open stays in it. */
  endTurn(): void;
  /**
   * What is held back (a text tail that could still be a token, an open reasoning) is forgotten, with no chunk. For a host
   * whose thread now draws another copy of what this decoder was writing, the persisted row: that copy already says it,
   * and flushing it would write it a second time. The sequence stays, so a redelivery is still a redelivery.
   *
   * TODO(CU-17tkuw61kfy): goes with the old text writer. With no old tokens, no tail is ever held.
   */
  discardHeld(): void;
  /**
   * What is held back, written and closed: the entry a host applies before a send of its own. A send opens the next turn
   * with no chunk to say so, and a turn can end with no `MESSAGE_END` (a crash, a lost chunk), so what this decoder still
   * holds would otherwise be written below the new message by the next chunk that closes it. No sequence: this comes off
   * no wire.
   *
   * TODO(CU-17tkuw61kfy): goes with the old text writer, like `discardHeld`.
   */
  closeHeld(): ChatStreamEntry;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function numOr(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

/** Decode an error's `details`: a JSON envelope (`{ error: { message } }`) or an already human string. */
function errorDetails(details: unknown): string | undefined {
  if (typeof details !== 'string' || details === '') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(details);
  } catch {
    return details;
  }
  if (!isRecord(parsed) || !isRecord(parsed.error)) return undefined;
  return str(parsed.error.message);
}

function askOptionsOf(raw: unknown): Array<{ label: string; description?: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isRecord)
    .map(item => ({
      label: typeof item.label === 'string' ? item.label.trim() : '',
      description: str(item.description),
    }))
    .filter(option => option.label.length > 0)
    .map(({ label, description }) => ({ label, ...(description !== undefined ? { description } : {}) }));
}

/** A source row in the new names, or null when it is in the old ones. GraphQL answers an unset field with null. */
function newSourcePart(row: Record<string, unknown>): ChatSourcePart | null {
  const named = nonEmpty(row.sourceId);
  if (!named) return null;
  const sourceId = normalizeSourceId(named);
  const title = nonEmpty(row.title);
  const url = nonEmpty(row.url);
  if (url && row.type !== 'source-document') {
    return { type: 'source-url', sourceId, url, ...(title ? { title } : {}) };
  }
  const filename = nonEmpty(row.filename);
  return {
    type: 'source-document',
    sourceId,
    mediaType: nonEmpty(row.mediaType) ?? 'text/plain',
    title: title ?? parseRecordHref(sourceId)?.id ?? sourceId,
    ...(filename ? { filename } : {}),
  };
}

/** What a person said in a Mingo row or chunk. TODO(CU-17tkuw61kfy): an old composer's tokens go with the old rows. */
export function mingoUserText(content: string): string {
  return oldMentionsToRecordLinks(content);
}

/** The approval a Mingo row or chunk names. TODO(CU-17tkuw61kfy): the old name goes with the old rows. */
export function mingoApprovalRequestId(raw: Record<string, unknown>): string | undefined {
  return nonEmpty(raw.approvalRequestId) ?? oldApprovalRequestId(raw);
}

export function createMingoDecoder(options: { now?: () => string } = {}): MingoDecoder {
  const now = options.now ?? (() => new Date().toISOString());
  // TODO(CU-17tkuw61kfy): the old source names, and the old tokens in a text, go with the old rows; text is then plain.
  const sources = createOldSourceIndex();
  let nextId = 0;
  const mintId = (prefix: string): string => `${prefix}${++nextId}`;
  const writer = createOldTextWriter(sources, () => mintId('t'), { citations: false });
  // TODO(CU-17tkuw61kfy): a tool row with no run id. Goes once the cleanup's sweep has given those rows ids.
  const oldRuns = createOldRunIds();
  let reasoningId: string | null = null;
  let compactionId: string | null = null;
  /**
   * The newest single approval still open: a tool only runs after its gate was granted.
   * TODO(CU-17tkuw61kfy): only an approval row with no tool list has one.
   */
  let pendingSingleApproval: string | null = null;
  const seenTools = new Set<string>();
  let lastSeq = Number.NEGATIVE_INFINITY;

  function closeOpen(out: UiChunk[]): void {
    if (reasoningId !== null) {
      out.push({ type: 'reasoning-end', id: reasoningId });
      reasoningId = null;
    }
    out.push(...writer.close());
  }

  function writeText(content: string, out: UiChunk[]): void {
    if (reasoningId !== null) {
      out.push({ type: 'reasoning-end', id: reasoningId });
      reasoningId = null;
    }
    out.push(...writer.push(content));
  }

  function sourceChunks(data: Record<string, unknown>): UiChunk[] {
    const parts: ChatSourcePart[] = [];
    const rows = Array.isArray(data.sources) ? data.sources.filter(isRecord) : [];
    for (const row of rows) {
      const part = newSourcePart(row);
      if (part) parts.push(part);
    }
    // TODO(CU-17tkuw61kfy): a row in the old names, and the old video rows. An old row read through the tenant's normaliser
    // answers its sources in the new names and its text as it was, so its `[card://t:i]` takes its name from these too.
    parts.push(...sources.register(rows.filter(row => !nonEmpty(row.sourceId))), ...oldVideoParts(data.videos));
    sources.remember(parts);
    return parts;
  }

  function toolInput(data: Record<string, unknown>, toolCallId: string): UiChunk {
    const metadata: ChatToolMetadata = {
      started: true,
      ...(nonEmpty(data.integratedToolType) ? { integratedToolType: data.integratedToolType as string } : {}),
      ...(nonEmpty(data.toolExplanation) ? { toolExplanation: data.toolExplanation as string } : {}),
      ...(nonEmpty(data.statusLabel) ? { statusLabel: data.statusLabel as string } : {}),
    };
    const title = nonEmpty(data.title);
    seenTools.add(toolCallId);
    return {
      type: 'tool-input-available',
      toolCallId,
      toolName: str(data.toolFunction) ?? '',
      input: isRecord(data.parameters) ? data.parameters : {},
      dynamic: true,
      ...(title ? { title } : {}),
      toolMetadata: metadata,
    };
  }

  /** A running tool grants its own row's gate, and the newest single gate when it has none of its own. */
  function grantsOfRun(data: Record<string, unknown>, toolCallId: string): UiChunk[] {
    const out: UiChunk[] = [];
    if (nonEmpty(data.toolExecutionRequestId)) {
      out.push({ type: 'tool-approval-response', approvalId: toolCallId, approved: true });
    }
    if (pendingSingleApproval !== null) {
      out.push({ type: 'tool-approval-response', approvalId: pendingSingleApproval, approved: true });
      pendingSingleApproval = null;
    }
    return out;
  }

  function approvalChunks(data: Record<string, unknown>, isRow: boolean, out: UiChunk[]): void {
    // TODO(CU-17tkuw61kfy): the old name.
    const requestId = mingoApprovalRequestId(data) ?? '';
    const approvalType = nonEmpty(data.approvalType) ?? (isRow ? 'CLIENT' : 'USER');
    const calls = Array.isArray(data.toolCalls) ? data.toolCalls.filter(isRecord) : [];
    if (calls.length > 0) {
      for (const call of calls) {
        const id = nonEmpty(call.toolExecutionRequestId);
        if (!id) continue;
        const requiresApproval = call.requiresApproval === true;
        const explanation = nonEmpty(call.toolExplanation);
        const metadata: ChatToolMetadata = {
          ...(nonEmpty(call.toolType) ? { integratedToolType: call.toolType as string } : {}),
          ...(explanation ? { toolExplanation: explanation } : {}),
          ...(requiresApproval ? {} : { batchId: requestId }),
        };
        const title = nonEmpty(call.toolTitle);
        out.push({
          type: 'tool-input-available',
          toolCallId: id,
          toolName: str(call.toolName) ?? '',
          input: isRecord(call.toolCallArguments) ? call.toolCallArguments : {},
          dynamic: true,
          ...(title ? { title } : {}),
          ...(Object.keys(metadata).length > 0 ? { toolMetadata: metadata } : {}),
        });
        if (requiresApproval) {
          const descriptor: ChatApprovalDescriptor = { approvalType, batchId: requestId };
          out.push({
            type: 'tool-approval-request',
            approvalId: id,
            toolCallId: id,
            ...(explanation ? { reason: explanation } : {}),
            approvalDescriptor: descriptor,
          });
        }
      }
      return;
    }
    // TODO(CU-17tkuw61kfy): a row with no tool list.
    if (!requestId) return;
    out.push(...oldSingleApprovalChunks(data, requestId, approvalType));
    pendingSingleApproval = requestId;
  }

  function escalationStatus(state: unknown): 'pending' | 'approved' | 'rejected' | 'cancelled' | null {
    switch (state) {
      case 'PENDING':
        return 'pending';
      case 'APPROVED':
        return 'approved';
      case 'DECLINED':
        return 'rejected';
      case 'SUPERSEDED':
        return 'cancelled';
      default:
        return null;
    }
  }

  function decode(raw: unknown, decodeOptions: { row?: MingoRowContext } = {}): ChatStreamEntry {
    const out: UiChunk[] = [];
    if (!isRecord(raw)) return { chunks: out };
    const { row } = decodeOptions;
    const isRow = row !== undefined;
    // A ticket event names its own sequence in the payload; the transport's envelope wins when both are there.
    const seq =
      typeof raw.streamSeq === 'number'
        ? raw.streamSeq
        : (row?.seq ??
          (raw.type === MESSAGE_TYPE.TICKET_EVENT && typeof raw.sequenceId === 'number' ? raw.sequenceId : undefined));
    if (!isRow && seq !== undefined) {
      if (seq <= lastSeq) return { seq, chunks: out };
      lastSeq = seq;
    }
    const resolvedByName = str(raw.resolvedByName) ?? str(raw.displayName);

    switch (raw.type) {
      case MESSAGE_TYPE.MESSAGE_START:
        closeOpen(out);
        oldRuns.endTurn();
        out.push({ type: 'start', messageId: seq !== undefined ? `stream-${seq}` : mintId('stream-') });
        break;

      case MESSAGE_TYPE.MESSAGE_END:
        closeOpen(out);
        oldRuns.endTurn();
        out.push({ type: 'finish', finishReason: 'stop' });
        break;

      case MESSAGE_TYPE.AI_METADATA: {
        const provider = nonEmpty(raw.providerName) ?? nonEmpty(raw.provider);
        const model = str(raw.modelName);
        if (model !== undefined && provider) {
          const modelLabel = str(raw.modelDisplayName);
          out.push({
            type: 'message-metadata',
            messageMetadata: {
              model,
              provider,
              contextWindowMaxTokens: numOr(raw.contextWindow),
              ...(modelLabel !== undefined ? { modelLabel } : {}),
            },
          });
        }
        break;
      }

      case MESSAGE_TYPE.TEXT:
        if (typeof raw.text === 'string' && raw.text !== '') {
          writeText(raw.text, out);
          if (isRow) out.push(...writer.close());
        }
        break;

      case MESSAGE_TYPE.THINKING:
        if (typeof raw.text === 'string' && raw.text !== '') {
          if (reasoningId === null) {
            reasoningId = mintId('r');
            out.push({ type: 'reasoning-start', id: reasoningId });
          }
          out.push({ type: 'reasoning-delta', id: reasoningId, delta: raw.text });
          if (isRow) {
            out.push({ type: 'reasoning-end', id: reasoningId });
            reasoningId = null;
          }
        }
        break;

      // A source never splits text, so what is open stays open.
      case MESSAGE_TYPE.ATTACHMENTS:
        out.push(...sourceChunks(raw));
        break;

      // TODO(CU-17tkuw61kfy): the envelope `ATTACHMENTS` replaced.
      case MESSAGE_TYPE.GUIDE: {
        const payload = oldGuidePayload(raw);
        if (payload) out.push(...sourceChunks(payload));
        break;
      }

      case MESSAGE_TYPE.RECORD_CARDS: {
        closeOpen(out);
        const records = normalizeRecordUris(raw.records);
        // TODO(CU-17tkuw61kfy): the old `cards` of a row on a dev cluster.
        const all = records.length > 0 ? records : oldRecordCardsOf(raw);
        if (all.length > 0) out.push({ type: 'data-record-cards', data: { records: all } });
        break;
      }

      // An ask card is only one with something to pick; its intro sentence is ordinary answer text in front of it.
      case MESSAGE_TYPE.ASK: {
        const question = typeof raw.question === 'string' ? raw.question.trim() : '';
        const askOptions = askOptionsOf(raw.options);
        if (!question || askOptions.length === 0) break;
        if (typeof raw.text === 'string' && raw.text !== '') writeText(raw.text, out);
        closeOpen(out);
        out.push({ type: 'data-ask', data: { question, options: askOptions } });
        break;
      }

      case MESSAGE_TYPE.EXECUTING_TOOL: {
        closeOpen(out);
        // TODO(CU-17tkuw61kfy): a row with no run id.
        const toolCallId = nonEmpty(raw.toolExecutionRequestId) ?? oldRuns.open(raw);
        out.push(...grantsOfRun(raw, toolCallId), toolInput(raw, toolCallId));
        break;
      }

      case MESSAGE_TYPE.EXECUTED_TOOL: {
        closeOpen(out);
        // TODO(CU-17tkuw61kfy): a row with no run id.
        const toolCallId = nonEmpty(raw.toolExecutionRequestId) ?? oldRuns.close(raw);
        out.push(...grantsOfRun(raw, toolCallId));
        // A result can be all that reached this reader: its row still has to exist to take it.
        if (!seenTools.has(toolCallId)) out.push(toolInput(raw, toolCallId));
        if (raw.success === false) {
          out.push({ type: 'tool-output-error', toolCallId, dynamic: true, errorText: str(raw.result) ?? '' });
        } else {
          out.push({ type: 'tool-output-available', toolCallId, dynamic: true, output: raw.result ?? null });
        }
        break;
      }

      case MESSAGE_TYPE.APPROVAL_REQUEST:
        closeOpen(out);
        approvalChunks(raw, isRow, out);
        break;

      case MESSAGE_TYPE.APPROVAL_RESULT: {
        // TODO(CU-17tkuw61kfy): the old name.
        const approvalId = mingoApprovalRequestId(raw);
        if (!approvalId) break;
        const approved = raw.approved === true;
        if (pendingSingleApproval === approvalId) pendingSingleApproval = null;
        out.push({
          type: 'tool-approval-response',
          approvalId,
          approved,
          ...(resolvedByName !== undefined ? { toolMetadata: { resolvedByName } } : {}),
        });
        if (!approved) out.push({ type: 'tool-output-denied', toolCallId: approvalId });
        break;
      }

      case MESSAGE_TYPE.ESCALATION_OFFER: {
        const offerId = nonEmpty(raw.offerId);
        const status = escalationStatus(raw.state);
        if (!offerId || !status) break;
        closeOpen(out);
        const origin = str(raw.origin);
        out.push({
          type: 'data-escalation-offer',
          id: offerId,
          data:
            status === 'pending'
              ? { text: str(raw.text) ?? '', status, ...(origin !== undefined ? { origin } : {}) }
              : { status, ...(resolvedByName !== undefined ? { resolvedByName } : {}) },
        });
        break;
      }

      case MESSAGE_TYPE.TICKET_ESCALATED: {
        const ticketId = nonEmpty(raw.ticketId);
        const reason = nonEmpty(raw.reason);
        if (!ticketId || !reason) break;
        closeOpen(out);
        const ticketNumber = typeof raw.ticketNumber === 'number' ? raw.ticketNumber : undefined;
        const escalatedText = str(raw.text);
        out.push({
          type: 'data-ticket-escalated',
          id: ticketId,
          data: {
            ticketId,
            reason,
            ...(ticketNumber !== undefined ? { ticketNumber } : {}),
            ...(escalatedText !== undefined ? { text: escalatedText } : {}),
          },
        });
        break;
      }

      // `kind` is the one required field, and deliberately open: an unknown kind renders as a neutral line.
      case MESSAGE_TYPE.TICKET_EVENT: {
        const kind = typeof raw.kind === 'string' ? raw.kind.trim() : '';
        if (!kind) break;
        closeOpen(out);
        const reason = typeof raw.reason === 'string' && raw.reason.trim() ? raw.reason : undefined;
        const targetStatusKind =
          typeof raw.targetStatusKind === 'string' && raw.targetStatusKind.trim() ? raw.targetStatusKind : undefined;
        out.push({
          type: 'data-ticket-event',
          ...(seq !== undefined ? { id: String(seq) } : {}),
          data: {
            kind,
            ...(str(raw.actorId) !== undefined ? { actorId: raw.actorId as string } : {}),
            ...(str(raw.actorName) !== undefined ? { actorName: raw.actorName as string } : {}),
            ...(str(raw.actorType) !== undefined ? { actorType: raw.actorType as string } : {}),
            ...(reason !== undefined ? { reason } : {}),
            ...(targetStatusKind !== undefined ? { targetStatusKind } : {}),
            occurredAt: row?.createdAt ?? now(),
          },
        });
        break;
      }

      // Drawn inline: the turn goes on.
      case MESSAGE_TYPE.ERROR: {
        closeOpen(out);
        const details = errorDetails(raw.details);
        out.push({
          type: 'data-error',
          data: { title: nonEmpty(raw.error) ?? 'An error occurred', ...(details !== undefined ? { details } : {}) },
        });
        break;
      }

      case MESSAGE_TYPE.CONTEXT_COMPACTION_START:
        closeOpen(out);
        // By sequence where there is one: a hydrated row and a live chunk come from two decoders.
        compactionId = seq !== undefined ? `compaction-${seq}` : mintId('compaction-');
        out.push({ type: 'data-context-compaction', id: compactionId, data: { status: 'started' } });
        break;

      case MESSAGE_TYPE.CONTEXT_COMPACTION_END: {
        closeOpen(out);
        const summary = str(raw.summary) ?? str(raw.text);
        out.push({
          type: 'data-context-compaction',
          id: compactionId ?? mintId('compaction-'),
          data: { status: 'completed', ...(summary !== undefined ? { summary } : {}) },
        });
        compactionId = null;
        break;
      }

      case MESSAGE_TYPE.MESSAGE_REQUEST:
      case MESSAGE_TYPE.DIRECT_MESSAGE:
      case MESSAGE_TYPE.SYSTEM: {
        if (raw.type !== MESSAGE_TYPE.MESSAGE_REQUEST && typeof raw.text !== 'string') break;
        const kind =
          raw.type === MESSAGE_TYPE.MESSAGE_REQUEST
            ? ('message-request' as const)
            : raw.type === MESSAGE_TYPE.DIRECT_MESSAGE
              ? ('direct-message' as const)
              : ('system' as const);
        const contextItems = Array.isArray(raw.contextItems)
          ? raw.contextItems
              .filter(isRecord)
              .filter(item => typeof item.type === 'string' && typeof item.id === 'string')
              .map(item => ({ type: item.type as string, id: item.id as string, label: item.id as string }))
          : undefined;
        const ownerType = str(raw.ownerType);
        const displayName = str(raw.displayName);
        const userId = str(raw.userId);
        const said = str(raw.text) ?? '';
        out.push({
          type: 'data-chat-participant',
          transient: true,
          data: {
            kind,
            text: kind === 'system' ? said : mingoUserText(said),
            ...(ownerType !== undefined ? { ownerType } : {}),
            ...(displayName !== undefined ? { displayName } : {}),
            ...(userId !== undefined ? { userId } : {}),
            ...(contextItems ? { contextItems } : {}),
          },
        });
        break;
      }

      case MESSAGE_TYPE.TOKEN_USAGE:
        out.push({
          type: 'data-token-usage',
          transient: true,
          data: {
            inputTokensSize: numOr(raw.inputTokensSize),
            outputTokensSize: numOr(raw.outputTokensSize),
            totalTokensSize: numOr(raw.totalTokensSize),
            contextSize: numOr(raw.contextSize),
          },
        });
        break;

      case MESSAGE_TYPE.DIALOG_CLOSED:
        out.push({ type: 'data-dialog-closed', transient: true, data: {} });
        break;

      default:
        break;
    }
    return { ...(seq !== undefined ? { seq } : {}), chunks: out };
  }

  return {
    decode,
    endTurn() {
      oldRuns.endTurn();
    },
    discardHeld() {
      writer.discard();
      reasoningId = null;
    },
    closeHeld() {
      const chunks: UiChunk[] = [];
      closeOpen(chunks);
      return { chunks };
    },
  };
}

// =============================================================================
// A stored row of the hub
// =============================================================================

/** A row from before the move: it has `content`, `sources`, or a part in the old names. TODO(CU-17tkuw61kfy): the cut. */
function isOldStoredRow(row: Record<string, unknown>): boolean {
  if (typeof row.content === 'string' || Array.isArray(row.sources)) return true;
  return Array.isArray(row.parts) && row.parts.some(part => isRecord(part) && part.type === 'RECORD_CARDS');
}

/**
 * The message a row of `GET /api/docs/chat/history` draws, or null for a role the chat does not show. A user row the
 * chat never shows (the approval placeholder, the server's auto-continuation directive) is `hidden`.
 * TODO(CU-17tkuw61kfy): `fallbackId` names a row that has no id of its own (an old hub answers none).
 */
export function messageOfStoredRow(row: unknown, fallbackId?: string): ChatMessage | null {
  if (!isRecord(row)) return null;
  const { role } = row;
  if (role !== 'assistant' && role !== 'user') return null;

  const old = isOldStoredRow(row);
  const parts = old ? oldStoredRowToParts(row) : parseStoredParts(row.parts);
  const stored = parseMessageMetadata(row.metadata, 'stored-row');
  const text = textOfParts(parts);
  const hidden =
    role === 'user' &&
    !parts.some(part => part.type === 'file') &&
    (text === '' || text.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX));
  const metadata: ChatMessageMetadata = {
    ...(old ? oldStoredRowMetadata(row) : stored),
    ...(hidden ? { hidden: true } : {}),
  };
  // TODO(CU-17tkuw61kfy): an old row's sequence is a column of its own, and only an old row has no id.
  const seq = old ? row.seq : stored.seq;
  return {
    id: nonEmpty(row.id) ?? fallbackId ?? `hydrated-${String(seq ?? '')}`,
    role,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    parts,
  };
}

// =============================================================================
// `/api/docs/search`
// =============================================================================

/** A search row's identity and address, in the new names, else the old. TODO(CU-17tkuw61kfy): the old go at the cleanup. */
export function docSearchFieldsOf(row: Record<string, unknown>): {
  sourceId: string | null;
  title: string;
  url: string | null;
} {
  const old = oldDocSearchFields(row);
  return {
    sourceId: nonEmpty(row.sourceId) ?? old.sourceId,
    title: nonEmpty(row.title) ?? old.title,
    url: nonEmpty(row.url) ?? old.url,
  };
}
