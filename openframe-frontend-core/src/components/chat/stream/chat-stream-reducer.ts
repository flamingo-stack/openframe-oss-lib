/**
 * createChatStreamReducer: THE master chat-stream reader. One accumulation path for every source:
 *
 *   the hub's stream  → readUiChunks           ─┐
 *   a NATS chunk      → createMingoDecoder      ─┼→ { seq, chunks } → reducer.apply() → applyChunkToMessages
 *   history           → processHistoricalMessages → reducer.initializeWithState()
 *
 * What a chunk does to a message is `applyChunkToMessages`, the ONE accumulator the hub's writer runs too. What is here is
 * what a thread needs around it:
 *   - the phase, including an agent working outside an open turn;
 *   - who is talking: echo dedup and the rows a participant chunk creates;
 *   - the direct-mode barrier, once a technician has taken over;
 *   - what this client already knows about an approval a replay shows again;
 *   - the coverage stamp the history merge decides with.
 *
 * Idempotency:
 *   - an entry whose `seq` ≤ the last applied seq is dropped (per instance);
 *   - participant rows additionally dedup via a one-shot optimistic-echo
 *     list and a short same-author content window (seq-less transports);
 *   - a chunk that changes nothing returns the prior references.
 *
 * TRANSPORT ORDERING ASSUMPTION (the seq gate, see `apply()`): every
 * transport feeding this reducer is AT-LEAST-ONCE and IN-ORDER. JetStream
 * redelivers (hence the gate) but never reorders within a stream, and the
 * catchup back-fill replays a monotonically increasing range. So `seq <=
 * lastAppliedSeq` means "already applied", and dropping is correct.
 * A genuinely out-of-order arrival (seq 5 then 4) would be discarded
 * PERMANENTLY, accepted deliberately: no transport here reorders, and an
 * out-of-order buffer would add latency + unbounded state to guard against
 * a case that cannot occur. If a reordering transport is ever added, this
 * gate is the place that must change (do not paper over it downstream).
 *
 * PURE + framework-free: no React, no timers, no network. Parts are data: a message's controls reach
 * `ChatMessageActions` at render time.
 */

import { applyChunkToMessages, createWireState, messageHoldingChunk } from '../../../chat-protocol/apply-chunk';
import {
  isSourcePart,
  textOfParts,
  type ChatFilePart,
  type ChatMessage,
  type ChatMessageMetadata,
} from '../../../chat-protocol/chat-message';
import {
  approvalStatusOfResponse,
  isOwnRowGrant,
  type ChatParticipantChunk,
  type ChatStreamEntry,
  type UiChunk,
} from '../../../chat-protocol/ui-chunks';
import { OWNER_TYPE, type ChatApprovalStatus } from '../types/chat.types';
import type { DialogTokenUsage, StreamingPhase } from '../types/unified-chat-state.types';
import {
  CONTENT_DEDUP_WINDOW,
  SYSTEM_DEDUP_WINDOW,
  hasRecentMessage,
  knownApprovalAnswer,
  nextId,
  resolutionChunks,
} from './message-mutations';

// =============================================================================
// Public types
// =============================================================================

export interface ChatReducerState {
  messages: ChatMessage[];
  streamingPhase: StreamingPhase;
  /** The message the wire names as being written (a card's, on its answer). Null when it names none: then a chunk goes to the trailing assistant message. */
  writingMessageId: string | null;
  dialogTokenUsage?: DialogTokenUsage | null;
  liveModel?: {
    provider: string | null;
    modelLabel: string | null;
    contextWindowMaxTokens: number | null;
  } | null;
  /**
   * What this client knows about approvals and offers, by id, whoever told it. A card's status is its part's; this is
   * what a card a replay shows again starts from, so a resolved one does not come back as actionable.
   */
  approvalStatuses: Record<string, ChatApprovalStatus>;
}

/** What the stream said about the model. A host that shows it beside the thread takes it here. */
export interface ChatReducerEffect {
  name: 'onMetadata';
  args: [{ modelDisplayName?: string; modelName?: string; providerName?: string; contextWindow?: number }];
}

export interface ChatStreamReducerOptions {
  /** Seed for the approval-status map (request-id → status). */
  approvalStatuses?: Record<string, ChatApprovalStatus>;
  /** Engage the direct-mode barrier optimistically (host-known takeover). */
  isDirectMode?: boolean;
  /** Effect sink for a host that shows the model beside the thread. */
  onEffect?: (effect: ChatReducerEffect) => void;
  /** Notified after every state mutation (the dialog store wires this). */
  onChange?: () => void;
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
  ownEchoIncludesAdmin?: boolean;
  /**
   * The LOCAL user's id, either as a value or as a GETTER resolved at event
   * time. When it resolves to a value, an inbound `MESSAGE_REQUEST` that
   * DECLARES a different author (`data.userId !== selfUserId`) may not be
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
  selfUserId?: string | (() => string | undefined);
}

/**
 * How long an un-consumed optimistic-echo entry stays armed **on the
 * UNATTRIBUTED path**. Long enough to cover any realistic send → server-echo
 * round trip, short enough that a send whose echo never lands cannot swallow
 * an unrelated identical message later in the conversation.
 *
 * A row that is DECLARED ours (`selfUserId` set and `data.userId ===
 * selfUserId`) gets the LONGER `OWN_ECHO_AUTHOR_TTL_MS` instead — see there.
 */
export const OWN_ECHO_TTL_MS = 30_000;

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
 * It is a BACKSTOP, not the usual bound: `finish` disarms entries much
 * sooner (see `purgeEchoesAtTurnEnd`). The ten minutes only ever apply to a
 * dialog that never reports a turn boundary at all.
 */
export const OWN_ECHO_AUTHOR_TTL_MS = 10 * 60_000;

/** Cap on simultaneously-armed echo entries (a backend that never echoes must
 *  not grow the list without bound). */
const MAX_PENDING_ECHOES = 5;

/** One armed optimistic-echo entry: the sent text and the wall-clock ms it was
 *  armed at. Exported because the LRU-eviction round trip PARKS these (see
 *  `getPendingEchoes` / `InitializeExtras.pendingEchoes`). */
export interface PendingEcho {
  text: string;
  at: number;
}

export interface InitializeExtras {
  /**
   * Approval statuses PARKED from a previous instance of this key (LRU
   * eviction hands them to `onEvict`). Merged with the same state-monotonic
   * precedence as `mergeApprovalStatuses`: a resolved approval must not come
   * back as actionable, which is exactly why `resetForDialogSwitch` preserves
   * this map rather than clearing it.
   */
  approvalStatuses?: Record<string, ChatApprovalStatus>;
  /**
   * Seq cursor PARKED from a previous instance of this key. A recreated
   * reducer starts at `-Infinity`, so a host that replays from its own cursor
   * would re-apply already-applied events; restoring the parked value keeps
   * `apply()`'s idempotency gate intact across an eviction. Only ever moves
   * the gate FORWARD (a lower value is ignored).
   */
  lastAppliedSeq?: number;
  /**
   * Armed optimistic-echo entries PARKED from a previous instance of this key.
   * Without them, a key LRU-evicted between `pushOptimisticSend` and its
   * `MESSAGE_REQUEST` echo leaves the replacement reducer with nothing armed,
   * so the echo renders a DUPLICATE user bubble. Entries already past
   * `OWN_ECHO_AUTHOR_TTL_MS` are dropped on restore (an expired entry could
   * only swallow an unrelated identical message), and the list is capped at
   * `MAX_PENDING_ECHOES` exactly as the live path is.
   */
  pendingEchoes?: readonly PendingEcho[];
  /**
   * Whether the restored tail means the AGENT IS STILL WORKING, as opposed to
   * blocked on the user. Raises an `idle` reducer to `thinking` on restore
   * (same rule as a live busy signal: an open stream keeps the phase), which
   * is what puts the activity indicator back.
   *
   * Nothing on the wire restores this: the phase machine is driven by chunks,
   * and a run's EXECUTING chunk is long past by the time a reload happens while
   * its EXECUTED one may be minutes away. Derived once by
   * `extractIncompleteTailState` so every host agrees on the distinction: a
   * PENDING approval is the opposite state and must NOT spin.
   */
  agentBusy?: boolean;
}

export interface BeginSseSendOptions {
  text: string;
  /** Attachments: the message's `file` parts, after its text. */
  files?: readonly ChatFilePart[];
  hidden?: boolean;
}

// =============================================================================
// Reducer
// =============================================================================

export interface ChatStreamReducer {
  /** Apply the chunks one wire entry became. */
  apply(entry: ChatStreamEntry): void;
  /** Current immutable state snapshot (stable identity between mutations). */
  readonly state: ChatReducerState;
  /** Full reset: thread, dedup sets, seq gate, maps. */
  reset(): void;
  /**
   * Seed the thread (history hydration / persisted-state rehydration) and restore what a previous instance parked.
   * `messages: null` keeps the current thread.
   */
  initializeWithState(messages: ChatMessage[] | null, extras?: InitializeExtras): void;

  // ── Thread commands (adapter-driven, not wire events) ──────────────────
  setMessages(messages: ChatMessage[]): void;
  prependMessages(messages: ChatMessage[]): void;
  /** Optimistic local send: user bubble (+ echo record) + assistant placeholder. */
  pushOptimisticSend(text: string, hidden?: boolean): void;
  /** Wipe the thread, keep approval statuses. */
  clearThread(): void;
  /** Per-dialog reset (keeps approval statuses: request-ids are global). */
  resetForDialogSwitch(): void;

  // ── Hub turn commands ───────────────────────────────────────────────────
  beginSseSend(options: BeginSseSendOptions): void;
  /** What follows is drawn in this message: the card's, whose approval is being answered. */
  continueMessage(messageId: string): void;
  endSseTurn(): void;

  // ── Phase / status commands ─────────────────────────────────────────────
  /**
   * The turn being built ends with this failure on it: what it already said stays, and a message with no parts reads as
   * the failure alone. A host's own word about its own send, so no wire rule applies: the direct-mode barrier stops the
   * assistant's chunks, and a send that failed is not one.
   */
  failTurn(errorMessage: string): void;
  setPhase(phase: StreamingPhase): void;
  setApprovalStatus(requestId: string, status: ChatApprovalStatus | null): void;
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
  mergeApprovalStatuses(persisted: Record<string, ChatApprovalStatus>): void;
  setDirectMode(isDirectMode: boolean): void;
  setDialogTokenUsage(usage: DialogTokenUsage | null): void;
  /** +1/-1 windows during catchup replay (suppresses agent-busy locks). */
  adjustAgentBusySuppression(delta: number): void;
  /**
   * The next `start` re-streams the incomplete tail of this thread (a catchup replay from its MESSAGE_START): the stream
   * takes that message over instead of opening a second one.
   */
  armAdoptTrailingAssistant(value: boolean): void;

  // ── Cross-side projections (dialog-store fan-out) ───────────────────────
  projectApprovalResolution(requestId: string, status: ChatApprovalStatus, resolvedByName?: string | null): void;
  /** A tool chunk heard on another side of this dialog. Merge-only: it never grows a card on a side it does not belong to. */
  projectToolChunk(chunk: UiChunk): void;

  /**
   * The seq gate's current value (`-Infinity` before anything seq-carrying was
   * applied). Not part of `state` (it is bookkeeping, not render input), but
   * a host that PARKS a reducer (LRU eviction, dialog swap) needs it to
   * restore idempotency on the recreated instance via
   * `initializeWithState(messages, { lastAppliedSeq })`.
   */
  getLastAppliedSeq(): number;

  /**
   * Currently-armed optimistic-echo entries. Same rationale as
   * `getLastAppliedSeq`: not render input, but a host that PARKS a reducer
   * needs them to restore echo dedup on the recreated instance via
   * `initializeWithState(messages, { pendingEchoes })`. Otherwise an echo
   * in flight across the eviction renders a duplicate user bubble.
   */
  getPendingEchoes(): readonly PendingEcho[];
}

/** Chunks allowed through once the dialog is in direct mode. Everything else is the AI assistant's and gets dropped: an
 *  allowlist, so any future assistant chunk is blocked by default. */
function isDirectModeAllowed(chunk: UiChunk): boolean {
  return chunk.type === 'data-chat-participant' || chunk.type === 'data-dialog-closed';
}

/** Does this chunk write to a message's body? The old copy of an adopted turn gives way to the first one that does. */
function writesBody(chunk: UiChunk): boolean {
  switch (chunk.type) {
    case 'text-delta':
    case 'reasoning-delta':
    case 'tool-input-available':
    case 'tool-input-error':
      return true;
    default:
      return chunk.type.startsWith('data-') && !('transient' in chunk && chunk.transient === true);
  }
}

/** Is this chunk content the backend persists? Never the control chunks: a row's coverage must not outrun its content. */
function raisesCoverage(chunk: UiChunk): boolean {
  return writesBody(chunk) || chunk.type === 'tool-output-available' || chunk.type === 'tool-output-error';
}

/**
 * Does this entry mean the agent is working, even outside an open turn? Approved commands run between the approval's
 * bubble and the continuation stream, so a phase keyed on stream boundaries alone reads idle while tools execute. A card
 * is not a run: it waits on the user, and neither is a result, which ends one.
 */
function signalsAgentBusy(chunks: readonly UiChunk[]): boolean {
  let working = false;
  for (const chunk of chunks) {
    if (
      chunk.type === 'tool-approval-request' ||
      chunk.type === 'tool-output-available' ||
      chunk.type === 'tool-output-error'
    ) {
      return false;
    }
    if (chunk.type === 'tool-approval-response' && chunk.approved) working = true;
    if (chunk.type === 'tool-input-available' && chunk.toolMetadata?.batchId === undefined) working = true;
  }
  return working;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createChatStreamReducer(options: ChatStreamReducerOptions = {}): ChatStreamReducer {
  const { onEffect, onChange } = options;

  // ── Mutable internals ──────────────────────────────────────────────────
  let messages: ChatMessage[] = [];
  let streamingPhase: StreamingPhase = 'idle';
  let dialogTokenUsage: DialogTokenUsage | null = null;
  let liveModel: ChatReducerState['liveModel'] = null;
  let approvalStatuses: Record<string, ChatApprovalStatus> = {
    ...(options.approvalStatuses ?? {}),
  };

  const wire = createWireState({ newMessageId: () => nextId('assistant') });

  let isInStream = false;

  // Direct-mode barrier.
  let directModeFlag = options.isDirectMode ?? false;
  let sawDirectMessage = false;
  let directTeardownFired = false;

  // Idempotency. `apply()`'s global gate drops any entry whose seq was applied before, so a seq-carrying participant row
  // can never reach the handlers twice.
  let lastAppliedSeq = Number.NEGATIVE_INFINITY;
  let pendingEchoTexts: PendingEcho[] = [];
  /** `Date.now()` of the last observed `start`; 0 = none seen yet.
   *  Bounds `purgeEchoesAtTurnEnd`, see there. */
  let turnStartedAt = 0;

  /** Consume a one-shot optimistic-echo entry for `text`. Returns true when
   *  this inbound row IS our own echo and must not render.
   *
   *  `authorMatched` widens the expiry window (`OWN_ECHO_AUTHOR_TTL_MS` vs
   *  `OWN_ECHO_TTL_MS`) — it does NOT remove it. The author check rules out a
   *  colleague's message, not the same user's second tab, so an entry whose
   *  echo never landed must still age out or it eventually swallows a real
   *  message. `MAX_PENDING_ECHOES` bounds growth on both paths. */
  function consumeOwnEcho(text: string, authorMatched = false): boolean {
    if (pendingEchoTexts.length === 0) return false;
    const now = Date.now();
    // Purge at the WIDEST bound only: a short-TTL (unattributed) lookup must
    // not evict an entry that a later author-matched row is still entitled to
    // consume. The per-path window is applied at match time instead.
    pendingEchoTexts = pendingEchoTexts.filter(e => now - e.at < OWN_ECHO_AUTHOR_TTL_MS);
    const ttl = authorMatched ? OWN_ECHO_AUTHOR_TTL_MS : OWN_ECHO_TTL_MS;
    const idx = pendingEchoTexts.findIndex(e => e.text === text && now - e.at < ttl);
    if (idx === -1) return false;
    pendingEchoTexts.splice(idx, 1);
    return true;
  }

  /** Disarm every echo entry that was armed BEFORE the turn this `finish`
   *  closes (i.e. before the last observed `start`).
   *
   *  A `finish` is proof the server finished processing everything it had
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
   *  the last `start` this reducer saw, NOT the event's own time: the
   *  chunk union carries no timestamp, and an entry's only envelope is `seq`
   *  (JetStream `streamSeq`). The boundary is therefore an ARRIVAL order, and
   *  only these cases are actually handled:
   *
   *  - COVERED — a `finish` with NO observed `start` purges nothing
   *    (`turnStartedAt` starts at 0; there is no boundary to be stale
   *    relative to). This is the approval-interrupt shape as the adapter
   *    drives it — sending while an approval pends cancels the in-flight
   *    turn, so the interrupted turn's `finish` lands after the new send
   *    armed its entry — and any stale `finish` on a fresh reducer.
   *  - COVERED — `start` observed BEFORE the send, `finish` after: the
   *    entry was armed past the boundary and survives.
   *  - NOT COVERED — a reconnect catch-up replay that delivers BOTH a
   *    pre-disconnect `start` and its `finish` after the user has
   *    already sent. The replayed `start` restamps `turnStartedAt` to
   *    now, so the following `finish` purges a still-live entry and the
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
   *  one. A send made DURING a turn is a human action a `start` later, so
   *  it never ties in practice. */
  function purgeEchoesAtTurnEnd(): void {
    if (pendingEchoTexts.length === 0) return;
    if (turnStartedAt === 0) return;
    pendingEchoTexts = pendingEchoTexts.filter(e => e.at > turnStartedAt);
  }

  /** Resolve `selfUserId` AT EVENT TIME — a getter lets the host track auth
   *  rehydration / user switches on a reducer that outlives both. */
  function resolveSelfUserId(): string | undefined {
    const self = options.selfUserId;
    return typeof self === 'function' ? self() : self;
  }

  /** One-shot: the host configured `selfUserId` but inbound rows carry none,
   *  so the author guard is inert and dedup silently degrades to text+TTL. */
  let warnedIdLessAuthor = false;
  function warnIdLessAuthor(): void {
    if (warnedIdLessAuthor) return;
    warnedIdLessAuthor = true;
    console.warn(
      '[chat] selfUserId is configured but an inbound MESSAGE_REQUEST carries no userId: ' +
        'the author echo guard is inert and dedup falls back to text + TTL matching. ' +
        'Check the transport decoder surfaces the author id (the ticket wire model ' +
        'declares it at `owner.userId`) and that it is in the SAME id space as selfUserId.',
    );
  }

  // Adapter-armed flags.
  let suppressAgentBusy = 0;
  let adoptTrailingAssistant = false;
  /** A message a replay took over: the first chunk that writes to its body replaces it. Until then the old copy stays. */
  let adoptedMessageId: string | null = null;

  // ── Snapshot cache ─────────────────────────────────────────────────────
  let stateCache: ChatReducerState | null = null;
  function invalidate(): void {
    stateCache = null;
    onChange?.();
  }
  function getState(): ChatReducerState {
    // The wire moves inside a write, and not every move changes a message: a read says where it stands now.
    if (!stateCache || stateCache.writingMessageId !== wire.messageId) {
      stateCache = {
        messages,
        streamingPhase,
        writingMessageId: wire.messageId,
        dialogTokenUsage,
        liveModel,
        approvalStatuses,
      };
    }
    return stateCache;
  }

  function setMessagesInternal(next: ChatMessage[]): void {
    if (next !== messages) {
      messages = next;
      invalidate();
    }
  }

  function setPhaseInternal(phase: StreamingPhase): void {
    if (streamingPhase !== phase) {
      streamingPhase = phase;
      invalidate();
    }
  }

  /** Busy semantics: only 'idle' upgrades to 'thinking'; an open stream keeps ownership. Suppressed during catchup
   *  replay. */
  function agentBusyState(): void {
    if (suppressAgentBusy > 0) return;
    if (streamingPhase === 'idle') setPhaseInternal('thinking');
  }

  function mirrorApprovalStatus(requestId: string, status: ChatApprovalStatus): void {
    if (approvalStatuses[requestId] === status) return;
    approvalStatuses = { ...approvalStatuses, [requestId]: status };
    invalidate();
  }

  // ===========================================================================
  // Writing a chunk
  // ===========================================================================

  /**
   * What a chunk's write owes the row it touched: the time it was first seen, since a thread's order and a card's time
   * read it, and the highest chunk seq consumed into it.
   *
   * The seq is what `mergeHistoryWithRealtime` decides coverage with, per message. Leave it off and the merge has no
   * per-row signal, so it falls through to the wall-clock fallback ("this synthetic predates the fetch instant, so history
   * must contain it"), which is false for any turn the backend has not finished persisting: a history refetch mid-stream
   * (the one a reconnect fires) then drops every live assistant bubble but the streaming one, leaving the thread as just
   * the persisted user prompt.
   *
   * Monotonic: replay can re-apply an older seq, and coverage must never go backwards.
   */
  function stampWrite(
    before: ChatMessage[],
    next: ChatMessage[],
    chunk: UiChunk,
    seq: number | undefined,
  ): ChatMessage[] {
    let index = next.length - 1;
    while (index >= 0 && next[index] === before[index]) index -= 1;
    if (index < 0) return next;
    const message = next[index];
    if (message.role !== 'assistant') return next;
    const covered = message.metadata?.streamSeq;
    const raises = typeof seq === 'number' && raisesCoverage(chunk) && (covered === undefined || covered < seq);
    if (!raises && message.metadata?.createdAt !== undefined) return next;
    const metadata: ChatMessageMetadata = {
      ...message.metadata,
      ...(message.metadata?.createdAt === undefined ? { createdAt: nowIso() } : {}),
      ...(raises ? { streamSeq: seq } : {}),
    };
    const stamped = next.slice();
    stamped[index] = { ...message, metadata };
    return stamped;
  }

  /** The adopted message gives way: its sources stay (the replay lists them again, and they dedup), its body goes. */
  function replaceAdoptedBody(): void {
    const id = adoptedMessageId;
    adoptedMessageId = null;
    const index = messages.findIndex(message => message.id === id);
    if (index === -1) return;
    const next = messages.slice();
    next[index] = { ...next[index], parts: next[index].parts.filter(isSourcePart) };
    setMessagesInternal(next);
  }

  function write(chunk: UiChunk, seq?: number): void {
    if (adoptedMessageId !== null && writesBody(chunk)) replaceAdoptedBody();
    const before = messages;
    const next = applyChunkToMessages(before, chunk, wire);
    if (next !== before) setMessagesInternal(stampWrite(before, next, chunk, seq));
  }

  function resolve(id: string, status: ChatApprovalStatus, resolvedByName?: string | null): void {
    for (const chunk of resolutionChunks(id, status, resolvedByName)) {
      const before = messages;
      setMessagesInternal(applyChunkToMessages(before, chunk, wire));
    }
  }

  // ===========================================================================
  // A turn opening and ending
  // ===========================================================================

  function applyStart(chunk: Extract<UiChunk, { type: 'start' }>): void {
    isInStream = true;
    turnStartedAt = Date.now();
    setPhaseInternal('streaming');
    const adopt = adoptTrailingAssistant;
    adoptTrailingAssistant = false;
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') {
      if (adopt) {
        // The incomplete history tail, re-streamed from its start: this stream IS that message.
        wire.setMessageId(last.id);
        adoptedMessageId = last.id;
        write({ type: 'start', ...(chunk.messageMetadata ? { messageMetadata: chunk.messageMetadata } : {}) });
        return;
      }
      // Our own optimistic placeholder: the turn's id names it. A new stream never overwrites a completed bubble (an
      // observer tab, a second device, a post-approval continuation): `applyChunkToMessages` opens a fresh one.
      if (chunk.messageId !== undefined && last.parts.length === 0) wire.setMessageId(last.id);
    }
    adoptedMessageId = null;
    write(chunk);
  }

  function endStream(chunk: UiChunk): void {
    isInStream = false;
    adoptedMessageId = null;
    purgeEchoesAtTurnEnd();
    setPhaseInternal('idle');
    write(chunk);
  }

  // ===========================================================================
  // Participant rows
  // ===========================================================================

  /** MESSAGE_REQUEST echo: a user message from THIS or another session.
   *  Dedup layers in priority order: seq identity → one-shot optimistic-echo
   *  consumption → same-author content window (seq-less transports only). */
  function applyUserMessage(data: ChatParticipantChunk['data'], seq: number | undefined): void {
    const { text } = data;
    if (!text) return;
    // ADMIN rows are only echo-consumable when the host declares that its
    // operator IS the admin (see `ownEchoIncludesAdmin`). Otherwise an
    // ADMIN row is someone else's message and must always render.
    const adminEchoAllowed = data.ownerType !== OWNER_TYPE.ADMIN || options.ownEchoIncludesAdmin === true;
    // AUTHOR guard: with `selfUserId` configured, a row that DECLARES a
    // DIFFERENT author may not consume an echo entry. Two technicians on the
    // same ADMIN side both author ADMIN rows, so text alone cannot tell "my
    // echo" from "their message".
    //
    // It fails OPEN on an id-less row: the decoder may not surface the author
    // (the ticket wire model declares it at `owner.userId`, and the app's id
    // may live in another id space entirely), and treating "unattributed" as
    // "not mine" would disable dedup outright: every send rendered TWICE,
    // strictly worse than the bug the guard fixes. Unattributed rows fall back
    // to the text + TTL behaviour, with a one-shot warning so the
    // misconfiguration is observable.
    const selfUserId = resolveSelfUserId();
    const authorDeclared = typeof data.userId === 'string' && data.userId !== '';
    if (selfUserId !== undefined && !authorDeclared) warnIdLessAuthor();
    const authorMatched = selfUserId !== undefined && authorDeclared && data.userId === selfUserId;
    const authorEchoAllowed = selfUserId === undefined || !authorDeclared || authorMatched;
    if (adminEchoAllowed && authorEchoAllowed && consumeOwnEcho(text, authorMatched)) return;
    const authorType = data.ownerType === OWNER_TYPE.ADMIN ? ('admin' as const) : ('user' as const);
    if (
      typeof seq !== 'number' &&
      hasRecentMessage(
        messages,
        m =>
          m.role === 'user' &&
          (m.metadata?.author?.authorType ?? 'user') === authorType &&
          textOfParts(m.parts) === text,
        CONTENT_DEDUP_WINDOW,
      )
    ) {
      return;
    }
    setMessagesInternal([
      ...messages,
      {
        id: nextId('user'),
        role: 'user',
        metadata: {
          createdAt: nowIso(),
          // Coverage signal for the history merge. For `user-` rows it is also what tells a REPLAYED echo (history already
          // has its row) apart from a genuine new send that merely repeats an earlier text.
          ...(typeof seq === 'number' ? { streamSeq: seq } : {}),
          author: { ...(data.displayName ? { name: data.displayName } : {}), authorType },
          ...(data.contextItems && data.contextItems.length > 0 ? { contextItems: data.contextItems } : {}),
        },
        parts: [{ type: 'text', text }],
      },
    ]);
  }

  /** Technician / admin direct message into the dialog. */
  function applyDirectMessage(data: ChatParticipantChunk['data'], seq: number | undefined): void {
    const { text } = data;
    if (!text) return;
    // Seq-less fallback matches only prior ADMIN-authored twins: a client's
    // identical text must never suppress the technician's.
    if (
      typeof seq !== 'number' &&
      hasRecentMessage(
        messages,
        m => m.role === 'user' && m.metadata?.author?.authorType === 'admin' && textOfParts(m.parts) === text,
        CONTENT_DEDUP_WINDOW,
      )
    ) {
      return;
    }
    setMessagesInternal([
      ...messages,
      {
        id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        metadata: {
          createdAt: nowIso(),
          ...(typeof seq === 'number' ? { streamSeq: seq } : {}),
          author: { name: data.displayName ?? 'Admin', authorType: 'admin' },
        },
        parts: [{ type: 'text', text }],
      },
    ]);
  }

  /** System notice: a row of its own, the shape history gives it. */
  function applySystemMessage(data: ChatParticipantChunk['data'], seq: number | undefined): void {
    const { text } = data;
    if (!text) return;
    if (
      typeof seq !== 'number' &&
      hasRecentMessage(messages, m => m.role === 'system' && textOfParts(m.parts) === text, SYSTEM_DEDUP_WINDOW)
    ) {
      return;
    }
    setMessagesInternal([
      ...messages,
      {
        id: `system-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: 'system',
        metadata: {
          createdAt: nowIso(),
          ...(typeof seq === 'number' ? { streamSeq: seq } : {}),
          author: { authorType: 'system' },
        },
        parts: [{ type: 'text', text }],
      },
    ]);
  }

  function applyParticipant(chunk: ChatParticipantChunk, seq: number | undefined): void {
    const before = messages;
    if (chunk.data.kind === 'message-request') applyUserMessage(chunk.data, seq);
    else if (chunk.data.kind === 'direct-message') applyDirectMessage(chunk.data, seq);
    else applySystemMessage(chunk.data, seq);
    // A row that lands between turns ends what a standalone chunk had gathered: the next one starts below it.
    if (messages !== before && !isInStream) wire.setMessageId(null);
  }

  // ===========================================================================
  // One chunk
  // ===========================================================================

  function applyMetadata(chunk: Extract<UiChunk, { type: 'message-metadata' }>): void {
    const { model, modelLabel, provider, contextWindowMaxTokens } = chunk.messageMetadata;
    if (model !== undefined || modelLabel !== undefined || provider !== undefined) {
      onEffect?.({
        name: 'onMetadata',
        args: [
          {
            ...(modelLabel !== undefined ? { modelDisplayName: modelLabel } : {}),
            ...(model !== undefined ? { modelName: model } : {}),
            ...(provider !== undefined ? { providerName: provider } : {}),
            ...(contextWindowMaxTokens !== undefined ? { contextWindow: contextWindowMaxTokens } : {}),
          },
        ],
      });
      liveModel = {
        provider: provider || null,
        modelLabel: modelLabel || model || null,
        contextWindowMaxTokens: contextWindowMaxTokens || null,
      };
      invalidate();
    }
    write(chunk);
  }

  function applyOne(chunk: UiChunk, entry: ChatStreamEntry): void {
    const { seq } = entry;
    if (chunk.type === 'data-chat-participant' && chunk.data.kind === 'direct-message') sawDirectMessage = true;

    if ((directModeFlag || sawDirectMessage) && !isDirectModeAllowed(chunk)) {
      // Hard stop: tear down AI activity exactly once so the typing
      // indicator, composer lock, and half-rendered bubble clear, then drop
      // the chunk. Fires even when no stream is open: an agent-busy lock
      // (approved commands executing post-MESSAGE_END) has no other release
      // once the barrier starts dropping the continuation chunks.
      if (isInStream || !directTeardownFired) {
        isInStream = false;
        directTeardownFired = true;
        adoptedMessageId = null;
        // What the assistant said stands, closed: nothing more of it comes.
        setMessagesInternal(applyChunkToMessages(messages, { type: 'finish' }, wire));
        wire.setMessageId(null);
        setPhaseInternal('idle');
      }
      return;
    }

    switch (chunk.type) {
      case 'start':
        applyStart(chunk);
        break;

      case 'finish':
      case 'abort':
      case 'error':
        endStream(chunk);
        break;

      case 'message-metadata':
        applyMetadata(chunk);
        break;

      case 'text-delta':
        // The first text of a turn this client asked for.
        if (streamingPhase === 'thinking') setPhaseInternal('streaming');
        write(chunk, seq);
        break;

      case 'tool-approval-response':
        // A tool's report grants its own row through the same chunk an answer uses: nobody answered, whatever that row asked.
        if (!isOwnRowGrant(chunk, entry)) mirrorApprovalStatus(chunk.approvalId, approvalStatusOfResponse(chunk));
        write(chunk, seq);
        break;

      case 'data-escalation-offer': {
        if (chunk.data.status !== 'pending') {
          mirrorApprovalStatus(chunk.id, chunk.data.status);
          write(chunk, seq);
          break;
        }
        const known = approvalStatuses[chunk.id];
        write(known !== undefined ? { ...chunk, data: { ...chunk.data, status: known } } : chunk, seq);
        break;
      }

      // Drawn inline, and the turn goes on. A terminal failure can arrive without a MESSAGE_END, though, so it unlocks the
      // composer unless an open stream still owns the phase.
      case 'data-error':
        write(chunk, seq);
        if (streamingPhase !== 'streaming') setPhaseInternal('idle');
        break;

      case 'data-chat-participant':
        applyParticipant(chunk, seq);
        break;

      case 'data-token-usage':
        dialogTokenUsage = chunk.data;
        invalidate();
        break;

      case 'data-dialog-closed':
        break;

      default:
        write(chunk, seq);
        break;
    }
  }

  // ===========================================================================
  // Public surface
  // ===========================================================================

  /**
   * A card a replay shows again keeps the answer this client already knows. The batch's answer comes first (it is what
   * was answered, and it reaches the rows of the batch that ask nothing), and after the whole entry, so those rows are there.
   */
  function resolveKnownAnswers(entry: ChatStreamEntry): void {
    for (const chunk of entry.chunks) {
      if (chunk.type !== 'tool-approval-request') continue;
      const known = knownApprovalAnswer(approvalStatuses, chunk);
      if (known) resolve(known.id, known.status);
    }
  }

  function apply(entry: ChatStreamEntry): void {
    // seq-based idempotency: drop redelivered / out-of-order entries.
    if (typeof entry.seq === 'number') {
      if (entry.seq <= lastAppliedSeq) return;
      lastAppliedSeq = entry.seq;
    }
    for (const chunk of entry.chunks) applyOne(chunk, entry);
    resolveKnownAnswers(entry);
    if (!directModeFlag && !sawDirectMessage && signalsAgentBusy(entry.chunks)) agentBusyState();
  }

  function clearStreamState(): void {
    isInStream = false;
    sawDirectMessage = false;
    directTeardownFired = false;
    lastAppliedSeq = Number.NEGATIVE_INFINITY;
    pendingEchoTexts = [];
    turnStartedAt = 0;
    adoptTrailingAssistant = false;
    adoptedMessageId = null;
    wire.setMessageId(null);
    wire.textOffsets.clear();
  }

  function reset(): void {
    messages = [];
    streamingPhase = 'idle';
    dialogTokenUsage = null;
    liveModel = null;
    approvalStatuses = {};
    clearStreamState();
    invalidate();
  }

  /**
   * Per-dialog reset. EVERYTHING scoped to one dialog is dropped; the two
   * deliberate survivors are called out below, because "the full reset minus
   * an explicit, argued list" is the only form of this function that does not
   * rot: a field added to `reset()` and forgotten here is a cross-dialog leak.
   *
   * SURVIVOR 1 — `approvalStatuses`: request ids are globally unique, and a
   * resolved approval must not re-render as actionable when its
   * APPROVAL_RESULT row is missing from the refetched history page.
   *
   * SURVIVOR 2 — `suppressAgentBusy`: NOT dialog state, but a refcount for an
   * IN-FLIGHT operation, owned by the caller's `+1` / `-1` pairing around a
   * catchup window. Zeroing it here would break that pairing in exactly the
   * race the suppression exists for: on an A → B → A re-entry, A's first
   * catchup can still be replaying its dead tail (`EXECUTING_TOOL` chunks whose
   * releasing `MESSAGE_END` never replays) when the switch back resets, so
   * clearing the count would let that replay lock the composer — the bug
   * `adjustAgentBusySuppression` was introduced to prevent. The pairing is
   * already safe across a switch (`Math.max(0, …)` absorbs an over-decrement
   * and each `finally` is scoped to its own captured dialogId), so leaving the
   * count alone is both correct and sufficient. Pinned by the
   * "agent-busy suppression survives a dialog switch" test.
   */
  function resetForDialogSwitch(): void {
    messages = [];
    streamingPhase = 'idle';
    dialogTokenUsage = null;
    liveModel = null;
    clearStreamState();
    invalidate();
  }

  /** Canonical state-monotonic merge of a persisted / parked status map.
   *  "resolved beats pending" in BOTH directions — see the interface doc on
   *  `mergeApprovalStatuses`, which is this function. */
  function mergeApprovalStatusesInternal(persisted: Record<string, ChatApprovalStatus>): void {
    const keys = Object.keys(persisted);
    if (keys.length === 0) return;
    let next: Record<string, ChatApprovalStatus> | null = null;
    for (const key of keys) {
      const mine = approvalStatuses[key];
      const theirs = persisted[key];
      // Unknown here → adopt. Known → adopt only to upgrade pending →
      // resolved; never downgrade a resolution back to pending.
      const adopt = mine === undefined || (mine === 'pending' && theirs !== 'pending');
      if (!adopt || mine === theirs) continue;
      next ??= { ...approvalStatuses };
      next[key] = theirs;
    }
    if (next === null) return;
    approvalStatuses = next;
    invalidate();
  }

  function initializeWithState(nextMessages: ChatMessage[] | null, extras?: InitializeExtras): void {
    if (nextMessages !== null) {
      messages = nextMessages;
    }
    if (extras) {
      // Parked state from a previous instance of this key (see the fields'
      // docs). Both are restore-only: statuses merge monotonically, the seq
      // gate only moves forward.
      if (extras.approvalStatuses) mergeApprovalStatusesInternal(extras.approvalStatuses);
      if (typeof extras.lastAppliedSeq === 'number' && extras.lastAppliedSeq > lastAppliedSeq) {
        lastAppliedSeq = extras.lastAppliedSeq;
      }
      if (extras.pendingEchoes && extras.pendingEchoes.length > 0) {
        const now = Date.now();
        const restored = extras.pendingEchoes.filter(e => now - e.at < OWN_ECHO_AUTHOR_TTL_MS);
        if (restored.length > 0) {
          pendingEchoTexts = [...pendingEchoTexts, ...restored.map(e => ({ ...e }))];
          if (pendingEchoTexts.length > MAX_PENDING_ECHOES) {
            pendingEchoTexts = pendingEchoTexts.slice(-MAX_PENDING_ECHOES);
          }
        }
      }
    }
    // A tail the extractor judged agent-busy restores the activity indicator.
    // Routed through `agentBusyState` so the restore obeys the SAME rule a live
    // busy signal does: only 'idle' upgrades, an open stream keeps ownership.
    if (extras?.agentBusy) agentBusyState();
    invalidate();
  }

  return {
    apply,
    get state() {
      return getState();
    },
    reset,
    initializeWithState,

    setMessages(next) {
      messages = next;
      invalidate();
    },
    prependMessages(older) {
      messages = [...older, ...messages];
      invalidate();
    },
    pushOptimisticSend(text, hidden = false) {
      // Record the text so the backend's MESSAGE_REQUEST echo consumes this
      // send instead of rendering a duplicate row (cap keeps the list from
      // growing if a backend never echoes).
      pendingEchoTexts.push({ text, at: Date.now() });
      if (pendingEchoTexts.length > MAX_PENDING_ECHOES) pendingEchoTexts.shift();
      const placeholder = nextId('assistant');
      const createdAt = nowIso();
      messages = [
        ...messages,
        // An EMPTY-text send is out-of-band metadata, not something the user said. Never materialize a row for it.
        ...(text.length > 0
          ? ([
              {
                id: nextId('user'),
                role: 'user',
                metadata: { createdAt, ...(hidden ? { hidden: true } : {}) },
                parts: [{ type: 'text', text }],
              },
            ] satisfies ChatMessage[])
          : []),
        { id: placeholder, role: 'assistant', metadata: { createdAt }, parts: [] },
      ];
      wire.setMessageId(placeholder);
      streamingPhase = 'thinking';
      invalidate();
    },
    clearThread() {
      messages = [];
      adoptedMessageId = null;
      wire.setMessageId(null);
      wire.textOffsets.clear();
      streamingPhase = 'idle';
      invalidate();
    },
    resetForDialogSwitch,

    beginSseSend({ text, files = [], hidden }) {
      const now = Date.now();
      const createdAt = new Date(now).toISOString();
      const placeholder = `assistant-${now}`;
      messages = [
        ...messages,
        // A send with nothing to say makes no row. Hidden sends that DO carry text (an auto-continuation directive) still
        // become real state: the LLM must see them, `metadata.hidden` keeps them off screen.
        ...(text.length > 0 || files.length > 0
          ? ([
              {
                id: `user-${now}`,
                role: 'user',
                metadata: { createdAt, ...(hidden ? { hidden: true } : {}) },
                parts: [...(text.length > 0 ? [{ type: 'text' as const, text }] : []), ...files],
              },
            ] satisfies ChatMessage[])
          : []),
        {
          id: placeholder,
          role: 'assistant',
          metadata: { createdAt },
          parts: [],
        },
      ];
      wire.setMessageId(placeholder);
      wire.textOffsets.clear();
      streamingPhase = 'thinking';
      invalidate();
    },
    continueMessage(messageId) {
      wire.setMessageId(messageId);
      wire.textOffsets.clear();
      streamingPhase = 'thinking';
      invalidate();
    },
    endSseTurn() {
      // A stream that wrote nothing into its placeholder (it was refused, or it ended before it said anything) would
      // render a blank bubble. Remove the trailing assistant message if it still has no parts. A cut turn stays: its row
      // is where the reader learns the answer never came.
      const last = messages[messages.length - 1];
      if (
        last &&
        last.role === 'assistant' &&
        last.parts.length === 0 &&
        last.metadata?.finishReason !== 'interrupted'
      ) {
        messages = messages.slice(0, -1);
      }
      wire.setMessageId(null);
      wire.textOffsets.clear();
      streamingPhase = 'idle';
      invalidate();
    },
    failTurn(errorMessage) {
      write({ type: 'error', errorText: errorMessage });
      streamingPhase = 'idle';
      invalidate();
    },

    setPhase(phase) {
      setPhaseInternal(phase);
    },
    setApprovalStatus(requestId, status) {
      if (status === null) {
        if (!(requestId in approvalStatuses)) return;
        const next = { ...approvalStatuses };
        delete next[requestId];
        approvalStatuses = next;
      } else {
        if (approvalStatuses[requestId] === status) return;
        approvalStatuses = { ...approvalStatuses, [requestId]: status };
      }
      invalidate();
    },
    mergeApprovalStatuses: mergeApprovalStatusesInternal,
    setDirectMode(isDirectMode) {
      directModeFlag = isDirectMode;
    },
    setDialogTokenUsage(usage) {
      dialogTokenUsage = usage;
      invalidate();
    },
    adjustAgentBusySuppression(delta) {
      suppressAgentBusy = Math.max(0, suppressAgentBusy + delta);
    },
    armAdoptTrailingAssistant(value) {
      adoptTrailingAssistant = value;
    },

    projectApprovalResolution(requestId, status, resolvedByName) {
      resolve(requestId, status, resolvedByName);
      mirrorApprovalStatus(requestId, status);
    },
    projectToolChunk(chunk) {
      // Merge-only: a projection must never grow a card on a side the tool
      // doesn't belong to, and must never re-enter the seq stream.
      if (messageHoldingChunk(messages, chunk) === -1) return;
      setMessagesInternal(applyChunkToMessages(messages, chunk, wire));
    },

    getLastAppliedSeq() {
      return lastAppliedSeq;
    },
    getPendingEchoes() {
      // SNAPSHOT, not the live array: `pushOptimisticSend` pushes into and
      // `consumeOwnEcho` splices the same object, so handing it out would make
      // the `readonly` return type a lie and let a parked copy mutate under
      // its holder.
      return pendingEchoTexts.slice();
    },
  };
}
