/**
 * The chat message, everywhere: one shape in memory, on the hub's wire, in a stored row and in the history route.
 *
 * The names are the AI SDK's `UIMessage` (`ai@7.0.159`): copied here, never imported at runtime, and held to the real
 * thing by `__tests__/ai-sdk-conformance.test.ts`. A message is its ordered `parts`; there is no `content`, `segments`,
 * `sources` or `timestamp` beside them, and a failure is an assistant message with a `data-error` part, never a role.
 *
 * A record's identity is its record URI (`record://<type>/<id>`, `./record-link`): one spelling for chips, cards,
 * sources and citations. What can be derived from a URI or a url is never carried.
 *
 * Server-safe: no React, no browser APIs.
 */

import type { QuickActionIconSpec } from '../components/chat/quick-action-chip';
import type { AssistantType, AuthorType, ChatApprovalStatus } from '../components/chat/types/chat.types';
import type { ChatContextItem } from '../components/chat/types/context-item.types';
import type {
  ApprovalRequestField,
  AskOptionData,
  TicketEscalatedData,
  TicketEventData,
} from '../components/chat/types/message.types';
import type { ChatProgress } from './progress';
import { normalizeRecordUris, normalizeSourceId } from './record-link';
import { isRecord } from './wire-narrow';

// =============================================================================
// Citations
// =============================================================================

export type ChatCitationSource =
  | { type: 'source'; sourceType: 'url'; id: string; url: string; title?: string }
  | { type: 'source'; sourceType: 'document'; id: string; mediaType: string; title: string; filename?: string };

/**
 * A citation on a text part. `startIndex` and `endIndex` are UTF-16 offsets into that part, end exclusive, and each is
 * optional on its own: a citation that knows a position and not a range stores `endIndex` only. `citedText` is in the
 * type because the standard has it; nothing stores or sends it.
 */
export interface ChatCitation {
  source: ChatCitationSource;
  startIndex?: number;
  endIndex?: number;
  citedText?: string;
}

// =============================================================================
// Parts
// =============================================================================

/** `state` is memory only: {@link storablePartsOf} drops it. */
export type ChatPartState = 'streaming' | 'done';

export interface ChatTextPart {
  type: 'text';
  text: string;
  /** Absent when empty, and always absent on Mingo. */
  citations?: ChatCitation[];
  state?: ChatPartState;
}

export interface ChatReasoningPart {
  type: 'reasoning';
  text: string;
  state?: ChatPartState;
}

/** A record with a url. `url` is absolute and canonical on the hub's wire; `title` is omitted when the record has none. */
export interface ChatSourceUrlPart {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
}

/**
 * A record with no url (a type with no page, a mapper that answered null, a collection): `mediaType` is what the model
 * was given, and the standard requires `title`.
 */
export interface ChatSourceDocumentPart {
  type: 'source-document';
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
}

export type ChatSourcePart = ChatSourceUrlPart | ChatSourceDocumentPart;

/** An attachment on a user row. Its `url` is the view proxy, never a signed storage URL. */
export interface ChatFilePart {
  type: 'file';
  mediaType: string;
  filename?: string;
  url: string;
}

/** The records an answer shows as cards. `records` is not capped on read: `RECORD_CARDS_MAX` binds the tool call. */
export interface ChatRecordCardsPart {
  type: 'data-record-cards';
  id?: string;
  data: { records: string[] };
}

export interface ChatAskPart {
  type: 'data-ask';
  id?: string;
  data: { question: string; options: AskOptionData[] };
}

export interface ChatEscalationOfferData {
  /** Absent on a resolution chunk: it flips the card the offer painted (`./apply-chunk`). */
  text?: string;
  origin?: string;
  status: ChatApprovalStatus;
  resolvedByName?: string | null;
}

export interface ChatEscalationOfferPart {
  type: 'data-escalation-offer';
  /** The offer's id. */
  id: string;
  data: ChatEscalationOfferData;
}

export interface ChatTicketEscalatedPart {
  type: 'data-ticket-escalated';
  id?: string;
  data: TicketEscalatedData;
}

export type ChatTicketEventData = TicketEventData & {
  /** When this event happened, ISO. The first-known time wins when a redelivery meets its hydrated twin. */
  occurredAt?: string;
};

export interface ChatTicketEventPart {
  type: 'data-ticket-event';
  /** The chunk's JetStream sequence: the event's only stable identity. */
  id?: string;
  data: ChatTicketEventData;
}

export interface ChatErrorPart {
  type: 'data-error';
  id?: string;
  data: { title: string; details?: string };
}

export interface ChatContextCompactionPart {
  type: 'data-context-compaction';
  id?: string;
  data: { status: 'started' | 'completed'; summary?: string };
}

export interface ChatSuggestionPrompt {
  label: string;
  prompt?: string;
  icon?: QuickActionIconSpec;
}

export interface ChatSuggestionGroup {
  label: string;
  prompts: ChatSuggestionPrompt[];
}

/** Prompts the assistant offers as chips. Never on the wire: a host builds it locally. */
export interface ChatSuggestionsPart {
  type: 'data-suggestions';
  id?: string;
  data: { groups: ChatSuggestionGroup[]; note?: string };
}

export type ChatDataPart =
  | ChatRecordCardsPart
  | ChatAskPart
  | ChatEscalationOfferPart
  | ChatTicketEscalatedPart
  | ChatTicketEventPart
  | ChatErrorPart
  | ChatContextCompactionPart
  | ChatSuggestionsPart;

/** What a tool part's row needs beside the standard's fields. A JSON object (the standard's `toolMetadata`). */
export type ChatToolMetadata = {
  integratedToolType?: string;
  toolExplanation?: string;
  statusLabel?: string;
  resolvedByName?: string | null;
  /** The batch a row with no approval of its own belongs to. */
  batchId?: string;
};

/** The standard's opaque `approval.descriptor`: what the card draws. */
export interface ChatApprovalDescriptor {
  /** The approval tier, where the transport has one. `approvalDisplaysInline` reads it. */
  approvalType?: string;
  fields?: ApprovalRequestField[];
  expiresAt?: string;
  ttlSeconds?: number;
  /** The batch this row belongs to. The renderer draws a run with one `batchId` as one card. */
  batchId?: string;
}

/** An approval waiting on its answer. */
export interface ChatToolApprovalRequest {
  id: string;
  approved?: never;
  reason?: never;
  requestReason?: string;
  descriptor?: ChatApprovalDescriptor;
}

/** An approval that was answered. `reason` is the reject reason; a cancellation is {@link APPROVAL_CANCELLED}. */
export type ChatToolApprovalResponse<APPROVED extends boolean = boolean> = Omit<
  ChatToolApprovalRequest,
  'approved' | 'reason'
> & { approved: APPROVED; reason?: string };

export type ChatToolApproval = ChatToolApprovalRequest | ChatToolApprovalResponse;

interface ChatToolPartBase {
  type: 'dynamic-tool';
  toolName: string;
  toolCallId: string;
  title?: string;
  toolMetadata?: ChatToolMetadata;
}

export type ChatToolPart =
  | (ChatToolPartBase & { state: 'input-available'; input: unknown })
  | (ChatToolPartBase & { state: 'approval-requested'; input: unknown; approval: ChatToolApprovalRequest })
  | (ChatToolPartBase & { state: 'approval-responded'; input: unknown; approval: ChatToolApprovalResponse })
  | (ChatToolPartBase & {
      state: 'output-available';
      input: unknown;
      output: unknown;
      approval?: ChatToolApprovalResponse<true>;
    })
  | (ChatToolPartBase & {
      state: 'output-error';
      input: unknown;
      errorText: string;
      approval?: ChatToolApprovalResponse<true>;
    })
  | (ChatToolPartBase & { state: 'output-denied'; input: unknown; approval: ChatToolApprovalResponse<false> });

export type ChatPart = ChatTextPart | ChatReasoningPart | ChatSourcePart | ChatFilePart | ChatDataPart | ChatToolPart;

// =============================================================================
// The message
// =============================================================================

/** The standard's finish reasons. */
export type ChatFinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'interrupted' | 'other';

export interface ChatUsageTelemetry {
  cards: number;
  citations: number;
  sentences: number;
  answerLen: number;
}

/**
 * A turn's usage: the SDK's names, and beside them what has no standard name (`metadata` is the documented app slot).
 * `usage_breakdown` in the database is another shape and stays as it is.
 */
export interface ChatUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputTokenDetails?: { noCacheTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number };
  hit_rate_pct?: number;
  telemetry?: ChatUsageTelemetry;
  /** Left opaque: its reader validates each field it draws. */
  breakdown?: Record<string, unknown>;
  debug?: Record<string, unknown>;
  stop_reason?: string;
  stop_detail?: string;
}

export interface ChatRouting {
  /** Open on purpose: an older or newer server may send a value this build does not know. */
  complexity: string;
  model?: string;
  thinkingBudget?: number | null;
}

/** A stage of the turn in memory: what the row draws. Never stored. */
export type ChatProgressRow = ChatProgress & { id: string; state: 'running' | 'done' | 'failed' };

export interface ChatMessageAuthor {
  name?: string;
  avatar?: string | null;
  authorType?: AuthorType;
  assistantType?: AssistantType;
}

/** JSON-serializable. */
export interface ChatMessageMetadata {
  // A stored row.
  seq?: number;
  /** ISO. */
  createdAt?: string;
  kind?: 'approval_receipt';
  /** Omitted when false. */
  aborted?: boolean;
  /** The admin transcript answers parts without source parts, and how many it left out. */
  sourceCount?: number;
  // The stream.
  conversationId?: string;
  model?: string;
  modelLabel?: string;
  provider?: string;
  contextWindowMaxTokens?: number;
  scrollAnchor?: string;
  routing?: ChatRouting;
  willAutoContinue?: boolean;
  usage?: ChatUsage;
  // Memory only.
  /** How the turn ended, when the stream said (`finish`). `interrupted` draws the notice `incomplete` draws. */
  finishReason?: ChatFinishReason;
  hidden?: boolean;
  progress?: ChatProgressRow[];
  author?: ChatMessageAuthor;
  contextItems?: ChatContextItem[];
  /** The highest chunk sequence consumed into this row: what the history merge decides coverage with. */
  streamSeq?: number;
}

export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  metadata?: ChatMessageMetadata;
  parts: ChatPart[];
}

// =============================================================================
// Narrowing
// =============================================================================

export function isSourcePart(part: ChatPart): part is ChatSourcePart {
  return part.type === 'source-url' || part.type === 'source-document';
}

export function isToolPart(part: ChatPart): part is ChatToolPart {
  return part.type === 'dynamic-tool';
}

/** The batch a tool part belongs to: its approval's, or for a row that needs none, its metadata's. */
export function approvalBatchIdOf(part: ChatToolPart): string | undefined {
  const approval = 'approval' in part ? part.approval : undefined;
  return approval?.descriptor?.batchId ?? part.toolMetadata?.batchId;
}

/**
 * The id the backend knows an approval by: one request can hold a batch of calls, and a card's button names the row. A
 * row that is in no batch is its own request.
 */
export function approvalRequestIdOf(messages: readonly ChatMessage[], id: string): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const part of messages[i].parts) {
      if (isToolPart(part) && 'approval' in part && part.approval?.id === id) return approvalBatchIdOf(part) ?? id;
    }
  }
  return id;
}

/** A citation's source, from the source part it names. */
export function citationSourceOfPart(part: ChatSourcePart): ChatCitationSource {
  if (part.type === 'source-url') {
    return {
      type: 'source',
      sourceType: 'url',
      id: part.sourceId,
      url: part.url,
      ...(part.title !== undefined ? { title: part.title } : {}),
    };
  }
  return {
    type: 'source',
    sourceType: 'document',
    id: part.sourceId,
    mediaType: part.mediaType,
    title: part.title,
    ...(part.filename !== undefined ? { filename: part.filename } : {}),
  };
}

/** The source part a citation's source names. */
export function sourcePartOfCitationSource(source: ChatCitationSource): ChatSourcePart {
  if (source.sourceType === 'url') {
    return {
      type: 'source-url',
      sourceId: source.id,
      url: source.url,
      ...(source.title !== undefined ? { title: source.title } : {}),
    };
  }
  return {
    type: 'source-document',
    sourceId: source.id,
    mediaType: source.mediaType,
    title: source.title,
    ...(source.filename !== undefined ? { filename: source.filename } : {}),
  };
}

// =============================================================================
// The one text helper
// =============================================================================

/**
 * A message's text: every text part, and a paragraph break where two parts meet with no newline of their own.
 *
 * Hub text carries its own `\n\n` across a card, so on a stored row the result is byte-identical to the text written.
 * Mingo text splits at tool rows with no newline, so those get the break.
 */
export function textOfParts(parts: readonly ChatPart[]): string {
  let out = '';
  for (const p of parts) {
    if (p.type !== 'text' || p.text === '') continue;
    if (out !== '' && !out.endsWith('\n') && !p.text.startsWith('\n')) out += '\n\n';
    out += p.text;
  }
  return out;
}

// =============================================================================
// What a row stores
// =============================================================================

/** A citation moved along by `offset` characters: its part was appended to another one. */
export function rebaseCitation(citation: ChatCitation, offset: number): ChatCitation {
  if (offset === 0) return citation;
  return {
    ...citation,
    ...(citation.startIndex !== undefined ? { startIndex: citation.startIndex + offset } : {}),
    ...(citation.endIndex !== undefined ? { endIndex: citation.endIndex + offset } : {}),
  };
}

function appendText(left: ChatTextPart, right: ChatTextPart, separator: string): ChatTextPart {
  const offset = left.text.length + separator.length;
  const citations = [...(left.citations ?? []), ...(right.citations ?? []).map(c => rebaseCitation(c, offset))];
  return {
    type: 'text',
    text: left.text + separator + right.text,
    ...(citations.length > 0 ? { citations } : {}),
  };
}

/**
 * The parts a row stores: `text`, `source-*`, `file` and `data-record-cards`. Sources lead, unique by `sourceId`; `state`
 * goes; an empty text part goes, so an empty answer is `[]`.
 *
 * Text parts a dropped part left adjacent become one, with their citations rebased. Across dropped reasoning nothing is
 * added, because reasoning never splits a sentence's text. Across any other dropped part (a tool row) they get the
 * paragraph break {@link textOfParts} draws there, so the row reads as the live message read.
 */
export function storablePartsOf(parts: readonly ChatPart[]): ChatPart[] {
  const sources: ChatSourcePart[] = [];
  const seen = new Set<string>();
  const body: ChatPart[] = [];
  let droppedOtherThanReasoning = false;

  for (const part of parts) {
    if (isSourcePart(part)) {
      if (!seen.has(part.sourceId)) {
        seen.add(part.sourceId);
        sources.push(part);
      }
    } else if (part.type === 'text') {
      if (part.text === '') continue;
      const { state: _state, ...text } = part;
      const last = body[body.length - 1];
      if (last?.type === 'text') {
        const breakNeeded =
          droppedOtherThanReasoning && !last.text.endsWith('\n') && !text.text.startsWith('\n') ? '\n\n' : '';
        body[body.length - 1] = appendText(last, text, breakNeeded);
      } else {
        body.push(text);
      }
      droppedOtherThanReasoning = false;
    } else if (part.type === 'file' || part.type === 'data-record-cards') {
      body.push(part);
      droppedOtherThanReasoning = false;
    } else if (part.type !== 'reasoning') {
      droppedOtherThanReasoning = true;
    }
  }
  return [...sources, ...body];
}

// =============================================================================
// Approvals
// =============================================================================

/** The `approval.reason` of a cancellation: a proposal the user neither approved nor rejected, and no longer can. */
export const APPROVAL_CANCELLED = 'cancelled';

/**
 * Where a tool part's approval stands, from its `state` and `approval` alone (no `cancelled` or `executing` flag
 * anywhere). Null for a tool part with no approval.
 */
export function approvalStatusOf(part: ChatToolPart): ChatApprovalStatus | null {
  const approval = 'approval' in part ? part.approval : undefined;
  if (!approval) return null;
  if (part.state === 'approval-requested') return 'pending';
  if (approval.approved) return 'approved';
  return approval.reason === APPROVAL_CANCELLED ? 'cancelled' : 'rejected';
}

// =============================================================================
// Reading parts off the wire
// =============================================================================

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function citationSourceOf(raw: unknown): ChatCitationSource | null {
  if (!isRecord(raw) || typeof raw.id !== 'string') return null;
  if (raw.sourceType === 'url' && typeof raw.url === 'string') {
    const title = optionalString(raw.title);
    return {
      type: 'source',
      sourceType: 'url',
      id: normalizeSourceId(raw.id),
      url: raw.url,
      ...(title ? { title } : {}),
    };
  }
  if (raw.sourceType === 'document' && typeof raw.mediaType === 'string' && typeof raw.title === 'string') {
    const filename = optionalString(raw.filename);
    return {
      type: 'source',
      sourceType: 'document',
      id: normalizeSourceId(raw.id),
      mediaType: raw.mediaType,
      title: raw.title,
      ...(filename ? { filename } : {}),
    };
  }
  return null;
}

function offsetOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/** The valid citations in a wire value. A malformed one goes and the rest stay: a citation is never worth a turn. */
export function parseCitations(raw: unknown): ChatCitation[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatCitation[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const source = citationSourceOf(item.source);
    if (!source) continue;
    const startIndex = offsetOf(item.startIndex);
    const endIndex = offsetOf(item.endIndex);
    out.push({
      source,
      ...(startIndex !== undefined ? { startIndex } : {}),
      ...(endIndex !== undefined ? { endIndex } : {}),
    });
  }
  return out;
}

/** One stored part, or null when it is not one a row may hold. */
function parseStoredPart(raw: unknown): ChatPart | null {
  if (!isRecord(raw)) return null;
  switch (raw.type) {
    case 'text': {
      if (typeof raw.text !== 'string') return null;
      const citations = parseCitations(raw.citations);
      return { type: 'text', text: raw.text, ...(citations.length > 0 ? { citations } : {}) };
    }
    case 'source-url': {
      if (typeof raw.sourceId !== 'string' || typeof raw.url !== 'string') return null;
      const title = optionalString(raw.title);
      return {
        type: 'source-url',
        sourceId: normalizeSourceId(raw.sourceId),
        url: raw.url,
        ...(title ? { title } : {}),
      };
    }
    case 'source-document': {
      if (typeof raw.sourceId !== 'string' || typeof raw.title !== 'string') return null;
      const filename = optionalString(raw.filename);
      return {
        type: 'source-document',
        sourceId: normalizeSourceId(raw.sourceId),
        mediaType: optionalString(raw.mediaType) ?? 'text/plain',
        title: raw.title,
        ...(filename ? { filename } : {}),
      };
    }
    case 'file': {
      if (typeof raw.url !== 'string' || typeof raw.mediaType !== 'string') return null;
      const filename = optionalString(raw.filename);
      return { type: 'file', mediaType: raw.mediaType, url: raw.url, ...(filename ? { filename } : {}) };
    }
    case 'data-record-cards': {
      const records = normalizeRecordUris(isRecord(raw.data) ? raw.data.records : undefined);
      return records.length > 0 ? { type: 'data-record-cards', data: { records } } : null;
    }
    default:
      return null;
  }
}

/** The parts of a stored row, in order. One a row may not hold is left out. */
export function parseStoredParts(raw: unknown): ChatPart[] {
  if (!Array.isArray(raw)) return [];
  const parts: ChatPart[] = [];
  for (const item of raw) {
    const part = parseStoredPart(item);
    if (part) parts.push(part);
  }
  return parts;
}

// =============================================================================
// Reading metadata
// =============================================================================

/** Reads one field: its value when it has the type the field holds, else undefined. */
type FieldReader = (value: unknown) => unknown;

const stringField: FieldReader = value => (typeof value === 'string' ? value : undefined);
const numberField: FieldReader = value => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const booleanField: FieldReader = value => (typeof value === 'boolean' ? value : undefined);
const recordField: FieldReader = value => (isRecord(value) ? value : undefined);

/** The fields of `raw` these readers accept. Anything else a wire sends is left out. */
function readFields(raw: Record<string, unknown>, readers: Record<string, FieldReader>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, read] of Object.entries(readers)) {
    const value = read(raw[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

const usageField: FieldReader = value => {
  if (!isRecord(value)) return undefined;
  return readFields(value, {
    inputTokens: numberField,
    outputTokens: numberField,
    totalTokens: numberField,
    inputTokenDetails: details =>
      isRecord(details)
        ? readFields(details, {
            noCacheTokens: numberField,
            cacheReadTokens: numberField,
            cacheWriteTokens: numberField,
          })
        : undefined,
    hit_rate_pct: numberField,
    telemetry: telemetry => {
      if (!isRecord(telemetry)) return undefined;
      const { cards, citations, sentences, answerLen } = telemetry;
      return [cards, citations, sentences, answerLen].every(count => numberField(count) !== undefined)
        ? { cards, citations, sentences, answerLen }
        : undefined;
    },
    breakdown: recordField,
    debug: recordField,
    stop_reason: stringField,
    stop_detail: stringField,
  });
};

const routingField: FieldReader = value => {
  if (!isRecord(value) || typeof value.complexity !== 'string') return undefined;
  const { thinkingBudget } = value;
  return {
    complexity: value.complexity,
    ...readFields(value, { model: stringField }),
    ...(thinkingBudget === null || numberField(thinkingBudget) !== undefined ? { thinkingBudget } : {}),
  };
};

/**
 * What a path may say about its message, and nothing else: `hidden`, `progress`, `author` and the rest are this client's
 * own and are never read off a wire.
 */
const METADATA_FIELDS: Record<'stored-row' | 'stream', Record<string, FieldReader>> = {
  'stored-row': {
    seq: numberField,
    createdAt: stringField,
    kind: value => (value === 'approval_receipt' ? value : undefined),
    aborted: value => (value === true ? value : undefined),
    sourceCount: numberField,
  },
  stream: {
    conversationId: stringField,
    model: stringField,
    modelLabel: stringField,
    provider: stringField,
    contextWindowMaxTokens: numberField,
    scrollAnchor: stringField,
    routing: routingField,
    willAutoContinue: booleanField,
    usage: usageField,
  },
};

/** A message's metadata as a stored row or a stream chunk states it, field by field. */
export function parseMessageMetadata(raw: unknown, path: 'stored-row' | 'stream'): ChatMessageMetadata {
  return isRecord(raw) ? readFields(raw, METADATA_FIELDS[path]) : {};
}
