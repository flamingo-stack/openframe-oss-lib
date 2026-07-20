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
import {
  CHAT_OWNER_ADMIN,
  type ChatStreamEvent,
  type ApprovalResolvedEvent,
  type ChatMetadataEvent,
  type ParticipantEvent,
  type UsageEvent,
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
  /**
   * The LOCAL user's id, either as a value or as a GETTER resolved at event
   * time. When it resolves to a value, an inbound `MESSAGE_REQUEST` that
   * DECLARES a different author (`event.userId !== selfUserId`) may not be
   * consumed as our own optimistic echo.
   *
   * Without it the echo list matches on RAW TEXT alone, which on a shared
   * ADMIN side (two technicians in one ticket, `ownEchoIncludesAdmin: true`)
   * can silently delete a colleague's message: if OUR send never echoes back,
   * its entry stays armed and the next identical text from anyone — canned
   * replies like "ok" / "done" / "on it" make this routine — is swallowed.
   *
   * The guard FAILS OPEN, deliberately: a row that carries NO `userId` is not
   * "someone else's", it is UNATTRIBUTED, and rejecting it would disable
   * dedup entirely (→ every send rendered twice) on any transport whose
   * decoder does not surface the author id. Such a row falls back to the
   * text + `OWN_ECHO_TTL_MS` behaviour instead, and a one-shot `console.warn`
   * makes the missing id observable.
   *
   * Pass a FUNCTION whenever the id can change or arrive late (auth
   * rehydration, logout / login-as-another-user without a reload): reducers
   * are retained for the store's lifetime, so a value captured at creation
   * time can go stale and silently disable the guard.
   */
  selfUserId?: string | (() => string | undefined)
}

/**
 * How long an un-consumed optimistic-echo entry stays armed **on the
 * UNATTRIBUTED path**. Long enough to cover any realistic send → server-echo
 * round trip, short enough that a send whose echo never lands cannot swallow
 * an unrelated identical message later in the conversation.
 *
 * A row that is DECLARED ours (`selfUserId` set and `event.userId ===
 * selfUserId`) gets the LONGER `OWN_ECHO_AUTHOR_TTL_MS` instead — see there.
 */
export const OWN_ECHO_TTL_MS = 30_000

/**
 * How long an un-consumed entry stays armed on the AUTHOR-MATCHED path
 * (`selfUserId` set, inbound row declares the same author).
 *
 * The author check rules out CROSS-technician theft, but NOT the same user on
 * a second tab or device: a row THIS tab did not originate looks exactly like
 * an author-matched echo. So the entry still needs an upper bound — without
 * one, a send whose echo never lands (dropped frame, backend text
 * normalization, reconnect gap) leaves the entry armed for the reducer's
 * whole lifetime, and the next identical text from the same user on ANOTHER
 * tab is silently swallowed. With `MAX_PENDING_ECHOES` armed slots and canned
 * replies ("ok", "done", "on it") being exactly the recurring strings, that is
 * a routine message-LOSS bug, strictly worse than the duplicate row it trades
 * against.
 *
 * Ten minutes is the bound: generously longer than the slow echo the author
 * path exists to protect (a JetStream catch-up replay after a network gap
 * arrives long after the send, and its rows carry `seq`, so the seq-less
 * content-dedup fallback cannot rescue it), and far shorter than the
 * "same text again an hour later" window in which a stale entry does damage.
 *
 * It is a BACKSTOP, not the usual bound: `turn-end` disarms entries much
 * sooner (see `purgeEchoesAtTurnEnd`). The ten minutes only ever apply to a
 * dialog that never reports a turn boundary at all.
 */
export const OWN_ECHO_AUTHOR_TTL_MS = 10 * 60_000

/** Cap on simultaneously-armed echo entries (a backend that never echoes must
 *  not grow the list without bound). */
const MAX_PENDING_ECHOES = 5

/** One armed optimistic-echo entry: the sent text and the wall-clock ms it was
 *  armed at. Exported because the LRU-eviction round trip PARKS these (see
 *  `getPendingEchoes` / `InitializeExtras.pendingEchoes`). */
export interface PendingEcho {
  text: string
  at: number
}

export interface InitializeExtras {
  existingSegments?: MessageSegment[]
  pendingApprovals?: Map<string, PendingApproval>
  executingTools?: Map<string, ExecutingToolState>
  escalatedApprovals?: Map<string, EscalatedApprovalData>
  /**
   * Approval statuses PARKED from a previous instance of this key (LRU
   * eviction hands them to `onEvict`). Merged with the same state-monotonic
   * precedence as `mergeApprovalStatuses` — a resolved approval must not come
   * back as actionable, which is exactly why `resetForDialogSwitch` preserves
   * this map rather than clearing it.
   */
  approvalStatuses?: Record<string, ChatApprovalStatus>
  /**
   * Seq cursor PARKED from a previous instance of this key. A recreated
   * reducer starts at `-Infinity`, so a host that replays from its own cursor
   * would re-apply already-applied events; restoring the parked value keeps
   * `apply()`'s idempotency gate intact across an eviction. Only ever moves
   * the gate FORWARD (a lower value is ignored).
   */
  lastAppliedSeq?: number
  /**
   * Armed optimistic-echo entries PARKED from a previous instance of this key.
   * Without them, a key LRU-evicted between `pushOptimisticSend` and its
   * `MESSAGE_REQUEST` echo leaves the replacement reducer with nothing armed,
   * so the echo renders a DUPLICATE user bubble. Entries already past
   * `OWN_ECHO_AUTHOR_TTL_MS` are dropped on restore (an expired entry could
   * only swallow an unrelated identical message), and the list is capped at
   * `MAX_PENDING_ECHOES` exactly as the live path is.
   */
  pendingEchoes?: readonly PendingEcho[]
  /**
   * Whether the restored thread is a RESUMED dialog (a `MESSAGE_START` already
   * fired server-side), which makes post-stream continuation chunks append
   * into the existing bubble instead of taking the cold-start cumulative path.
   * Defaults to "the restored thread is non-empty" — an eviction restore of a
   * key that never streamed must NOT claim it did, or a cold text-delta with
   * no preceding `turn-start` appends into a bubble that was never spawned.
   * Pass explicitly only to override that derivation.
   */
  resumed?: boolean
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
   * CANONICAL merge of a PERSISTED status map (host-side store, history
   * hydration, dialog-switch top-up) into this reducer's map.
   *
   * Precedence is STATE-MONOTONIC, not source-based, because either side can
   * be the stale one:
   *  - persisted lags (a snapshot taken before the stream resolved the
   *    request) → the stream's resolved status must win, or a just-approved
   *    card would be downgraded back to `pending` and re-arm its buttons;
   *  - the STREAM lags (this tab saw the request, the operator resolved it in
   *    a SECOND TAB, and the persisted map is the one carrying the truth) →
   *    the persisted resolution must win, or the card stays actionable and
   *    invites a second approve on an already-resolved request.
   *
   * With statuses being exactly `pending | approved | rejected | cancelled`,
   * "resolved beats pending" is a total order that gets both directions
   * right: take the persisted value when ours is `pending` and theirs isn't;
   * keep ours otherwise. Persisted entries still fill in every request-id the
   * stream hasn't seen (other dialogs, pre-session history).
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

  /**
   * The seq gate's current value (`-Infinity` before anything seq-carrying was
   * applied). Not part of `state` — it is bookkeeping, not render input — but
   * a host that PARKS a reducer (LRU eviction, dialog swap) needs it to
   * restore idempotency on the recreated instance via
   * `initializeWithState(messages, { lastAppliedSeq })`.
   */
  getLastAppliedSeq(): number

  /**
   * Currently-armed optimistic-echo entries. Same rationale as
   * `getLastAppliedSeq`: not render input, but a host that PARKS a reducer
   * needs them to restore echo dedup on the recreated instance via
   * `initializeWithState(messages, { pendingEchoes })` — otherwise an echo
   * in flight across the eviction renders a duplicate user bubble.
   */
  getPendingEchoes(): readonly PendingEcho[]

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
  let pendingEchoTexts: PendingEcho[] = []
  /** `Date.now()` of the last observed `turn-start`; 0 = none seen yet.
   *  Bounds `purgeEchoesAtTurnEnd` — see there. */
  let turnStartedAt = 0

  /** Consume a one-shot optimistic-echo entry for `text`. Returns true when
   *  this inbound row IS our own echo and must not render.
   *
   *  `authorMatched` widens the expiry window (`OWN_ECHO_AUTHOR_TTL_MS` vs
   *  `OWN_ECHO_TTL_MS`) — it does NOT remove it. The author check rules out a
   *  colleague's message, not the same user's second tab, so an entry whose
   *  echo never landed must still age out or it eventually swallows a real
   *  message. `MAX_PENDING_ECHOES` bounds growth on both paths. */
  function consumeOwnEcho(text: string, authorMatched = false): boolean {
    if (pendingEchoTexts.length === 0) return false
    const now = Date.now()
    // Purge at the WIDEST bound only: a short-TTL (unattributed) lookup must
    // not evict an entry that a later author-matched row is still entitled to
    // consume. The per-path window is applied at match time instead.
    pendingEchoTexts = pendingEchoTexts.filter((e) => now - e.at < OWN_ECHO_AUTHOR_TTL_MS)
    const ttl = authorMatched ? OWN_ECHO_AUTHOR_TTL_MS : OWN_ECHO_TTL_MS
    const idx = pendingEchoTexts.findIndex((e) => e.text === text && now - e.at < ttl)
    if (idx === -1) return false
    pendingEchoTexts.splice(idx, 1)
    return true
  }

  /** Disarm every echo entry that was armed BEFORE the turn this `turn-end`
   *  closes (i.e. before the last observed `turn-start`).
   *
   *  A `turn-end` is proof the server finished processing everything it had
   *  accepted up to that point, so an echo for a send made BEFORE the turn
   *  opened that has not landed by now never will (dropped frame, backend
   *  text normalization, reconnect gap). Keeping the entry armed for the full
   *  `OWN_ECHO_AUTHOR_TTL_MS` preserves up to ten minutes in which the same
   *  user's identical send from a SECOND TAB is silently swallowed — the
   *  message-LOSS failure this module ranks strictly worse than the duplicate
   *  row it trades against. Draining at the turn boundary cuts that window
   *  from ten minutes to one turn.
   *
   *  The purge is SELECTIVE (`at > turnStartedAt`) rather than unconditional:
   *  an entry armed DURING the turn being ended is not stale by the argument
   *  above — its echo is still in flight — and dropping it duplicates the
   *  user's bubble. Such entries survive to their normal author TTL; entries
   *  from earlier turns still drain here.
   *
   *  WHAT THIS COVERS, EXACTLY. `turnStartedAt` is the ARRIVAL wall-clock of
   *  the last `turn-start` this reducer saw, NOT the event's own time: the
   *  normalized event union carries no timestamp. `ChatStreamEventBase` has a
   *  single optional field, `seq` (JetStream `streamSeq`, lifted by
   *  `decodeNatsChunk`); the SSE decoder emits a bare `{ type: 'turn-start' }`
   *  with no envelope at all. The boundary is therefore an ARRIVAL order, and
   *  only these cases are actually handled:
   *
   *  - COVERED — a `turn-end` with NO observed `turn-start` purges nothing
   *    (`turnStartedAt` starts at 0; there is no boundary to be stale
   *    relative to). This is the approval-interrupt shape as the adapter
   *    drives it — sending while an approval pends cancels the in-flight
   *    turn, so the interrupted turn's `turn-end` lands after the new send
   *    armed its entry — and any stale `turn-end` on a fresh reducer.
   *  - COVERED — `turn-start` observed BEFORE the send, `turn-end` after: the
   *    entry was armed past the boundary and survives.
   *  - NOT COVERED — a reconnect catch-up replay that delivers BOTH a
   *    pre-disconnect `turn-start` and its `turn-end` after the user has
   *    already sent. The replayed `turn-start` restamps `turnStartedAt` to
   *    now, so the following `turn-end` purges a still-live entry and the
   *    echo renders a SECOND bubble. This is not fixable at this layer: with
   *    no event-own timestamp, that interleaving is indistinguishable from
   *    "the send was queued mid-turn, and this reducer's own turn opened and
   *    closed before the echo landed" — a case the module deliberately
   *    resolves toward the duplicate row rather than risk swallowing a real
   *    message. `seq` does not disambiguate it either: a replay whose seqs
   *    were already applied is dropped by `apply()`'s idempotency gate before
   *    reaching here, so any replay that DOES reach here carries
   *    strictly-increasing unseen seqs — exactly what a live turn carries.
   *    Pinned by the "a replayed turn boundary after a send duplicates the
   *    bubble" test. Fix it by giving the transport an event-own time, not by
   *    widening the purge here.
   *
   *  `OWN_ECHO_AUTHOR_TTL_MS` remains the backstop for dialogs that never
   *  report a turn boundary at all.
   *
   *  Same-millisecond ties break toward PURGING (`>`, not `>=`): a send and
   *  the turn it opened share a timestamp, and that entry IS the pre-turn
   *  one. A send made DURING a turn is a human action a turn-start later, so
   *  it never ties in practice. */
  function purgeEchoesAtTurnEnd(): void {
    if (pendingEchoTexts.length === 0) return
    if (turnStartedAt === 0) return
    pendingEchoTexts = pendingEchoTexts.filter((e) => e.at > turnStartedAt)
  }

  /** Resolve `selfUserId` AT EVENT TIME — a getter lets the host track auth
   *  rehydration / user switches on a reducer that outlives both. */
  function resolveSelfUserId(): string | undefined {
    const self = options.selfUserId
    return typeof self === 'function' ? self() : self
  }

  /** One-shot: the host configured `selfUserId` but inbound rows carry none,
   *  so the author guard is inert and dedup silently degrades to text+TTL. */
  let warnedIdLessAuthor = false
  function warnIdLessAuthor(): void {
    if (warnedIdLessAuthor) return
    warnedIdLessAuthor = true
    console.warn(
      '[chat] selfUserId is configured but an inbound MESSAGE_REQUEST carries no userId — ' +
        'the author echo guard is inert and dedup falls back to text + TTL matching. ' +
        'Check the transport decoder surfaces the author id (the ticket wire model ' +
        'declares it at `owner.userId`) and that it is in the SAME id space as selfUserId.',
    )
  }

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
    const adminEchoAllowed =
      ev.ownerType !== CHAT_OWNER_ADMIN || options.ownEchoIncludesAdmin === true
    // AUTHOR guard: with `selfUserId` configured, a row that DECLARES a
    // DIFFERENT author may not consume an echo entry. Two technicians on the
    // same ADMIN side both author ADMIN rows, so text alone cannot tell "my
    // echo" from "their message".
    //
    // It fails OPEN on an id-less row: the decoder may not surface the author
    // (the ticket wire model declares it at `owner.userId`, and the app's id
    // may live in another id space entirely), and treating "unattributed" as
    // "not mine" would disable dedup outright — every send rendered TWICE,
    // strictly worse than the bug the guard fixes. Unattributed rows fall back
    // to the text + TTL behaviour, with a one-shot warning so the
    // misconfiguration is observable.
    const selfUserId = resolveSelfUserId()
    const authorDeclared = typeof ev.userId === 'string' && ev.userId !== ''
    if (selfUserId !== undefined && !authorDeclared) warnIdLessAuthor()
    const authorMatched = selfUserId !== undefined && authorDeclared && ev.userId === selfUserId
    const authorEchoAllowed = selfUserId === undefined || !authorDeclared || authorMatched
    if (adminEchoAllowed && authorEchoAllowed && consumeOwnEcho(text, authorMatched)) return
    const authorType = ev.ownerType === CHAT_OWNER_ADMIN ? ('admin' as const) : ('user' as const)
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
        turnStartedAt = Date.now()
        emit('onStreamStart')
        applyStreamStartToState()
        accumulator.resetSegments()
        break
      }

      case 'turn-end': {
        isInStream = false
        purgeEchoesAtTurnEnd()
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
    turnStartedAt = 0
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
    turnStartedAt = 0
    adoptTrailingAssistant = false
    invalidate()
  }

  /** Canonical state-monotonic merge of a persisted / parked status map.
   *  "resolved beats pending" in BOTH directions — see the interface doc on
   *  `mergeApprovalStatuses`, which is this function. */
  function mergeApprovalStatusesInternal(
    persisted: Record<string, ChatApprovalStatus>,
  ): void {
    const keys = Object.keys(persisted)
    if (keys.length === 0) return
    let next: Record<string, ChatApprovalStatus> | null = null
    for (const key of keys) {
      const mine = approvalStatuses[key]
      const theirs = persisted[key]
      // Unknown here → adopt. Known → adopt only to upgrade pending →
      // resolved; never downgrade a resolution back to pending.
      const adopt = mine === undefined || (mine === 'pending' && theirs !== 'pending')
      if (!adopt || mine === theirs) continue
      next ??= { ...approvalStatuses }
      next[key] = theirs
    }
    if (next === null) return
    approvalStatuses = next
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
      // Parked state from a previous instance of this key (see the fields'
      // docs). Both are restore-only: statuses merge monotonically, the seq
      // gate only moves forward.
      if (extras.approvalStatuses) mergeApprovalStatusesInternal(extras.approvalStatuses)
      if (typeof extras.lastAppliedSeq === 'number' && extras.lastAppliedSeq > lastAppliedSeq) {
        lastAppliedSeq = extras.lastAppliedSeq
      }
      if (extras.pendingEchoes && extras.pendingEchoes.length > 0) {
        const now = Date.now()
        const restored = extras.pendingEchoes.filter(
          (e) => now - e.at < OWN_ECHO_AUTHOR_TTL_MS,
        )
        if (restored.length > 0) {
          pendingEchoTexts = [...pendingEchoTexts, ...restored.map((e) => ({ ...e }))]
          if (pendingEchoTexts.length > MAX_PENDING_ECHOES) {
            pendingEchoTexts = pendingEchoTexts.slice(-MAX_PENDING_ECHOES)
          }
        }
      }
    }
    // Resumed dialog: a MESSAGE_START already fired server-side. Treat
    // subsequent continuation chunks (after the next MESSAGE_END) as
    // post-stream so they append into the existing bubble instead of
    // replacing its content via the cold-start cumulative path.
    //
    // Gated on the restored thread being non-empty (overridable via
    // `extras.resumed`): the eviction round trip calls this for EVERY dropped
    // key, including one that never streamed and parked an empty thread.
    // Claiming "resumed" there would send a later cold text-delta with no
    // preceding `turn-start` down the append branch, so the first assistant
    // bubble never spawns.
    // Never DOWNGRADES an instance that already streamed — this only decides
    // whether the restore itself counts as evidence of a prior stream.
    hasEverStreamed = hasEverStreamed || (extras?.resumed ?? messages.length > 0)
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
      pendingEchoTexts.push({ text, at: Date.now() })
      if (pendingEchoTexts.length > MAX_PENDING_ECHOES) pendingEchoTexts.shift()
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
    mergeApprovalStatuses: mergeApprovalStatusesInternal,
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

    getLastAppliedSeq() {
      return lastAppliedSeq
    },
    getPendingEchoes() {
      // SNAPSHOT, not the live array: `pushOptimisticSend` pushes into and
      // `consumeOwnEcho` splices the same object, so handing it out would make
      // the `readonly` return type a lie and let a parked copy mutate under
      // its holder.
      return pendingEchoTexts.slice()
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
