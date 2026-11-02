/**
 * The ONE accumulator: a stream's chunks into a message's parts. The hub's writer stores what it builds and the lib's
 * reducer draws what it builds, so a stored row and the live message read the same.
 *
 * The rules (`./chat-message` states what they protect):
 *   - `text-start` continues the last part when it is text, and `text-end` rebases its citations by the offset that
 *     wire id started at. On the wire a block with citations closes its id, because `text-end` is the only standard
 *     chunk that carries them; in the parts the text stays one part.
 *   - A source chunk inserts at the head of the body, unique by `sourceId`. A reasoning chunk goes before the first
 *     text part. Neither ever splits text.
 *   - A `data-*` chunk with an existing `id` replaces (its fields over the part's: a resolution names no text). A
 *     transient one goes to the handler.
 *   - A `tool-*` chunk whose call the parts do not hold is ignored, and a tool part never moves back from a later state
 *     to an earlier one (a redelivered chunk is a no-op).
 *
 * Above it, {@link applyChunkToMessages} is the ONE list rule: a resolution finds its part across messages, newest
 * first, and everything else goes to the message being built.
 *
 * Copy-on-write: `parts`, `messages` and each part are never mutated, and a chunk that changes nothing returns the same
 * reference, so memoization over an untouched message survives redelivery. What a stream remembers between chunks is on
 * the {@link WireState}, which is mutated: call these once per chunk, outside a React state updater.
 *
 * Server-safe: no React, no browser APIs.
 */

import {
  approvalBatchIdOf,
  isSourcePart,
  isToolPart,
  rebaseCitation,
  sourcePartOfCitationSource,
  type ChatCitation,
  type ChatMessage,
  type ChatMessageMetadata,
  type ChatPart,
  type ChatProgressRow,
  type ChatSourcePart,
  type ChatTextPart,
  type ChatTicketEventPart,
  type ChatToolApproval,
  type ChatToolApprovalResponse,
  type ChatToolMetadata,
  type ChatToolPart,
} from './chat-message';
import type { ChatProgressChunk, UiChunk, UiDataPartChunk, UiTransientChunk } from './ui-chunks';
import { isRecord } from './wire-narrow';

// =============================================================================
// Wire state
// =============================================================================

/** What one stream remembers between chunks. */
export interface WireState {
  /** Where each wire text id started, in the text part it continues. */
  textOffsets: Map<string, number>;
  /** The message being built. Null between turns: then a chunk goes to the trailing assistant message, else a new one. */
  messageId: string | null;
  /** Names the message being built: a card's, before it resolves the card, so the answer continues there. */
  setMessageId: (id: string | null) => void;
  /** Told every transient chunk. */
  onTransient?: (chunk: UiTransientChunk) => void;
  /** The id of a message a chunk had to create. */
  newMessageId: () => string;
}

function defaultMessageId(): string {
  return `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createWireState(options: Partial<Pick<WireState, 'onTransient' | 'newMessageId'>> = {}): WireState {
  const wire: WireState = {
    textOffsets: new Map(),
    messageId: null,
    setMessageId(id) {
      wire.messageId = id;
    },
    onTransient: options.onTransient,
    newMessageId: options.newMessageId ?? defaultMessageId,
  };
  return wire;
}

// =============================================================================
// Small copy-on-write helpers
// =============================================================================

function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  const next = list.slice();
  next[index] = item;
  return next;
}

function insertAt<T>(list: readonly T[], index: number, item: T): T[] {
  return [...list.slice(0, index), item, ...list.slice(index)];
}

/** JSON-shape equality: a part is JSON, so a redelivery that writes the same values is a no-op. */
function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}

/** Objects merge field by field (the SDK's rule for message metadata); anything else replaces. */
function mergeDeep(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    const current = merged[key];
    merged[key] = isPlainObject(current) && isPlainObject(value) ? mergeDeep(current, value) : value;
  }
  return merged;
}

function lastTextIndex(parts: readonly ChatPart[]): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].type === 'text') return i;
  }
  return -1;
}

/** Marks what is still streaming as done: the stream that fed it is over. */
function closeStreaming(parts: ChatPart[]): ChatPart[] {
  let next = parts;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if ((part.type === 'text' || part.type === 'reasoning') && part.state === 'streaming') {
      if (next === parts) next = parts.slice();
      next[i] = { ...part, state: 'done' };
    }
  }
  return next;
}

// =============================================================================
// Text
// =============================================================================

function insertSource(parts: ChatPart[], source: ChatSourcePart): ChatPart[] {
  if (parts.some(part => isSourcePart(part) && part.sourceId === source.sourceId)) return parts;
  const firstBody = parts.findIndex(part => !isSourcePart(part));
  return insertAt(parts, firstBody === -1 ? parts.length : firstBody, source);
}

/** Citations on a wire part, as offsets into the stored part. One past the part's end is dropped: its range is a lie. */
function rebasedCitations(citations: readonly ChatCitation[], offset: number, length: number): ChatCitation[] {
  return citations
    .map(citation => rebaseCitation(citation, offset))
    .filter(citation => (citation.startIndex ?? 0) <= length && (citation.endIndex ?? 0) <= length);
}

function applyTextDelta(parts: ChatPart[], id: string, delta: string, wire: WireState): ChatPart[] {
  if (delta === '') return parts;
  const last = parts[parts.length - 1];
  if (last?.type === 'text') {
    if (!wire.textOffsets.has(id)) wire.textOffsets.set(id, last.text.length);
    return replaceAt<ChatPart>(parts, parts.length - 1, { ...last, text: last.text + delta, state: 'streaming' });
  }
  wire.textOffsets.set(id, 0);
  return [...parts, { type: 'text', text: delta, state: 'streaming' }];
}

function applyTextEnd(
  parts: ChatPart[],
  id: string,
  citations: readonly ChatCitation[] | undefined,
  wire: WireState,
): ChatPart[] {
  const offset = wire.textOffsets.get(id);
  // No delta ever arrived on this id: no text of its own, so nothing its citations could point at.
  if (offset === undefined) return parts;
  wire.textOffsets.delete(id);
  const index = lastTextIndex(parts);
  if (index === -1) return parts;
  const part = parts[index] as ChatTextPart;
  const added = citations ? rebasedCitations(citations, offset, part.text.length) : [];
  const merged = [...(part.citations ?? []), ...added];
  let next = replaceAt<ChatPart>(parts, index, {
    ...part,
    state: 'done',
    ...(merged.length > 0 ? { citations: merged } : {}),
  });
  // Every citation's source is a source part of the same message, whoever wrote the stream.
  for (const citation of added) next = insertSource(next, sourcePartOfCitationSource(citation.source));
  return next;
}

// =============================================================================
// Reasoning
// =============================================================================

function applyReasoningDelta(parts: ChatPart[], delta: string): ChatPart[] {
  if (delta === '') return parts;
  const open = parts.findIndex(part => part.type === 'reasoning' && part.state === 'streaming');
  const firstText = parts.findIndex(part => part.type === 'text');
  const at = firstText === -1 ? parts.length : firstText;
  const continued = open !== -1 ? open : parts[at - 1]?.type === 'reasoning' ? at - 1 : -1;
  if (continued !== -1) {
    const part = parts[continued];
    if (part.type !== 'reasoning') return parts;
    return replaceAt<ChatPart>(parts, continued, { ...part, text: part.text + delta, state: 'streaming' });
  }
  return insertAt<ChatPart>(parts, at, { type: 'reasoning', text: delta, state: 'streaming' });
}

function applyReasoningEnd(parts: ChatPart[]): ChatPart[] {
  const open = parts.findIndex(part => part.type === 'reasoning' && part.state === 'streaming');
  if (open === -1) return parts;
  const part = parts[open];
  return part.type === 'reasoning' ? replaceAt<ChatPart>(parts, open, { ...part, state: 'done' }) : parts;
}

// =============================================================================
// Data
// =============================================================================

type DataChunkOf<TYPE extends UiDataPartChunk['type']> = Extract<UiDataPartChunk, { type: TYPE }>;

function partOfDataChunk(chunk: UiDataPartChunk): ChatPart {
  const { transient: _transient, ...part } = chunk;
  return part;
}

/** A stored ticket event carries no sequence when its row did not, so a replayed copy meets it by what it says. */
function ticketEventPayloadOf(part: { data: object }): string {
  const { occurredAt: _occurredAt, ...rest } = part.data as ChatTicketEventPart['data'];
  return JSON.stringify(rest);
}

/**
 * The twin of a ticket event in the parts: only the LAST one is considered, because an older one may be a genuinely
 * repeated resolve and reopen, and two known and different sequences are proven distinct.
 */
function ticketEventTwinIndex(parts: readonly ChatPart[], chunk: DataChunkOf<'data-ticket-event'>): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.type !== 'data-ticket-event') continue;
    const distinct = part.id !== undefined && chunk.id !== undefined;
    return !distinct && ticketEventPayloadOf(part) === ticketEventPayloadOf(chunk) ? i : -1;
  }
  return -1;
}

function replaceData(parts: ChatPart[], index: number, chunk: UiDataPartChunk): ChatPart[] {
  const existing = parts[index];
  if (!('data' in existing)) return parts;
  const data: Record<string, unknown> = { ...existing.data, ...chunk.data };
  // The first-known time wins: a hydrated twin carries the row's own time, a redelivery only its late arrival.
  const occurredAt = (existing.data as { occurredAt?: string }).occurredAt;
  if (occurredAt !== undefined) data.occurredAt = occurredAt;
  const id = existing.id ?? chunk.id;
  const next = { type: existing.type, ...(id !== undefined ? { id } : {}), data } as ChatPart;
  return sameValue(existing, next) ? parts : replaceAt(parts, index, next);
}

/** The compaction still open in these parts: the one a completion belongs to. Earlier ones completed in place. */
function openCompactionIndex(parts: readonly ChatPart[]): number {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.type === 'data-context-compaction' && part.data.status === 'started') return i;
  }
  return -1;
}

function applyData(parts: ChatPart[], chunk: UiDataPartChunk): ChatPart[] {
  if (chunk.type === 'data-record-cards' && chunk.data.records.length === 0) return parts;
  // A completion finds the row its start drew, whoever decoded that start: a hydrated one has another id.
  if (chunk.type === 'data-context-compaction' && chunk.data.status === 'completed') {
    const open = openCompactionIndex(parts);
    if (open !== -1) return replaceData(parts, open, chunk);
  }
  const index =
    chunk.id !== undefined
      ? parts.findIndex(part => part.type === chunk.type && 'id' in part && part.id === chunk.id)
      : -1;
  if (index !== -1) return replaceData(parts, index, chunk);
  if (chunk.type === 'data-ticket-event') {
    const twin = ticketEventTwinIndex(parts, chunk);
    if (twin !== -1) return replaceData(parts, twin, chunk);
  }
  // A resolution names no text: with no offer here to flip, there is nothing to draw.
  if (chunk.type === 'data-escalation-offer' && chunk.data.text === undefined) return parts;
  return [...parts, partOfDataChunk(chunk)];
}

// =============================================================================
// Tools
// =============================================================================

/**
 * Does this chunk's id name this part: by its call, its approval, or the batch it is in? A row of a batch that needs no
 * approval of its own carries the batch on its metadata, so a denied batch takes that row with it: it will never run.
 */
function toolPartMatches(part: ChatToolPart, id: string): boolean {
  if (part.toolCallId === id) return true;
  const approval = 'approval' in part ? part.approval : undefined;
  return approval?.id === id || approvalBatchIdOf(part) === id;
}

function isFinal(part: ChatToolPart): boolean {
  return part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied';
}

function mergeMetadata(
  existing: ChatToolMetadata | undefined,
  over: ChatToolMetadata | undefined,
): ChatToolMetadata | undefined {
  return over ? { ...existing, ...over } : existing;
}

/** Applies `update` to every tool part the id names. */
function updateToolParts(parts: ChatPart[], id: string, update: (part: ChatToolPart) => ChatToolPart): ChatPart[] {
  let next = parts;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!isToolPart(part) || !toolPartMatches(part, id)) continue;
    const updated = update(part);
    if (sameValue(part, updated)) continue;
    if (next === parts) next = parts.slice();
    next[i] = updated;
  }
  return next;
}

function holdsToolPart(parts: readonly ChatPart[], id: string): boolean {
  return parts.some(part => isToolPart(part) && toolPartMatches(part, id));
}

function baseOf(part: ChatToolPart) {
  return {
    type: part.type,
    toolName: part.toolName,
    toolCallId: part.toolCallId,
    ...(part.title !== undefined ? { title: part.title } : {}),
    ...(part.toolMetadata !== undefined ? { toolMetadata: part.toolMetadata } : {}),
  };
}

function approvalOf(part: ChatToolPart): ChatToolApproval | undefined {
  return 'approval' in part ? part.approval : undefined;
}

function withoutAnswer(approval: ChatToolApproval): Omit<ChatToolApproval, 'approved' | 'reason'> {
  const { approved: _approved, reason: _reason, ...rest } = approval;
  return rest;
}

/** A tool only runs after its gate was granted, so an output grants the approval it shows. */
function grantedApprovalOf(part: ChatToolPart): { approval?: ChatToolApprovalResponse<true> } {
  const approval = approvalOf(part);
  return approval ? { approval: { ...withoutAnswer(approval), approved: true } } : {};
}

/** The part denied: what it was asked, and the answer it holds. */
function deniedPartOf(part: ChatToolPart): ChatToolPart {
  const approval = approvalOf(part);
  return {
    ...baseOf(part),
    state: 'output-denied',
    input: part.input,
    approval: {
      ...withoutAnswer(approval ?? { id: part.toolCallId }),
      approved: false,
      ...(approval?.reason !== undefined ? { reason: approval.reason } : {}),
    },
  };
}

/**
 * A rejection stands whatever the server then says about it: a refusal (expired, already used) or a request that failed
 * ran nothing either. `output-error` only holds a granted approval, in the SDK's types too, so it ends denied.
 */
function isRejected(part: ChatToolPart): boolean {
  return approvalOf(part)?.approved === false;
}

function applyToolInput(parts: ChatPart[], chunk: Extract<UiChunk, { type: 'tool-input-available' }>): ChatPart[] {
  const index = parts.findIndex(part => isToolPart(part) && part.toolCallId === chunk.toolCallId);
  const title = chunk.title !== undefined ? { title: chunk.title } : {};
  if (index === -1) {
    return [
      ...parts,
      {
        type: 'dynamic-tool',
        toolName: chunk.toolName,
        toolCallId: chunk.toolCallId,
        ...title,
        ...(chunk.toolMetadata !== undefined ? { toolMetadata: chunk.toolMetadata } : {}),
        state: 'input-available',
        input: chunk.input,
      },
    ];
  }
  const part = parts[index] as ChatToolPart;
  if (isFinal(part)) return parts;
  // A tool's run chunk may state no arguments: the card's stay.
  const keepsInput = isRecord(chunk.input) && Object.keys(chunk.input).length === 0;
  const toolMetadata = mergeMetadata(part.toolMetadata, chunk.toolMetadata);
  const next = {
    ...part,
    ...title,
    ...(toolMetadata !== undefined ? { toolMetadata } : {}),
    ...(keepsInput ? {} : { input: chunk.input }),
  } as ChatToolPart;
  return sameValue(part, next) ? parts : replaceAt<ChatPart>(parts, index, next);
}

function applyToolInputError(parts: ChatPart[], chunk: Extract<UiChunk, { type: 'tool-input-error' }>): ChatPart[] {
  const index = parts.findIndex(part => isToolPart(part) && part.toolCallId === chunk.toolCallId);
  const title = chunk.title !== undefined ? { title: chunk.title } : {};
  if (index === -1) {
    return [
      ...parts,
      {
        type: 'dynamic-tool',
        toolName: chunk.toolName,
        toolCallId: chunk.toolCallId,
        ...title,
        ...(chunk.toolMetadata !== undefined ? { toolMetadata: chunk.toolMetadata } : {}),
        state: 'output-error',
        input: chunk.input,
        errorText: chunk.errorText,
      },
    ];
  }
  const part = parts[index] as ChatToolPart;
  const toolMetadata = mergeMetadata(part.toolMetadata, chunk.toolMetadata);
  const next: ChatToolPart = isRejected(part)
    ? deniedPartOf(part)
    : {
        ...baseOf(part),
        ...title,
        ...(toolMetadata !== undefined ? { toolMetadata } : {}),
        state: 'output-error',
        input: chunk.input,
        errorText: chunk.errorText,
        ...grantedApprovalOf(part),
      };
  return sameValue(part, next) ? parts : replaceAt<ChatPart>(parts, index, next);
}

function applyApprovalRequest(
  parts: ChatPart[],
  chunk: Extract<UiChunk, { type: 'tool-approval-request' }>,
): ChatPart[] {
  const index = parts.findIndex(part => isToolPart(part) && part.toolCallId === chunk.toolCallId);
  if (index === -1) return parts;
  const part = parts[index] as ChatToolPart;
  if (isFinal(part) || part.state === 'approval-responded') return parts;
  const next: ChatToolPart = {
    ...baseOf(part),
    state: 'approval-requested',
    input: part.input,
    approval: {
      id: chunk.approvalId,
      ...(chunk.reason !== undefined ? { requestReason: chunk.reason } : {}),
      ...(chunk.approvalDescriptor !== undefined ? { descriptor: chunk.approvalDescriptor } : {}),
    },
  };
  return sameValue(part, next) ? parts : replaceAt<ChatPart>(parts, index, next);
}

function applyApprovalResponse(
  parts: ChatPart[],
  chunk: Extract<UiChunk, { type: 'tool-approval-response' }>,
): ChatPart[] {
  return updateToolParts(parts, chunk.approvalId, part => {
    if (part.state !== 'approval-requested' && part.state !== 'approval-responded') return part;
    const toolMetadata = mergeMetadata(part.toolMetadata, chunk.toolMetadata);
    return {
      ...baseOf(part),
      ...(toolMetadata !== undefined ? { toolMetadata } : {}),
      state: 'approval-responded',
      input: part.input,
      approval: {
        ...withoutAnswer(part.approval),
        approved: chunk.approved,
        ...(chunk.reason !== undefined ? { reason: chunk.reason } : {}),
      },
    };
  });
}

function applyOutputDenied(parts: ChatPart[], id: string): ChatPart[] {
  return updateToolParts(parts, id, part =>
    part.state === 'output-available' || part.state === 'output-error' ? part : deniedPartOf(part),
  );
}

function applyOutput(parts: ChatPart[], chunk: Extract<UiChunk, { type: 'tool-output-available' }>): ChatPart[] {
  return updateToolParts(parts, chunk.toolCallId, part => {
    if (part.state === 'output-denied') return part;
    const toolMetadata = mergeMetadata(part.toolMetadata, chunk.toolMetadata);
    return {
      ...baseOf(part),
      ...(toolMetadata !== undefined ? { toolMetadata } : {}),
      state: 'output-available',
      input: part.input,
      output: chunk.output,
      ...grantedApprovalOf(part),
    };
  });
}

function applyOutputError(parts: ChatPart[], chunk: Extract<UiChunk, { type: 'tool-output-error' }>): ChatPart[] {
  return updateToolParts(parts, chunk.toolCallId, part => {
    if (part.state === 'output-denied') return part;
    if (isRejected(part)) return deniedPartOf(part);
    const toolMetadata = mergeMetadata(part.toolMetadata, chunk.toolMetadata);
    return {
      ...baseOf(part),
      ...(toolMetadata !== undefined ? { toolMetadata } : {}),
      state: 'output-error',
      input: part.input,
      errorText: chunk.errorText,
      ...grantedApprovalOf(part),
    };
  });
}

// =============================================================================
// applyChunk
// =============================================================================

/** One chunk into one message's parts. */
export function applyChunk(parts: ChatPart[], chunk: UiChunk, wire: WireState): ChatPart[] {
  switch (chunk.type) {
    case 'text-start':
      wire.textOffsets.delete(chunk.id);
      return parts;
    case 'text-delta':
      return applyTextDelta(parts, chunk.id, chunk.delta, wire);
    case 'text-end':
      return applyTextEnd(parts, chunk.id, chunk.citations, wire);
    case 'reasoning-start':
      return parts;
    case 'reasoning-delta':
      return applyReasoningDelta(parts, chunk.delta);
    case 'reasoning-end':
      return applyReasoningEnd(parts);
    case 'source-url':
      return insertSource(parts, {
        type: 'source-url',
        sourceId: chunk.sourceId,
        url: chunk.url,
        ...(chunk.title !== undefined ? { title: chunk.title } : {}),
      });
    case 'source-document':
      return insertSource(parts, {
        type: 'source-document',
        sourceId: chunk.sourceId,
        mediaType: chunk.mediaType,
        title: chunk.title,
        ...(chunk.filename !== undefined ? { filename: chunk.filename } : {}),
      });
    case 'tool-input-available':
      return applyToolInput(parts, chunk);
    case 'tool-input-error':
      return applyToolInputError(parts, chunk);
    case 'tool-approval-request':
      return applyApprovalRequest(parts, chunk);
    case 'tool-approval-response':
      return applyApprovalResponse(parts, chunk);
    case 'tool-output-available':
      return applyOutput(parts, chunk);
    case 'tool-output-error':
      return applyOutputError(parts, chunk);
    case 'tool-output-denied':
      return applyOutputDenied(parts, chunk.toolCallId);
    case 'finish':
    case 'abort':
      wire.textOffsets.clear();
      return closeStreaming(parts);
    case 'error':
      wire.textOffsets.clear();
      return [...closeStreaming(parts), { type: 'data-error', data: { title: chunk.errorText } }];
    case 'start':
    case 'message-metadata':
      return parts;
    default:
      if (chunk.transient) {
        wire.onTransient?.(chunk);
        return parts;
      }
      return applyData(parts, chunk);
  }
}

// =============================================================================
// applyChunkToMessages
// =============================================================================

/** The message that holds a part this chunk names, newest first. */
function messageHolding(messages: readonly ChatMessage[], holds: (parts: readonly ChatPart[]) => boolean): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (holds(messages[i].parts)) return i;
  }
  return -1;
}

/**
 * The chunks that can name a part of an earlier message (what resolves a card, a tool that runs after one, an offer's
 * answer): the index of the message that holds what this chunk names, newest first, or -1.
 */
export function messageHoldingChunk(messages: readonly ChatMessage[], chunk: UiChunk): number {
  switch (chunk.type) {
    case 'tool-approval-response':
      return messageHolding(messages, parts => holdsToolPart(parts, chunk.approvalId));
    case 'tool-input-available':
    case 'tool-input-error':
    case 'tool-output-available':
    case 'tool-output-error':
    case 'tool-output-denied':
      return messageHolding(messages, parts => holdsToolPart(parts, chunk.toolCallId));
    case 'data-escalation-offer':
    case 'data-ticket-event': {
      const { id } = chunk;
      if (id === undefined) return -1;
      return messageHolding(messages, parts =>
        parts.some(part => part.type === chunk.type && 'id' in part && part.id === id),
      );
    }
    default:
      return -1;
  }
}

/** Index of the message being built, or -1. */
function currentMessageIndex(messages: readonly ChatMessage[], wire: WireState): number {
  if (wire.messageId !== null) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].id === wire.messageId) return i;
    }
  }
  const last = messages[messages.length - 1];
  return last?.role === 'assistant' ? messages.length - 1 : -1;
}

function withParts(message: ChatMessage, parts: ChatPart[]): ChatMessage {
  return parts === message.parts ? message : { ...message, parts };
}

function withMetadata(message: ChatMessage, over: ChatMessageMetadata | undefined): ChatMessage {
  if (!over || Object.keys(over).length === 0) return message;
  const metadata = mergeDeep((message.metadata ?? {}) as Record<string, unknown>, over as Record<string, unknown>);
  return sameValue(message.metadata, metadata) ? message : { ...message, metadata: metadata };
}

function withProgress(message: ChatMessage, chunk: ChatProgressChunk): ChatMessage {
  const row: ChatProgressRow = { id: chunk.id, ...chunk.data };
  const rows = message.metadata?.progress ?? [];
  const index = rows.findIndex(existing => existing.id === chunk.id);
  if (index !== -1 && sameValue(rows[index], row)) return message;
  const progress = index === -1 ? [...rows, row] : replaceAt(rows, index, row);
  return { ...message, metadata: { ...message.metadata, progress } };
}

/**
 * A stage still running when its turn ends will never say how it went: it finished on a turn that finished, and failed
 * on one that did not. Nothing else would stop its loader.
 */
function withSettledProgress(message: ChatMessage, state: 'done' | 'failed'): ChatMessage {
  const rows = message.metadata?.progress;
  if (!rows?.some(row => row.state === 'running')) return message;
  const progress = rows.map(row => (row.state === 'running' ? { ...row, state } : row));
  return { ...message, metadata: { ...message.metadata, progress } };
}

/** How the stages a turn left running ended, from how it ended. */
function stageStateOfEnd(chunk: Extract<UiChunk, { type: 'finish' | 'abort' }>): 'done' | 'failed' {
  if (chunk.type === 'abort') return 'failed';
  return chunk.finishReason === 'interrupted' || chunk.finishReason === 'error' ? 'failed' : 'done';
}

/** Applies `update` to the message being built. A chunk that only describes a message makes none. */
function updateCurrent(
  messages: ChatMessage[],
  wire: WireState,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  const index = currentMessageIndex(messages, wire);
  if (index === -1) return messages;
  const message = messages[index];
  const updated = update(message);
  return updated === message ? messages : replaceAt(messages, index, updated);
}

/** One chunk into the message being built, creating it when the chunk gave it something to hold. */
function applyToCurrent(messages: ChatMessage[], chunk: UiChunk, wire: WireState): ChatMessage[] {
  const index = currentMessageIndex(messages, wire);
  if (index !== -1) {
    return updateCurrent(messages, wire, message => withParts(message, applyChunk(message.parts, chunk, wire)));
  }
  const parts = applyChunk([], chunk, wire);
  if (parts.length === 0) return messages;
  const id = wire.newMessageId();
  wire.setMessageId(id);
  return [...messages, { id, role: 'assistant', parts }];
}

function applyStart(
  messages: ChatMessage[],
  chunk: Extract<UiChunk, { type: 'start' }>,
  wire: WireState,
): ChatMessage[] {
  const { messageId, messageMetadata } = chunk;
  if (messageId === undefined) {
    // No id: the answer continues the message being built (the card's, on an approval), like a standard reader.
    const index = currentMessageIndex(messages, wire);
    if (index !== -1) {
      wire.setMessageId(messages[index].id);
      return updateCurrent(messages, wire, message => withMetadata(message, messageMetadata));
    }
    const id = wire.newMessageId();
    wire.setMessageId(id);
    return [...messages, withMetadata({ id, role: 'assistant', parts: [] }, messageMetadata)];
  }
  const known = messages.findIndex(message => message.id === messageId);
  if (known !== -1) {
    wire.setMessageId(messageId);
    return updateCurrent(messages, wire, message => withMetadata(message, messageMetadata));
  }
  // The server names the message the client is already holding a placeholder for.
  const current = wire.messageId === null ? -1 : messages.findIndex(message => message.id === wire.messageId);
  wire.setMessageId(messageId);
  if (current !== -1 && messages[current].parts.length === 0) {
    return replaceAt(messages, current, withMetadata({ ...messages[current], id: messageId }, messageMetadata));
  }
  return [...messages, withMetadata({ id: messageId, role: 'assistant', parts: [] }, messageMetadata)];
}

/**
 * One chunk into a message list: the ONE list rule. A chunk that resolves a tool part or an offer finds its part across
 * messages, newest first, by `toolCallId`, `approval.id` or `approval.descriptor.batchId`, because a card lives in an
 * earlier message than the answer it unlocks. Every other chunk goes to the message being built.
 */
export function applyChunkToMessages(messages: ChatMessage[], chunk: UiChunk, wire: WireState): ChatMessage[] {
  switch (chunk.type) {
    case 'start':
      return applyStart(messages, chunk, wire);
    case 'message-metadata':
      return updateCurrent(messages, wire, message => withMetadata(message, chunk.messageMetadata));
    case 'finish':
    case 'abort': {
      const over: ChatMessageMetadata =
        chunk.type === 'abort'
          ? { aborted: true }
          : {
              ...chunk.messageMetadata,
              ...(chunk.finishReason !== undefined ? { finishReason: chunk.finishReason } : {}),
            };
      const ended = updateCurrent(messages, wire, message =>
        withSettledProgress(
          withParts(withMetadata(message, over), applyChunk(message.parts, chunk, wire)),
          stageStateOfEnd(chunk),
        ),
      );
      wire.setMessageId(null);
      return ended;
    }
    case 'error': {
      const failed = updateCurrent(applyToCurrent(messages, chunk, wire), wire, message =>
        withSettledProgress(message, 'failed'),
      );
      wire.setMessageId(null);
      return failed;
    }
    case 'data-chat-progress':
      wire.onTransient?.(chunk);
      return updateCurrent(messages, wire, message => withProgress(message, chunk));
    case 'data-chat-participant':
    case 'data-token-usage':
    case 'data-dialog-closed':
      wire.onTransient?.(chunk);
      return messages;
    default: {
      const holder = messageHoldingChunk(messages, chunk);
      if (holder === -1) return applyToCurrent(messages, chunk, wire);
      const message = messages[holder];
      const parts = applyChunk(message.parts, chunk, wire);
      return parts === message.parts ? messages : replaceAt(messages, holder, { ...message, parts });
    }
  }
}
