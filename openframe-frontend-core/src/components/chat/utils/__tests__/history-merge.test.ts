import { describe, expect, it } from 'vitest'
import type { MessageSegment } from '../../types'
import {
  computeHistoryPrepend,
  flattenMessagePagesChronological,
  maxPersistedStreamSeq,
  type MergeableChatMessage,
  mergeHistoryWithRealtime,
} from '../history-merge'

interface TestMessage extends MergeableChatMessage {
  role: 'user' | 'assistant'
}

const txt = (s: string): MessageSegment[] => [{ type: 'text', text: s }]
const t = (ms: number) => new Date(ms)
const ids = (msgs: TestMessage[]) => msgs.map((m) => m.id)
const batchSeg = {
  type: 'approval_batch',
  data: { approvalRequestId: 'req-9', toolCalls: [] },
} as unknown as MessageSegment

// Persisted history (Mongo ids), first fetched at t=1000
const U0: TestMessage = { id: 'aaaa0001', role: 'user', content: 'first question', timestamp: t(500) }
const A0: TestMessage = { id: 'aaaa0002', role: 'assistant', content: txt('first answer'), timestamp: t(600) }

// A later turn that happened via realtime (optimistic user + streamed reply)
const OPT1: TestMessage = { id: 'optimistic-2000-x', role: 'user', content: 'second question', timestamp: t(2000) }
const SYN1: TestMessage = { id: 'assistant-2100-x', role: 'assistant', content: txt('second answer'), timestamp: t(2100) }

// Persisted counterparts of that turn (what a FRESH fetch returns)
const U1: TestMessage = { id: 'aaaa0003', role: 'user', content: 'second question', timestamp: t(2000) }
const A1: TestMessage = { id: 'aaaa0004', role: 'assistant', content: txt('second answer'), timestamp: t(2100) }

describe('mergeHistoryWithRealtime', () => {
  it('keeps realtime messages newer than a STALE history snapshot (no data loss)', () => {
    // Reopen a dialog: first merge runs against the cached snapshot fetched
    // BEFORE the second turn existed. The completed reply must survive — the
    // realtime transport will not redeliver chunks this client already consumed.
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 1000,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, OPT1.id, SYN1.id])
  })

  it('replaces optimistic + synthetic messages with their persisted twins on a FRESH snapshot', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id])
  })

  it('never drops the in-flight streaming synthetic', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1], // assistant turn not persisted yet
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: SYN1.id,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(SYN1.id)
  })

  it('dedupes mid-list synthetics against fresh history (no duplicated turns)', () => {
    const OPT2: TestMessage = { id: 'optimistic-3000-x', role: 'user', content: 'third question', timestamp: t(3000) }
    const SYN2: TestMessage = { id: 'assistant-3100-x', role: 'assistant', content: txt('third answer'), timestamp: t(3100) }
    const U2: TestMessage = { id: 'aaaa0006', role: 'user', content: 'third question', timestamp: t(3000) }
    const A2: TestMessage = { id: 'aaaa0007', role: 'assistant', content: txt('third answer'), timestamp: t(3100) }

    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1, U2, A2],
      existingMessages: [U0, A0, OPT1, SYN1, OPT2, SYN2],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, U2.id, A2.id])
  })

  it('pins the more-complete synthetic over a partial history assistant (approval persistence race)', () => {
    const partialHistA: TestMessage = { id: 'aaaa0005', role: 'assistant', content: [batchSeg], timestamp: t(2100) }
    const fullSyn: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100), // OLDER than the snapshot — pin must beat the freshness rule
    }

    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, partialHistA],
      existingMessages: [U0, A0, OPT1, fullSyn],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(fullSyn.id)
    expect(ids(merged)).not.toContain(partialHistA.id)
  })

  it('drops the synthetic when history is at least as complete for the same approval batch', () => {
    const fullHistA: TestMessage = {
      id: 'aaaa0005',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100),
    }
    const lesserSyn: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [batchSeg],
      timestamp: t(9000), // even NEWER than the snapshot — explicit drop wins
    }

    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, fullHistA],
      existingMessages: [U0, A0, OPT1, lesserSyn],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(fullHistA.id)
    expect(ids(merged)).not.toContain(lesserSyn.id)
  })

  it('drops a replay-minted synthetic with a FRESH timestamp when seq coverage proves history contains it', () => {
    // Chunk replay re-materializes an old turn into a synthetic stamped with
    // the CURRENT time — newer than the snapshot, so the wall-clock rule
    // would wrongly keep it next to its persisted twin (the "duplicated
    // assistant message after navigating back" bug). Seq coverage is exact:
    // history persisted through seq 80 >= client consumed through seq 80.
    const replayedSyn: TestMessage = {
      id: 'assistant-9999-r',
      role: 'assistant',
      content: txt('second answer'),
      timestamp: t(9999), // newer than historyFetchedAt
    }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, replayedSyn],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 80,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id])
  })

  it('keeps an old-looking synthetic when seq coverage proves history is BEHIND (persistence lag)', () => {
    // Client consumed through seq 90 but history only persisted through 80 —
    // dropping the synthetic would lose content, no matter how old its
    // wall-clock timestamp looks.
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, OPT1, SYN1], // SYN1 timestamp 2100 <= fetchedAt
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 90,
    })
    expect(ids(merged)).toContain(SYN1.id)
  })

  it('falls back to the wall-clock rule when seq signals are unavailable', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 0,
      realtimeSeenStreamSeq: 0,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id])
  })

  it('keeps a just-sent optimistic message whose text repeats an older turn (stale snapshot)', () => {
    // The user re-sends "first question" and the merge runs against a STALE
    // snapshot (e.g. triggered by stream start). Content-dedup must not match
    // it against the OLD persisted turn with the same text.
    const repeat: TestMessage = { id: 'optimistic-9000-x', role: 'user', content: 'first question', timestamp: t(9000) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, repeat],
      streamingMessageId: null,
      historyFetchedAt: 1000,
    })
    expect(ids(merged)).toContain(repeat.id)
  })

  it('drops an optimistic repeat once the snapshot is fresh enough to contain its twin', () => {
    const repeatPersisted: TestMessage = { id: 'bbbb0001', role: 'user', content: 'first question', timestamp: t(9000) }
    const repeat: TestMessage = { id: 'optimistic-9000-x', role: 'user', content: 'first question', timestamp: t(9000) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, repeatPersisted],
      existingMessages: [U0, A0, repeat],
      streamingMessageId: null,
      historyFetchedAt: 10_000,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, repeatPersisted.id])
  })

  it('returns existing messages untouched when the history snapshot is empty', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [],
      existingMessages: [OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 10_000,
    })
    expect(merged).toEqual([OPT1, SYN1])
  })

  it('keeps a just-sent optimistic repeat even when seq coverage reports covered', () => {
    // Optimistic messages are minted on send, not by chunks — seq coverage
    // says nothing about them. Sent AFTER the snapshot → must survive even
    // though its text matches an old persisted turn.
    const repeat: TestMessage = { id: 'optimistic-9000-x', role: 'user', content: 'first question', timestamp: t(9000) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, repeat],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 80,
    })
    expect(ids(merged)).toContain(repeat.id)
  })

  it('drops a replayed `user-` synthetic against a COMPLETED persisted turn (missing user seq)', () => {
    // Repro of the tickets client→viewer duplicate: the backend persists the
    // user MESSAGE_REQUEST row without a lastChunkStreamSeq, so JetStream
    // replays the user chunk and mints a fresh `user-` synthetic that neither
    // seq coverage nor wall-clock can drop. Its persisted twin (U1) is
    // followed by the assistant turn (A1) — a completed turn — so the replay
    // is recognised by content and dropped. The assistant replay is collapsed
    // by the assistant content-fallback, matching "user twice, Fae once".
    const userSynthetic: TestMessage = { id: 'user-9000-x', role: 'user', content: 'second question', timestamp: t(9000) }
    const asstSynthetic: TestMessage = { id: 'assistant-9100-x', role: 'assistant', content: txt('second answer'), timestamp: t(9100) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, U1, A1, userSynthetic, asstSynthetic],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id])
  })

  it('keeps a `user-` synthetic whose only twin is the TRAILING history row (just-sent, not a replay)', () => {
    // A newly-sent user message: its persisted twin is the LAST history row
    // (no assistant reply yet), so it must NOT be treated as a completed-turn
    // replay — dropping it would erase a message the user just sent.
    const justSent: TestMessage = { id: 'user-9000-x', role: 'user', content: 'third question', timestamp: t(9000) }
    const trailingPersisted: TestMessage = { id: 'aaaa0006', role: 'user', content: 'third question', timestamp: t(3000) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1, trailingPersisted],
      existingMessages: [U0, A0, U1, A1, trailingPersisted, justSent],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(justSent.id)
  })

  it('keeps a `user-` synthetic when no persisted twin exists yet (persistence lag)', () => {
    const pending: TestMessage = { id: 'user-9000-x', role: 'user', content: 'brand new question', timestamp: t(9000) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, pending],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(pending.id)
  })

  it('pins the streaming twin even when it carries a persisted history id (adoption path)', () => {
    // Chunk processors ADOPT an in-progress trailing assistant after a prior
    // merge, so the streaming twin can have the SAME Mongo id as history's
    // trailing message. The pin must beat the processed/raw id dedup or the
    // turn vanishes from both lists.
    const adopted: TestMessage = { id: 'aaaa0005', role: 'assistant', content: [batchSeg], timestamp: t(2100) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, adopted],
      rawHistoryIds: new Set([U0.id, A0.id, U1.id, adopted.id]),
      existingMessages: [U0, A0, adopted],
      streamingMessageId: adopted.id,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, adopted.id])
  })

  it('never drops the streaming twin in the approval-batch resolution (pins it instead)', () => {
    // History's trailing assistant fully persisted the approval turn, but the
    // same batch id belongs to the LIVE streaming bubble (continuation after
    // approve). Dropping it would orphan the host's streaming pointer and
    // make continuation chunks invisible.
    const fullHistA: TestMessage = {
      id: 'aaaa0005',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100),
    }
    const liveTwin: TestMessage = { id: 'assistant-2100-y', role: 'assistant', content: [batchSeg], timestamp: t(2100) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, fullHistA],
      existingMessages: [U0, A0, OPT1, liveTwin],
      streamingMessageId: liveTwin.id,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(liveTwin.id)
    expect(ids(merged)).not.toContain(fullHistA.id)
  })

  it('resolves the approval batch against the most recent twin when several share the batch id', () => {
    const partialHistA: TestMessage = { id: 'aaaa0005', role: 'assistant', content: [batchSeg], timestamp: t(2100) }
    const staleTwin: TestMessage = { id: 'assistant-1000-old', role: 'assistant', content: [batchSeg], timestamp: t(1000) }
    const fullTwin: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100),
    }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, partialHistA],
      existingMessages: [U0, A0, staleTwin, fullTwin],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(fullTwin.id)
    expect(ids(merged)).not.toContain(partialHistA.id)
    expect(ids(merged)).not.toContain(staleTwin.id)
  })

  it('keeps welcome bubbles (never persisted server-side)', () => {
    const welcome: TestMessage = { id: 'welcome-d1', role: 'assistant', content: 'Hi!', timestamp: t(100) }
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [welcome],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    })
    expect(ids(merged)).toContain(welcome.id)
  })

  // Production reality: the client consumes the non-persisted MESSAGE_END /
  // final TOKEN_USAGE chunks, so `realtimeSeenStreamSeq` always ends up ABOVE
  // `historyMaxStreamSeq` (no persisted message can carry the tail's seq).
  // The single global coverage signal therefore reads "not covered" forever
  // and a non-trailing synthetic survives next to its persisted twin (the
  // reported duplication). The per-message `streamSeq` makes the decision
  // exact and turn-local.
  describe('per-message streamSeq coverage', () => {
    const U2b: TestMessage = { id: 'aaaa0006', role: 'user', content: 'third question', timestamp: t(3000) }
    const A2b: TestMessage = { id: 'aaaa0007', role: 'assistant', content: txt('history three'), timestamp: t(3100) }

    it('drops an earlier finished synthetic by its own seq even though the global seq reads not-covered', () => {
      const synEarly: TestMessage = { id: 'assistant-2100-x', role: 'assistant', content: txt('second answer'), timestamp: t(2100), streamSeq: 40 }
      const synLate: TestMessage = { id: 'assistant-3100-x', role: 'assistant', content: txt('realtime three'), timestamp: t(3100), streamSeq: 80 }
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1, U2b, A2b],
        rawHistoryIds: new Set([U0.id, A0.id, U1.id, A1.id, U2b.id, A2b.id]),
        existingMessages: [U0, A0, U1, A1, U2b, A2b, synEarly, synLate],
        streamingMessageId: null,
        historyFetchedAt: 9000,
        historyMaxStreamSeq: 80, // both turns fully persisted
        realtimeSeenStreamSeq: 82, // biased past 80 by the consumed MESSAGE_END
      })
      // Global seq (80 >= 82) is false, but per-message seqs (40, 80) are both <= 80.
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, U2b.id, A2b.id])
    })

    it('drops a partial mid-stream synthetic in favour of the full persisted turn', () => {
      const partial: TestMessage = { id: 'assistant-2100-x', role: 'assistant', content: txt('second ans'), timestamp: t(2100), streamSeq: 50 }
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1],
        rawHistoryIds: new Set([U0.id, A0.id, U1.id, A1.id]),
        existingMessages: [U0, A0, U1, A1, partial],
        streamingMessageId: null,
        historyFetchedAt: 9000,
        historyMaxStreamSeq: 80,
        realtimeSeenStreamSeq: 82,
      })
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id])
    })

    it('keeps a still-streaming later turn while dropping an earlier finished one', () => {
      const synEarly: TestMessage = { id: 'assistant-2100-x', role: 'assistant', content: txt('second answer'), timestamp: t(2100), streamSeq: 40 }
      const synLive: TestMessage = { id: 'assistant-3100-x', role: 'assistant', content: txt('third in progress'), timestamp: t(3100), streamSeq: 70 }
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1], // only turn 1 persisted so far
        rawHistoryIds: new Set([U0.id, A0.id, U1.id, A1.id]),
        existingMessages: [U0, A0, U1, A1, synEarly, synLive],
        streamingMessageId: null,
        historyFetchedAt: 9000,
        historyMaxStreamSeq: 40, // turn 2 not persisted yet
        realtimeSeenStreamSeq: 70,
      })
      // synEarly (40 <= 40) is covered and dropped; synLive (70 > 40) survives.
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, synLive.id])
    })

    it('falls back to the global seq for an unstamped synthetic (legacy NATS)', () => {
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1],
        existingMessages: [U0, A0, OPT1, SYN1], // SYN1 has no streamSeq
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
        realtimeSeenStreamSeq: 80,
      })
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id])
    })

    // The reported reconnect bug: a replayed direct/system message re-mints a
    // synthetic with a FRESH timestamp (wall-clock can't catch it), so dedup
    // must be by seq. Direct/system are role 'user' rows persisted with a
    // lastChunkStreamSeq equal to the realtime chunk's streamSeq.
    it('drops a replayed direct-message synthetic once history persisted it', () => {
      const histDirect: TestMessage = { id: 'aaaa0009', role: 'user', content: 'ping from tech', timestamp: t(2100) }
      const replayedDirect: TestMessage = {
        id: 'direct-9999-r',
        role: 'user',
        content: 'ping from tech',
        timestamp: t(9999), // re-minted on reconnect replay — newer than the snapshot
        streamSeq: 80,
      }
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, histDirect],
        rawHistoryIds: new Set([U0.id, A0.id, histDirect.id]),
        existingMessages: [U0, A0, histDirect, replayedDirect],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
      })
      expect(ids(merged)).toEqual([U0.id, A0.id, histDirect.id])
    })

    it('keeps a live direct message history has not persisted yet (no loss)', () => {
      const liveDirect: TestMessage = {
        id: 'direct-3000-x',
        role: 'user',
        content: 'new tech msg',
        timestamp: t(3000),
        streamSeq: 90,
      }
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0],
        existingMessages: [U0, A0, liveDirect],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80, // history hasn't reached seq 90 yet
      })
      expect(ids(merged)).toContain(liveDirect.id)
    })

    it('dedups a system-message synthetic by seq coverage', () => {
      const histSystem: TestMessage = { id: 'aaaa0010', role: 'user', content: 'User joined', timestamp: t(2100) }
      const synSystem: TestMessage = {
        id: 'system-9999-r',
        role: 'user',
        content: 'User joined',
        timestamp: t(9999),
        streamSeq: 70,
      }
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, histSystem],
        rawHistoryIds: new Set([U0.id, A0.id, histSystem.id]),
        existingMessages: [U0, A0, histSystem, synSystem],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
      })
      expect(ids(merged)).toEqual([U0.id, A0.id, histSystem.id])
    })
  })
})

describe('computeHistoryPrepend', () => {
  it('collects only messages above the first known id', () => {
    const older: TestMessage = { id: 'aaaa0000', role: 'user', content: 'zeroth', timestamp: t(100) }
    const result = computeHistoryPrepend([older, U0, A0], [U0, A0, SYN1])
    expect(result).not.toBeNull()
    expect(ids(result!.newMessages)).toEqual([older.id])
    expect(result!.boundaryUpdates).toBeUndefined()
  })

  it('reports a boundary content refresh when the known boundary message changed', () => {
    const updatedU0: TestMessage = { ...U0, content: 'first question (edited)' }
    const result = computeHistoryPrepend([updatedU0, A0], [U0, A0])
    expect(result).not.toBeNull()
    expect(result!.newMessages).toEqual([])
    expect(result!.boundaryMessageId).toBe(U0.id)
    expect(result!.boundaryUpdates).toEqual({ content: 'first question (edited)' })
  })

  it('returns null when there is nothing to apply', () => {
    expect(computeHistoryPrepend([U0, A0], [U0, A0])).toBeNull()
  })
})

describe('page helpers', () => {
  // Pages arrive DESC (newest page first, newest message first within a page).
  const pages: { messages: { id: string; lastChunkStreamSeq?: number | null }[] }[] = [
    { messages: [{ id: 'd', lastChunkStreamSeq: 40 }, { id: 'c', lastChunkStreamSeq: null }] },
    { messages: [{ id: 'b', lastChunkStreamSeq: 20 }, { id: 'a' }] },
  ]

  it('flattenMessagePagesChronological reverses pages and messages into chronological order', () => {
    expect(flattenMessagePagesChronological(pages).map((m) => m.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(flattenMessagePagesChronological(undefined)).toEqual([])
  })

  it('maxPersistedStreamSeq returns the highest stamped seq, 0 when absent', () => {
    expect(maxPersistedStreamSeq(pages)).toBe(40)
    expect(maxPersistedStreamSeq([{ messages: [{}] }])).toBe(0)
    expect(maxPersistedStreamSeq(undefined)).toBe(0)
  })
})
