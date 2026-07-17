import type { ApprovalBatchSegment, MessageContent } from '../types'

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
  id: string
  role: string
  content: MessageContent
  timestamp?: Date
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
  streamSeq?: number
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
export const SYNTHETIC_REALTIME_ID_PREFIXES = ['assistant-', 'user-', 'direct-', 'system-', 'error-'] as const

function isSyntheticRealtimeId(id: string): boolean {
  return SYNTHETIC_REALTIME_ID_PREFIXES.some((prefix) => id.startsWith(prefix))
}

/** Rendered answer text of an assistant message (TEXT segments, or a plain string). Used to
 *  recognise a replayed synthetic as the twin of an already-persisted turn when the stream-seq
 *  signal can't prove it (see the trailing-turn fallback below). Empty for tool/approval-only
 *  turns that carry no answer text — callers must treat "" as "no signal", never as a match. */
function assistantAnswerText(content: MessageContent): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const seg of content) {
    if (seg.type === 'text') parts.push(seg.text)
  }
  return parts.join('\n').trim()
}

/** Flattens DESC-sorted message pages (newest page first, newest message
 *  first within a page) into one chronological list. */
export function flattenMessagePagesChronological<T>(pages: readonly { messages: readonly T[] }[] | undefined): T[] {
  if (!pages) return []
  return [...pages].reverse().flatMap((page) => [...page.messages].reverse())
}

/** Max `lastChunkStreamSeq` across history pages — the history half of the
 *  merge's seq-coverage signal (`HistoryMergeInput.historyMaxStreamSeq`),
 *  also used by hosts as the JetStream replay start offset. 0 = unstamped. */
export function maxPersistedStreamSeq(
  pages: readonly { messages: readonly { lastChunkStreamSeq?: number | null }[] }[] | undefined,
): number {
  let max = 0
  if (!pages) return max
  for (const page of pages) {
    for (const msg of page.messages) {
      const seq = msg.lastChunkStreamSeq
      if (typeof seq === 'number' && seq > max) max = seq
    }
  }
  return max
}

export interface HistoryMergeInput<M extends MergeableChatMessage> {
  /** Processed history in chronological order (all fetched pages). */
  processedHistory: M[]
  /** Raw history message ids across all fetched pages, when they can differ
   *  from processed ids (processing may merge/rename). Optional — pass when
   *  available so raw-id duplicates are filtered too. */
  rawHistoryIds?: ReadonlySet<string>
  /** Messages currently in the host store for this dialog (realtime + prior merges). */
  existingMessages: M[]
  /** Id of the in-flight streaming synthetic, if any. Never dropped.
   *  IMPORTANT: hosts must not pass a STALE id here (e.g. a streaming entry
   *  left behind by unmounting mid-stream) — gate it on the server-side
   *  stream state when available, or the synthetic will be exempted forever. */
  streamingMessageId: string | null
  /** Epoch ms when the history pages were fetched (react-query `dataUpdatedAt`).
   *  Wall-clock freshness fallback used when seq coverage (below) is unknown:
   *  a synthetic created AFTER this instant cannot be represented in the
   *  snapshot, so it must be kept. NOTE this heuristic is blind to chunk
   *  REPLAY, which re-mints synthetics for old turns with fresh timestamps —
   *  pass the seq fields whenever the host tracks them. */
  historyFetchedAt: number
  /** Max `lastChunkStreamSeq` across the raw history pages, when the backend
   *  stamps it (see `maxPersistedStreamSeq`). Together with
   *  `realtimeSeenStreamSeq` this gives an exact coverage signal that
   *  replaces the wall-clock heuristic. */
  historyMaxStreamSeq?: number
  /** Highest stream seq this client has consumed for the dialog (live or
   *  replayed chunks). */
  realtimeSeenStreamSeq?: number
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
  } = input

  // An empty snapshot can't dedupe anything — merging would only let the
  // freshness rules below wipe completed realtime messages (e.g. persistence
  // lag on a fresh dialog). The realtime side stays the source of truth.
  if (processedHistory.length === 0) return existingMessages

  const processedIds = new Set(processedHistory.map((m) => m.id))

  // Seq-based coverage: every synthetic is derived from consumed chunks, so
  // when history's max persisted seq reaches the highest seq this client has
  // consumed, ALL synthetics are represented in history (drop them); when it
  // hasn't, history is provably behind (keep them ALL — even ones that look
  // old by wall-clock, e.g. re-minted by a chunk replay). `null` = signal
  // unavailable (legacy transport / backend without seq stamps) → fall back
  // to the per-message wall-clock rule.
  const seqCoverageKnown = realtimeSeenStreamSeq > 0 && historyMaxStreamSeq > 0
  const historyCoversRealtime = seqCoverageKnown ? historyMaxStreamSeq >= realtimeSeenStreamSeq : null

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
  const historyMaxSeqByRole = new Map<string, number>()
  let anyHistoryRowSeq = false
  for (const pm of processedHistory) {
    if (typeof pm.streamSeq === 'number') {
      anyHistoryRowSeq = true
      const prev = historyMaxSeqByRole.get(pm.role) ?? 0
      if (pm.streamSeq > prev) historyMaxSeqByRole.set(pm.role, pm.streamSeq)
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
  const trailing = processedHistory[processedHistory.length - 1]
  const historyTrailingAssistant = trailing?.role === 'assistant' ? trailing : null
  const historyBatchId =
    historyTrailingAssistant && Array.isArray(historyTrailingAssistant.content)
      ? ((historyTrailingAssistant.content.find((s) => s.type === 'approval_batch') as ApprovalBatchSegment | undefined)
          ?.data?.approvalRequestId ?? null)
      : null

  let processedToUse = processedHistory
  const pinnedSyntheticIds = new Set<string>()
  const droppedSyntheticIds = new Set<string>()

  if (historyBatchId) {
    const batchTwins = existingMessages.filter(
      (m) =>
        m.role === 'assistant' &&
        Array.isArray(m.content) &&
        m.content.some(
          (s) => s.type === 'approval_batch' && (s as ApprovalBatchSegment).data?.approvalRequestId === historyBatchId,
        ),
    )
    // Prefer the live streaming twin; otherwise the most recent one (a stale
    // replay-minted duplicate may precede it).
    const existingWithSameBatch = batchTwins.find((m) => m.id === streamingMessageId) ?? batchTwins[batchTwins.length - 1]
    if (existingWithSameBatch && Array.isArray(existingWithSameBatch.content)) {
      const histSize = Array.isArray(historyTrailingAssistant?.content) ? historyTrailingAssistant.content.length : 0
      const realtimeSize = existingWithSameBatch.content.length
      if (existingWithSameBatch.id === streamingMessageId || realtimeSize > histSize) {
        processedToUse = processedHistory.slice(0, -1)
        pinnedSyntheticIds.add(existingWithSameBatch.id)
      } else {
        droppedSyntheticIds.add(existingWithSameBatch.id)
      }
    }
  }

  // Content-equality fallback for the trailing turn. The backend stamps `lastChunkStreamSeq`
  // asynchronously, so a just-finished assistant can land in history with a seq BELOW the replay's
  // terminal chunk seq; seq coverage then reads "not covered" and the replayed synthetic survives
  // next to its persisted twin. Recognise the twin by its rendered answer text.
  const lastProcessed = processedToUse[processedToUse.length - 1]
  const trailingAssistantText =
    lastProcessed && lastProcessed.role === 'assistant' ? assistantAnswerText(lastProcessed.content) : ''

  // Positional content multiset for `user-` synthetic dedup. The backend
  // persists user MESSAGE_REQUEST rows WITHOUT a `lastChunkStreamSeq`, so a
  // replayed/echoed `user-` synthetic can be covered by neither seq (its twin
  // adds 0 to every seq max) nor wall-clock (replay re-mints a fresh
  // timestamp). Match it by TEXT against persisted user rows, positionally: the
  // k-th `user-` synthetic with a text is the twin of the k-th persisted user
  // row with that text. This drops a replay/echo once its own row is in the
  // snapshot (kills the client→viewer duplicate, trailing twin or not) while
  // keeping a LATER same-text turn whose row hasn't persisted yet — which the
  // old first-match `findIndex` dropped, losing a repeated message.
  const persistedUserContentCounts = new Map<string, number>()
  for (const pm of processedToUse) {
    if (pm.role === 'user' && typeof pm.content === 'string') {
      persistedUserContentCounts.set(pm.content, (persistedUserContentCounts.get(pm.content) ?? 0) + 1)
    }
  }
  const seenUserSyntheticByContent = new Map<string, number>()

  const realtimeMessages = existingMessages.filter((m) => {
    // Pin wins over everything: the twin may carry a persisted Mongo id (the
    // chunk processors ADOPT an in-progress trailing assistant after a prior
    // merge), in which case `processedIds`/`rawHistoryIds` would drop it even
    // though the pin branch above already removed history's copy — vanishing
    // the whole turn.
    if (pinnedSyntheticIds.has(m.id)) return true
    if (droppedSyntheticIds.has(m.id)) return false
    if (processedIds.has(m.id)) return false
    if (rawHistoryIds?.has(m.id)) return false
    if (m.role === 'user' && m.id.startsWith('optimistic-') && typeof m.content === 'string') {
      // Content-dedup only when the message predates the snapshot — a
      // just-sent message whose text repeats an earlier turn ("yes", "ok")
      // must not vanish against stale history. Wall-clock, not seq coverage:
      // optimistic messages are minted on send, never by chunk replay, so
      // their timestamps are trustworthy.
      const canBeInSnapshot = (m.timestamp?.getTime() ?? 0) <= historyFetchedAt
      return !(canBeInSnapshot && processedToUse.some((pm) => pm.role === 'user' && pm.content === m.content))
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
        return false
      }
      // Regular user MESSAGE_REQUEST synthetics (`user-`): the backend persists
      // the user row WITHOUT a `lastChunkStreamSeq` (unlike DIRECT/SYSTEM rows,
      // which carry the chunk seq), so seq coverage can NEVER see them (the twin
      // adds 0 to every seq max) and wall-clock can't either (replay re-mints a
      // fresh timestamp). Dedup them purely by TEXT, matched positionally
      // against persisted user rows (see `persistedUserContentCounts`): drop the
      // synthetic once its own row is in the snapshot — trailing twin or not,
      // killing the client→viewer duplicate — while keeping a later same-text
      // turn whose row hasn't persisted yet. `direct-` / `system-` synthetics
      // are ALSO role 'user' but DO carry a persisted seq, so the `user-` prefix
      // gate lets them fall through to seq coverage below.
      // NOTE: content matching is a workaround for the missing user-row
      // `lastChunkStreamSeq`; the durable fix is the backend stamping it (as it
      // already does for DIRECT/SYSTEM), which also stops the replay at the
      // source via a correct `optStartSeq`.
      if (m.role === 'user' && m.id.startsWith('user-') && typeof m.content === 'string') {
        const seen = (seenUserSyntheticByContent.get(m.content) ?? 0) + 1
        seenUserSyntheticByContent.set(m.content, seen)
        return (persistedUserContentCounts.get(m.content) ?? 0) < seen
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
      let covered: boolean
      if (typeof m.streamSeq === 'number' && anyHistoryRowSeq) {
        const roleMax = historyMaxSeqByRole.get(m.role) ?? 0
        covered = roleMax > 0 && roleMax >= m.streamSeq
      } else if (typeof m.streamSeq === 'number' && historyMaxStreamSeq > 0) {
        covered = historyMaxStreamSeq >= m.streamSeq
      } else {
        covered =
          historyCoversRealtime !== null
            ? historyCoversRealtime
            : (m.timestamp?.getTime() ?? 0) <= historyFetchedAt
      }
      if (covered) return false
    }
    return true
  })

  return [...processedToUse, ...realtimeMessages]
}

export interface HistoryPrependResult<M extends MergeableChatMessage> {
  newMessages: M[]
  boundaryMessageId?: string
  boundaryUpdates?: { content: MessageContent }
}

/** Pagination path (an older page arrived via fetchNextPage): everything on
 *  screen stays; collect only the messages above the first already-known id,
 *  plus a content refresh for that boundary message if it changed. Returns
 *  null when there is nothing to apply. */
export function computeHistoryPrepend<M extends MergeableChatMessage>(
  processedHistory: M[],
  existingMessages: M[],
): HistoryPrependResult<M> | null {
  const existingIds = new Set(existingMessages.map((m) => m.id))
  const newMessages: M[] = []
  let boundaryMessageIndex = -1

  for (let i = 0; i < processedHistory.length; i++) {
    if (existingIds.has(processedHistory[i].id)) {
      boundaryMessageIndex = i
      break
    }
    newMessages.push(processedHistory[i])
  }

  let boundaryMessageId: string | undefined
  let boundaryUpdates: { content: MessageContent } | undefined

  if (boundaryMessageIndex >= 0) {
    const boundaryMessage = processedHistory[boundaryMessageIndex]
    const existingBoundary = existingMessages.find((m) => m.id === boundaryMessage.id)

    if (existingBoundary) {
      const existingContent = JSON.stringify(existingBoundary.content)
      const newContent = JSON.stringify(boundaryMessage.content)

      if (existingContent !== newContent) {
        boundaryMessageId = boundaryMessage.id
        boundaryUpdates = { content: boundaryMessage.content }
      }
    }
  }

  if (newMessages.length === 0 && !boundaryUpdates) return null
  return { newMessages, boundaryMessageId, boundaryUpdates }
}
