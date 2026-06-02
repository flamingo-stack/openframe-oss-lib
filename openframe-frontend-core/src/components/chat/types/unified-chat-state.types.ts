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
import type { DialogItem } from './component.types'

// ─── Per-dialog token usage (Mingo backend telemetry) ────────────────────────

/**
 * Token usage snapshot for the active Mingo dialog, hydrated from the
 * backend's `dialog.tokenUsage` GraphQL field. Mirrors the shape returned
 * by the openframe `dialogs` GraphQL endpoint so hosts can pass it through
 * `fetchDialogMessages` without re-mapping.
 *
 * Null when no Mingo dialog is active, when the backend hasn't reported
 * usage yet, or when the active mode is Guide (SSE telemetry surfaces via
 * `currentInputTokens`/`currentOutputTokens` instead).
 */
export interface DialogTokenUsage {
  /** Backend chat-type discriminator, e.g. `ADMIN_AI_CHAT`. Free-form. */
  chatType?: string
  /** Total input tokens consumed so far in this dialog. */
  inputTokensSize: number
  /** Total output tokens emitted so far in this dialog. */
  outputTokensSize: number
  /** Sum of input + output. May be > input + output when the backend
   *  counts cache reads in a separate bucket — trust the backend value. */
  totalTokensSize: number
  /** Current LLM context-window occupancy in tokens — what the model
   *  has loaded right now, not the cumulative dialog sum. */
  contextSize?: number
}

// ─── Connection state (transport-level) ──────────────────────────────────────

/**
 * High-level transport connection status. Drives any UI affordance that
 * needs to communicate "live tail is/isn't healthy" to the user. SSE/Guide
 * adapter currently reports `'connected'` whenever a turn isn't streaming
 * — the SSE side is request-response and has no long-lived socket.
 */
export type ChatConnectionState = 'connected' | 'connecting' | 'disconnected'

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

  // ─── Dialog management (Mingo: backend; Guide: localStorage) ──────────────
  //
  // All fields below are optional in practice: a transport adapter that
  // doesn't manage multi-dialog history (older `useNatsChatAdapter`
  // configs, the Guide adapter with localStorage disabled) returns the
  // empty/null defaults so existing consumers keep working unchanged.
  // Callers gate UI on `dialogs.length > 0` or `activeDialogId != null`.

  /**
   * History of dialogs available for the active mode. Mingo: paginated
   * from the openframe backend. Guide: list of recent threads from
   * localStorage. Empty when the active adapter doesn't expose dialog
   * management.
   */
  dialogs: DialogItem[]

  /** Currently-selected dialog id, or `null` when no dialog is active
   *  (draft state — "start a new conversation"). */
  activeDialogId: string | null

  /** Switch the panel to an existing dialog. Idempotent — selecting the
   *  active id is a no-op. Pass `null` to drop back to draft state. */
  selectDialog: (id: string | null) => void

  /** Allocate a fresh dialog on the backend (Mingo) or in localStorage
   *  (Guide) and switch to it. Returns the new dialog id. When the
   *  adapter doesn't support creation, resolves to `null`. */
  startNewDialog: () => Promise<string | null>

  /** Delete a dialog from history. No-op when the adapter doesn't
   *  expose `deleteDialog` (Guide localStorage always supports it;
   *  Mingo gates on the host-provided callback). */
  deleteDialog: (id: string) => Promise<void>

  /** True while the dialog list is being fetched for the first time. */
  isDialogsLoading: boolean

  /** True while message history for the active dialog is being fetched. */
  isMessagesLoading: boolean

  /** Whether more dialogs remain on the server (Mingo cursor pagination). */
  hasMoreDialogs: boolean

  /** Fetch the next page of dialogs. No-op when `hasMoreDialogs` is false. */
  loadMoreDialogs: () => Promise<void>

  /** Whether more historical messages remain in the active dialog. */
  hasMoreMessages: boolean

  /** Fetch the next page of historical messages for the active dialog. */
  loadMoreMessages: () => Promise<void>

  // ─── Approval mutations (Mingo agent tool-call workflow) ──────────────────

  /** Approve an in-flight tool-call request. Errors surface via the
   *  host-supplied toast in the callback config (lib does not own UI). */
  approveRequest: (requestId: string) => Promise<void>

  /** Reject an in-flight tool-call request. Optional `reason` is
   *  forwarded to the backend when supported. */
  rejectRequest: (requestId: string, reason?: string) => Promise<void>

  // ─── Per-dialog token usage (Mingo only) ──────────────────────────────────

  /** Cumulative token usage for the active Mingo dialog. Null in Guide
   *  mode or when the backend hasn't reported usage yet. Per-turn
   *  metadata (`currentInputTokens` etc.) is orthogonal — that fires on
   *  every SSE `message_start`, while this hydrates from the dialog
   *  fetch + live `TOKEN_USAGE` events. */
  dialogTokenUsage: DialogTokenUsage | null

  // ─── Connection state ─────────────────────────────────────────────────────

  /** High-level transport connection state. Drives reconnect UI in
   *  Mingo mode; always `'connected'` in Guide mode (SSE is request-
   *  response and has no persistent socket to monitor). */
  connectionState: ChatConnectionState
}
