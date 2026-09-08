/**
 * Message-related types
 * Contains all message structures, segments, and content types
 */

import type { AssistantType, AuthorType, ChatApprovalStatus, MessageOwner } from './chat.types';

// ========== Message Type Definitions ==========

export const MESSAGE_TYPE = {
  TEXT: 'TEXT',
  THINKING: 'THINKING',
  ASK: 'ASK',
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

/** Per-message viewport-positioning hint sent on the per-turn metadata
 *  leading frame at the START of every assistant response. The chat
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
   * the accumulator restores it onto the merged `EXECUTED_TOOL` segment.
   */
  toolExplanation?: string;
  parameters?: Record<string, unknown>;
  result?: string;
  success?: boolean;
  /**
   * Backend-issued id (matches `PendingToolCallData.toolExecutionRequestId`).
   * When present, lets the accumulator merge this execution event into the
   * matching approval batch row instead of emitting a standalone segment.
   */
  toolExecutionRequestId?: string;
}

/**
 * Snapshot of an in-flight tool kept between the `EXECUTING_TOOL` and
 * `EXECUTED_TOOL` events. The backend only sends `toolTitle` on
 * `EXECUTING_TOOL`; carrying this state lets the accumulator restore it onto
 * the merged `EXECUTED_TOOL` segment instead of falling back to the raw
 * `toolFunction`.
 */
export interface ExecutingToolState {
  integratedToolType: string;
  toolFunction: string;
  /** Mirrors {@link ToolExecutionData.toolTitle}; absent on `EXECUTED_TOOL`. */
  toolTitle?: string;
  /** Mirrors {@link ToolExecutionData.toolExplanation}; absent on `EXECUTED_TOOL`. */
  toolExplanation?: string;
  parameters?: Record<string, unknown>;
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
  icon?: ReactNode;
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

/** Approve/reject handler stamped onto approval segments. MAY resolve a
 *  boolean success flag — `false` means the confirm FAILED (expired
 *  proposal, network error); batch approve-all loops use it to tick the
 *  row's failure cross. `void` (legacy transports) is treated as
 *  success. Single source of truth for this signature — component
 *  props, accumulator callbacks, and adapters all reference it. */
export type ApprovalResolutionHandler = (requestId?: string) => void | boolean | Promise<void | boolean>;

// ========== Message Segment Types ==========

export type TextSegment = {
  type: 'text';
  text: string;
};

export type ThinkingSegment = {
  type: 'thinking';
  text: string;
};

/** One reading the assistant offers in an `ask` card. `label` is BOTH the row's
 *  headline and the exact text sent back when the row is picked — the backend's
 *  guide classifier resolves the user's next message against the labels it
 *  offered, so the reply must be the label verbatim. `description` is a short
 *  clarifying line rendered under it. */
export type AskOptionData = {
  label: string;
  description?: string;
};

/** Clarification card — the assistant asking WHICH reading of an ambiguous
 *  question it should answer, rendered as a heading plus a list of clickable
 *  options instead of prose bullets. NATS-only (the `ASK` chunk); the intro
 *  sentence riding the same chunk becomes an ordinary `text` segment in front
 *  of the card, so it goes through the normal markdown body pipeline. Unlike
 *  the three delta streams an ask arrives whole — it is never coalesced. */
export type AskSegment = {
  type: 'ask';
  question: string;
  options: AskOptionData[];
};

export type ToolExecutionSegment = {
  type: 'tool_execution';
  data: ToolExecutionData;
};

export type ApprovalRequestSegment = {
  type: 'approval_request';
  data: ApprovalRequestData & { approvalType?: string };
  status?: ChatApprovalStatus;
  /** Display name of the user who resolved the request; baked into the client
   *  variant's full-text status pill ("Approved by {name}"). */
  resolvedByName?: string | null;
  onApprove?: ApprovalResolutionHandler;
  onReject?: ApprovalResolutionHandler;
};

export type ApprovalBatchSegment = {
  type: 'approval_batch';
  data: ApprovalBatchData;
  status?: ChatApprovalStatus;
  /** Display name of the user who resolved the request; set when the batch is resolved (null/absent for system actions). */
  resolvedByName?: string | null;
  onApprove?: ApprovalResolutionHandler;
  onReject?: ApprovalResolutionHandler;
};

/**
 * Ticket-escalation offer block. Visually the client approval card (same
 * Figma component), but a SEPARATE segment type on purpose: it resolves
 * through the ticket-escalation GraphQL mutations rather than the tool
 * approval endpoint, and hosts that hide pending tool approvals from the
 * thread must still render this one inline.
 *
 * `cancelled` is the wire's SUPERSEDED — the client typed over the offer.
 */
export type EscalationOfferSegment = {
  type: 'escalation_offer';
  data: EscalationOfferData;
  status?: ChatApprovalStatus;
  resolvedByName?: string | null;
  onApprove?: ApprovalResolutionHandler;
  onReject?: ApprovalResolutionHandler;
};

/**
 * The conversation was handed off to a human technician. Decoded from the
 * `TICKET_ESCALATED` block, so it appears for every escalation path the
 * backend emits it for — including the inactivity auto-escalation, which
 * raises no offer and therefore has no offer state to infer from.
 */
export type TicketEscalatedSegment = {
  type: 'ticket_escalated';
  data: TicketEscalatedData;
};

/**
 * Ticket lifecycle receipt (resolved / reopened / an unknown future kind).
 * Arrives as a standalone `TICKET_EVENT` chunk outside MESSAGE_START/END —
 * same delivery shape as `ticket_escalated`.
 *
 * `streamSeq` is the chunk's JetStream sequence, kept ON the segment because
 * it is the event's only stable identity: the accumulator upserts on it so a
 * redelivered chunk (catch-up over hydrated history) replaces rather than
 * stacks a second card, while two genuinely distinct events of the same kind
 * (resolve → reopen → resolve) keep distinct sequences and both render.
 */
export type TicketEventSegment = {
  type: 'ticket_event';
  data: TicketEventData;
  streamSeq?: number;
  /** When THIS event happened (history: the persisted row's `createdAt`;
   *  live: chunk arrival). Kept beside `streamSeq`, not in `data`: the
   *  upsert's payload-equality fallback must keep matching a redelivered
   *  chunk to its hydrated twin, and their times come from different clocks.
   *  Without it the card inherits the surrounding assistant bubble's
   *  timestamp — the FIRST row of the whole turn, so every lifecycle card
   *  reads the same stale time. */
  occurredAt?: Date;
};

export type ErrorSegment = {
  type: 'error';
  title: string;
  details?: string;
};

export type ContextCompactionSegment = {
  type: 'context_compaction';
  status: 'started' | 'completed';
  summary?: string;
};

export type MessageSegment =
  | TextSegment
  | ThinkingSegment
  | AskSegment
  | ToolExecutionSegment
  | ApprovalRequestSegment
  | ApprovalBatchSegment
  | EscalationOfferSegment
  | TicketEscalatedSegment
  | TicketEventSegment
  | ErrorSegment
  | ContextCompactionSegment;

export type MessageContent = string | MessageSegment[];

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

/** Persisted `ASK` row (GraphQL `AskData`). `text` is the intro sentence, which
 *  history replays as a text segment ahead of the card — same split the live
 *  `ASK` chunk carries. */
export interface AskMessageData extends MessageDataBase {
  type: 'ASK';
  text?: string;
  question?: string;
  /** WIRE shape — `label` is optional here because the backend can (and does)
   *  ship label-less rows; `normalizeAskOptions` drops them, which is what
   *  turns this into the card's `AskOptionData[]`. */
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

/** Persisted ticket lifecycle row — same field names as the live chunk
 *  (see `TicketEventData`), decoded by the SAME mapper on replay. Fields are
 *  wire-shaped (`| null`): every one is a nullable GraphQL scalar. */
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
 * Human-technician takeover row. A REALTIME-only concept: the history
 * processors have no branch for it, so a persisted `DIRECT_MESSAGE` row
 * contributes nothing on reload (pinned by the golden characterization test).
 * Declared here so the wire shape is nameable without `any`.
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
  /** Persisted stream sequence of this row's last chunk (the backend's
   *  `lastChunkStreamSeq`). Passed through to the processed message's
   *  `streamSeq` so `mergeHistoryWithRealtime` can decide coverage per-role
   *  (a synthetic is covered only by a persisted row of its OWN role reaching
   *  its seq). Optional — absent for rows the backend doesn't stamp (e.g. user
   *  MESSAGE_REQUEST rows), which then don't participate in seq coverage. */
  lastChunkStreamSeq?: number | null;
}

// ========== Processed Message Types ==========

export interface ProcessedMessage {
  id: string;
  role: 'user' | 'assistant' | 'error'; // Limited to display roles
  content: MessageContent;
  name?: string;
  assistantType?: AssistantType;
  authorType?: AuthorType;
  timestamp: Date;
  avatar?: string;
  /** Persisted last-chunk stream sequence carried through from
   *  `HistoricalMessage.lastChunkStreamSeq` (for assistant turns: the MAX
   *  across the grouped rows). Hosts stamp it onto the rendered message's
   *  `streamSeq` so the history/realtime merge can do per-role seq coverage.
   *  Absent when the source row(s) carried no seq. */
  streamSeq?: number;
}

// ========== Base Message Interface ==========

import type { ReactNode } from 'react';
import type { ChatContextItem } from './context-item.types';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error'; // Limited to display roles
  content: MessageContent;
  name?: string;
  assistantType?: AssistantType;
  authorType?: AuthorType;
  timestamp?: Date;
  avatar?: string | null;
  /** Highest CONTENT chunk streamSeq that composed this message. Stamped on
   *  realtime synthetics so `mergeHistoryWithRealtime` can decide history
   *  coverage per-message (see `MergeableChatMessage.streamSeq`). */
  streamSeq?: number;
  /** Entity-context items attached to this (user) message via the composer's
   *  context picker. When present the message bubble renders the context
   *  chips beneath its text (Figma node 31:28709). Optional — omitted for
   *  assistant messages and turns sent without context. */
  contextItems?: ChatContextItem[];
  /** Per-message viewport-positioning hint. OPTIONAL — when omitted (the
   *  default for every LLM Q&A / browse / search / find / Discuss path)
   *  the chat tails as today via `use-stick-to-bottom`. Only `'top'` opts
   *  in to the alternative top-anchor behaviour (display-action answers
   *  whose body is a long article). The server is the sole decision-
   *  maker — set on the metadata leading frame. */
  scrollAnchor?: ScrollAnchor;
  /** When true the message is part of the API conversation history (sent
   *  to the LLM so it has context) but is NOT rendered in the chat UI.
   *
   *  Used for "synthetic continuation" turns: when the user clicks Approve
   *  on a tool proposal, the host auto-fires a follow-up `sendMessage`
   *  with `hidden: true` carrying a directive like "the user just
   *  approved <tool>; ask follow-up questions per protocol". The LLM's
   *  response IS rendered (as a normal assistant message); only the
   *  trigger prompt is suppressed so the chat reads naturally:
   *
   *    user: "open a ticket"
   *    assistant: preamble + approval card
   *    [user clicks Approve]
   *    assistant: "Now to triage faster, can you share..."   ← auto-fires
   *
   *  Without this flag the trigger prompt would surface as a confusing
   *  bubble like "(continue per protocol)" between the approval card
   *  and the AI's follow-up. */
  hidden?: boolean;
}
