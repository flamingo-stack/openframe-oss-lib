/**
 * Message-related types. The message itself is `ChatMessage` (`chat-protocol/chat-message`), one shape in memory, on the
 * wire and in a stored row. What is here: the Mingo wire's vocabulary, what a persisted Mingo row holds, and the shapes a
 * card draws.
 */

import type { MessageOwner } from './chat.types';

// ========== Message Type Definitions ==========

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  THINKING: 'THINKING',
  ASK: 'ASK',
  /** The records an answer was given: `sources` on the entry, what becomes its source parts. TODO(CU-17tkuw61kfy):
   *  `GUIDE` is the envelope it replaced, the same arrays under `payload`, read by `old-wire` only. */
  ATTACHMENTS: 'ATTACHMENTS',
  GUIDE: 'GUIDE',
  /** The records the answer shows as cards, chosen by the model's `show_records`
   *  tool call and checked by the server: a part of the message of its own, drawn
   *  where the call was made. A record named in the text is a chip, never a card. */
  RECORD_CARDS: 'RECORD_CARDS',
  EXECUTING_TOOL: 'EXECUTING_TOOL',
  EXECUTED_TOOL: 'EXECUTED_TOOL',
  APPROVAL_REQUEST: 'APPROVAL_REQUEST',
  APPROVAL_RESULT: 'APPROVAL_RESULT',
  ESCALATION_OFFER: 'ESCALATION_OFFER',
  TICKET_ESCALATED: 'TICKET_ESCALATED',
  TICKET_EVENT: 'TICKET_EVENT',
  ERROR: 'ERROR',
  MESSAGE_START: 'MESSAGE_START',
  MESSAGE_END: 'MESSAGE_END',
  MESSAGE_REQUEST: 'MESSAGE_REQUEST',
  AI_METADATA: 'AI_METADATA',
  TOKEN_USAGE: 'TOKEN_USAGE',
  CONTEXT_COMPACTION_START: 'CONTEXT_COMPACTION_START',
  CONTEXT_COMPACTION_END: 'CONTEXT_COMPACTION_END',
  DIRECT_MESSAGE: 'DIRECT_MESSAGE',
  SYSTEM: 'SYSTEM',
  DIALOG_CLOSED: 'DIALOG_CLOSED',
} as const;

export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];

// ========== Scroll Anchor (per-message render hint) ==========

/** Per-message viewport-positioning hint sent on the per-turn
 *  `message-metadata` chunk at the START of every assistant response. The chat
 *  message-list reads it to override the default `use-stick-to-bottom`
 *  tail behaviour for a single message. Field is OPTIONAL — when omitted
 *  (or set to `'bottom'`) the chat tails as today. Only `'top'` opts in
 *  to the alternative behaviour (used by display-action answers whose
 *  body is a long article and should be read top-down). */
export const SCROLL_ANCHOR = { TOP: 'top', BOTTOM: 'bottom' } as const;

export type ScrollAnchor = (typeof SCROLL_ANCHOR)[keyof typeof SCROLL_ANCHOR];

// ========== Tool Execution Types ==========

export interface ToolExecutionData {
  type: 'EXECUTING_TOOL' | 'EXECUTED_TOOL';
  integratedToolType: string;
  toolFunction: string;
  /** Backend-issued human-readable title (mirrors `PendingToolCallData.toolTitle`). */
  toolTitle?: string;
  /**
   * Backend-issued human-readable explanation of what the tool is doing and why
   * (mirrors `PendingToolCallData.toolExplanation`). Only sent on `EXECUTING_TOOL`;
   * the row keeps it through its `EXECUTED_TOOL`.
   */
  toolExplanation?: string;
  parameters?: Record<string, unknown>;
  result?: string;
  success?: boolean;
  /**
   * The words of the row's status line where it is drawn as a card (the
   * end-client view): e.g. "Fixed on its own". Omitted: "Working on it",
   * "Done" or "Failed" by state.
   */
  statusLabel?: string;
  /**
   * Backend-issued id (matches `PendingToolCallData.toolExecutionRequestId`).
   * When present, this run lands on the matching approval batch row instead of
   * a row of its own.
   */
  toolExecutionRequestId?: string;
}

// ========== Approval Request Types ==========

export interface ApprovalRequestField {
  /** Short label — e.g. "Subject", "Priority". Rendered in a muted
   *  caps style above the value. */
  label: string;
  /** Free-text value. Wraps and line-breaks are preserved
   *  (`whitespace-pre-wrap`). */
  value: string;
}

export interface ApprovalRequestData {
  command: string;
  /** Structured field list — preferred over `explanation`. When set,
   *  the approval card renders a vertical label/value stack with
   *  proper spacing. Falls back to `explanation` (a single paragraph)
   *  when omitted. Keep BOTH when you want hosts on older lib
   *  versions to still see the prose; new hosts should send only
   *  `fields`. */
  fields?: ApprovalRequestField[];
  explanation?: string;
  requestId?: string;
  approvalRequestId?: string;
  approvalType?: string;
}

export interface ApprovalResultData {
  approvalRequestId: string;
  approved: boolean;
  approvalType?: string;
  /** Display name of the user who resolved the request; null/absent for system actions. */
  resolvedByName?: string | null;
}

// ========== Escalation Offer Types ==========

export interface EscalationOfferData {
  offerId: string;
  /** Backend-fixed card copy; the client never composes it. */
  text: string;
  /** Why the offer was raised (`TOOL`, `MANUAL`, a trigger reason). Carried
   *  for telemetry — every origin renders the same card. */
  origin?: string;
}

// ========== Ticket Escalated Types ==========

/** Open union: the wire currently defines only `INACTIVITY`, and the block
 *  renders from `text` rather than branching on this, so a reason added
 *  server-side needs no client change. */
export type TicketEscalationReason = 'INACTIVITY' | (string & {});

/** The handoff receipt — a real block on the wire, not something the client
 *  infers from an escalation offer's state. */
export interface TicketEscalatedData {
  ticketId: string;
  ticketNumber?: number;
  reason: TicketEscalationReason;
  /** Backend-authored explanation; the card falls back to generic copy when
   *  the wire omits it (the field is nullable). */
  text?: string;
}

// ========== Ticket Event Types ==========

/** Known `TicketEventData.kind` values. The vocabulary is OPEN on the wire:
 *  an unknown kind still renders (as a neutral info line) rather than being
 *  dropped, so the backend can add lifecycle kinds without a client release. */
export const TICKET_EVENT_KIND = {
  RESOLVED: 'RESOLVED',
  REOPENED: 'REOPENED',
} as const;

export type TicketEventKind = (typeof TICKET_EVENT_KIND)[keyof typeof TICKET_EVENT_KIND] | (string & {});

/** Ticket lifecycle receipt (`TICKET_EVENT`) — the ticket was resolved,
 *  reopened, etc. Same field names live (NATS chunk) and persisted
 *  (GraphQL `TicketEventData` inside `messageData`), so ONE mapper covers
 *  both paths. All actor fields are optional: the event stays renderable
 *  when the backend can't attribute it. */
export interface TicketEventData {
  kind: TicketEventKind;
  actorId?: string;
  actorName?: string;
  /** Who acted — e.g. an AI agent vs a human. Open string like `kind`. */
  actorType?: string;
  reason?: string;
  /** Kind-token of the status the ticket reopened INTO (AI_ASSISTANCE /
   *  TECH_REQUIRED / CUSTOM / ...) — same open vocabulary the lifecycle
   *  statuses use. Picks the REOPENED card's subtitle deterministically;
   *  absent on RESOLVED events and older backends. */
  targetStatusKind?: string;
}

/**
 * Single tool call inside a batch approval request.
 * Mirrors backend PendingToolCallDto.
 */
export interface PendingToolCallData {
  toolExecutionRequestId: string;
  toolName: string;
  toolTitle?: string;
  toolExplanation?: string;
  toolType?: string;
  requiresApproval: boolean;
  approvalType?: string | null;
  toolCallArguments?: Record<string, unknown> | null;
}

/**
 * Per-tool execution state inside an approval batch.
 * Populated by EXECUTING_TOOL / EXECUTED_TOOL chunks that carry a
 * `toolExecutionRequestId` matching one of the batch's tool calls.
 */
export interface ApprovalBatchExecutionState {
  status: 'executing' | 'done';
  result?: string;
  success?: boolean;
  /** Nothing said how the row ended: no cross and no check, and `result` says so. */
  outcomeUnknown?: boolean;
  /** The server refused the answer sent for this row, and `result` is its sentence to a person, not a tool's raw output. */
  refused?: boolean;
}

export interface ApprovalBatchData {
  approvalRequestId: string;
  /** Highest approval type required across the batch (e.g. ADMIN beats CLIENT). */
  approvalType: string;
  toolCalls: PendingToolCallData[];
  /**
   * Keyed by `PendingToolCallData.toolExecutionRequestId`. Absent before
   * approval; rows without an entry render as "queued" (loader) once the
   * batch itself is approved.
   */
  executions?: Record<string, ApprovalBatchExecutionState>;
}

/** What a card's button calls. MAY resolve a boolean success flag: `false` means the confirm FAILED (expired proposal,
 *  network error). `void` is treated as success. */
export type ApprovalResolutionHandler = (requestId?: string) => void | boolean | Promise<void | boolean>;

/** One reading the assistant offers in an ask card. `label` is BOTH the row's headline and the exact text sent back when
 *  the row is picked: the backend's guide classifier resolves the user's next message against the labels it offered, so
 *  the reply must be the label verbatim. `description` is a short clarifying line rendered under it. */
export type AskOptionData = {
  label: string;
  description?: string;
};

/**
 * What a message's controls do. Parts are data and hold no callbacks, so a message's buttons reach these at render time:
 * a stable object from each adapter, compared by reference in the message's memo. Each one is optional: a thread with no
 * way to act draws its cards read-only.
 */
export interface ChatMessageActions {
  /** Approve a pending approval, by its `approval.id` or its batch's id. Resolves `false` when it failed. */
  approve?: (id: string) => void | boolean | Promise<void | boolean>;
  /** Reject a pending approval, by its `approval.id` or its batch's id. */
  reject?: (id: string, reason?: string) => void | boolean | Promise<void | boolean>;
  approveEscalation?: (id: string) => void | Promise<void>;
  rejectEscalation?: (id: string) => void | Promise<void>;
  /** Send a suggestion chip's prompt. */
  pickSuggestion?: (prompt: string) => void;
  /** Send an ask card's option, by its label verbatim: the backend resolves the reply against the labels it offered. */
  selectAsk?: (label: string) => void;
}

// ========== Message Data Types (from GraphQL/API) ==========

export interface MessageDataBase {
  type: MessageType;
}

export interface TextMessageData extends MessageDataBase {
  type: 'TEXT';
  text?: string;
  /** Entity references the user attached to the message. Wire shape is
   *  `[{ type, id }]`; rows missing `id` are dropped by the history
   *  processor, so `id` is optional here. */
  contextItems?: Array<{ type?: string; id?: string }>;
}

export interface ThinkingMessageData extends MessageDataBase {
  type: 'THINKING';
  text?: string;
}

/** Persisted attachments row (GraphQL `AttachmentsData`): the same array the live chunk carries, so history and realtime
 *  share one decoder. Left untyped: it is unvalidated wire data, and `createMingoDecoder` turns it into source parts.
 *  TODO(CU-17tkuw61kfy): `videos` and `cards` are old rows' only. */
export interface AttachmentsMessageData extends MessageDataBase {
  type: 'ATTACHMENTS';
  sources?: unknown;
  videos?: unknown;
  cards?: unknown;
}

/** Persisted `RECORD_CARDS` row (GraphQL `RecordCardsData`); the live chunk has the same shape. TODO(CU-17tkuw61kfy):
 *  `cards` is a dev cluster's old rows' only. */
export interface RecordCardsMessageData extends MessageDataBase {
  type: 'RECORD_CARDS';
  records?: unknown;
  cards?: unknown;
}

/** TODO(CU-17tkuw61kfy): the envelope `ATTACHMENTS` replaced, the same arrays under `payload`. */
export interface SourceMetadataMessageData extends MessageDataBase {
  type: 'GUIDE';
  payload?: unknown;
}

/** Persisted `ASK` row (GraphQL `AskData`). `text` is the intro sentence, ordinary answer text ahead of the card: the
 *  split the live `ASK` chunk carries. */
export interface AskMessageData extends MessageDataBase {
  type: 'ASK';
  text?: string;
  question?: string;
  /** WIRE shape: `label` is optional here because the backend can (and does) ship label-less rows; the decoder drops
   *  them, which is what turns this into the card's `AskOptionData[]`. */
  options?: Array<{ label?: string; description?: string }>;
}

export interface ExecutingToolMessageData extends MessageDataBase {
  type: 'EXECUTING_TOOL';
  integratedToolType?: string;
  toolFunction?: string;
  /** Backend-issued human-readable title (wire field, mirrors `ChunkData.title`). */
  title?: string;
  /** Backend-issued human-readable explanation (what/why) of the tool call. */
  toolExplanation?: string;
  parameters?: Record<string, unknown>;
  toolExecutionRequestId?: string;
}

export interface ExecutedToolMessageData extends MessageDataBase {
  type: 'EXECUTED_TOOL';
  integratedToolType?: string;
  toolFunction?: string;
  /** Backend-issued human-readable title (wire field, mirrors `ChunkData.title`). */
  title?: string;
  parameters?: Record<string, unknown>;
  result?: string;
  success?: boolean;
  toolExecutionRequestId?: string;
}

export interface ApprovalRequestMessageData extends MessageDataBase {
  type: 'APPROVAL_REQUEST';
  approvalRequestId?: string;
  approvalType?: string;
  command?: string;
  explanation?: string;
  /** Present when the approval is a batch of tool calls (new format). */
  toolCalls?: PendingToolCallData[];
}

export interface ApprovalResultMessageData extends MessageDataBase {
  type: 'APPROVAL_RESULT';
  approvalRequestId?: string;
  approved?: boolean;
  approvalType?: string;
  /** Display name of the user who resolved the request; null/absent for system actions. */
  resolvedByName?: string | null;
}

/**
 * Persisted escalation-offer row. The PENDING row carries `text`/`origin`;
 * the resolution is a SECOND row with the same `offerId`, state
 * APPROVED/DECLINED/SUPERSEDED and no text — matched on replay by id.
 */
export interface EscalationOfferMessageData extends MessageDataBase {
  type: 'ESCALATION_OFFER';
  offerId?: string;
  state?: string;
  text?: string;
  origin?: string;
  resolvedByUserId?: string | null;
  resolvedByName?: string | null;
}

export interface TicketEscalatedMessageData extends MessageDataBase {
  type: 'TICKET_ESCALATED';
  ticketId?: string;
  ticketNumber?: number;
  reason?: TicketEscalationReason;
  text?: string;
}

/** Persisted ticket lifecycle row: the same field names as the live chunk (see `TicketEventData`), decoded by the same
 *  mapper. Fields are wire-shaped (`| null`): every one is a nullable GraphQL scalar. */
export interface TicketEventMessageData extends MessageDataBase {
  type: 'TICKET_EVENT';
  kind?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorType?: string | null;
  reason?: string | null;
  targetStatusKind?: string | null;
}

export interface ErrorMessageData extends MessageDataBase {
  type: 'ERROR';
  error?: string;
  details?: string;
}

export interface AIMetadataMessageData extends MessageDataBase {
  type: 'AI_METADATA';
  modelName?: string;
  providerName?: string;
  provider?: string;
  contextWindow?: number;
}

export interface TokenUsageData {
  inputTokensSize: number;
  outputTokensSize: number;
  totalTokensSize: number;
  contextSize: number;
}

export interface SystemMessageData extends MessageDataBase {
  type: 'SYSTEM';
  text?: string;
}

/**
 * Human-technician takeover row. A REALTIME-only concept: a persisted `DIRECT_MESSAGE` row contributes nothing on reload
 * (`processHistoricalMessages` pins it). Declared here so the wire shape is nameable without `any`.
 */
export interface DirectMessageData extends MessageDataBase {
  type: 'DIRECT_MESSAGE';
  text?: string;
}

export interface ContextCompactionStartMessageData extends MessageDataBase {
  type: 'CONTEXT_COMPACTION_START';
}

export interface ContextCompactionEndMessageData extends MessageDataBase {
  type: 'CONTEXT_COMPACTION_END';
  summary?: string;
}

export type MessageData =
  | TextMessageData
  | ThinkingMessageData
  | AskMessageData
  | AttachmentsMessageData
  | RecordCardsMessageData
  | SourceMetadataMessageData
  | ExecutingToolMessageData
  | ExecutedToolMessageData
  | ApprovalRequestMessageData
  | ApprovalResultMessageData
  | EscalationOfferMessageData
  | TicketEscalatedMessageData
  | TicketEventMessageData
  | ErrorMessageData
  | AIMetadataMessageData
  | SystemMessageData
  | DirectMessageData
  | ContextCompactionStartMessageData
  | ContextCompactionEndMessageData;

// ========== Historical Message Types ==========

export interface HistoricalMessage {
  id: string;
  dialogId?: string;
  chatType?: string;
  createdAt: string;
  owner?: MessageOwner;
  messageData?: MessageData | MessageData[];
  /** Persisted stream sequence of this row's last chunk (the backend's `lastChunkStreamSeq`). Passed through to the
   *  message's `metadata.streamSeq` so `mergeHistoryWithRealtime` can decide coverage per-role (a synthetic is covered
   *  only by a persisted row of its OWN role reaching its seq). Optional: absent for rows the backend doesn't stamp (e.g.
   *  user MESSAGE_REQUEST rows), which then don't participate in seq coverage. */
  lastChunkStreamSeq?: number | null;
}
