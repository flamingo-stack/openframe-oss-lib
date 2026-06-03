'use client'

/**
 * UnifiedChatState — the return shape that BOTH transport hooks must satisfy.
 *
 * Two transport implementations live behind this contract:
 *   - SSE (Guide mode) — talks to the hub backend
 *   - NATS (Mingo mode) — talks to the OpenFrame backend
 *
 * The public `useChat({ mode })` hook picks one based on `mode.transport` and
 * returns this shape regardless. Consumers (MingoChat shell, advanced custom
 * embedders) work against this contract and never see which transport is live.
 *
 * Fields that only one transport can populate are typed as nullable (per-turn
 * LLM metadata is SSE-only) or optional (Guide-only message sub-fields like
 * `sources` and `chatRefs`). In the off-mode they're null/undefined.
 */

import type { MessageSegment } from './message.types'
import type { ScrollAnchor } from './message.types'
import type { ChatRef } from '../chat-ref.types'
import type { ChatSource } from '../hooks/use-sse-chat-adapter'
import type { ChatAttachment } from '../utils/chat-attachment-markdown'

// ─── Streaming phase (unified across transports) ─────────────────────────────

/**
 * Granular streaming-status enum the chat shell uses to render the
 * "Thinking..."/"Streaming..." indicator above the input.
 *
 * - 'idle'      → no in-flight turn
 * - 'thinking'  → request fired; no streamed text/segments yet
 * - 'streaming' → first text/segment chunk arrived; output in progress
 *
 * Common to both Guide (SSE) and Mingo (NATS) modes — the phase
 * machine fires identically in either transport, just driven by
 * different chunk boundaries.
 */
export type StreamingPhase = 'idle' | 'thinking' | 'streaming'

// ─── Usage breakdown (SSE-only telemetry) ────────────────────────────────────

/**
 * Cross-call token-usage breakdown extracted from the SSE trailing usage
 * frame. Surfaces sub-call costs for the Haiku rewriter/classifier/summarizer
 * pipeline plus the routing decision for the main answer.
 *
 * Lives on `UnifiedChatState.currentUsageBreakdown` as `null` until the
 * server's trailing usage frame lands. Always `null` in Mingo mode — NATS
 * agent doesn't surface this telemetry.
 */
export interface UnifiedUsageBreakdown {
  haikuRewriter?: { input: number; output: number }
  haikuClassifier?: { input: number; output: number }
  haikuSummarizer?: { input: number; output: number }
  routedAnswer?: { model: string; complexity: string; thinkingBudget: number }
}

// ─── Message ─────────────────────────────────────────────────────────────────

/**
 * Generic chat message shape — unified between Guide (SSE) and Mingo (NATS).
 *
 * Guide-mode messages populate `sources` (RAG document citations) and
 * `chatRefs` (inline entity-card references). Mingo-mode messages leave
 * those undefined. Tool-execution and approval events ride inside
 * `segments` and are common to both modes.
 */
export interface UnifiedChatMessage {
  id: string
  role: 'user' | 'assistant'

  /**
   * Flat string form for legacy/simple callers. The structured `segments`
   * form is preferred — it carries thinking blocks, tool calls, approval
   * cards, etc., which `<ChatMessageEnhanced>` renders.
   */
  content: string
  segments?: MessageSegment[]

  /** Guide/SSE-only: document citations. Undefined in Mingo mode. */
  sources?: ChatSource[]

  /**
   * Guide/SSE-only: per-row refs for inline entity-card rendering.
   * Keyed by `<documentType>:<primaryKey>`. Undefined in Mingo mode.
   */
  chatRefs?: Record<string, ChatRef>

  /**
   * Per-message viewport-positioning hint. Common to both modes; the
   * message-list reads it to override default tail-on-stream behaviour
   * for a single message (e.g. long display-action answers anchor to
   * the top so the reader starts at the lede).
   */
  scrollAnchor?: ScrollAnchor

  /**
   * When true the message is part of the conversation history but is
   * NOT rendered in the chat UI. Used for post-approval auto-continuation
   * turns where we don't want synthetic prompts polluting the visible
   * thread.
   */
  hidden?: boolean
}

// ─── sendMessage options ─────────────────────────────────────────────────────

/**
 * Options passed to `sendMessage`. Kept narrow on purpose — transport-specific
 * extras stay inside the transport implementation, not on the public surface.
 * Add fields here only when BOTH transports honour them.
 */
export interface UnifiedSendMessageOptions {
  /**
   * Treat the user message as background context only — added to the LLM
   * history so the model sees it, but NOT rendered in the UI. Used by hosts
   * to fire post-approval auto-continuation turns. The assistant response
   * still renders normally.
   */
  hidden?: boolean

  /**
   * Image attachments uploaded via `useChatAttachments` to ride alongside
   * the user message. Each entry carries `{ storagePath, viewToken }` —
   * server-side the transport adapter replaces embedded view-URL markdown
   * lines with provider-native image content blocks.
   *
   * Guide/SSE mode: forwarded to the hub's `/api/docs/chat` endpoint.
   * Mingo/NATS mode: ignored (agent backend does not currently accept
   * image attachments — adapter will silently drop).
   */
  attachments?: ChatAttachment[]
}

// ─── Return shape ────────────────────────────────────────────────────────────

/**
 * The contract every transport hook returns. Stable across SSE and NATS —
 * consumers depend on this shape and never branch on `mode` themselves.
 *
 * Mode-specific telemetry (provider, token counts, cache-hit %) is SSE-only.
 * In Mingo mode those fields are `null` because NATS-agent doesn't surface
 * per-turn LLM metadata the same way.
 */
export interface UnifiedChatState {
  // ─── Message thread ───────────────────────────────────────────────────────
  messages: UnifiedChatMessage[]

  /**
   * True while a user turn is in progress — server-side thinking, streaming,
   * or both. Driven by `streamingPhase` under the hood; exposed as a flat
   * boolean for the chat-input "submit disabled" affordance.
   */
  isLoading: boolean

  /** Granular phase for the "Thinking..."/"Streaming..." status row above input. */
  streamingPhase: StreamingPhase

  // ─── Actions ──────────────────────────────────────────────────────────────
  sendMessage: (
    text: string,
    options?: UnifiedSendMessageOptions,
  ) => Promise<void>

  /** Abort the in-flight stream. No-op when idle. */
  stopMessage: () => void

  /** Wipe the local message buffer. Does not touch server-side history. */
  clearMessages: () => void

  /**
   * Trigger the chat's "Discuss this row" affordance — opens a focused
   * thread scoped to a specific RAG entity. Guide-mode only; in Mingo mode
   * this is a no-op (the agent has no entity-id-filtered retrieval).
   */
  discussRef: (ref: ChatRef) => void

  /**
   * Trigger the chat's "Display this row" affordance — same as `discussRef`
   * but for read-only card display rather than a question. Guide-mode only.
   */
  displayRef: (ref: ChatRef) => void

  // ─── Per-turn LLM metadata (Guide/SSE only) ───────────────────────────────
  /**
   * Provider key recognised by `<ModelDisplay>` for icon selection.
   * Values: 'anthropic' | 'openai' | 'google' (case-insensitive).
   * Null in Mingo mode and during the brief window before the server's
   * `message_start` frame arrives.
   */
  currentProvider: string | null

  /** Display label for the active model, e.g. "Sonnet 4.6". Null in Mingo. */
  currentModelLabel: string | null

  /** Model's context-window cap in tokens. Null in Mingo. */
  currentContextWindowMaxTokens: number | null

  /** Input tokens for the current turn (from `message_start`). Null in Mingo. */
  currentInputTokens: number | null

  /** Output tokens for the current turn (only known after stream end). */
  currentOutputTokens: number | null

  /** Cache-hit % (read / total-input × 100). Only known after stream end. */
  currentCacheHitRatePct: number | null

  /**
   * Cross-call token-usage breakdown (Haiku rewriter/classifier/summarizer
   * + routed-answer telemetry). Null until the SSE trailing usage frame
   * arrives. Always null in Mingo mode.
   */
  currentUsageBreakdown: UnifiedUsageBreakdown | null
}
