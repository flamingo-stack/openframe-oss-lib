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
  /** Inline post-approve card: the ref payload + its documentType +
   *  the `[card://…]` marker (SSE only). */
  cardRef?: unknown
  cardType?: string
  marker?: string
  result?: DecisionResolvedFrame['result']
  willAutoContinue?: boolean
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
  refs?: unknown
  scrollAnchor?: unknown
  routing?: {
    routedComplexity: string
    routedModel?: string
    routedThinkingBudget: number | null
  }
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
export interface ParticipantEvent extends ChatStreamEventBase {
  type: 'participant'
  kind: 'message-request' | 'direct-message' | 'system'
  text: string
  ownerType?: string
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
  | StatusEvent
  | ToolExecutionEvent
  | ApprovalRequestEvent
  | ApprovalResolvedEvent
  | ChatMetadataEvent
  | UsageEvent
  | TokenUsageEvent
  | CompactionEvent
  | ErrorEvent
  | ParticipantEvent
  | DialogClosedEvent
