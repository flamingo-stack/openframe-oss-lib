/**
 * SSE wire-protocol frame shapes — the byte-level contract between the
 * hub's chat stream emitter (`multi-platform-hub/lib/utils/claude-util.ts`)
 * and the lib's SSE decoder (`./decode.ts`).
 *
 * Wire format (custom byte framing, NOT standard SSE `data:` lines):
 *
 *   [JSON frame]\0 [JSON frame]\0 …  \x1E  <raw UTF-8 answer deltas>  \x1F [JSON usage trailer]
 *
 *   1. LEADING frames — each a JSON object terminated by `\0`
 *      (FRAME_TERMINATOR). Status, metadata, routing, live thinking
 *      deltas, usage:start, tool approval frames.
 *   2. ONE `\x1E` byte (END_OF_LEADING) — flips the stream into raw
 *      UTF-8 answer-text mode.
 *   3. `\x1F` (TRAILER_SENTINEL) + one JSON usage frame running to
 *      stream end (no terminator).
 *
 * Server-safe: no React, no browser APIs beyond TextEncoder/TextDecoder.
 */

// =============================================================================
// Sentinel constants
// =============================================================================

/** Terminates every leading JSON frame. */
export const FRAME_TERMINATOR = '\0'
/** Record Separator — end of leading frames, start of raw answer text. */
export const END_OF_LEADING = '\x1E'
/** Unit Separator — start of the trailing usage JSON frame. */
export const TRAILER_SENTINEL = '\x1F'

// =============================================================================
// Routing types (moved verbatim from the hub's `lib/chat/wire-frames.ts`;
// `RouteComplexity` is lib-local so the lib never imports hub code)
// =============================================================================

/** Server-side routing complexity tiers. Mirror of the hub's
 *  `lib/constants/ai-models.ts` union — kept as a lib-local literal type
 *  so the wire SSOT has zero hub imports. The DECODER accepts any string
 *  (older/newer servers may ship values outside this union). */
export type RouteComplexity = 'trivial' | 'default' | 'complex' | 'deep'

/**
 * Routing decision frame. Emitted once per turn as a LEADING frame
 * (between metadata and the `\x1E` end-of-leading-frames sentinel) when
 * the server's `decideRoute()` produces a `Route`.
 *
 * Field names use the `routed*` prefix on PURPOSE — the client's
 * catch-all leading-frame branch inspects `meta.model` / `meta.modelLabel`.
 * A bare `model` field on this frame would OVERWRITE the metadata frame's
 * modelLabel and break the <ModelDisplay> badge. The `routed` prefix
 * sidesteps that collision.
 *
 * Older clients that don't recognize `kind: 'routing'` silently drop
 * the frame (the catch-all only matches frames carrying known fields
 * like `sources` / `refs` / `modelLabel`).
 */
export interface RoutingFrame {
  kind: 'routing'
  routedComplexity: RouteComplexity
  routedModel: string
  routedThinkingBudget: number
}

/**
 * Optional field on the trailing usage frame's `breakdown`. Surfaces
 * per-route attribution to the admin test console so an operator can
 * see "this turn ran on Haiku/trivial/$0.0005" without re-parsing the
 * stream. Additive: clients that ignore unknown keys keep working.
 */
export interface RoutedAnswerBreakdown {
  model: string
  complexity: RouteComplexity
  thinkingBudget: number
}

// =============================================================================
// Leading frames
// =============================================================================

/** First frame on every stream — lets the shell render "Thinking…"
 *  within ~200ms, before any upstream byte arrives. */
export interface StatusThinkingFrame {
  status: 'thinking'
}

/** Per-turn metadata frame. The emitter sends `options.metadata`
 *  verbatim; a separate refs-only frame may follow with the same shape.
 *  All fields optional — the decoder's catch-all treats ANY frame that
 *  didn't match a `kind` discriminant as metadata-ish. */
export interface ChatMetadataFrame {
  /** Retrieval sources for the source-chip strip. Host-defined row
   *  shape (`ChatSource` on the adapter side) — opaque at wire level. */
  sources?: unknown[]
  /** Per-row refs for inline object cards, keyed `<type>:<id>`. */
  refs?: Record<string, unknown>
  /** Raw model id (e.g. 'claude-sonnet-x'). Presence alone triggers the
   *  client's meta merge; the value itself is not stored. */
  model?: string
  modelLabel?: string
  provider?: string
  contextWindowMaxTokens?: number
  /** Per-message viewport-positioning hint ('top' | 'bottom'). */
  scrollAnchor?: string
}

/** Live adaptive-thinking delta. WIRE IS ALREADY DELTA (Anthropic
 *  thinking_delta slices) — decoders must NOT diff or re-accumulate. */
export interface ThinkingDeltaFrame {
  kind: 'thinking-delta'
  text: string
}

/** Usage frame emitted as a LEADING frame right after Anthropic's
 *  message_start (stage='start'). */
export interface UsageStartFrame {
  kind: 'usage'
  stage: 'start'
  input_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

/** Model preamble prose written BEFORE a tool_use block — emitted as a
 *  standalone leading frame so it isn't stranded behind the approval
 *  card (the `\x1E` sentinel is suppressed on tool turns). */
export interface TextLeadingFrame {
  kind: 'text-leading'
  text: string
}

/** Tool invocation failed server-side (proposal persist error,
 *  validation, ownership denial …). */
export interface ToolErrorFrame {
  kind: 'tool_error'
  toolName?: string
  toolUseId?: string
  message: string
}

export interface ApprovalRequestField {
  label: string
  value: string
}

/** The model called a write tool; the server persisted a proposal and
 *  ships a card-ready payload. Shape mirrors the hub's `onToolUse`
 *  return in `lib/data/doc-chat-utils.ts`. */
export interface ApprovalRequestFrame {
  kind: 'approval_request'
  proposalId: string
  toolName: string
  title?: string
  fields?: ApprovalRequestField[]
  preamble?: string | null
  args?: Record<string, unknown>
  expiresAt?: string
  ttlSeconds?: number
}

/** Server-driven post-approve / post-reject frame (confirm-tool route).
 *  Mirror of the hub's `DecisionResolvedFrame` in
 *  `lib/data/chat-agent-utils.ts` (tool_name widened to string — the
 *  known-write-tool whitelist is host-side knowledge). */
export interface DecisionResolvedFrame {
  kind: 'decision_resolved'
  /** The proposal this decision resolved — locates the SOURCE approval
   *  card so the shell can flip its status + append the receipt. */
  proposalId: string
  ok: boolean
  action: 'approved' | 'rejected'
  tool_name?: string
  result?: {
    ticket_id?: string
    status?: string | null
    mirror_synced?: boolean
  }
  card?: {
    type: string
    marker: string
    ref: unknown
  }
  /** True when the server WILL pipe an auto-continuation turn after
   *  this frame. */
  willAutoContinue: boolean
  /** Pre-rendered receipt copy from the source strategy's
   *  `receiptRenderer` — client renders verbatim. */
  receiptText?: string
}

/** Every leading frame the emitter can produce. */
export type SseLeadingFrame =
  | StatusThinkingFrame
  | ChatMetadataFrame
  | RoutingFrame
  | ThinkingDeltaFrame
  | UsageStartFrame
  | TextLeadingFrame
  | ToolErrorFrame
  | ApprovalRequestFrame
  | DecisionResolvedFrame

// =============================================================================
// Trailing usage frame
// =============================================================================

/** Card/chip emission counts for admin adoption tooling. */
export interface UsageTelemetry {
  cards: number
  chips: number
  sentences: number
  answerLen: number
}

/** Trailing usage frame — `\x1F` + JSON, runs to stream end (no
 *  terminator). `stage: 'display'` is a legacy alias the decoder treats
 *  identically to `'end'`. */
export interface SseTrailingUsageFrame {
  kind: 'usage'
  stage: 'end' | 'display'
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  hit_rate_pct?: number
  telemetry?: UsageTelemetry
  /** Cross-call usage breakdown (Haiku rewriter / classifier /
   *  summarizer + routed-answer attribution). */
  breakdown?: {
    haikuRewriter?: { input: number; output: number }
    haikuClassifier?: { input: number; output: number }
    haikuSummarizer?: { input: number; output: number }
    routedAnswer?: RoutedAnswerBreakdown
  }
  /** Gated deep-debug payload (only present when the request carried
   *  the privileged debug secret). */
  debug?: Record<string, unknown>
}
