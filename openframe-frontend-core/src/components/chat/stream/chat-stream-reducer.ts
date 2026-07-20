/**
 * createChatStreamReducer — THE master chat-stream reader (Phase 3 of the
 * chat unification). One accumulation path for every event source:
 *
 *   SSE bytes  → createSseFrameDecoder ─┐
 *   NATS chunk → decodeNatsChunk       ─┼→ ChatStreamEvent → reducer.apply()
 *   history    → decodeHistoricalMessageData (per-item vocabulary) →
 *                envelope grouping → reducer.initializeWithState()
 *
 * The reducer absorbs, verbatim, the semantics that used to be spread over
 * three layers:
 *   - `MessageSegmentAccumulator` stays as the internal per-turn segment
 *     kernel (instantiated here — its goldens remain valid);
 *   - the deleted `useRealtimeChunkProcessor`'s switch (in-stream vs post-END
 *     routing, agent-busy outside a message window, escalated approvals,
 *     compaction upsert, direct-mode barrier) — surfaced as
 *     `ChatReducerEffect`s for consumers that want the callback contract;
 *   - `useNatsChatAdapter`'s message-mutation callbacks (trailing-assistant
 *     replace/append, compaction upsert, cross-message tool merge, approval
 *     flip, participant dedup) — now the reducer's own state transitions via
 *     `./message-mutations`;
 *   - `useSseChatAdapter`/`useChat`'s SSE turn kernel (cumulative text
 *     replace, front-inserted thinking, approval card, `decision_resolved`
 *     receipt + cardRef stamping, sendIdx-keyed sources/refs/meta maps).
 *
 * Idempotency:
 *   - events whose `seq` ≤ the last applied seq are dropped (per instance);
 *   - participant rows additionally dedup via a one-shot optimistic-echo
 *     list and a short same-author content window (seq-less transports);
 *   - value-level no-op merges return prior references (see
 *     `message-mutations.ts`).
 *
 * TRANSPORT ORDERING ASSUMPTION (the seq gate, see `apply()`): every
 * transport feeding this reducer is AT-LEAST-ONCE and IN-ORDER. JetStream
 * redelivers (hence the gate) but never reorders within a stream, and the
 * catchup back-fill replays a monotonically increasing range. So `seq <=
 * lastAppliedSeq` means "already applied", and dropping is correct.
 * A genuinely out-of-order arrival (seq 5 then 4) would be discarded
 * PERMANENTLY — accepted deliberately: no transport here reorders, and an
 * out-of-order buffer would add latency + unbounded state to guard against
 * a case that cannot occur. If a reordering transport is ever added, this
 * gate is the place that must change (do not paper over it downstream).
 *
 * `resolvePendingApprovalForExecution` (the accumulator's implicit
 * approve-on-execution) is reachable ONLY on `transport: 'nats'` — the SSE
 * kernel never routes tool executions through the accumulator.
 *
 * PURE + framework-free: no React, no timers, no network. Side effects the
 * UI needs (approve/reject POSTs) enter as opaque callbacks stamped onto
 * approval segments.
 */

import {
  MessageSegmentAccumulator,
  createMessageSegmentAccumulator,
  type AccumulatorCallbacks,
} from '../utils/message-segment-accumulator'
import { getCommandText } from '../utils/tool-call-helpers'
import { parseScrollAnchor, type ScrollAnchor } from '../utils/scroll-anchor'
import { escapeThinkingTags } from '../../../chat-protocol/decode'
import { buildChatRefKey } from '../types/chat.types'
import type {
  ApprovalRequestSegment,
  ChatApprovalStatus,
  MessageSegment,
  PendingToolCallData,
  SegmentsUpdateMetadata,
  ToolExecutionSegment,
  ExecutingToolState,
} from '../types'
import type { PendingApproval } from '../types/processing.types'
import type {
  DialogTokenUsage,
  StreamingPhase,
  UnifiedChatMessage,
  UnifiedUsageBreakdown,
} from '../types/unified-chat-state.types'
import type {
  ChatStreamEvent,
  ApprovalResolvedEvent,
  ChatMetadataEvent,
  ParticipantEvent,
  UsageEvent,
} from '../../../chat-protocol/events'
import type { ChatRef } from '../chat-ref.types'
import {
  CONTENT_DEDUP_WINDOW,
  SYSTEM_DEDUP_WINDOW,
  appendToTrailingAssistant,
  applyToolExecutionToMessages,
  hasRecentMessage,
  mergeToolExecutionIfPresent,
  nextId,
  projectApprovalResolutionToMessages,
  updateTrailingAssistant,
  upsertTrailingCompaction,
} from './message-mutations'

// =============================================================================
// Public types
// =============================================================================

/** Per-turn metadata extracted from the streamed metadata/usage frames
 *  (SSE transport). Canonical home — `use-sse-chat-adapter` re-exports it. */
export interface ChatTurnMeta {
  provider: string | null
  modelLabel: string | null
  contextWindowMaxTokens: number | null
  /** Input tokens (from usage:start). Includes cached tokens. */
  inputTokens: number | null
  /** Output tokens (from the trailing usage frame). */
  outputTokens: number | null
  /** Cache hit % (read / total-input × 100). Only known after stream end. */
  cacheHitRatePct: number | null
  /** Cross-call usage breakdown extracted from the trailing usage frame. */
  breakdown: UnifiedUsageBreakdown | null
  /** Per-message viewport-positioning hint. */
  scrollAnchor: ScrollAnchor | null
  routedComplexity: string | null
  routedThinkingBudget: number | null
}

/** Single source of truth for a fresh `ChatTurnMeta` row. */
export function createEmptyTurnMeta(): ChatTurnMeta {
  return {
    provider: null,
    modelLabel: null,
    contextWindowMaxTokens: null,
    inputTokens: null,
    outputTokens: null,
    cacheHitRatePct: null,
    breakdown: null,
    scrollAnchor: null,
    routedComplexity: null,
    routedThinkingBudget: null,
  }
}

/** SSE per-send maps, keyed by the send counter (`sendIdx`). Each user send
 *  produces ONE server-side refs/sources entry but can fan out to MULTIPLE
 *  assistant messages client-side — the adapter maps every following
 *  assistant message back to its send's entry. */
export interface ChatTurnMetaState {
  meta: Map<number, ChatTurnMeta>
  sources: Map<number, unknown[]>
  refs: Map<number, Record<string, ChatRef>>
  sendCount: number
}

export interface ChatReducerState {
  messages: UnifiedChatMessage[]
  streamingPhase: StreamingPhase
  turnMeta: ChatTurnMetaState
  dialogTokenUsage?: DialogTokenUsage | null
  liveModel?: {
    provider: string | null
    modelLabel: string | null
    contextWindowMaxTokens: number | null
  } | null
  approvalStatuses: Record<string, ChatApprovalStatus>
}

/** Escalated-approval bookkeeping entry (mirrors the legacy processor). */
export interface EscalatedApprovalData {
  command: string
  explanation?: string
  approvalType: string
  toolCalls?: PendingToolCallData[]
}

/**
 * Callback-visible effect produced by `apply()`. Names + args mirror the
 * legacy `RealtimeChunkCallbacks` contract 1:1 — the contract the deleted
 * `useRealtimeChunkProcessor` wrapper exposed, now pinned directly by
 * `__tests__/chat-stream-reducer-golden.test.ts`.
 *
 * `segments-after-approval-result` is the one conditional emission: the
 * legacy processor emitted a cumulative `onSegmentsUpdate` for a
 * non-escalated APPROVAL_RESULT only when the consumer had NOT wired
 * `onApprovalResolved` — the effect sink resolves that at dispatch time.
 */
export interface ChatReducerEffect {
  name:
    | 'onStreamStart'
    | 'onStreamEnd'
    | 'onMetadata'
    | 'onSegmentsUpdate'
    | 'onError'
    | 'onUserMessage'
    | 'onTokenUsage'
    | 'onDirectMessage'
    | 'onSystemMessage'
    | 'onEscalatedApproval'
    | 'onEscalatedApprovalResult'
    | 'onApprovalResolved'
    | 'onToolExecuted'
    | 'onAgentBusy'
    | 'onDialogClosed'
    | 'segments-after-approval-result'
  args: unknown[]
}

export interface ChatStreamReducerOptions {
  /** Which transport's turn kernel drives `apply()`. Default `'nats'`. */
  transport?: 'sse' | 'nats'
  /** Seed for the approval-status map (request-id → status). */
  approvalStatuses?: Record<string, ChatApprovalStatus>
  /** Batch APPROVAL_REQUESTs render as one card (default true) or unfold. */
  batchApprovalsEnabled?: boolean
  /** Approval types displayed inline; others escalate. Default ['CLIENT']. */
  displayApprovalTypes?: string[]
  /** Opaque approve/reject handlers stamped onto approval segments. */
  callbacks?: AccumulatorCallbacks
  /** Engage the direct-mode barrier optimistically (host-known takeover). */
  isDirectMode?: boolean
  /**
   * Legacy-processor parity knob: post-MESSAGE_END tool chunks route
   * cross-message (`onToolExecuted` effect + `applyToolExecutionToMessages`)
   * only when the consumer wired the cross-message updater; otherwise they
   * fall through the accumulator like the pre-callback code path. Default
   * true (both first-party adapters wire it).
   */
  crossMessageToolRouting?: boolean
  /** Effect sink for callback-contract consumers (compat wrapper). */
  onEffect?: (effect: ChatReducerEffect) => void
  /** Notified after every state mutation (the dialog store wires this). */
  onChange?: () => void
  /**
   * Whether an ADMIN-authored `MESSAGE_REQUEST` may be consumed as OUR OWN
   * optimistic echo (see `pushOptimisticSend`). Default `false`.
   *
   * Who the local operator is decides this, and it differs per host:
   *  - Hub website chat / ticket CLIENT side: the local user is NEVER the
   *    admin, so an ADMIN-authored inbound row is a technician's reply and
   *    must ALWAYS render. Consuming it as an echo would silently delete a
   *    real message whenever its text happened to match ours. → `false`.
   *  - OpenFrame product app (Mingo + ticket ADMIN side): the operator IS
   *    the admin, so their own sends echo back as ADMIN and MUST be
   *    deduped, or every message renders twice. → `true`.
   *
   * Only ever applies to text the host itself registered via
   * `pushOptimisticSend`, so enabling it cannot drop a message the host
   * did not just send.
   */
  ownEchoIncludesAdmin?: boolean
}

export interface InitializeExtras {
  existingSegments?: MessageSegment[]
  pendingApprovals?: Map<string, PendingApproval>
  executingTools?: Map<string, ExecutingToolState>
  escalatedApprovals?: Map<string, EscalatedApprovalData>
}

export interface BeginSseSendOptions {
  text: string
  hidden?: boolean
  userName?: string
  assistantName?: string
  assistantAvatar?: string
}

// =============================================================================
// Reducer
// =============================================================================

export interface ChatStreamReducer {
  /** Apply one normalized stream event. */
  apply(event: ChatStreamEvent): void
  /** Current immutable state snapshot (stable identity between mutations). */
  readonly state: ChatReducerState
  /** Full reset — thread, per-turn kernel, dedup sets, seq gate, maps. */
  reset(): void
  /**
   * Seed the thread (history hydration / persisted-state rehydration) and
   * optionally the per-turn kernel + escalated approvals (resume of an
   * incomplete turn). `messages: null` keeps the current thread. Escalated
   * entries are re-surfaced via `onEscalatedApproval` effects. Marks the
   * instance as having streamed so continuation chunks append.
   */
  initializeWithState(messages: UnifiedChatMessage[] | null, extras?: InitializeExtras): void

  // ── Thread commands (adapter-driven, not wire events) ──────────────────
  setMessages(messages: UnifiedChatMessage[]): void
  prependMessages(messages: UnifiedChatMessage[]): void
  /** Optimistic local send: user bubble (+ echo record) + assistant placeholder. */
  pushOptimisticSend(text: string, hidden?: boolean): void
  /** Wipe thread + per-turn kernel, keep approval statuses (legacy clear). */
  clearThread(): void
  /** Per-dialog reset (keeps approval statuses — request-ids are global). */
  resetForDialogSwitch(): void

  // ── SSE turn commands ───────────────────────────────────────────────────
  beginSseSend(options: BeginSseSendOptions): void
  endSseTurn(): void
  failSseTurn(errorMessage: string): void
  seedSseMaps(seed: {
    sources?: Array<[number, unknown[]]>
    refs?: Array<[number, Record<string, ChatRef>]>
    sendCount?: number
  }): void

  // ── Phase / status commands ─────────────────────────────────────────────
  setPhase(phase: StreamingPhase): void
  setApprovalStatus(requestId: string, status: ChatApprovalStatus | null): void
  /**
   * Wrapper-parity: overwrite the status lookup map WHOLESALE. Almost always
   * the wrong tool for a host — use `mergeApprovalStatuses` instead, which
   * bakes in the canonical precedence.
   */
  syncApprovalStatuses(statuses: Record<string, ChatApprovalStatus>): void
  /**
   * CANONICAL merge of a PERSISTED status map (host-side store, history
   * hydration, dialog-switch top-up) into this reducer's map.
   *
   * Precedence is fixed here, deliberately, so no host can get it backwards:
   * `{ ...persisted, ...streamLearned }` — a status this reducer LEARNED FROM
   * THE STREAM always wins over the persisted copy. The persisted map is a
   * snapshot that can lag by a whole round trip, so letting it win downgrades
   * a just-resolved approval back to `pending` and re-arms its buttons.
   * Persisted entries still fill in every request-id the stream hasn't seen
   * (other dialogs, pre-session history).
   */
  mergeApprovalStatuses(persisted: Record<string, ChatApprovalStatus>): void
  setDirectMode(isDirectMode: boolean): void
  setDialogTokenUsage(usage: DialogTokenUsage | null): void
  /** +1/-1 windows during catchup replay (suppresses agent-busy locks). */
  adjustAgentBusySuppression(delta: number): void
  armAdoptTrailingAssistant(value: boolean): void

  // ── Cross-side projections (dialog-store fan-out) ───────────────────────
  projectApprovalResolution(
    requestId: string,
    status: ChatApprovalStatus,
    resolvedByName?: string | null,
  ): void
  projectToolExecution(segment: ToolExecutionSegment): void

  // ── Legacy processor surface (compat wrapper) ───────────────────────────
  getSegments(): MessageSegment[]
  updateApprovalStatus(
    requestId: string,
    status: ChatApprovalStatus,
    resolvedByName?: string | null,
  ): MessageSegment[]
  getPendingEscalated(): Map<string, EscalatedApprovalData>
}

// Actions allowed through once the dialog is in direct mode. Everything else
// is an AI-assistant event and gets dropped — an allowlist so any future
// assistant event is blocked by default.
function isDirectModeAllowed(event: ChatStreamEvent): boolean {
  return event.type === 'participant' || event.type === 'dialog-closed'
}

export function createChatStreamReducer(
  options: ChatStreamReducerOptions = {},
): ChatStreamReducer {
  const {
    transport = 'nats',
    batchApprovalsEnabled = true,
    displayApprovalTypes = ['CLIENT'],
    callbacks = {},
    crossMessageToolRouting = true,
    onEffect,
    onChange,
  } = options

  // ── Mutable internals ──────────────────────────────────────────────────
  let messages: UnifiedChatMessage[] = []
  let streamingPhase: StreamingPhase = 'idle'
  let dialogTokenUsage: DialogTokenUsage | null = null
  let liveModel: ChatReducerState['liveModel'] = null
  let approvalStatuses: Record<string, ChatApprovalStatus> = {
    ...(options.approvalStatuses ?? {}),
  }

  const accumulator: MessageSegmentAccumulator = createMessageSegmentAccumulator(callbacks)

  // Stream-window flags (chunk-processor parity).
  let isInStream = false
  let hasEverStreamed = false

  // Direct-mode barrier.
  let directModeFlag = options.isDirectMode ?? false
  let sawDirectMessage = false
  let directTeardownFired = false

  // Escalated approvals (single or batch).
  const pendingEscalated = new Map<string, EscalatedApprovalData>()

  // Idempotency. The per-participant seen-seq set that used to live here was
  // REMOVED as redundant: `apply()`'s global gate already drops any event
  // whose seq was applied before, so a seq-carrying participant row can never
  // reach the handlers twice.
  let lastAppliedSeq = Number.NEGATIVE_INFINITY
  let pendingEchoTexts: string[] = []

  // Adapter-armed flags.
  let suppressAgentBusy = 0
  let adoptTrailingAssistant = false

  // SSE per-send maps + per-turn kernel.
  const metaMap = new Map<number, ChatTurnMeta>()
  const sourcesMap = new Map<number, unknown[]>()
  const refsMap = new Map<number, Record<string, ChatRef>>()
  let sendCount = 0
  let sseCurrentText = ''

  // ── Snapshot cache ─────────────────────────────────────────────────────
  let stateCache: ChatReducerState | null = null
  function invalidate(): void {
    stateCache = null
    onChange?.()
  }
  function getState(): ChatReducerState {
    if (!stateCache) {
      stateCache = {
        messages,
        streamingPhase,
        turnMeta: { meta: metaMap, sources: sourcesMap, refs: refsMap, sendCount },
        dialogTokenUsage,
        liveModel,
        approvalStatuses,
      }
    }
    return stateCache
  }

  function emit(name: ChatReducerEffect['name'], ...args: unknown[]): void {
    onEffect?.({ name, args })
  }

  function setMessagesInternal(next: UnifiedChatMessage[]): void {
    if (next !== messages) {
      messages = next
      invalidate()
    }
  }

  function setPhaseInternal(phase: StreamingPhase): void {
    if (streamingPhase !== phase) {
      streamingPhase = phase
      invalidate()
    }
  }

  /** onAgentBusy state semantics: only 'idle' upgrades to 'thinking'; an
   *  open stream keeps ownership. Suppressed during catchup replay. */
  function agentBusyState(): void {
    if (suppressAgentBusy > 0) return
    if (streamingPhase === 'idle') setPhaseInternal('thinking')
  }

  function mirrorApprovalStatus(requestId: string, status: ChatApprovalStatus): void {
    if (approvalStatuses[requestId] === status) return
    approvalStatuses = { ...approvalStatuses, [requestId]: status }
    invalidate()
  }

  // ===========================================================================
  // NATS kernel — the absorbed chunk-processor switch + adapter callbacks body
  // ===========================================================================

  function applySegmentsToState(segments: MessageSegment[], meta?: SegmentsUpdateMetadata): void {
    // Standalone compaction updates carry the accumulator's cumulative
    // array — apply only the compaction segment (upsert) or interleaved
    // continuation text would duplicate.
    if (meta?.append && meta.isCompacting) {
      setMessagesInternal(upsertTrailingCompaction(messages, segments))
      return
    }
    // Post-MESSAGE_END continuation fragments append into the existing
    // bubble; replacing would wipe the completed reply.
    if (meta?.append) {
      setMessagesInternal(appendToTrailingAssistant(messages, segments))
      return
    }
    setMessagesInternal(updateTrailingAssistant(messages, segments))
  }

  function applyStreamStartToState(): void {
    setPhaseInternal('streaming')
    // A new stream must never overwrite a COMPLETED trailing assistant
    // bubble (observer tab / second device / post-approval continuation
    // turn). Open a fresh bubble unless the trailing assistant is empty
    // (our own optimistic placeholder) or is the incomplete history tail
    // the catchup replay is legitimately re-streaming (adopt-once flag).
    const adoptTail = adoptTrailingAssistant
    adoptTrailingAssistant = false
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant' || adoptTail) return
    const hasContent = (last.segments?.length ?? 0) > 0 || last.content !== ''
    if (!hasContent) return
    setMessagesInternal([
      ...messages,
      { id: nextId('assistant'), role: 'assistant', content: '', segments: [] },
    ])
  }

  /** MESSAGE_REQUEST echo — a user message from THIS or another session.
   *  Dedup layers in priority order: seq identity → one-shot optimistic-echo
   *  consumption → same-author content window (seq-less transports only). */
  function applyUserMessageToState(ev: ParticipantEvent): void {
    const text = ev.text
    if (!text) return
    const seq = ev.seq
    // ADMIN rows are only echo-consumable when the host declares that its
    // operator IS the admin (see `ownEchoIncludesAdmin`). Otherwise an
    // ADMIN row is someone else's message and must always render.
    if (ev.ownerType !== 'ADMIN' || options.ownEchoIncludesAdmin === true) {
      const echoIdx = pendingEchoTexts.indexOf(text)
      if (echoIdx !== -1) {
        pendingEchoTexts.splice(echoIdx, 1)
        return
      }
    }
    const authorType = ev.ownerType === 'ADMIN' ? ('admin' as const) : ('user' as const)
    if (
      typeof seq !== 'number' &&
      hasRecentMessage(
        messages,
        (m) => m.role === 'user' && (m.authorType ?? 'user') === authorType && m.content === text,
        CONTENT_DEDUP_WINDOW,
      )
    ) {
      return
    }
    setMessagesInternal([
      ...messages,
      {
        id: nextId('user'),
        role: 'user',
        content: text,
        ...(ev.displayName ? { name: ev.displayName } : {}),
        authorType,
        ...(ev.contextItems && ev.contextItems.length > 0
          ? { contextItems: ev.contextItems }
          : {}),
      },
    ])
  }

  /** Technician / admin direct message into the dialog. */
  function applyDirectMessageToState(ev: ParticipantEvent): void {
    const text = ev.text
    if (!text) return
    const seq = ev.seq
    // Seq-less fallback matches only prior ADMIN-authored twins — a client's
    // identical text must never suppress the technician's.
    if (
      typeof seq !== 'number' &&
      hasRecentMessage(
        messages,
        (m) => m.role === 'user' && m.authorType === 'admin' && m.content === text,
        CONTENT_DEDUP_WINDOW,
      )
    ) {
      return
    }
    setMessagesInternal([
      ...messages,
      {
        id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: text,
        name: ev.displayName ?? 'Admin',
        authorType: 'admin',
      },
    ])
  }

  /** System notice — rendered as a name-only row (same shape the history
   *  processor produces via its standalone-SYSTEM path). */
  function applySystemMessageToState(ev: ParticipantEvent): void {
    const text = ev.text
    if (!text) return
    const seq = ev.seq
    if (
      typeof seq !== 'number' &&
      hasRecentMessage(
        messages,
        (m) => m.authorType === 'system' && m.name === text,
        SYSTEM_DEDUP_WINDOW,
      )
    ) {
      return
    }
    setMessagesInternal([
      ...messages,
      {
        id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: '',
        name: text,
        authorType: 'system',
      },
    ])
  }

  function applyNats(event: ChatStreamEvent): void {
    const seq = event.seq
    const withSeqMeta = (meta?: SegmentsUpdateMetadata): SegmentsUpdateMetadata | undefined =>
      seq != null ? { ...meta, streamSeq: seq } : meta
    const emitSegments = (segments: MessageSegment[], meta?: SegmentsUpdateMetadata) =>
      emit('onSegmentsUpdate', segments, withSeqMeta(meta))

    if (event.type === 'participant' && event.kind === 'direct-message') {
      sawDirectMessage = true
    }

    if ((directModeFlag || sawDirectMessage) && !isDirectModeAllowed(event)) {
      // Hard stop: tear down AI activity exactly once so the typing
      // indicator, composer lock, and half-rendered bubble clear, then drop
      // the event. Fires even when no stream is open — an agent-busy lock
      // (approved commands executing post-MESSAGE_END) has no other release
      // once the barrier starts dropping the continuation chunks.
      if (isInStream || !directTeardownFired) {
        isInStream = false
        directTeardownFired = true
        emit('onStreamEnd')
        setPhaseInternal('idle')
        accumulator.resetSegments()
      }
      return
    }

    switch (event.type) {
      case 'turn-start': {
        isInStream = true
        hasEverStreamed = true
        emit('onStreamStart')
        applyStreamStartToState()
        accumulator.resetSegments()
        break
      }

      case 'turn-end': {
        isInStream = false
        emit('onStreamEnd')
        setPhaseInternal('idle')
        accumulator.resetSegments()
        break
      }

      case 'metadata': {
        // Legacy `parseChunkToAction` action shape, reconstructed for the
        // callback contract.
        emit('onMetadata', {
          action: 'metadata',
          modelDisplayName: event.modelLabel ?? undefined,
          modelName: event.modelName,
          providerName: event.provider,
          contextWindow: event.contextWindowMaxTokens,
        })
        liveModel = {
          provider: event.provider || null,
          modelLabel: event.modelLabel || event.modelName || null,
          contextWindowMaxTokens: event.contextWindowMaxTokens || null,
        }
        invalidate()
        break
      }

      case 'text-delta':
      case 'thinking-delta': {
        const isText = event.type === 'text-delta'
        const segments = isText
          ? accumulator.appendText(event.text)
          : accumulator.appendThinking(event.text)
        // Append-mode only for *true* post-stream continuation (after a
        // MESSAGE_END we actually saw). Cold-start chunks (no prior
        // MESSAGE_START) emit cumulative segments so the consumer can spawn
        // the first assistant bubble.
        if (isInStream || !hasEverStreamed) {
          emitSegments(segments)
          applySegmentsToState(segments, withSeqMeta(undefined))
        } else {
          const delta: MessageSegment[] = [
            isText ? { type: 'text', text: event.text } : { type: 'thinking', text: event.text },
          ]
          emitSegments(delta, { append: true })
          applySegmentsToState(delta, withSeqMeta({ append: true }))
        }
        break
      }

      case 'tool-execution': {
        const segment: ToolExecutionSegment = { type: 'tool_execution', data: event.data }
        // A starting tool run means the agent's turn is in progress even
        // when this lands after MESSAGE_END (approved commands execute
        // between the approval bubble and the continuation stream).
        if (event.data.type === 'EXECUTING_TOOL') {
          emit('onAgentBusy')
          agentBusyState()
        }
        // Post-MESSAGE_END tool chunks (cancellations / async batch results
        // for a batch in a prior bubble) flow only through the cross-message
        // updater. Skipping the accumulator avoids pushing a standalone
        // segment that the next text chunk would replay into a new bubble.
        if (!isInStream && crossMessageToolRouting) {
          emit('onToolExecuted', segment)
          setMessagesInternal(applyToolExecutionToMessages(messages, segment))
          break
        }
        // In-stream: accumulator-driven update of the streaming bubble is
        // the source of truth. The cross-message scan is first-match-wins
        // and could touch a same-execId segment in a prior bubble (agent
        // retry case), so it is NOT run here.
        const segments = accumulator.addToolExecution(segment)
        emitSegments(segments)
        applySegmentsToState(segments, withSeqMeta(undefined))
        break
      }

      case 'approval-request': {
        const requestId = event.requestId
        const approvalType = event.approvalType ?? 'USER'
        const toolCalls = event.toolCalls

        if (toolCalls && toolCalls.length > 0) {
          // ── Batch form ──
          const status = (approvalStatuses[requestId] || 'pending') as ChatApprovalStatus
          if (!displayApprovalTypes.includes(approvalType)) {
            // Escalated: keep batch context locally for replay on result;
            // surface a summary command via the legacy escalation callback.
            const required = toolCalls.find((c) => c.requiresApproval) ?? toolCalls[0]
            const summary = required
              ? getCommandText(required)
              : `Batch of ${toolCalls.length} tool calls`
            pendingEscalated.set(requestId, {
              command: summary,
              explanation: required?.toolExplanation,
              approvalType,
              toolCalls,
            })
            emit('onEscalatedApproval', requestId, {
              command: summary,
              explanation: required?.toolExplanation,
              approvalType,
            })
            break
          }
          if (batchApprovalsEnabled) {
            const segments = accumulator.addApprovalBatch(requestId, approvalType, toolCalls, status)
            emitSegments(segments)
            applySegmentsToState(segments, withSeqMeta(undefined))
            break
          }
          // Flag OFF — unfold batch into N legacy approval cards. They share
          // `requestId`, so a click on any will approve the whole batch via a
          // single backend call, and the resulting APPROVAL_RESULT event will
          // flip status on every matching segment.
          let segments = accumulator.getSegments()
          for (const call of toolCalls) {
            if (!call.requiresApproval) continue
            segments = accumulator.addApprovalRequest(
              requestId,
              getCommandText(call),
              call.toolExplanation,
              approvalType,
              status,
            )
          }
          emitSegments(segments)
          applySegmentsToState(segments, withSeqMeta(undefined))
          break
        }

        // ── Single form ──
        const command = event.command ?? ''
        const explanation = event.explanation
        if (displayApprovalTypes.includes(approvalType)) {
          const status = (approvalStatuses[requestId] || 'pending') as ChatApprovalStatus
          const segments = accumulator.addApprovalRequest(
            requestId,
            command,
            explanation,
            approvalType,
            status,
          )
          emitSegments(segments)
          applySegmentsToState(segments, withSeqMeta(undefined))
        } else {
          pendingEscalated.set(requestId, { command, explanation, approvalType })
          emit('onEscalatedApproval', requestId, { command, explanation, approvalType })
        }
        break
      }

      case 'approval-resolved': {
        const requestId = event.requestId ?? ''
        const status = event.status
        const approved = status === 'approved'
        const approvalType = event.approvalType ?? 'CLIENT'
        const resolvedByName = event.resolvedByName
        // Approved → the agent resumes to execute the command(s); surface
        // busy immediately so the composer locks before EXECUTING_TOOL
        // lands. Rejection keeps the input free — the user may want to type
        // a correction right away.
        if (approved) {
          emit('onAgentBusy')
          agentBusyState()
        }
        const escalatedData = pendingEscalated.get(requestId)

        if (escalatedData) {
          pendingEscalated.delete(requestId)
          emit('onEscalatedApprovalResult', requestId, approved, {
            command: escalatedData.command,
            explanation: escalatedData.explanation,
            approvalType: escalatedData.approvalType,
          })

          // The escalated card was never displayed inline, so this emit is
          // what surfaces it after resolution. In-stream the cumulative
          // array is correct; post-MESSAGE_END the accumulator was RESET, so
          // a cumulative (replace-mode) emit would wipe the trailing bubble
          // down to the lone card — emit only the resolved card(s) as an
          // append instead. Appends upsert by request id, so a replayed
          // append stays idempotent.
          const emitResolved = (segments: MessageSegment[]) => {
            if (isInStream) {
              emitSegments(segments)
              applySegmentsToState(segments, withSeqMeta(undefined))
              return
            }
            const delta = segments.filter(
              (s) =>
                (s.type === 'approval_request' && s.data.requestId === requestId) ||
                (s.type === 'approval_batch' && s.data.approvalRequestId === requestId),
            )
            emitSegments(delta, { append: true })
            applySegmentsToState(delta, withSeqMeta({ append: true }))
          }

          if (escalatedData.toolCalls && escalatedData.toolCalls.length > 0) {
            if (batchApprovalsEnabled) {
              emitResolved(
                accumulator.addApprovalBatch(
                  requestId,
                  escalatedData.approvalType,
                  escalatedData.toolCalls,
                  status,
                  undefined,
                  resolvedByName,
                ),
              )
            } else {
              let segments = accumulator.getSegments()
              for (const call of escalatedData.toolCalls) {
                if (!call.requiresApproval) continue
                segments = accumulator.addApprovalRequest(
                  requestId,
                  getCommandText(call),
                  call.toolExplanation,
                  escalatedData.approvalType,
                  status,
                )
              }
              emitResolved(segments)
            }
          } else {
            emitResolved(
              accumulator.addApprovalRequest(
                requestId,
                escalatedData.command,
                escalatedData.explanation,
                escalatedData.approvalType,
                status,
              ),
            )
          }
        } else {
          // Always keep the in-memory accumulator in sync so a following
          // text/tool event replays the resolved status into the message.
          accumulator.updateApprovalStatus(requestId, status, resolvedByName)
          // Conditional legacy emission — forwarded as onSegmentsUpdate only
          // when the consumer did NOT wire onApprovalResolved (the wrapper
          // resolves the condition at dispatch time).
          emit('segments-after-approval-result', accumulator.getSegments(), withSeqMeta(undefined))
        }

        // Cross-message status flip + status-map mirror (absorbed adapter
        // handler) — runs for both branches, matching the legacy adapter
        // whose onApprovalResolved callback fired unconditionally.
        setMessagesInternal(
          projectApprovalResolutionToMessages(messages, requestId, status, resolvedByName),
        )
        mirrorApprovalStatus(requestId, status)
        emit('onApprovalResolved', requestId, status, approvalType, resolvedByName)
        break
      }

      case 'error': {
        let message: string | undefined
        if (event.details) {
          try {
            message = JSON.parse(event.details)?.error?.message
          } catch {
            message = event.details
          }
        }
        const segments = accumulator.addError(event.title, message)
        emitSegments(segments)
        applySegmentsToState(segments, withSeqMeta(undefined))
        emit('onError', event.title, message)
        // Terminal turn failures can arrive without a MESSAGE_END; unlock
        // the composer unless an open stream still owns the phase.
        if (streamingPhase !== 'streaming') setPhaseInternal('idle')
        break
      }

      case 'participant': {
        if (event.kind === 'message-request') {
          emit('onUserMessage', event.text, {
            ownerType: event.ownerType,
            displayName: event.displayName,
            userId: event.userId,
            streamSeq: seq,
            contextItems: event.contextItems,
          })
          applyUserMessageToState(event)
        } else if (event.kind === 'direct-message') {
          emit('onDirectMessage', event.text, {
            ownerType: event.ownerType,
            displayName: event.displayName,
            userId: event.userId,
            streamSeq: seq,
          })
          applyDirectMessageToState(event)
        } else {
          emit('onSystemMessage', event.text, { streamSeq: seq })
          applySystemMessageToState(event)
        }
        break
      }

      case 'token-usage': {
        const data = {
          inputTokensSize: event.inputTokensSize,
          outputTokensSize: event.outputTokensSize,
          totalTokensSize: event.totalTokensSize,
          contextSize: event.contextSize,
        }
        emit('onTokenUsage', data)
        dialogTokenUsage = data
        invalidate()
        break
      }

      case 'compaction': {
        const standalone = !isInStream
        const segments =
          event.phase === 'start'
            ? accumulator.addContextCompaction()
            : accumulator.completeContextCompaction(event.summary)
        const meta = standalone ? ({ append: true, isCompacting: true } as const) : undefined
        emitSegments(segments, meta)
        applySegmentsToState(segments, withSeqMeta(meta))
        break
      }

      case 'dialog-closed': {
        emit('onDialogClosed')
        break
      }

      default:
        // Unknown / SSE-only event on the NATS kernel — ignore.
        break
    }
  }

  // ===========================================================================
  // SSE kernel — the absorbed useChat merge + decision_resolved receipt path
  // ===========================================================================

  /** Replace the trailing text segment of the LAST assistant message with
   *  the cumulative turn text (or push one). Mirrors `useChat`'s
   *  currentTextSegment handling byte-for-byte. */
  function sseWriteTrailingText(text: string): void {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    const segments = [...(last.segments ?? [])]
    const tail = segments[segments.length - 1]
    if (tail && tail.type === 'text') {
      segments[segments.length - 1] = { type: 'text', text }
    } else {
      segments.push({ type: 'text', text })
    }
    setMessagesInternal([...messages.slice(0, -1), { ...last, segments }])
  }

  function sseAppendText(text: string): void {
    sseCurrentText += text
    sseWriteTrailingText(sseCurrentText)
  }

  /** Single thinking segment per message, ALWAYS before the answer text:
   *  replaced in place when present, inserted at the FRONT otherwise. */
  function sseAppendThinking(escapedDelta: string): void {
    const last = messages[messages.length - 1]
    if (!last || last.role !== 'assistant') return
    const segments = [...(last.segments ?? [])]
    const idx = segments.findIndex((s) => s.type === 'thinking')
    if (idx !== -1) {
      const existing = segments[idx] as { type: 'thinking'; text: string }
      segments[idx] = { type: 'thinking', text: existing.text + escapedDelta }
    } else {
      segments.unshift({ type: 'thinking', text: escapedDelta })
    }
    setMessagesInternal([...messages.slice(0, -1), { ...last, segments }])
  }

  function mergeTurnMeta(sendIdx: number, partial: Partial<ChatTurnMeta>): void {
    const prev = metaMap.get(sendIdx) ?? createEmptyTurnMeta()
    const filtered = Object.fromEntries(
      Object.entries(partial).filter(([, v]) => v !== undefined && v !== null),
    ) as Partial<ChatTurnMeta>
    metaMap.set(sendIdx, { ...prev, ...filtered })
    invalidate()
  }

  function applySseApprovalResolved(event: ApprovalResolvedEvent, sendIdx: number): void {
    // Inline post-approve card ref → per-send refs map (the marker in the
    // receipt resolves through it on rehydration).
    const cardRef = event.cardRef as ChatRef | undefined
    if (cardRef?.id && event.cardType) {
      const existing = refsMap.get(sendIdx) ?? {}
      const key = buildChatRefKey(event.cardType, cardRef.id)
      refsMap.set(sendIdx, { ...existing, [key]: cardRef })
      invalidate()
    }
    const proposalId = event.requestId
    if (!proposalId) return

    // Step 1 — flip the SOURCE card's status (the approval card lives in an
    // EARLIER assistant message than the one being streamed into).
    setMessagesInternal(
      projectApprovalResolutionToMessages(messages, proposalId, event.status),
    )

    // Step 2 — server-rendered receipt into the CURRENT message. No
    // server-provided copy → don't fabricate a fallback.
    const receipt = typeof event.receiptText === 'string' ? event.receiptText : null
    if (receipt === null) return
    sseCurrentText = receipt + '\n\n'
    sseWriteTrailingText(sseCurrentText)

    // Step 3 — stamp the ref onto THIS assistant message so the
    // `[card://<type>:<id>]` marker resolves via `message.chatRefs`
    // independent of per-turn refsMap indexing.
    const refForMessage =
      cardRef && typeof (cardRef as { type?: unknown }).type === 'string' && typeof cardRef.id === 'string'
        ? cardRef
        : null
    if (refForMessage) {
      const last = messages[messages.length - 1]
      if (last && last.role === 'assistant') {
        const refKey = buildChatRefKey((refForMessage as { type: string }).type, refForMessage.id)
        setMessagesInternal([
          ...messages.slice(0, -1),
          { ...last, chatRefs: { ...(last.chatRefs ?? {}), [refKey]: refForMessage } },
        ])
      }
    }
  }

  function applySseMetadata(event: ChatMetadataEvent, sendIdx: number): void {
    if (event.routing) {
      mergeTurnMeta(sendIdx, {
        routedComplexity: event.routing.routedComplexity,
        routedThinkingBudget: event.routing.routedThinkingBudget,
      })
      return
    }
    if (event.sources) {
      sourcesMap.set(sendIdx, event.sources as unknown[])
      invalidate()
    }
    if (event.refs && typeof event.refs === 'object') {
      refsMap.set(sendIdx, event.refs as Record<string, ChatRef>)
      invalidate()
    }
    if (event.modelLabel || event.contextWindowMaxTokens || event.provider || event.modelName) {
      mergeTurnMeta(sendIdx, {
        provider: event.provider ?? null,
        modelLabel: event.modelLabel ?? null,
        contextWindowMaxTokens: event.contextWindowMaxTokens ?? null,
      })
    }
    const parsedAnchor = parseScrollAnchor(event.scrollAnchor)
    if (parsedAnchor !== null) {
      mergeTurnMeta(sendIdx, { scrollAnchor: parsedAnchor })
    }
  }

  function applySseUsage(event: UsageEvent, sendIdx: number): void {
    if (event.stage === 'start') {
      mergeTurnMeta(sendIdx, { inputTokens: event.input_tokens ?? null })
      return
    }
    // stage === 'end' — the trailing usage frame. Raw wire values pass the
    // legacy truthiness/typeof gates so a malformed frame degrades
    // identically to the pre-SSOT parser.
    const rawBreakdown = event.breakdown as Record<string, any> | null | undefined
    const breakdown: UnifiedUsageBreakdown | null =
      rawBreakdown && typeof rawBreakdown === 'object'
        ? {
            haikuRewriter:
              rawBreakdown.haikuRewriter && typeof rawBreakdown.haikuRewriter.input === 'number'
                ? rawBreakdown.haikuRewriter
                : undefined,
            haikuClassifier:
              rawBreakdown.haikuClassifier && typeof rawBreakdown.haikuClassifier.input === 'number'
                ? rawBreakdown.haikuClassifier
                : undefined,
            haikuSummarizer:
              rawBreakdown.haikuSummarizer && typeof rawBreakdown.haikuSummarizer.input === 'number'
                ? rawBreakdown.haikuSummarizer
                : undefined,
            routedAnswer:
              rawBreakdown.routedAnswer && typeof rawBreakdown.routedAnswer.model === 'string'
                ? rawBreakdown.routedAnswer
                : undefined,
          }
        : null
    mergeTurnMeta(sendIdx, {
      inputTokens: event.input_tokens ?? null,
      outputTokens: event.output_tokens ?? null,
      cacheHitRatePct: typeof event.hit_rate_pct === 'number' ? event.hit_rate_pct : null,
      ...(breakdown ? { breakdown } : {}),
    })
  }

  function applySse(event: ChatStreamEvent): void {
    const sendIdx = sendCount - 1
    switch (event.type) {
      case 'status':
        setPhaseInternal('thinking')
        break
      case 'thinking-delta':
        sseAppendThinking(escapeThinkingTags(event.text))
        break
      case 'turn-start':
        setPhaseInternal('streaming')
        break
      case 'text-delta':
        if (!event.leading) setPhaseInternal('streaming')
        sseAppendText(event.text)
        break
      case 'error':
        // Legacy parity: SSE tool errors surface as answer text.
        sseAppendText(`⚠️ ${event.title}`)
        break
      case 'approval-request': {
        // Flush any accumulated preamble text so the card lands after it.
        if (sseCurrentText) {
          sseWriteTrailingText(sseCurrentText)
          sseCurrentText = ''
        }
        const segment: ApprovalRequestSegment = {
          type: 'approval_request',
          data: {
            command: event.command ?? '',
            fields: event.fields,
            requestId: event.requestId,
            approvalType: event.approvalType,
          },
          status: 'pending',
          onApprove: callbacks.onApprove,
          onReject: callbacks.onReject,
        }
        const last = messages[messages.length - 1]
        if (last && last.role === 'assistant') {
          setMessagesInternal([
            ...messages.slice(0, -1),
            { ...last, segments: [...(last.segments ?? []), segment] },
          ])
        }
        break
      }
      case 'approval-resolved':
        applySseApprovalResolved(event, sendIdx)
        break
      case 'metadata':
        applySseMetadata(event, sendIdx)
        break
      case 'usage':
        applySseUsage(event, sendIdx)
        break
      // NOTE: 'tool-execution' is intentionally NOT handled on the SSE
      // kernel — the SSE wire never carries it, and routing it through the
      // accumulator would invoke resolvePendingApprovalForExecution, which
      // is a NATS-only semantic (observer streams without APPROVAL_RESULT).
      default:
        break
    }
  }

  // ===========================================================================
  // Public surface
  // ===========================================================================

  function apply(event: ChatStreamEvent): void {
    // seq-based idempotency: drop redelivered / out-of-order events.
    if (typeof event.seq === 'number') {
      if (event.seq <= lastAppliedSeq) return
      lastAppliedSeq = event.seq
    }
    if (transport === 'sse') applySse(event)
    else applyNats(event)
  }

  function reset(): void {
    messages = []
    streamingPhase = 'idle'
    dialogTokenUsage = null
    liveModel = null
    approvalStatuses = {}
    accumulator.reset()
    pendingEscalated.clear()
    isInStream = false
    hasEverStreamed = false
    sawDirectMessage = false
    directTeardownFired = false
    lastAppliedSeq = Number.NEGATIVE_INFINITY
    pendingEchoTexts = []
    adoptTrailingAssistant = false
    metaMap.clear()
    sourcesMap.clear()
    refsMap.clear()
    sendCount = 0
    sseCurrentText = ''
    invalidate()
  }

  function resetForDialogSwitch(): void {
    // Per-dialog reset. approvalStatuses deliberately SURVIVE — request ids
    // are globally unique and a resolved approval must not re-render as
    // actionable when its APPROVAL_RESULT row is missing from history pages.
    messages = []
    streamingPhase = 'idle'
    dialogTokenUsage = null
    liveModel = null
    accumulator.reset()
    pendingEscalated.clear()
    isInStream = false
    hasEverStreamed = false
    sawDirectMessage = false
    directTeardownFired = false
    lastAppliedSeq = Number.NEGATIVE_INFINITY
    pendingEchoTexts = []
    adoptTrailingAssistant = false
    invalidate()
  }

  function initializeWithState(
    nextMessages: UnifiedChatMessage[] | null,
    extras?: InitializeExtras,
  ): void {
    if (nextMessages !== null) {
      messages = nextMessages
    }
    if (extras) {
      accumulator.initializeWithState({
        existingSegments: extras.existingSegments,
        pendingApprovals: extras.pendingApprovals,
        executingTools: extras.executingTools,
      })
      if (extras.escalatedApprovals) {
        for (const [requestId, data] of extras.escalatedApprovals) {
          pendingEscalated.set(requestId, data)
          emit('onEscalatedApproval', requestId, data)
        }
      }
    }
    // Resumed dialog: a MESSAGE_START already fired server-side. Treat
    // subsequent continuation chunks (after the next MESSAGE_END) as
    // post-stream so they append into the existing bubble instead of
    // replacing its content via the cold-start cumulative path.
    hasEverStreamed = true
    invalidate()
  }

  return {
    apply,
    get state() {
      return getState()
    },
    reset,
    initializeWithState,

    setMessages(next) {
      messages = next
      invalidate()
    },
    prependMessages(older) {
      messages = [...older, ...messages]
      invalidate()
    },
    pushOptimisticSend(text, hidden = false) {
      // Record the text so the backend's MESSAGE_REQUEST echo consumes this
      // send instead of rendering a duplicate row (cap keeps the list from
      // growing if a backend never echoes).
      pendingEchoTexts.push(text)
      if (pendingEchoTexts.length > 5) pendingEchoTexts.shift()
      messages = [
        ...messages,
        {
          id: nextId('user'),
          role: 'user',
          content: text,
          ...(hidden ? { hidden: true } : {}),
        },
        { id: nextId('assistant'), role: 'assistant', content: '', segments: [] },
      ]
      streamingPhase = 'thinking'
      invalidate()
    },
    clearThread() {
      messages = []
      accumulator.reset()
      streamingPhase = 'idle'
      invalidate()
    },
    resetForDialogSwitch,

    beginSseSend({ text, hidden, userName = 'You', assistantName, assistantAvatar }) {
      const now = Date.now()
      messages = [
        ...messages,
        {
          id: `user-${now}`,
          role: 'user',
          name: userName,
          content: text,
          timestamp: new Date(now),
          ...(hidden ? { hidden: true } : {}),
        },
        {
          id: `assistant-${now}`,
          role: 'assistant',
          name: assistantName,
          content: '',
          segments: [],
          timestamp: new Date(now),
          ...(assistantAvatar !== undefined ? { avatar: assistantAvatar } : {}),
        },
      ]
      sendCount += 1
      sseCurrentText = ''
      streamingPhase = 'thinking'
      invalidate()
    },
    endSseTurn() {
      // Reject-path on confirm-tool emits ONLY a `decision_resolved` leading
      // frame and closes — no text segments stream in, so the placeholder
      // assistant message would render as a blank bubble. Remove the
      // trailing assistant message if it still has no content.
      const last = messages[messages.length - 1]
      if (
        last &&
        last.role === 'assistant' &&
        (last.segments?.length ?? 0) === 0 &&
        last.content === ''
      ) {
        messages = messages.slice(0, -1)
      }
      sseCurrentText = ''
      streamingPhase = 'idle'
      invalidate()
    },
    failSseTurn(errorMessage) {
      // Legacy `useChat` catch parity: the trailing (placeholder) message is
      // replaced by an error-role row.
      messages = [
        ...messages.slice(0, -1),
        {
          id: `error-${Date.now()}`,
          role: 'error',
          content: errorMessage,
          timestamp: new Date(),
        } as unknown as UnifiedChatMessage,
      ]
      sseCurrentText = ''
      streamingPhase = 'idle'
      invalidate()
    },
    seedSseMaps({ sources, refs, sendCount: seedSendCount }) {
      if (sources) for (const [k, v] of sources) sourcesMap.set(k, v)
      if (refs) for (const [k, v] of refs) refsMap.set(k, v)
      if (typeof seedSendCount === 'number') sendCount = seedSendCount
      invalidate()
    },

    setPhase(phase) {
      setPhaseInternal(phase)
    },
    setApprovalStatus(requestId, status) {
      if (status === null) {
        if (!(requestId in approvalStatuses)) return
        const next = { ...approvalStatuses }
        delete next[requestId]
        approvalStatuses = next
      } else {
        if (approvalStatuses[requestId] === status) return
        approvalStatuses = { ...approvalStatuses, [requestId]: status }
      }
      invalidate()
    },
    syncApprovalStatuses(statuses) {
      // Notifies through the NORMAL invalidate path. The old "silent" variant
      // (drop `stateCache` without calling `onChange`) let `getSnapshot()`
      // hand out a freshly-built object with no intervening store
      // notification — a tearing hazard that breaks the snapshot-stability
      // contract this file's header relies on. The silence existed only for
      // the deleted `useRealtimeChunkProcessor` wrapper, which called this on
      // EVERY render (a notify there would have looped). Every present caller
      // is effectful, so notifying is both correct and safe.
      if (approvalStatuses === statuses) return
      approvalStatuses = statuses
      invalidate()
    },
    mergeApprovalStatuses(persisted) {
      // Stream-learned entries win — see the interface doc for why.
      const keys = Object.keys(persisted)
      if (keys.length === 0) return
      let changed = false
      for (const key of keys) {
        if (!(key in approvalStatuses)) {
          changed = true
          break
        }
      }
      if (!changed) return
      approvalStatuses = { ...persisted, ...approvalStatuses }
      invalidate()
    },
    setDirectMode(isDirectMode) {
      directModeFlag = isDirectMode
    },
    setDialogTokenUsage(usage) {
      dialogTokenUsage = usage
      invalidate()
    },
    adjustAgentBusySuppression(delta) {
      suppressAgentBusy = Math.max(0, suppressAgentBusy + delta)
    },
    armAdoptTrailingAssistant(value) {
      adoptTrailingAssistant = value
    },

    projectApprovalResolution(requestId, status, resolvedByName) {
      setMessagesInternal(
        projectApprovalResolutionToMessages(messages, requestId, status, resolvedByName),
      )
      mirrorApprovalStatus(requestId, status)
    },
    projectToolExecution(segment) {
      // Merge-only: a projection must never grow a card on a side the tool
      // doesn't belong to, and must never re-enter the seq stream.
      const merged = mergeToolExecutionIfPresent(messages, segment)
      if (merged !== null) setMessagesInternal(merged)
    },

    getSegments() {
      return accumulator.getSegments()
    },
    updateApprovalStatus(requestId, status, resolvedByName) {
      const segments = accumulator.updateApprovalStatus(requestId, status, resolvedByName)
      setMessagesInternal(
        projectApprovalResolutionToMessages(messages, requestId, status, resolvedByName),
      )
      return segments
    },
    getPendingEscalated() {
      return new Map(pendingEscalated)
    },
  }
}
