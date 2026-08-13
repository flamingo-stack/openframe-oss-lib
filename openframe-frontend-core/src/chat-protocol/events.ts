/**
 * Normalized chat stream events — the transport-agnostic event union BOTH
 * decoders (SSE byte framing in `./decode.ts`, NATS chunks in
 * `./nats-decoder.ts`) emit. Phase 3 of the chat unification makes the
 * reducer consume these directly; today the SSE adapter maps them back to
 * legacy `MessageSegment` yields.
 *
 * Server-safe: no React, no browser APIs.
 */

// The wire-frame shapes these events carry through are defined ONCE in
// `./frames.ts` — reuse them here rather than restating their fields.
import type {
  ApprovalRequestField,
  DecisionResolvedFrame,
  UsageTelemetry,
} from './frames'
// The ask card's option shape is the SEGMENT's shape — the decoder hands the
// rows straight to the accumulator, so restating them here would be two
// declarations of one wire contract. Type-only import from a React-free
// module; `nats-decoder.ts` already depends on the same file for MESSAGE_TYPE.
import type { AskOptionData } from '../components/chat/types/message.types'

/** Optional envelope on every event. `seq` carries the transport's
 *  stream sequence (JetStream `streamSeq` on NATS; unused on SSE). */
interface ChatStreamEventBase {
  seq?: number
}

/** Stream entered answer-text mode (SSE: the `\x1E` sentinel or the
 *  JSON-parse-failure fallback; NATS: MESSAGE_START).
 *  `implicit` is true ONLY for the SSE fallback path where a
 *  non-JSON leading buffer flips straight into text mode — consumers
 *  that flush coalesced thinking on turn-start must SKIP the flush for
 *  implicit starts (legacy adapter parity: the fallback path never
 *  flushed pending thinking before the text). */
export interface TurnStartEvent extends ChatStreamEventBase {
  type: 'turn-start'
  implicit?: boolean
}

export interface TurnEndEvent extends ChatStreamEventBase {
  type: 'turn-end'
}

/** Answer text delta. `leading: true` marks SSE `text-leading` frames
 *  (model preamble prose emitted BEFORE the tool approval card). */
export interface TextDeltaEvent extends ChatStreamEventBase {
  type: 'text-delta'
  text: string
  leading?: boolean
}

/** Thinking delta — APPEND-ONLY contract: each event carries the next
 *  verbatim slice; consumers accumulate. Decoders never diff. */
export interface ThinkingDeltaEvent extends ChatStreamEventBase {
  type: 'thinking-delta'
  text: string
}

/** Guide-body delta (NATS `GUIDE` chunk) — the assistant's how-to /
 *  documentation answer, rendered as a titled "OpenFrame Guide" card rather
 *  than bare prose. Same APPEND-ONLY contract as `text-delta` /
 *  `thinking-delta`: each event carries the next verbatim slice and consumers
 *  coalesce into the trailing `guide` segment. NATS-only today — the SSE
 *  frame grammar has no guide frame — but it lives in the shared union
 *  because the reducer is transport-agnostic. */
export interface GuideDeltaEvent extends ChatStreamEventBase {
  type: 'guide-delta'
  text: string
}

/** Clarification card (NATS `ASK` chunk) — the assistant asking which reading
 *  of an ambiguous question to answer. NOT a delta: the chunk carries the
 *  finished card, so consumers push it whole instead of coalescing. `text` is
 *  the intro sentence the same chunk rides along with; consumers render it as
 *  ordinary answer text BEFORE the card. NATS-only — the SSE frame grammar has
 *  no ask frame — but it lives in the shared union because the reducer is
 *  transport-agnostic. */
export interface AskEvent extends ChatStreamEventBase {
  type: 'ask'
  text?: string
  question: string
  options: AskOptionData[]
}

export interface StatusEvent extends ChatStreamEventBase {
  type: 'status'
  phase: 'thinking'
}

/** NATS tool execution progress (EXECUTING_TOOL / EXECUTED_TOOL). */
export interface ToolExecutionEvent extends ChatStreamEventBase {
  type: 'tool-execution'
  data: {
    type: 'EXECUTING_TOOL' | 'EXECUTED_TOOL'
    integratedToolType: string
    toolFunction: string
    toolTitle?: string
    /**
     * Human-readable "why this tool is running" line, rendered as the body of
     * the tool card. Carried by the EXECUTING chunk ONLY — the EXECUTED one
     * never repeats it, and the accumulator's merge keeps whatever the
     * EXECUTING segment held (`toolData.toolExplanation ?? existing`). Omitting
     * it from this contract blanks the card for the whole run, live and on
     * replay, which is exactly what happened while it was missing here.
     */
    toolExplanation?: string
    parameters?: Record<string, unknown>
    result?: string
    success?: boolean
    toolExecutionRequestId?: string
  }
}

/** Single tool call inside a batch approval request (NATS). */
export interface ApprovalToolCall {
  toolExecutionRequestId: string
  toolName: string
  toolTitle?: string
  toolExplanation?: string
  toolType?: string
  requiresApproval: boolean
  approvalType?: string | null
  toolCallArguments?: Record<string, unknown> | null
}

/** A tool call awaits user approval. SSE fills `command`/`fields`
 *  (card-ready payload); NATS fills `command`/`explanation` or
 *  `toolCalls` (batch form). */
export interface ApprovalRequestEvent extends ChatStreamEventBase {
  type: 'approval-request'
  requestId: string
  /** SSE: the write tool's name. NATS: approval tier (USER/ADMIN/…). */
  approvalType?: string
  command?: string
  explanation?: string
  fields?: ApprovalRequestField[]
  toolCalls?: ApprovalToolCall[]
  status?: 'pending'
  /** Set when the card came from a Product Guide frame — see {@link GuideOrigin}. */
  origin?: GuideOrigin
}

/**
 * Marks an event whose payload is a Product Guide frame, whatever transport
 * carried it. It exists because ONE stream can now mix both worlds: the agent
 * re-streams the hub's frames into a NATS dialog, so a card typed the hub's way
 * (`approvalType` = the tool name, resolved through the hub's confirm route)
 * travels beside cards typed the agent's way (`approvalType` = an approval TIER
 * routed to human escalation).
 *
 * Consumers read it to keep the guide half behaving exactly as it does in the
 * hub's own chat — NOT to give it special treatment. Without it the NATS kernel
 * would have to guess from `approvalType`, and every tool the hub adds would
 * silently fall into the escalation path.
 */
export type GuideOrigin = 'guide'

/** The only value of {@link GuideOrigin}. Lives beside the type, and beside the
 *  predicate below, because both decoders and every consumer that branches on
 *  provenance must compare against the same token — a bare `'guide'` literal
 *  typo silently disables the branch instead of failing to compile. */
export const GUIDE_ORIGIN: GuideOrigin = 'guide'

/** True for anything stamped as coming from the Product Guide — a stream event
 *  or the `data` of a segment built from one. */
export function isGuideOrigin(
  source: { origin?: GuideOrigin | string } | null | undefined,
): boolean {
  return source?.origin === GUIDE_ORIGIN
}

/** An approval request was resolved (SSE `decision_resolved` frame /
 *  NATS APPROVAL_RESULT chunk). */
export interface ApprovalResolvedEvent extends ChatStreamEventBase {
  type: 'approval-resolved'
  requestId?: string
  status: 'approved' | 'rejected'
  ok?: boolean
  toolName?: string
  approvalType?: string
  resolvedByName?: string | null
  receiptText?: string
  result?: DecisionResolvedFrame['result']
  willAutoContinue?: boolean
  /** Set when the resolution came from a Product Guide frame — see {@link GuideOrigin}. */
  origin?: GuideOrigin
}

/** The client is offered a handoff of this ticket to a human technician
 *  (NATS `ESCALATION_OFFER` chunk in state PENDING). Distinct from
 *  `approval-request`: it resolves through the ticket-escalation mutations,
 *  never the tool-approval flow, and it is raised by four different origins
 *  (Fae's own tool call, the client's header button, a deterministic
 *  trigger, or a deferred surfacing at turn end) that all render alike. */
export interface EscalationOfferEvent extends ChatStreamEventBase {
  type: 'escalation-offer'
  offerId: string
  text: string
  origin?: string
}

/** Wire vocabulary of `EscalationOfferData.state`. */
export const ESCALATION_STATE = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DECLINED: 'DECLINED',
  SUPERSEDED: 'SUPERSEDED',
} as const

/** Terminal wire state → the shared `ChatApprovalStatus` vocabulary; `null`
 *  for PENDING or anything unrecognized. Shared by BOTH decoders (live
 *  chunks and persisted rows) so a state can never mean two things. */
export function escalationResolvedStatus(
  state: unknown,
): EscalationOfferResolvedEvent['status'] | null {
  switch (state) {
    case ESCALATION_STATE.APPROVED:
      return 'approved'
    case ESCALATION_STATE.DECLINED:
      return 'rejected'
    case ESCALATION_STATE.SUPERSEDED:
      return 'cancelled'
    default:
      return null
  }
}

/** An escalation offer reached a terminal state. The wire's SUPERSEDED
 *  (the client typed over a pending offer) maps onto `cancelled` so the
 *  whole stack keeps ONE status vocabulary (`ChatApprovalStatus`). The
 *  resolved chunk carries no text — consumers flip the existing block. */
export interface EscalationOfferResolvedEvent extends ChatStreamEventBase {
  type: 'escalation-offer-resolved'
  offerId: string
  status: 'approved' | 'rejected' | 'cancelled'
  resolvedByName?: string | null
}

/** The conversation was handed off to a human technician (`TICKET_ESCALATED`).
 *  A first-class block rather than something inferred from an offer's state,
 *  so paths that raise no offer at all — the inactivity auto-escalation — still
 *  produce a receipt. `text` is nullable on the wire; consumers supply the
 *  fallback copy. */
export interface TicketEscalatedEvent extends ChatStreamEventBase {
  type: 'ticket-escalated'
  ticketId: string
  ticketNumber?: number
  reason: string
  text?: string
}

/** Per-turn metadata. Raw wire values pass through UNVALIDATED — the
 *  consumer replicates the legacy truthiness/typeof gates (so a
 *  malformed frame degrades identically to the pre-SSOT parser). */
export interface ChatMetadataEvent extends ChatStreamEventBase {
  type: 'metadata'
  provider?: string | null
  modelLabel?: string | null
  /** Raw model id (SSE `meta.model`; NATS `modelName`). */
  modelName?: string | null
  contextWindowMaxTokens?: number | null
  sources?: unknown
  scrollAnchor?: unknown
  /** Server-minted conversation id (`ChatMetadataFrame.conversationId`),
   *  passed through raw like every other catch-all field — the consumer
   *  applies the `typeof === 'string' && truthy` gate. */
  conversationId?: string | null
  routing?: {
    routedComplexity: string
    routedModel?: string
    routedThinkingBudget: number | null
  }
  /**
   * Set when the metadata came from a Product Guide frame — see
   * {@link GuideOrigin}. Such an event carries ONLY `conversationId`: it exists
   * to record the hub's conversation id (every confirm-tool call must quote it
   * back), NOT to describe the dialog's model, which stays the agent's.
   */
  origin?: GuideOrigin
}

/** SSE usage frames — raw wire keys (snake_case) preserved. */
export interface UsageEvent extends ChatStreamEventBase {
  type: 'usage'
  stage: 'start' | 'end'
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  hit_rate_pct?: number
  telemetry?: UsageTelemetry
  /** Left OPAQUE on purpose: the consumer (`chat-stream-reducer`'s
   *  `applySseUsage`) re-validates every nested field with the legacy
   *  truthiness/typeof gates, so a malformed frame degrades identically
   *  to the pre-SSOT parser. Typing it would imply guarantees the wire
   *  does not make. */
  breakdown?: unknown
  debug?: unknown
}

/** NATS TOKEN_USAGE chunk (camelCase backend shape). */
export interface TokenUsageEvent extends ChatStreamEventBase {
  type: 'token-usage'
  inputTokensSize: number
  outputTokensSize: number
  totalTokensSize: number
  contextSize: number
}

export interface CompactionEvent extends ChatStreamEventBase {
  type: 'compaction'
  phase: 'start' | 'end'
  summary?: string
}

export interface ErrorEvent extends ChatStreamEventBase {
  type: 'error'
  title: string
  details?: string
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
export type ChatOwnerType = 'ADMIN' | 'CLIENT' | (string & {})

/** Canonical ADMIN owner-type token (see `ChatOwnerType`). */
export const CHAT_OWNER_ADMIN = 'ADMIN'

export interface ParticipantEvent extends ChatStreamEventBase {
  type: 'participant'
  kind: 'message-request' | 'direct-message' | 'system'
  text: string
  ownerType?: ChatOwnerType
  displayName?: string
  userId?: string
  contextItems?: Array<{ type: string; id: string; label: string }>
}

export interface DialogClosedEvent extends ChatStreamEventBase {
  type: 'dialog-closed'
}

export type ChatStreamEvent =
  | TurnStartEvent
  | TurnEndEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | GuideDeltaEvent
  | AskEvent
  | StatusEvent
  | ToolExecutionEvent
  | ApprovalRequestEvent
  | ApprovalResolvedEvent
  | EscalationOfferEvent
  | EscalationOfferResolvedEvent
  | TicketEscalatedEvent
  | ChatMetadataEvent
  | UsageEvent
  | TokenUsageEvent
  | CompactionEvent
  | ErrorEvent
  | ParticipantEvent
  | DialogClosedEvent
