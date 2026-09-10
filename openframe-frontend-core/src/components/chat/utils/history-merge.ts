import type { MessageContent } from '../types';

/**
 * Reconciliation between persisted dialog history (processed GraphQL pages)
 * and the realtime messages a chat client accumulated from streaming chunks.
 *
 * This is the missing middle piece of the chat pipeline this lib already
 * owns: `processHistoricalMessages*` produces one stream, the realtime chunk
 * processor / segment accumulator produces the other, and every host (Mingo,
 * tickets, openframe-chat) needs to merge them whenever history is (re)fetched.
 * Hand-rolled versions of this merge have produced both duplicated turns
 * (synthetic kept alongside its persisted twin) and lost turns (synthetic
 * trimmed against a stale snapshot that didn't contain its persisted twin
 * yet) — the freshness rule below is the invariant that prevents both.
 *
 * Pure on purpose: the host owns WHEN to merge (react-query wiring, store
 * writes), this module owns HOW.
 */

/** Minimal structural shape the merge needs — hosts pass their own message
 *  type and get it back. */
export interface MergeableChatMessage {
  id: string;
  role: string;
  content: MessageContent;
  timestamp?: Date;
  /** Highest CONTENT chunk streamSeq that composed this message (text / tool /
   *  approval / error / compaction — never the non-persisted MESSAGE_END /
   *  TOKEN_USAGE control chunks). Hosts stamp it on realtime synthetics so the
   *  merge can decide coverage per-message: a synthetic is in history once a
   *  persisted row of the SAME role reaches its seq. (Regular `user-`
   *  MESSAGE_REQUEST synthetics are the exception — the backend persists their
   *  rows without a seq, so they are deduped by content, not seq; see the merge.)
   *
   *  Stamp it on HISTORY rows too (from the persisted `lastChunkStreamSeq`)
   *  when available: the merge then computes a PER-ROLE max from history and a
   *  synthetic is "covered" only when a persisted row of its own role actually
   *  reached its seq. Without per-row history seqs the merge falls back to the
   *  single global `historyMaxStreamSeq`, which a later/other-role row can push
   *  past a synthetic whose turn is NOT in the snapshot (interrupted /
   *  async-persisted) — dropping a message the user saw with no replay to
   *  restore it. Optional — absent on hosts that don't stamp it (those keep the
   *  global-seq / wall-clock behaviour). */
  streamSeq?: number;
}

/** Ids minted client-side by realtime chunk processors
 *  (`assistant-<ts>-…` placeholder bubbles, `user-<ts>-…` peer messages,
 *  `direct-<ts>-…` technician direct messages, `system-<ts>-…` system notices,
 *  `error-<ts>` stream errors). They never match the Mongo ObjectIds history
 *  returns for the same turns. This is the cross-host contract every minting
 *  site (lib `use-chat`, Mingo / tickets chunk processors, openframe-chat)
 *  must keep matching — exported so it lives in exactly one place.
 *  `direct-`/`system-` are persisted (as ADMIN/SYSTEM history rows) and so are
 *  replayed by JetStream on reconnect; without them here a replayed direct
 *  message renders twice (its persisted twin + the fresh synthetic).
 *  `welcome-` and `optimistic-` ids are intentionally NOT listed: welcome
 *  bubbles are never persisted server-side, and optimistic user messages are
 *  deduped by content below. */
export const SYNTHETIC_REALTIME_ID_PREFIXES = ['assistant-', 'user-', 'direct-', 'system-', 'error-'] as const;

function isSyntheticRealtimeId(id: string): boolean {
  return SYNTHETIC_REALTIME_ID_PREFIXES.some(prefix => id.startsWith(prefix));
}

/** Host-minted user bubble of a send in flight. Deliberately NOT one of the
 *  synthetic-realtime prefixes — see the note above them. */
function isOptimisticId(id: string): boolean {
  return id.startsWith('optimistic-');
}

/** Peer `MESSAGE_REQUEST` echo (another session's send). Its persisted twin is
 *  the one row kind the backend never stamps with a `lastChunkStreamSeq`, so
 *  seq can never prove it in or out of a snapshot — every site that treats
 *  `user-` specially exists for that, and all of them go when the backend
 *  starts stamping user rows. */
function isUserRequestSyntheticId(id: string): boolean {
  return id.startsWith('user-');
}

/** A row this client made up and never fetched. Everything else (`welcome-`
 *  included) reads as a persisted row where the thread's own shape cannot say
 *  otherwise. */
function isClientMintedId(id: string): boolean {
  return isSyntheticRealtimeId(id) || isOptimisticId(id);
}

/** The host's greeting on a fresh dialog: never persisted, belongs at the top. */
function isWelcomeId(id: string): boolean {
  return id.startsWith('welcome-');
}

/** Rendered answer text of an assistant message (TEXT segments, or a plain string). Used to
 *  recognise a replayed synthetic as the twin of an already-persisted turn when the stream-seq
 *  signal can't prove it (see the trailing-turn fallback below). Empty for tool/approval-only
 *  turns that carry no answer text — callers must treat "" as "no signal", never as a match. */
function assistantAnswerText(content: MessageContent): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const seg of content) {
    if (seg.type === 'text') parts.push(seg.text);
  }
  return parts.join('\n').trim();
}

/**
 * Backend request ids carried by a turn's segments — tool-call ids, approval
 * request ids, batch ids.
 *
 * These identify the TURN, which is what lets the merge recognise history's
 * persisted row and a live synthetic as two copies of the same thing when
 * their IDS DIFFER. Ids only converge through adoption, and adoption only
 * happens on a replay (a reload re-streams the turn into the persisted row);
 * a refetch that lands mid-stream has no replay, so the live copy keeps the
 * synthetic id the reducer minted.
 *
 * Empty for a turn that has produced only text — callers must treat an empty
 * set as "no signal", never as a match.
 */
function turnRequestKeys(content: MessageContent): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(content)) return keys;
  for (const seg of content) {
    if (seg.type === 'tool_execution') {
      const id = seg.data?.toolExecutionRequestId;
      if (id) keys.add(id);
    } else if (seg.type === 'approval_request') {
      const id = seg.data?.requestId;
      if (id) keys.add(id);
    } else if (seg.type === 'escalation_offer') {
      const id = seg.data?.offerId;
      if (id) keys.add(id);
      // `ticket_escalated` is deliberately absent: its only id is the ticketId,
      // which is dialog-scoped, so a re-escalated dialog would false-match an
      // older bubble and slice the newest persisted turn out of the thread.
    } else if (seg.type === 'approval_batch') {
      const data = seg.data;
      if (data?.approvalRequestId) keys.add(data.approvalRequestId);
      for (const call of data?.toolCalls ?? []) {
        if (call?.toolExecutionRequestId) keys.add(call.toolExecutionRequestId);
      }
    }
  }
  return keys;
}

/** Whether any of a turn's `keys` (see `turnRequestKeys`) is in `others`. */
function sharesRequestKey(keys: ReadonlySet<string>, others: ReadonlySet<string>): boolean {
  if (keys.size === 0 || others.size === 0) return false;
  for (const key of keys) {
    if (others.has(key)) return true;
  }
  return false;
}

/** A user row's identity is its text; empty text is no identity (system rows
 *  persist with `content: ''`). `''` for any other row. */
function userText(m: MergeableChatMessage): string {
  return m.role === 'user' && typeof m.content === 'string' ? m.content : '';
}

/** What a set of rows says about the turns they render, so another copy of one
 *  of those turns can be recognised under a DIFFERENT id: the backend request
 *  ids their segments carry, their answer texts and their user texts. The text
 *  maps count occurrences for the callers that pair copies positionally (a
 *  repeated prompt twins the NEWEST unclaimed same-text row); `twinVerdict`
 *  itself reads them as presence. Empty user text carries no identity (system
 *  rows persist with `content: ''`) and is left out. */
interface TwinSignals {
  requestKeys: Set<string>;
  assistantTexts: Map<string, number>;
  userContents: Map<string, number>;
}

function collectTwinSignals(rows: readonly MergeableChatMessage[]): TwinSignals {
  const signals: TwinSignals = { requestKeys: new Set(), assistantTexts: new Map(), userContents: new Map() };
  for (const row of rows) {
    for (const key of turnRequestKeys(row.content)) signals.requestKeys.add(key);
    if (row.role === 'assistant') {
      const text = assistantAnswerText(row.content);
      if (text !== '') signals.assistantTexts.set(text, (signals.assistantTexts.get(text) ?? 0) + 1);
      continue;
    }
    const text = userText(row);
    if (text !== '') signals.userContents.set(text, (signals.userContents.get(text) ?? 0) + 1);
  }
  return signals;
}

type TwinVerdict = 'twin' | 'distinct' | 'unknown';

/** Whether `m` renders one of the turns `signals` describe. 'twin': a shared
 *  request id, a user text held verbatim, or an answer text that is a prefix
 *  either way of one held — streaming only appends, so a copy cut short, or a
 *  persisted row still being written, is a prefix of the full one. 'unknown':
 *  the row carries nothing a twin could be recognised by (no user text, no
 *  request id, no answer text), so "no match" says nothing about it. */
function twinVerdict(signals: TwinSignals, m: MergeableChatMessage): TwinVerdict {
  if (m.role !== 'assistant') {
    const text = userText(m);
    if (text === '') return 'unknown';
    return signals.userContents.has(text) ? 'twin' : 'distinct';
  }
  const keys = turnRequestKeys(m.content);
  if (keys.size > 0) return sharesRequestKey(keys, signals.requestKeys) ? 'twin' : 'distinct';
  const text = assistantAnswerText(m.content);
  if (text === '') return 'unknown';
  for (const other of signals.assistantTexts.keys()) {
    if (other.startsWith(text) || text.startsWith(other)) return 'twin';
  }
  return 'distinct';
}

/** Flattens DESC-sorted message pages (newest page first, newest message
 *  first within a page) into one chronological list. */
export function flattenMessagePagesChronological<T>(pages: readonly { messages: readonly T[] }[] | undefined): T[] {
  if (!pages) return [];
  return [...pages].reverse().flatMap(page => [...page.messages].reverse());
}

/** Max `lastChunkStreamSeq` across history pages — the history half of the
 *  merge's seq-coverage signal (`HistoryMergeInput.historyMaxStreamSeq`),
 *  also used by hosts as the JetStream replay start offset. 0 = unstamped. */
export function maxPersistedStreamSeq(
  pages: readonly { messages: readonly { lastChunkStreamSeq?: number | null }[] }[] | undefined,
): number {
  let max = 0;
  if (!pages) return max;
  for (const page of pages) {
    for (const msg of page.messages) {
      const seq = msg.lastChunkStreamSeq;
      if (typeof seq === 'number' && seq > max) max = seq;
    }
  }
  return max;
}

export interface HistoryMergeInput<M extends MergeableChatMessage> {
  /** Processed history in chronological order (all fetched pages). */
  processedHistory: M[];
  /** Raw history message ids across all fetched pages, when they can differ
   *  from processed ids (processing may merge/rename). Optional — pass when
   *  available so raw-id duplicates are filtered too. */
  rawHistoryIds?: ReadonlySet<string>;
  /** Messages currently in the host store for this dialog (realtime + prior merges). */
  existingMessages: M[];
  /** Id of the in-flight streaming synthetic, if any. Never dropped.
   *  IMPORTANT: hosts must not pass a STALE id here (e.g. a streaming entry
   *  left behind by unmounting mid-stream) — gate it on the server-side
   *  stream state when available, or the synthetic will be exempted forever. */
  streamingMessageId: string | null;
  /** Epoch ms when the history pages were fetched (react-query `dataUpdatedAt`).
   *  Wall-clock freshness fallback used when seq coverage (below) is unknown:
   *  a synthetic created AFTER this instant cannot be represented in the
   *  snapshot, so it must be kept. NOTE this heuristic is blind to chunk
   *  REPLAY, which re-mints synthetics for old turns with fresh timestamps —
   *  pass the seq fields whenever the host tracks them. */
  historyFetchedAt: number;
  /** Max `lastChunkStreamSeq` across the raw history pages, when the backend
   *  stamps it (see `maxPersistedStreamSeq`). Together with
   *  `realtimeSeenStreamSeq` this gives an exact coverage signal that
   *  replaces the wall-clock heuristic. */
  historyMaxStreamSeq?: number;
  /** Highest stream seq this client has consumed for the dialog (live or
   *  replayed chunks). */
  realtimeSeenStreamSeq?: number;
}

export function mergeHistoryWithRealtime<M extends MergeableChatMessage>(input: HistoryMergeInput<M>): M[] {
  const {
    processedHistory,
    rawHistoryIds,
    existingMessages,
    streamingMessageId,
    historyFetchedAt,
    historyMaxStreamSeq = 0,
    realtimeSeenStreamSeq = 0,
  } = input;

  // An empty snapshot can't dedupe anything — merging would only let the
  // freshness rules below wipe completed realtime messages (e.g. persistence
  // lag on a fresh dialog). The realtime side stays the source of truth.
  if (processedHistory.length === 0) return existingMessages;

  const processedIds = new Set(processedHistory.map(m => m.id));

  // Seq-based coverage: every synthetic is derived from consumed chunks, so
  // when history's max persisted seq reaches the highest seq this client has
  // consumed, ALL synthetics are represented in history (drop them); when it
  // hasn't, history is provably behind (keep them ALL — even ones that look
  // old by wall-clock, e.g. re-minted by a chunk replay). `null` = signal
  // unavailable (legacy transport / backend without seq stamps) → fall back
  // to the per-message wall-clock rule.
  const seqCoverageKnown = realtimeSeenStreamSeq > 0 && historyMaxStreamSeq > 0;
  const historyCoversRealtime = seqCoverageKnown ? historyMaxStreamSeq >= realtimeSeenStreamSeq : null;

  // Per-role max persisted streamSeq, computed from history rows that carry a
  // per-row `streamSeq` (hosts stamp it from `lastChunkStreamSeq`). The single
  // global `historyMaxStreamSeq` is a MAX over ALL rows, so a later turn or an
  // other-role row (e.g. a user MESSAGE_REQUEST) can push it past a synthetic
  // whose OWN turn is not in the snapshot yet — the merge then "covers" and
  // drops that synthetic with no twin to replace it (permanent loss on stop /
  // reload / any recompute). Deciding coverage against the same-role max
  // instead means a synthetic is dropped only when a persisted row of its role
  // actually reached its seq. `anyHistoryRowSeq` gates the whole scheme: when
  // no history row is seq-stamped (legacy hosts) we keep the previous global
  // behaviour unchanged.
  const historyMaxSeqByRole = new Map<string, number>();
  let anyHistoryRowSeq = false;
  for (const pm of processedHistory) {
    if (typeof pm.streamSeq === 'number') {
      anyHistoryRowSeq = true;
      const prev = historyMaxSeqByRole.get(pm.role) ?? 0;
      if (pm.streamSeq > prev) historyMaxSeqByRole.set(pm.role, pm.streamSeq);
    }
  }

  // Persistence is asynchronous per-chunk: an assistant turn ending in an
  // approval can have its APPROVAL_REQUEST document persisted before the
  // leading THINKING/TEXT documents, so history can return a partial trailing
  // assistant (just `[approval_batch]`) while the realtime store already has
  // the full `[thinking, text, approval_batch]` synthetic. Resolve by
  // `approval_batch.approvalRequestId`:
  //   - if the existing twin is the LIVE streaming message, or has more
  //     segments — drop the history assistant and pin the twin (realtime is
  //     the more complete / still-growing copy).
  //   - else (history is at least as complete) — drop the twin.
  const trailing = processedHistory[processedHistory.length - 1];
  const historyTrailingAssistant = trailing?.role === 'assistant' ? trailing : null;
  const historyBatchId =
    historyTrailingAssistant && Array.isArray(historyTrailingAssistant.content)
      ? (historyTrailingAssistant.content.find(s => s.type === 'approval_batch')?.data?.approvalRequestId ?? null)
      : null;

  let processedToUse = processedHistory;
  const pinnedSyntheticIds = new Set<string>();
  const droppedSyntheticIds = new Set<string>();

  if (historyBatchId) {
    const batchTwins = existingMessages.filter(
      m =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.some(s => s.type === 'approval_batch' && s.data?.approvalRequestId === historyBatchId),
    );
    // Prefer the live streaming twin; otherwise the most recent one (a stale
    // replay-minted duplicate may precede it).
    const existingWithSameBatch =
      batchTwins.find(m => m.id === streamingMessageId) ?? batchTwins[batchTwins.length - 1];
    if (existingWithSameBatch && Array.isArray(existingWithSameBatch.content)) {
      const histSize = Array.isArray(historyTrailingAssistant?.content) ? historyTrailingAssistant.content.length : 0;
      const realtimeSize = existingWithSameBatch.content.length;
      if (existingWithSameBatch.id === streamingMessageId || realtimeSize > histSize) {
        processedToUse = processedHistory.slice(0, -1);
        pinnedSyntheticIds.add(existingWithSameBatch.id);
      } else {
        droppedSyntheticIds.add(existingWithSameBatch.id);
      }
    }
  }

  // Adoption pin, generalised to plain tool turns (no approval batch). After a
  // mid-stream reload the trailing assistant is a PERSISTED row (Mongo id); the
  // chunk processors ADOPT it and append later chunks IN PLACE, so the store's
  // copy keeps that Mongo id but accumulates MORE than history has persisted yet
  // (a later tool, a tool's terminal state). `processedIds` would then drop that
  // richer realtime copy as an id-duplicate and revert the bubble to history's
  // stale segments — the reported "3 tools collapse to 2, one stuck pending
  // instead of failed" after reload + stop. When a same-id realtime twin is
  // strictly richer than the persisted trailing (more segments, or an equal
  // count but a higher consumed `streamSeq`), pin it and drop history's copy —
  // the same rule the approval-batch branch above applies, for any trailing
  // assistant. Skipped when that branch already claimed the trailing turn (its
  // slice moved the last element) or the trailing isn't an assistant. Once the
  // backend finishes persisting the turn, history's length/seq catch up, the
  // twin is no longer richer, and the persisted copy wins again (self-heals).
  if (
    historyTrailingAssistant &&
    Array.isArray(historyTrailingAssistant.content) &&
    processedToUse[processedToUse.length - 1] === historyTrailingAssistant &&
    !pinnedSyntheticIds.has(historyTrailingAssistant.id)
  ) {
    const persistedSize = historyTrailingAssistant.content.length;
    const persistedSeq = historyTrailingAssistant.streamSeq ?? 0;
    // Turn identity for a twin that has NOT adopted the persisted id. Adoption
    // only happens on a REPLAY (a reload re-streams the turn from its
    // MESSAGE_START into the persisted row); a refetch that lands while the
    // turn is still streaming has no replay, so the live copy keeps the
    // synthetic id the reducer minted and the id test above can never match.
    // Both copies do carry the backend's per-call request ids, which identify
    // the TURN — the same trick the approval-batch branch plays with
    // `approvalRequestId`, widened to tool calls.
    const trailingKeys = turnRequestKeys(historyTrailingAssistant.content);
    const isSameTurn = (m: M): boolean =>
      m.id === historyTrailingAssistant.id || sharesRequestKey(turnRequestKeys(m.content), trailingKeys);
    const richerTwin = existingMessages.find(
      m =>
        m !== historyTrailingAssistant &&
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        isSameTurn(m) &&
        // A STILL-STREAMING twin wins outright: it is the copy the chunks are
        // landing in, so "richer" is a property it is about to have anyway,
        // and history's snapshot of a turn in flight is stale by construction.
        // Without this the same turn rendered TWICE — history's partial copy
        // beside the live one, their tool rows disagreeing (one pending, one
        // failed) because each stopped at a different chunk.
        (m.id === streamingMessageId ||
          m.content.length > persistedSize ||
          (m.content.length === persistedSize && typeof m.streamSeq === 'number' && m.streamSeq > persistedSeq)),
    );
    if (richerTwin) {
      processedToUse = processedToUse.slice(0, -1);
      pinnedSyntheticIds.add(richerTwin.id);
    }
  }

  // Content-equality fallback for the trailing turn. The backend stamps `lastChunkStreamSeq`
  // asynchronously, so a just-finished assistant can land in history with a seq BELOW the replay's
  // terminal chunk seq; seq coverage then reads "not covered" and the replayed synthetic survives
  // next to its persisted twin. Recognise the twin by its rendered answer text.
  const lastProcessed = processedToUse[processedToUse.length - 1];
  const trailingAssistantText =
    lastProcessed && lastProcessed.role === 'assistant' ? assistantAnswerText(lastProcessed.content) : '';

  // Content identity of the window, for recognising copies of its turns under
  // other ids; its `userContents` multiset is also what the `user-` branch of
  // `keepRealtime` pairs echoes against positionally (rationale there).
  const windowSignals = collectTwinSignals(processedToUse);
  const seenUserSyntheticByContent = new Map<string, number>();

  // The window boundary. `processedHistory` is what the host FETCHED, and hosts
  // fetch newest-first with a fixed page count: once the thread has grown, the
  // same fetch returns the newest N×limit rows and the head of what is on
  // screen is no longer in it. Those rows have no twin the window could hold,
  // so the dedup rules below must never see them — coverage read a synthetic
  // older than the window as "a persisted row reached this seq" and DROPPED it,
  // and an unordered keep appended a persisted row AFTER the newest reply. Both
  // were the reported "conversation reverts to an earlier state after a
  // refresh". Rows older than the window are kept verbatim, in their existing
  // order, in FRONT of it.
  //
  // `existingMessages` is chronological (every write path appends, prepends an
  // older page, or is this merge), so the thread's own shape decides first:
  //   - where it holds window rows, the first of them is the boundary. Rows
  //     from it on are the window and its live tail, whatever their id or
  //     clock says — a host-minted tail row such as a ticket preview must not
  //     be pulled to the top. One exception before it: a client-minted row
  //     that shares a request id with a window row IS that row's copy, placed
  //     by a previous merge while the row's stamp was missing, and goes back to
  //     coverage so the placement heals instead of being cemented.
  //   - where it holds none (every window row is the persisted twin of a
  //     synthetic, or the store was empty), the window IS the newest persisted
  //     rows, so a persisted id absent from it is older by construction — and
  //     so is everything before the last such row. "Persisted" needs the row
  //     to predate the fetch: a host-minted row newer than it (a ticket
  //     preview) is not history, whatever its id. Unless the thread holds no
  //     client-minted row at all: then nothing bridges those rows to the
  //     window, the gap is rows this client never saw, and the next older page
  //     would be prepended above them out of order — the window alone is the
  //     thread, the rest is refetchable (a `welcome-` bubble is not, and stays).
  // Only rows past both anchors are judged on their own:
  //   - a seq-stamped synthetic below every stamped window row: seq is
  //     monotonic per dialog, but a copy CUT SHORT carries its last consumed
  //     chunk's seq, below its twin's stamp — so `twinVerdict` decides where it
  //     has a signal, and seq decides an 'unknown' only where it cannot
  //     mislead: not for a `user-` / optimistic copy (twin never stamped), nor
  //     for an assistant copy while the window holds an unstamped assistant
  //     row. A `direct-` / `system-` copy has a stamped twin, so seq is exact.
  //   - an unstamped synthetic / optimistic row: minted BEFORE the fetch
  //     (`historyFetchedAt`, client clock like the row's own stamp, so a send
  //     after the fetch never qualifies), timestamped before the window's
  //     oldest row (server clock — a client clock behind the server can still
  //     misread a pre-fetch row, hence the verdict too) and 'distinct'.
  //     Replay-minted synthetics carry fresh timestamps and never qualify.
  const isInWindow = (m: M): boolean => processedIds.has(m.id) || (rawHistoryIds?.has(m.id) ?? false);
  const firstWindowIndex = existingMessages.findIndex(isInWindow);
  const isPersistedOlder = (m: M): boolean =>
    !isClientMintedId(m.id) && (m.timestamp?.getTime() ?? 0) <= historyFetchedAt;
  let lastOlderPersistedIndex = -1;
  if (firstWindowIndex < 0) {
    for (const [index, m] of existingMessages.entries()) {
      if (isPersistedOlder(m) && !pinnedSyntheticIds.has(m.id) && !droppedSyntheticIds.has(m.id)) {
        lastOlderPersistedIndex = index;
      }
    }
  }
  let windowMinSeq = Number.POSITIVE_INFINITY;
  let windowMinTime = Number.POSITIVE_INFINITY;
  let windowHasUnstampedAssistant = false;
  for (const pm of processedToUse) {
    if (typeof pm.streamSeq === 'number') {
      if (pm.streamSeq < windowMinSeq) windowMinSeq = pm.streamSeq;
    } else if (pm.role === 'assistant') {
      windowHasUnstampedAssistant = true;
    }
    const time = pm.timestamp?.getTime();
    if (typeof time === 'number' && time < windowMinTime) windowMinTime = time;
  }
  const threadHasClientMintedRow = existingMessages.some(m => isClientMintedId(m.id));
  const seqCanMislead = (m: M): boolean =>
    m.role === 'assistant' ? windowHasUnstampedAssistant : isUserRequestSyntheticId(m.id) || isOptimisticId(m.id);
  const isOlderThanWindow = (m: M, index: number): boolean => {
    if (m.id === streamingMessageId) return false;
    if (firstWindowIndex >= 0) {
      if (index >= firstWindowIndex) return false;
      return !(isClientMintedId(m.id) && sharesRequestKey(turnRequestKeys(m.content), windowSignals.requestKeys));
    }
    if (index < lastOlderPersistedIndex) return true;
    if (!isClientMintedId(m.id)) return isPersistedOlder(m);
    if (typeof m.streamSeq === 'number') {
      if (!Number.isFinite(windowMinSeq) || m.streamSeq >= windowMinSeq) return false;
      const verdict = twinVerdict(windowSignals, m);
      return verdict === 'unknown' ? !seqCanMislead(m) : verdict === 'distinct';
    }
    const time = m.timestamp?.getTime();
    if (typeof time !== 'number' || time > historyFetchedAt) return false;
    if (!Number.isFinite(windowMinTime) || time >= windowMinTime) return false;
    return twinVerdict(windowSignals, m) === 'distinct';
  };

  // The dedup rules for a row at or after the window boundary.
  const keepRealtime = (m: M): boolean => {
    if (m.role === 'user' && isOptimisticId(m.id) && typeof m.content === 'string') {
      // Content-dedup only when the message predates the snapshot — a
      // just-sent message whose text repeats an earlier turn ("yes", "ok")
      // must not vanish against stale history. Wall-clock, not seq coverage:
      // optimistic messages are minted on send, never by chunk replay, so
      // their timestamps are trustworthy.
      const canBeInSnapshot = (m.timestamp?.getTime() ?? 0) <= historyFetchedAt;
      return !(canBeInSnapshot && windowSignals.userContents.has(m.content));
    }
    // Freshness rule: a synthetic whose turn is represented in the snapshot
    // (under its persisted Mongo id) must be dropped or the turn renders
    // twice; one the snapshot cannot contain yet must be kept or a message
    // the user already saw is lost, with no realtime replay to restore it
    // (JetStream resumes after the highest seq this client has consumed).
    // Decided PER-MESSAGE by its own content seq when stamped, else the global
    // seq coverage, else wall-clock.
    if (isSyntheticRealtimeId(m.id) && m.id !== streamingMessageId) {
      // A non-streaming synthetic that re-renders the trailing persisted assistant verbatim is its
      // twin no matter what the seq signal says — drop it (covers the persistence-lag gap).
      if (m.role === 'assistant' && trailingAssistantText && assistantAnswerText(m.content) === trailingAssistantText) {
        return false;
      }
      // Regular user MESSAGE_REQUEST synthetics (`user-`): the backend persists
      // the user row WITHOUT a `lastChunkStreamSeq` (unlike DIRECT/SYSTEM rows,
      // which carry the chunk seq), so seq coverage can NEVER see them (the twin
      // adds 0 to every seq max) and wall-clock can't either (replay re-mints a
      // fresh timestamp). Dedup them purely by TEXT, matched positionally
      // against persisted user rows (`windowSignals.userContents`): drop the
      // synthetic once its own row is in the snapshot — trailing twin or not,
      // killing the client→viewer duplicate — while keeping a later same-text
      // turn whose row hasn't persisted yet. `direct-` / `system-` synthetics
      // are ALSO role 'user' but DO carry a persisted seq, so the `user-` prefix
      // gate lets them fall through to seq coverage below.
      // NOTE: content matching is a workaround for the missing user-row
      // `lastChunkStreamSeq`; the durable fix is the backend stamping it (as it
      // already does for DIRECT/SYSTEM), which also stops the replay at the
      // source via a correct `optStartSeq`.
      if (m.role === 'user' && isUserRequestSyntheticId(m.id) && typeof m.content === 'string') {
        const seen = (seenUserSyntheticByContent.get(m.content) ?? 0) + 1;
        seenUserSyntheticByContent.set(m.content, seen);
        // No persisted row for THIS occurrence slot → keep (nothing renders it).
        if ((windowSignals.userContents.get(m.content) ?? 0) < seen) return true;
        // A same-text persisted twin exists for this slot. User rows carry no
        // persisted seq, so that twin may be THIS message's OWN row (drop — it
        // renders the message) OR an OLDER identical-text turn while this is a
        // NEW send repeating the text (keep — dropping it loses a message the
        // user just sent: the reported "message from the client chat disappears"
        // when the text repeats an earlier turn, e.g. sending "continue" again).
        // Disambiguate with signals that DON'T need a user-row seq:
        //   - seq watermark: if history persisted PAST this synthetic's
        //     streamSeq, the stream reached this delivery point, so its own row
        //     is in the snapshot → replay → drop.
        //   - trailing twin: if the last history row is a same-text user row (no
        //     reply yet), it's the just-sent message's own row → drop its echo.
        //   - else history is BEHIND this fresh seq and the twin is an older
        //     completed turn → NEW repeat → keep.
        // No seq signal (legacy transport) → positional-only dedup (drop).
        if (typeof m.streamSeq !== 'number' || historyMaxStreamSeq <= 0) return false;
        if (historyMaxStreamSeq >= m.streamSeq) return false;
        const lastPersisted = processedToUse[processedToUse.length - 1];
        if (lastPersisted && lastPersisted.role === 'user' && lastPersisted.content === m.content) return false;
        return true;
      }
      // Per-message seq coverage for the remaining synthetics (assistant /
      // direct / system / error). The synthetic carries the highest CONTENT seq
      // that built it (never the MESSAGE_END/TOKEN_USAGE tail), so history has
      // it once a persisted row reaches that seq — exact per-turn: it drops an
      // earlier finished turn while keeping a later still-streaming one, which
      // the single global `realtimeSeenStreamSeq` (biased upward by the consumed
      // tail) cannot distinguish.
      //
      // In the per-role regime (some history row is seq-stamped) decide ONLY
      // against the SAME-ROLE persisted max and NEVER fall back to the global
      // (cross-role) coverage: a role whose persisted rows reached no seq >=
      // this one has no evidence the turn is in the snapshot, so it must be kept
      // — letting an unrelated role's seq (a user MESSAGE_REQUEST that raised the
      // global max, a later turn) cover it is exactly the reload/stop
      // message-loss bug. Only when NO history row is seq-stamped (legacy hosts /
      // unstamped history) do we use the global seq, then wall-clock.
      let covered: boolean;
      if (typeof m.streamSeq === 'number' && anyHistoryRowSeq) {
        const roleMax = historyMaxSeqByRole.get(m.role) ?? 0;
        covered = roleMax > 0 && roleMax >= m.streamSeq;
      } else if (typeof m.streamSeq === 'number') {
        // This synthetic carries its own seq, but no history row does. Decide
        // against the global when it exists — and when it does NOT
        // (`historyMaxStreamSeq === 0`), that is not "unknown, guess by clock":
        // it is positive evidence that nothing in the snapshot has reached any
        // seq at all, so the snapshot cannot contain this turn. KEEP it.
        //
        // This is the mid-stream refetch: the only persisted row of a turn in
        // flight is the user MESSAGE_REQUEST, which the backend does not stamp,
        // so the max is 0 while live bubbles keep arriving. Falling through to
        // wall-clock there judged every one of them "older than the fetch
        // instant, therefore persisted" and dropped all but the single
        // `streamingMessageId` — the thread collapsed to the user's prompt.
        covered = historyMaxStreamSeq > 0 && historyMaxStreamSeq >= m.streamSeq;
      } else {
        covered =
          historyCoversRealtime !== null ? historyCoversRealtime : (m.timestamp?.getTime() ?? 0) <= historyFetchedAt;
      }
      if (covered) return false;
    }
    return true;
  };

  const olderThanWindowMessages: M[] = [];
  const realtimeMessages: M[] = [];
  for (const [index, m] of existingMessages.entries()) {
    // Pin wins over everything: the twin may carry a persisted Mongo id (the
    // chunk processors ADOPT an in-progress trailing assistant after a prior
    // merge), in which case `processedIds`/`rawHistoryIds` would drop it even
    // though the pin branch above already removed history's copy — vanishing
    // the whole turn.
    if (pinnedSyntheticIds.has(m.id)) {
      realtimeMessages.push(m);
      continue;
    }
    if (droppedSyntheticIds.has(m.id) || isInWindow(m)) continue;
    // Persisted rows disjoint from the window with nothing live between — see
    // the boundary note: the gap is rows this client never saw.
    if (firstWindowIndex < 0 && !threadHasClientMintedRow && isPersistedOlder(m) && !isWelcomeId(m.id)) continue;
    if (isOlderThanWindow(m, index)) {
      olderThanWindowMessages.push(m);
      continue;
    }
    if (keepRealtime(m)) realtimeMessages.push(m);
  }

  return [...olderThanWindowMessages, ...processedToUse, ...realtimeMessages];
}

export interface HistoryPrependResult<M extends MergeableChatMessage> {
  newMessages: M[];
  boundaryMessageId?: string;
  boundaryUpdates?: { content: MessageContent };
}

/** Pagination path (an older page arrived via fetchNextPage): everything on
 *  screen stays; collect only the messages above the first already-known id,
 *  plus a content refresh for that boundary message if it changed. Persisted
 *  twins of client-minted rows the thread still shows above that boundary are
 *  left out (see the note in the body). Returns null when there is nothing to
 *  apply. */
export function computeHistoryPrepend<M extends MergeableChatMessage>(
  processedHistory: M[],
  existingMessages: M[],
): HistoryPrependResult<M> | null {
  const existingIds = new Set(existingMessages.map(m => m.id));
  const boundaryMessageIndex = processedHistory.findIndex(m => existingIds.has(m.id));
  const newEnd = boundaryMessageIndex >= 0 ? boundaryMessageIndex : processedHistory.length;
  const boundaryIndexInExisting =
    boundaryMessageIndex >= 0
      ? existingMessages.findIndex(m => m.id === processedHistory[boundaryMessageIndex].id)
      : -1;

  // Turns the thread still shows under client-minted ids ABOVE the boundary
  // streamed live and fell out of the refetch window before any snapshot
  // replaced them (the window boundary in `mergeHistoryWithRealtime`). The
  // older page carries their persisted twins; prepending those would render
  // each such turn twice, so they are left out — the persisted copy takes over
  // at the next full merge, whose window then reaches them. Matched from the
  // boundary backwards and one claim per live row, because the live rows are
  // the NEWEST turns before it: a repeated prompt or a shared opener further up
  // the page is a different turn and stays. The page is persisted in full, so
  // an answer text twins only in the cut-short direction (the live copy is a
  // prefix of the persisted one).
  const liveAboveBoundary =
    boundaryIndexInExisting > 0
      ? existingMessages.slice(0, boundaryIndexInExisting).filter(m => isClientMintedId(m.id))
      : [];
  const twinIndices = new Set<number>();
  if (liveAboveBoundary.length > 0) {
    const liveSignals = collectTwinSignals(liveAboveBoundary);
    const userTwinsLeft = new Map(liveSignals.userContents);
    const assistantTwinsLeft = new Map(liveSignals.assistantTexts);
    for (let i = newEnd - 1; i >= 0; i--) {
      const pm = processedHistory[i];
      if (pm.role === 'user') {
        const text = userText(pm);
        const left = text === '' ? 0 : (userTwinsLeft.get(text) ?? 0);
        if (left === 0) continue;
        userTwinsLeft.set(text, left - 1);
        twinIndices.add(i);
      } else if (pm.role === 'assistant') {
        const keys = turnRequestKeys(pm.content);
        if (keys.size > 0) {
          if (sharesRequestKey(keys, liveSignals.requestKeys)) twinIndices.add(i);
          continue;
        }
        const text = assistantAnswerText(pm.content);
        if (text === '') continue;
        for (const [liveText, left] of assistantTwinsLeft) {
          if (left === 0 || !text.startsWith(liveText)) continue;
          assistantTwinsLeft.set(liveText, left - 1);
          twinIndices.add(i);
          break;
        }
      }
    }
  }
  const newMessages = processedHistory.slice(0, newEnd).filter((_, i) => !twinIndices.has(i));

  let boundaryMessageId: string | undefined;
  let boundaryUpdates: { content: MessageContent } | undefined;

  if (boundaryIndexInExisting >= 0) {
    const boundaryMessage = processedHistory[boundaryMessageIndex];
    const existingBoundary = existingMessages[boundaryIndexInExisting];
    const existingContent = JSON.stringify(existingBoundary.content);
    const newContent = JSON.stringify(boundaryMessage.content);

    if (existingContent !== newContent) {
      boundaryMessageId = boundaryMessage.id;
      boundaryUpdates = { content: boundaryMessage.content };
    }
  }

  if (newMessages.length === 0 && !boundaryUpdates) return null;
  return { newMessages, boundaryMessageId, boundaryUpdates };
}
