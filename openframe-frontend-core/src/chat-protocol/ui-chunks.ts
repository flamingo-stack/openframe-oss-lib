/**
 * The chat stream: the AI SDK's UI message stream (`ai@7.0.159`), server-sent events with one JSON chunk per event,
 * ending `data: [DONE]`. The chunk union is the part of the standard's `UIMessageChunk` the hub and Mingo send, copied
 * here, never imported at runtime, and held to the real schema by `__tests__/ai-sdk-conformance.test.ts`.
 *
 * `data-*` is the standard's app slot, so there is one chunk union for every transport and no second event type. A
 * chunk marked `transient` never becomes a part of a message.
 *
 * Self-delimiting chunks are the whole reason for the move: no sentinel byte can be mis-framed by model text, and any
 * part can follow any other, so text goes out live on a turn that may still call a tool.
 *
 * Server-safe: no React, no browser APIs beyond TextEncoder/TextDecoder.
 */

import {
  parseCitations,
  type ChatApprovalDescriptor,
  type ChatAskPart,
  type ChatCitation,
  type ChatContextCompactionPart,
  type ChatErrorPart,
  type ChatEscalationOfferPart,
  type ChatFinishReason,
  type ChatMessageMetadata,
  type ChatRecordCardsPart,
  type ChatSuggestionsPart,
  type ChatTicketEscalatedPart,
  type ChatTicketEventPart,
  type ChatToolMetadata,
} from './chat-message';
import type { ChatProgressStage } from './progress';
import { CHAT_PROGRESS_STAGES } from './progress';
import { isRecord } from './wire-narrow';

// =============================================================================
// The chunk union
// =============================================================================

/** What a stage reports: `running` opens its row, `done` or `failed` closes it. Copy stays in `chatProgressLabel`. */
export interface ChatProgressChunk {
  type: 'data-chat-progress';
  /** `<turn>:<stage>`. */
  id: string;
  transient: true;
  data: { stage: ChatProgressStage; count?: number; state: 'running' | 'done' | 'failed' };
}

/** A message the stream carries that is not the assistant's (Mingo): the reducer gives it a `ChatMessage` of its own. */
export interface ChatParticipantChunk {
  type: 'data-chat-participant';
  id?: string;
  transient: true;
  data: {
    kind: 'message-request' | 'direct-message' | 'system';
    text: string;
    /** Open: clients branch on the admin value only. */
    ownerType?: string;
    displayName?: string;
    userId?: string;
    contextItems?: Array<{ type: string; id: string; label: string }>;
  };
}

/** The dialog's context use (Mingo): dialog-level, never on one message. */
export interface ChatTokenUsageChunk {
  type: 'data-token-usage';
  id?: string;
  transient: true;
  data: { inputTokensSize: number; outputTokensSize: number; totalTokensSize: number; contextSize: number };
}

export interface ChatDialogClosedChunk {
  type: 'data-dialog-closed';
  id?: string;
  transient: true;
  data: Record<string, never>;
}

export type UiTransientChunk = ChatProgressChunk | ChatParticipantChunk | ChatTokenUsageChunk | ChatDialogClosedChunk;

/** A data part as a chunk. `transient` on the wire is the standard's own field. */
type DataPartChunk<PART> = PART & { transient?: false };

export type UiDataPartChunk =
  | DataPartChunk<ChatRecordCardsPart>
  | DataPartChunk<ChatAskPart>
  | DataPartChunk<ChatEscalationOfferPart>
  | DataPartChunk<ChatTicketEscalatedPart>
  | DataPartChunk<ChatTicketEventPart>
  | DataPartChunk<ChatErrorPart>
  | DataPartChunk<ChatContextCompactionPart>
  | DataPartChunk<ChatSuggestionsPart>;

export type UiChunk =
  | { type: 'start'; messageId?: string; messageMetadata?: ChatMessageMetadata }
  | { type: 'message-metadata'; messageMetadata: ChatMessageMetadata }
  | { type: 'finish'; finishReason?: ChatFinishReason; messageMetadata?: ChatMessageMetadata }
  | { type: 'abort'; reason?: string }
  | { type: 'error'; errorText: string }
  | { type: 'text-start'; id: string }
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'text-end'; id: string; citations?: ChatCitation[] }
  | { type: 'reasoning-start'; id: string }
  | { type: 'reasoning-delta'; id: string; delta: string }
  | { type: 'reasoning-end'; id: string }
  | { type: 'source-url'; sourceId: string; url: string; title?: string }
  | { type: 'source-document'; sourceId: string; mediaType: string; title: string; filename?: string }
  | {
      type: 'tool-input-available';
      toolCallId: string;
      toolName: string;
      input: unknown;
      dynamic?: boolean;
      title?: string;
      toolMetadata?: ChatToolMetadata;
    }
  | {
      type: 'tool-input-error';
      toolCallId: string;
      toolName: string;
      input: unknown;
      dynamic?: boolean;
      errorText: string;
      title?: string;
      toolMetadata?: ChatToolMetadata;
    }
  | {
      type: 'tool-approval-request';
      approvalId: string;
      toolCallId: string;
      reason?: string;
      approvalDescriptor?: ChatApprovalDescriptor;
    }
  | {
      type: 'tool-approval-response';
      /** May name a batch on Mingo, whose result names the whole batch. */
      approvalId: string;
      approved: boolean;
      reason?: string;
      /** Lib-internal (Mingo): who resolved it. No standard reader sees NATS. */
      toolMetadata?: ChatToolMetadata;
    }
  | {
      type: 'tool-output-available';
      toolCallId: string;
      output: unknown;
      dynamic?: boolean;
      toolMetadata?: ChatToolMetadata;
    }
  | {
      type: 'tool-output-error';
      toolCallId: string;
      errorText: string;
      dynamic?: boolean;
      toolMetadata?: ChatToolMetadata;
    }
  | { type: 'tool-output-denied'; toolCallId: string }
  | UiDataPartChunk
  | UiTransientChunk;

/**
 * What a transport hands the reducer: the chunks one wire entry became, and that entry's sequence. One Mingo entry can
 * become several chunks, so the idempotency gate admits or drops them together.
 */
export interface ChatStreamEntry {
  seq?: number;
  chunks: UiChunk[];
}

// =============================================================================
// Headers + encoding
// =============================================================================

/** What a turn that ended with no completion signal says under its text (`finishReason: 'interrupted'`). */
export const CHAT_INTERRUPTED_NOTICE =
  'The answer was interrupted before it finished, so it may be incomplete. Please ask again.';

/**
 * The stream's response headers. `no-transform` goes beyond the standard's `no-cache`: a buffering intermediary breaks
 * a stream that streams, and every hub SSE response has always sent it.
 */
export const UI_MESSAGE_STREAM_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache, no-transform',
  connection: 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no',
} as const;

const DONE = '[DONE]';

const encoder = new TextEncoder();

/** One chunk as its event: `data: <json>\n\n`. */
export function encodeUiChunk(chunk: UiChunk): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

/** The event that ends every stream, on every path: `data: [DONE]\n\n`. */
export function encodeUiDone(): Uint8Array {
  return encoder.encode(`data: ${DONE}\n\n`);
}

// =============================================================================
// How a turn ended
// =============================================================================

const FINISH_REASON_OF_STOP: ReadonlyMap<string, ChatFinishReason> = new Map([
  ['end_turn', 'stop'],
  ['stop_sequence', 'stop'],
  ['tool_use', 'tool-calls'],
  ['max_tokens', 'length'],
  ['refusal', 'content-filter'],
  ['error', 'error'],
  ['incomplete', 'interrupted'],
  ['retrieval_only', 'other'],
]);

/** The stop reasons a turn ends on with `abort`, never `finish`. */
const ABORT_STOP_REASONS: ReadonlySet<string> = new Set(['aborted', 'timeout']);

/**
 * The standard's finish reason for a turn's stop reason (the exact one stays in `usage.stop_reason`), or null for one
 * that ends the turn with an `abort` chunk and no `finish`. A reason this build does not know is `other`.
 */
export function finishReasonOfStop(stopReason: string | null | undefined): ChatFinishReason | null {
  if (stopReason && ABORT_STOP_REASONS.has(stopReason)) return null;
  return FINISH_REASON_OF_STOP.get(stopReason ?? '') ?? 'other';
}

// =============================================================================
// Validation
// =============================================================================

const REQUIRED_STRINGS: ReadonlyMap<string, readonly string[]> = new Map([
  ['start', []],
  ['message-metadata', []],
  ['finish', []],
  ['abort', []],
  ['error', ['errorText']],
  ['text-start', ['id']],
  ['text-delta', ['id', 'delta']],
  ['text-end', ['id']],
  ['reasoning-start', ['id']],
  ['reasoning-delta', ['id', 'delta']],
  ['reasoning-end', ['id']],
  ['source-url', ['sourceId', 'url']],
  ['source-document', ['sourceId', 'mediaType', 'title']],
  ['tool-input-available', ['toolCallId', 'toolName']],
  ['tool-input-error', ['toolCallId', 'toolName', 'errorText']],
  ['tool-approval-request', ['approvalId', 'toolCallId']],
  ['tool-approval-response', ['approvalId']],
  ['tool-output-available', ['toolCallId']],
  ['tool-output-error', ['toolCallId', 'errorText']],
  ['tool-output-denied', ['toolCallId']],
]);

/** Is this a data chunk's payload this build can draw? The check is the whole of what its part needs. */
function isDataPayload(type: string, data: Record<string, unknown>): boolean {
  switch (type) {
    case 'data-record-cards':
      return Array.isArray(data.records) && data.records.every(uri => typeof uri === 'string');
    case 'data-ask':
      return typeof data.question === 'string' && Array.isArray(data.options);
    case 'data-escalation-offer':
      return typeof data.status === 'string';
    case 'data-ticket-escalated':
      return typeof data.ticketId === 'string' && typeof data.reason === 'string';
    case 'data-ticket-event':
      return typeof data.kind === 'string';
    case 'data-error':
      return typeof data.title === 'string';
    case 'data-context-compaction':
      return data.status === 'started' || data.status === 'completed';
    case 'data-suggestions':
      return Array.isArray(data.groups);
    case 'data-chat-progress':
      return (
        (CHAT_PROGRESS_STAGES as readonly unknown[]).includes(data.stage) &&
        (data.state === 'running' || data.state === 'done' || data.state === 'failed')
      );
    case 'data-chat-participant':
      return typeof data.kind === 'string' && typeof data.text === 'string';
    case 'data-token-usage':
    case 'data-dialog-closed':
      return true;
    default:
      return false;
  }
}

/**
 * One chunk off the wire, or null for what this build cannot read: an unknown type, a missing required field. A backend
 * that adds a chunk type must not break the stream, so what cannot be read is dropped rather than thrown.
 */
export function parseUiChunk(value: unknown): UiChunk | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  const { type } = value;
  if (type.startsWith('data-')) {
    return isRecord(value.data) && isDataPayload(type, value.data) ? (value as unknown as UiChunk) : null;
  }
  const required = REQUIRED_STRINGS.get(type);
  if (!required || required.some(key => typeof value[key] !== 'string')) return null;
  if (type === 'message-metadata' && !isRecord(value.messageMetadata)) return null;
  if (type === 'tool-approval-response' && typeof value.approved !== 'boolean') return null;
  // An optional object that is not one is as good as absent; its readers spread it.
  const chunk: Record<string, unknown> = { ...value };
  for (const key of ['messageMetadata', 'toolMetadata', 'approvalDescriptor']) {
    if (chunk[key] !== undefined && !isRecord(chunk[key])) delete chunk[key];
  }
  if (type === 'text-end' && chunk.citations !== undefined) {
    const citations = parseCitations(chunk.citations);
    if (citations.length > 0) chunk.citations = citations;
    else delete chunk.citations;
  }
  return chunk as unknown as UiChunk;
}

// =============================================================================
// Reading
// =============================================================================

/** Reads a stream's bytes into its chunks. */
export interface UiChunkDecoder {
  /** Feed raw response bytes; returns the chunks they completed. */
  push(bytes: Uint8Array): UiChunk[];
  /**
   * The stream ended. A stream that ends with no `finish`, `abort` or `[DONE]` (a cut connection, the gateway) closes
   * what is open and ends the turn as `finish` with `interrupted`, so the partial text stays. An `error` already ended
   * its turn and says so itself. Idempotent.
   */
  end(): UiChunk[];
}

export function createUiChunkDecoder(): UiChunkDecoder {
  const textDecoder = new TextDecoder();
  const openText = new Set<string>();
  const openReasoning = new Set<string>();
  let buffer = '';
  let eventData: string[] = [];
  let terminated = false;
  let done = false;
  let ended = false;

  function readEvent(out: UiChunk[]): void {
    if (eventData.length === 0) return;
    const data = eventData.join('\n');
    eventData = [];
    if (done) return;
    if (data === DONE) {
      terminated = true;
      done = true;
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(data);
    } catch {
      return;
    }
    const chunk = parseUiChunk(value);
    if (!chunk) return;
    if (chunk.type === 'finish' || chunk.type === 'abort' || chunk.type === 'error') terminated = true;
    else if (chunk.type === 'text-start') openText.add(chunk.id);
    else if (chunk.type === 'text-end') openText.delete(chunk.id);
    else if (chunk.type === 'reasoning-start') openReasoning.add(chunk.id);
    else if (chunk.type === 'reasoning-end') openReasoning.delete(chunk.id);
    out.push(chunk);
  }

  function readLine(line: string, out: UiChunk[]): void {
    if (line === '') {
      readEvent(out);
      return;
    }
    // A comment (`: keep-alive`) or a field this reader has no use for (`event:`, `id:`, `retry:`).
    if (!line.startsWith('data:')) return;
    eventData.push(line.slice(line[5] === ' ' ? 6 : 5));
  }

  return {
    push(bytes) {
      const out: UiChunk[] = [];
      buffer += textDecoder.decode(bytes, { stream: true });
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        if (char !== '\n' && char !== '\r') continue;
        // A `\r` at the end of what arrived may be the first half of a `\r\n`: wait for the next byte.
        if (char === '\r' && i === buffer.length - 1) break;
        readLine(buffer.slice(start, i), out);
        if (char === '\r' && buffer[i + 1] === '\n') i++;
        start = i + 1;
      }
      buffer = buffer.slice(start);
      return out;
    },
    end() {
      if (ended) return [];
      ended = true;
      if (terminated) return [];
      terminated = true;
      const out: UiChunk[] = [];
      for (const id of openText) out.push({ type: 'text-end', id });
      for (const id of openReasoning) out.push({ type: 'reasoning-end', id });
      out.push({ type: 'finish', finishReason: 'interrupted' });
      return out;
    },
  };
}

function isAbort(error: unknown): boolean {
  return isRecord(error) && error.name === 'AbortError';
}

/**
 * Drains a body through a decoder, the bytes already read off it first. A read that fails is a cut connection and ends
 * like one; the caller's own abort is rethrown. Leaving early cancels the body.
 */
export async function* drainChunks(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: { push(bytes: Uint8Array): UiChunk[]; end(): UiChunk[] },
  head: readonly Uint8Array[] = [],
): AsyncGenerator<UiChunk, void, undefined> {
  let finished = false;
  try {
    for (const bytes of head) yield* decoder.push(bytes);
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield* decoder.push(value);
      }
    } catch (error) {
      if (isAbort(error)) throw error;
    }
    finished = true;
    yield* decoder.end();
  } finally {
    if (!finished) void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** A UI message stream's chunks, in order. */
export function readUiChunks(body: ReadableStream<Uint8Array>): AsyncGenerator<UiChunk, void, undefined> {
  return drainChunks(body.getReader(), createUiChunkDecoder());
}
