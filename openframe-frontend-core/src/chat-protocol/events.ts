/**
 * Normalized chat stream events — the transport-agnostic event union BOTH
 * decoders (SSE byte framing in `./decode.ts`, NATS chunks in
 * `./nats-decoder.ts`) emit. Phase 3 of the chat unification makes the
 * reducer consume these directly; today the SSE adapter maps them back to
 * legacy `MessageSegment` yields.
 *
 * Server-safe: no React, no browser APIs.
 */

// The ask card's option shape is the SEGMENT's shape — the decoder hands the
// rows straight to the accumulator, so restating them here would be two
// declarations of one wire contract. Type-only import from a React-free
// module; `nats-decoder.ts` already depends on the same file for MESSAGE_TYPE.
import type { AskOptionData } from '../components/chat/types/message.types';
// The wire-frame shapes these events carry through are defined ONCE in
// `./frames.ts` — reuse them here rather than restating their fields.
import type { ApprovalRequestField, DecisionResolvedFrame, UsageTelemetry } from './frames';

/** Optional envelope on every event. `seq` carries the transport's
 *  stream sequence (JetStream `streamSeq` on NATS; unused on SSE). */
interface ChatStreamEventBase {
  seq?: number;
}

/** Stream entered answer-text mode (SSE: the `\x1E` sentinel or the
 *  JSON-parse-failure fallback; NATS: MESSAGE_START).
 *  `implicit` is true ONLY for the SSE fallback path where a
 *  non-JSON leading buffer flips straight into text mode — consumers
 *  that flush coalesced thinking on turn-start must SKIP the flush for
 *  implicit starts (legacy adapter parity: the fallback path never
 *  flushed pending thinking before the text). */
export interface TurnStartEvent extends ChatStreamEventBase {
  type: 'turn-start';
  implicit?: boolean;
}

export interface TurnEndEvent extends ChatStreamEventBase {
  type: 'turn-end';
}

/** Answer text delta. `leading: true` marks SSE `text-leading` frames
 *  (model preamble prose emitted BEFORE the tool approval card). */
export interface TextDeltaEvent extends ChatStreamEventBase {
  type: 'text-delta';
  text: string;
  leading?: boolean;
}

/** Thinking delta — APPEND-ONLY contract: each event carries the next
 *  verbatim slice; consumers accumulate. Decoders never diff. */
export interface ThinkingDeltaEvent extends ChatStreamEventBase {
  type: 'thinking-delta';
  text: string;
}

/** Clarification card (NATS `ASK` chunk) — the assistant asking which reading
 *  of an ambiguous question to answer. NOT a delta: the chunk carries the
 *  finished card, so consumers push it whole instead of coalescing. `text` is
 *  the intro sentence the same chunk rides along with; consumers render it as
 *  ordinary answer text BEFORE the card. NATS-only — the SSE frame grammar has
 *  no ask frame — but it lives in the shared union because the reducer is
 *  transport-agnostic. */
export interface AskEvent extends ChatStreamEventBase {
  type: 'ask';
  text?: string;
  question: string;
  options: AskOptionData[];
}

export interface StatusEvent extends ChatStreamEventBase {
  type: 'status';
  phase: 'thinking';
}

/** NATS tool execution progress (EXECUTING_TOOL / EXECUTED_TOOL). */
export interface ToolExecutionEvent extends ChatStreamEventBase {
  type: 'tool-execution';
  data: {
    type: 'EXECUTING_TOOL' | 'EXECUTED_TOOL';
    integratedToolType: string;
    toolFunction: string;
    toolTitle?: string;
    /**
     * Human-readable "why this tool is running" line, rendered as the body of
     * the tool card. Carried by the EXECUTING chunk ONLY — the EXECUTED one
     * never repeats it, and the accumulator's merge keeps whatever the
     * EXECUTING segment held (`toolData.toolExplanation ?? existing`). Omitting
     * it from this contract blanks the card for the whole run, live and on
     * replay, which is exactly what happened while it was missing here.
     */
    toolExplanation?: string;
    parameters?: Record<string, unknown>;
    result?: string;
    success?: boolean;
    toolExecutionRequestId?: string;
  };
}

/** Single tool call inside a batch approval request (NATS). */
export interface ApprovalToolCall {
  toolExecutionRequestId: string;
  toolName: string;
  toolTitle?: string;
  toolExplanation?: string;
  toolType?: string;
  requiresApproval: boolean;
  approvalType?: string | null;
  toolCallArguments?: Record<string, unknown> | null;
}

/** A tool call awaits user approval. SSE fills `command`/`fields`
 *  (card-ready payload); NATS fills `command`/`explanation` or
 *  `toolCalls` (batch form). */
export interface ApprovalRequestEvent extends ChatStreamEventBase {
  type: 'approval-request';
  requestId: string;
  /** SSE: the write tool's name. NATS: approval tier (USER/ADMIN/…). */
  approvalType?: string;
  command?: string;
  explanation?: string;
  fields?: ApprovalRequestField[];
  toolCalls?: ApprovalToolCall[];
  status?: 'pending';
}

/** An approval request was resolved (SSE `decision_resolved` frame /
 *  NATS APPROVAL_RESULT chunk). */
export interface ApprovalResolvedEvent extends ChatStreamEventBase {
  type: 'approval-resolved';
  requestId?: string;
  status: 'approved' | 'rejected';
  ok?: boolean;
  toolName?: string;
  approvalType?: string;
  resolvedByName?: string | null;
  receiptText?: string;
  result?: DecisionResolvedFrame['result'];
  willAutoContinue?: boolean;
}

/** The client is offered a handoff of this ticket to a human technician
 *  (NATS `ESCALATION_OFFER` chunk in state PENDING). Distinct from
 *  `approval-request`: it resolves through the ticket-escalation mutations,
 *  never the tool-approval flow, and it is raised by four different origins
 *  (Fae's own tool call, the client's header button, a deterministic
 *  trigger, or a deferred surfacing at turn end) that all render alike. */
export interface EscalationOfferEvent extends ChatStreamEventBase {
  type: 'escalation-offer';
  offerId: string;
  text: string;
  origin?: string;
}

/** Wire vocabulary of `EscalationOfferData.state`. */
export const ESCALATION_STATE = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

/** Terminal wire state → the shared `ChatApprovalStatus` vocabulary; `null`
 *  for PENDING or anything unrecognized. Shared by BOTH decoders (live
 *  chunks and persisted rows) so a state can never mean two things. */
export function escalationResolvedStatus(state: unknown): EscalationOfferResolvedEvent['status'] | null {
  switch (state) {
    case ESCALATION_STATE.APPROVED:
      return 'approved';
    case ESCALATION_STATE.DECLINED:
      return 'rejected';
    case ESCALATION_STATE.SUPERSEDED:
      return 'cancelled';
    default:
      return null;
  }
}

/** An escalation offer reached a terminal state. The wire's SUPERSEDED
 *  (the client typed over a pending offer) maps onto `cancelled` so the
 *  whole stack keeps ONE status vocabulary (`ChatApprovalStatus`). The
 *  resolved chunk carries no text — consumers flip the existing block. */
export interface EscalationOfferResolvedEvent extends ChatStreamEventBase {
  type: 'escalation-offer-resolved';
  offerId: string;
  status: 'approved' | 'rejected' | 'cancelled';
  resolvedByName?: string | null;
}

/** The conversation was handed off to a human technician (`TICKET_ESCALATED`).
 *  A first-class block rather than something inferred from an offer's state,
 *  so paths that raise no offer at all — the inactivity auto-escalation — still
 *  produce a receipt. `text` is nullable on the wire; consumers supply the
 *  fallback copy. */
export interface TicketEscalatedEvent extends ChatStreamEventBase {
  type: 'ticket-escalated';
  ticketId: string;
  ticketNumber?: number;
  reason: string;
  text?: string;
}

/** Ticket lifecycle receipt (`TICKET_EVENT`) — the ticket was resolved,
 *  reopened, etc. `kind` is an OPEN vocabulary (RESOLVED/REOPENED today):
 *  an unknown kind still decodes and renders as a neutral line rather than
 *  being dropped, so the backend can add kinds without a client release.
 *  Arrives standalone (outside MESSAGE_START/END), like `ticket-escalated`. */
export interface TicketEventEvent extends ChatStreamEventBase {
  type: 'ticket-event';
  kind: string;
  actorId?: string;
  actorName?: string;
  /** Who acted — e.g. an AI agent vs a human technician. Open string. */
  actorType?: string;
  reason?: string;
  /** Kind-token the ticket reopened INTO (AI_ASSISTANCE / TECH_REQUIRED / ...). */
  targetStatusKind?: string;
}

/** Per-turn metadata. Raw wire values pass through UNVALIDATED — the
 *  consumer replicates the legacy truthiness/typeof gates (so a
 *  malformed frame degrades identically to the pre-SSOT parser). */
export interface ChatMetadataEvent extends ChatStreamEventBase {
  type: 'metadata';
  provider?: string | null;
  modelLabel?: string | null;
  /** Raw model id (SSE `meta.model`; NATS `modelName`). */
  modelName?: string | null;
  contextWindowMaxTokens?: number | null;
  sources?: unknown;
  scrollAnchor?: unknown;
  /** Server-minted conversation id (`ChatMetadataFrame.conversationId`),
   *  passed through raw like every other catch-all field — the consumer
   *  applies the `typeof === 'string' && truthy` gate. */
  conversationId?: string | null;
  routing?: {
    routedComplexity: string;
    routedModel?: string;
    routedThinkingBudget: number | null;
  };
}

/** SSE usage frames — raw wire keys (snake_case) preserved. */
export interface UsageEvent extends ChatStreamEventBase {
  type: 'usage';
  stage: 'start' | 'end';
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  hit_rate_pct?: number;
  telemetry?: UsageTelemetry;
  /** Left OPAQUE on purpose: the consumer (`chat-stream-reducer`'s
   *  `applySseUsage`) re-validates every nested field with the legacy
   *  truthiness/typeof gates, so a malformed frame degrades identically
   *  to the pre-SSOT parser. Typing it would imply guarantees the wire
   *  does not make. */
  breakdown?: unknown;
  debug?: unknown;
}

/** NATS TOKEN_USAGE chunk (camelCase backend shape). */
export interface TokenUsageEvent extends ChatStreamEventBase {
  type: 'token-usage';
  inputTokensSize: number;
  outputTokensSize: number;
  totalTokensSize: number;
  contextSize: number;
}

export interface CompactionEvent extends ChatStreamEventBase {
  type: 'compaction';
  phase: 'start' | 'end';
  summary?: string;
}

export interface ErrorEvent extends ChatStreamEventBase {
  type: 'error';
  title: string;
  details?: string;
}

/**
 * Decode {@link ErrorEvent.details} into the sub-line an error card renders.
 *
 * `details` is EITHER a JSON envelope (`{ error: { message } }`) or an already-
 * human string, and both the live reducer and the history replay have to agree
 * on which — a card that reads one way live and another on refresh is the whole
 * class of bug this module's shared decoders exist to prevent. Lives here,
 * beside the event it decodes, because it is the wire contract, not a rendering
 * choice.
 *
 * Gates:
 *   - not JSON            → the raw string (it was already human-readable)
 *   - JSON, string message → that message
 *   - JSON, anything else  → `undefined`, so the card shows its title alone
 *
 * That last gate is the fix for a real defect: the message was previously
 * copied out of the envelope UNCHECKED, so a server that nested an object
 * under `error.message` put that object into a `string` field and the card
 * rendered the literal text "[object Object]" under the title. Valid JSON that
 * simply lacks `error.message` still yields `undefined` (unchanged) rather than
 * dumping the raw envelope at the user.
 */
export function errorDetailsMessage(details: string | undefined): string | undefined {
  if (!details) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(details);
  } catch {
    return details;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const error: unknown = (parsed as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return undefined;
  const message: unknown = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

/** Non-assistant message on the stream (NATS): the user's own message
 *  echo (`message-request`), an operator direct message, or a system
 *  line. */
/**
 * Dialog participant owner type. The two members below are the ones clients
 * BRANCH ON (admin-vs-not decides echo dedup and author styling); the union
 * stays open (`string & {}`) because the wire may carry other roles that the
 * client treats as "not admin". Always compare against `CHAT_OWNER_ADMIN`,
 * never a bare `'ADMIN'` literal — a typo in a literal silently disables
 * dedup instead of failing to compile.
 */
export type ChatOwnerType = 'ADMIN' | 'CLIENT' | (string & {});

/** Canonical ADMIN owner-type token (see `ChatOwnerType`). */
export const CHAT_OWNER_ADMIN = 'ADMIN';

export interface ParticipantEvent extends ChatStreamEventBase {
  type: 'participant';
  kind: 'message-request' | 'direct-message' | 'system';
  text: string;
  ownerType?: ChatOwnerType;
  displayName?: string;
  userId?: string;
  contextItems?: Array<{ type: string; id: string; label: string }>;
}

export interface DialogClosedEvent extends ChatStreamEventBase {
  type: 'dialog-closed';
}

export type ChatStreamEvent =
  | TurnStartEvent
  | TurnEndEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | AskEvent
  | StatusEvent
  | ToolExecutionEvent
  | ApprovalRequestEvent
  | ApprovalResolvedEvent
  | EscalationOfferEvent
  | EscalationOfferResolvedEvent
  | TicketEscalatedEvent
  | TicketEventEvent
  | ChatMetadataEvent
  | UsageEvent
  | TokenUsageEvent
  | CompactionEvent
  | ErrorEvent
  | ParticipantEvent
  | DialogClosedEvent;
