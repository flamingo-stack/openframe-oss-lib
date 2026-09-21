import { describe, expect, it } from 'vitest';
import type { MessageSegment } from '../../types';
import {
  computeHistoryPrepend,
  flattenMessagePagesChronological,
  maxPersistedStreamSeq,
  type MergeableChatMessage,
  mergeHistoryWithRealtime,
} from '../history-merge';

interface TestMessage extends MergeableChatMessage {
  role: 'user' | 'assistant';
}

const txt = (s: string): MessageSegment[] => [{ type: 'text', text: s }];
const t = (ms: number) => new Date(ms);
const ids = (msgs: TestMessage[]) => msgs.map(m => m.id);
const batchSeg = {
  type: 'approval_batch',
  data: { approvalRequestId: 'req-9', toolCalls: [] },
} as unknown as MessageSegment;
const tool = (id: string, state: 'EXECUTING_TOOL' | 'EXECUTED_TOOL'): MessageSegment =>
  ({
    type: 'tool_execution',
    data: { type: state, integratedToolType: 'sqlite', toolFunction: 'query', toolExecutionRequestId: id },
  }) as unknown as MessageSegment;

// Persisted history (Mongo ids), first fetched at t=1000
const U0: TestMessage = { id: 'aaaa0001', role: 'user', content: 'first question', timestamp: t(500) };
const A0: TestMessage = { id: 'aaaa0002', role: 'assistant', content: txt('first answer'), timestamp: t(600) };

// A later turn that happened via realtime (optimistic user + streamed reply)
const OPT1: TestMessage = { id: 'optimistic-2000-x', role: 'user', content: 'second question', timestamp: t(2000) };
const SYN1: TestMessage = {
  id: 'assistant-2100-x',
  role: 'assistant',
  content: txt('second answer'),
  timestamp: t(2100),
};

// Persisted counterparts of that turn (what a FRESH fetch returns)
const U1: TestMessage = { id: 'aaaa0003', role: 'user', content: 'second question', timestamp: t(2000) };
const A1: TestMessage = { id: 'aaaa0004', role: 'assistant', content: txt('second answer'), timestamp: t(2100) };

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
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, OPT1.id, SYN1.id]);
  });

  it('replaces optimistic + synthetic messages with their persisted twins on a FRESH snapshot', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id]);
  });

  it('never drops the in-flight streaming synthetic', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1], // assistant turn not persisted yet
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: SYN1.id,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(SYN1.id);
  });

  it('dedupes mid-list synthetics against fresh history (no duplicated turns)', () => {
    const OPT2: TestMessage = { id: 'optimistic-3000-x', role: 'user', content: 'third question', timestamp: t(3000) };
    const SYN2: TestMessage = {
      id: 'assistant-3100-x',
      role: 'assistant',
      content: txt('third answer'),
      timestamp: t(3100),
    };
    const U2: TestMessage = { id: 'aaaa0006', role: 'user', content: 'third question', timestamp: t(3000) };
    const A2: TestMessage = { id: 'aaaa0007', role: 'assistant', content: txt('third answer'), timestamp: t(3100) };

    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1, U2, A2],
      existingMessages: [U0, A0, OPT1, SYN1, OPT2, SYN2],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, U2.id, A2.id]);
  });

  it('pins the more-complete synthetic over a partial history assistant (approval persistence race)', () => {
    const partialHistA: TestMessage = { id: 'aaaa0005', role: 'assistant', content: [batchSeg], timestamp: t(2100) };
    const fullSyn: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100), // OLDER than the snapshot — pin must beat the freshness rule
    };

    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, partialHistA],
      existingMessages: [U0, A0, OPT1, fullSyn],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(fullSyn.id);
    expect(ids(merged)).not.toContain(partialHistA.id);
  });

  it('drops the synthetic when history is at least as complete for the same approval batch', () => {
    const fullHistA: TestMessage = {
      id: 'aaaa0005',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100),
    };
    const lesserSyn: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [batchSeg],
      timestamp: t(9000), // even NEWER than the snapshot — explicit drop wins
    };

    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, fullHistA],
      existingMessages: [U0, A0, OPT1, lesserSyn],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(fullHistA.id);
    expect(ids(merged)).not.toContain(lesserSyn.id);
  });

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
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, replayedSyn],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 80,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id]);
  });

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
    });
    expect(ids(merged)).toContain(SYN1.id);
  });

  it('falls back to the wall-clock rule when seq signals are unavailable', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 0,
      realtimeSeenStreamSeq: 0,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id]);
  });

  it('keeps a just-sent optimistic message whose text repeats an older turn (stale snapshot)', () => {
    // The user re-sends "first question" and the merge runs against a STALE
    // snapshot (e.g. triggered by stream start). Content-dedup must not match
    // it against the OLD persisted turn with the same text.
    const repeat: TestMessage = {
      id: 'optimistic-9000-x',
      role: 'user',
      content: 'first question',
      timestamp: t(9000),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, repeat],
      streamingMessageId: null,
      historyFetchedAt: 1000,
    });
    expect(ids(merged)).toContain(repeat.id);
  });

  it('drops an optimistic repeat once the snapshot is fresh enough to contain its twin', () => {
    const repeatPersisted: TestMessage = {
      id: 'bbbb0001',
      role: 'user',
      content: 'first question',
      timestamp: t(9000),
    };
    const repeat: TestMessage = {
      id: 'optimistic-9000-x',
      role: 'user',
      content: 'first question',
      timestamp: t(9000),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, repeatPersisted],
      existingMessages: [U0, A0, repeat],
      streamingMessageId: null,
      historyFetchedAt: 10_000,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, repeatPersisted.id]);
  });

  it('returns existing messages untouched when the history snapshot is empty', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [],
      existingMessages: [OPT1, SYN1],
      streamingMessageId: null,
      historyFetchedAt: 10_000,
    });
    expect(merged).toEqual([OPT1, SYN1]);
  });

  it('keeps a just-sent optimistic repeat even when seq coverage reports covered', () => {
    // Optimistic messages are minted on send, not by chunks — seq coverage
    // says nothing about them. Sent AFTER the snapshot → must survive even
    // though its text matches an old persisted turn.
    const repeat: TestMessage = {
      id: 'optimistic-9000-x',
      role: 'user',
      content: 'first question',
      timestamp: t(9000),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, repeat],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 80,
    });
    expect(ids(merged)).toContain(repeat.id);
  });

  it('drops a replayed `user-` synthetic against a COMPLETED persisted turn (missing user seq)', () => {
    // Repro of the tickets client→viewer duplicate: the backend persists the
    // user MESSAGE_REQUEST row without a lastChunkStreamSeq, so JetStream
    // replays the user chunk and mints a fresh `user-` synthetic that neither
    // seq coverage nor wall-clock can drop. Its persisted twin (U1) is
    // followed by the assistant turn (A1) — a completed turn — so the replay
    // is recognised by content and dropped. The assistant replay is collapsed
    // by the assistant content-fallback, matching "user twice, Fae once".
    const userSynthetic: TestMessage = {
      id: 'user-9000-x',
      role: 'user',
      content: 'second question',
      timestamp: t(9000),
    };
    const asstSynthetic: TestMessage = {
      id: 'assistant-9100-x',
      role: 'assistant',
      content: txt('second answer'),
      timestamp: t(9100),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1],
      existingMessages: [U0, A0, U1, A1, userSynthetic, asstSynthetic],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id]);
  });

  it('dedupes a `user-` synthetic against its persisted twin even when that twin is the TRAILING row', () => {
    // Client→viewer duplicate at the START of a conversation: the user row is
    // persisted (as the trailing history row — the assistant reply is not saved
    // yet) and the same MESSAGE_REQUEST is replayed as a `user-` synthetic. The
    // persisted row renders the message, so the synthetic must be dropped —
    // keeping it (the old trailing-twin carve-out) IS the reported duplicate.
    const replay: TestMessage = { id: 'user-9000-x', role: 'user', content: 'third question', timestamp: t(9000) };
    const trailingPersisted: TestMessage = {
      id: 'aaaa0006',
      role: 'user',
      content: 'third question',
      timestamp: t(3000),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, A1, trailingPersisted],
      existingMessages: [U0, A0, U1, A1, trailingPersisted, replay],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, trailingPersisted.id]);
  });

  it('keeps a LATER same-text `user-` synthetic whose own row is not persisted yet (positional match)', () => {
    // Two identical "continue" turns: the first is persisted, the second was
    // just sent and its row hasn't landed. Positional content matching covers
    // the first synthetic with the one persisted row and KEEPS the second — the
    // old first-match dedup matched the second against the first's row and
    // dropped it, losing the message (the reported "user message lost" repro).
    const persistedFirst: TestMessage = { id: 'aaaa0006', role: 'user', content: 'continue', timestamp: t(3000) };
    const asstFirst: TestMessage = { id: 'aaaa0007', role: 'assistant', content: txt('ok one'), timestamp: t(3100) };
    const synFirst: TestMessage = { id: 'user-4000-a', role: 'user', content: 'continue', timestamp: t(4000) };
    const synSecond: TestMessage = { id: 'user-5000-b', role: 'user', content: 'continue', timestamp: t(5000) };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, persistedFirst, asstFirst],
      existingMessages: [U0, A0, persistedFirst, asstFirst, synFirst, synSecond],
      streamingMessageId: null,
      historyFetchedAt: 6000,
    });
    // Only one persisted "continue" → synFirst covered/dropped, synSecond kept.
    expect(ids(merged)).toEqual([U0.id, A0.id, persistedFirst.id, asstFirst.id, synSecond.id]);
  });

  it('KEEPS a `user-` synthetic when a seq-stamped ASSISTANT row raised the global max but the user turn is not persisted', () => {
    // The reload+stop loss: history has a seq-stamped assistant row (so
    // anyHistoryRowSeq is true and the global max is high) and a live `user-`
    // message arrived whose own row the backend persists WITHOUT a seq and
    // hasn't yet. The assistant's seq must NOT cover it — content dedup finds no
    // twin, so it survives. (On the pre-fix code the `user-` role max was 0 and
    // the merge fell back to the global coverage, dropping it.)
    const histAsst: TestMessage = {
      id: 'aaaa0501',
      role: 'assistant',
      content: txt('older answer'),
      timestamp: t(2100),
      streamSeq: 200,
    };
    const liveUser: TestMessage = {
      id: 'user-9000-x',
      role: 'user',
      content: 'continue',
      timestamp: t(9000),
      streamSeq: 150,
    };
    const merged = mergeHistoryWithRealtime<TestMessage>({
      processedHistory: [U0, histAsst],
      existingMessages: [U0, histAsst, liveUser],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 200,
      realtimeSeenStreamSeq: 200,
    });
    expect(ids(merged)).toContain(liveUser.id);
  });

  it('keeps a `user-` synthetic when no persisted twin exists yet (persistence lag)', () => {
    const pending: TestMessage = { id: 'user-9000-x', role: 'user', content: 'brand new question', timestamp: t(9000) };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [U0, A0, pending],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(pending.id);
  });

  it('KEEPS a repeated `user-` message whose streamSeq is ahead of history (new send after a long tool turn)', () => {
    // The "many tools + reload, message from the client chat disappears" repro:
    // an earlier "continue" is persisted and answered (a long tool turn pushed
    // historyMaxStreamSeq to 200), then the user sends "continue" AGAIN. The new
    // synthetic's streamSeq (250) is ahead of everything persisted → it is a NEW
    // message, not a replay of the old turn. Positional content match alone
    // would drop it against the old "continue"; the seq watermark keeps it.
    const oldUser: TestMessage = { id: 'aaaa0801', role: 'user', content: 'continue', timestamp: t(2000) };
    const oldAsst: TestMessage = {
      id: 'aaaa0802',
      role: 'assistant',
      content: txt('ok one'),
      timestamp: t(2100),
      streamSeq: 200,
    };
    const newSend: TestMessage = {
      id: 'user-9000-x',
      role: 'user',
      content: 'continue',
      timestamp: t(9000),
      streamSeq: 250,
    };
    const merged = mergeHistoryWithRealtime<TestMessage>({
      processedHistory: [oldUser, oldAsst],
      existingMessages: [oldUser, oldAsst, newSend],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 200,
      realtimeSeenStreamSeq: 250,
    });
    expect(ids(merged)).toContain(newSend.id);
  });

  it('DROPS a replayed `user-` message whose streamSeq history already passed', () => {
    // A replay of the OLD "continue" (streamSeq 150) after history persisted the
    // turn past it (200): its own row is in the snapshot → drop the duplicate.
    const oldUser: TestMessage = { id: 'aaaa0811', role: 'user', content: 'continue', timestamp: t(2000) };
    const oldAsst: TestMessage = {
      id: 'aaaa0812',
      role: 'assistant',
      content: txt('ok one'),
      timestamp: t(2100),
      streamSeq: 200,
    };
    const replay: TestMessage = {
      id: 'user-9000-x',
      role: 'user',
      content: 'continue',
      timestamp: t(9000),
      streamSeq: 150,
    };
    const merged = mergeHistoryWithRealtime<TestMessage>({
      processedHistory: [oldUser, oldAsst],
      existingMessages: [oldUser, oldAsst, replay],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 200,
      realtimeSeenStreamSeq: 200,
    });
    expect(ids(merged)).toEqual([oldUser.id, oldAsst.id]);
  });

  it('DROPS a `user-` echo of a just-sent TRAILING message even when history is behind its seq', () => {
    // Start of a turn: the just-sent "hello" is the trailing history row (no
    // reply yet, so historyMaxStreamSeq is behind its seq). Its own row is right
    // there → drop the echo, don't render "hello" twice.
    const justSent: TestMessage = { id: 'aaaa0821', role: 'user', content: 'hello', timestamp: t(3000) };
    const echo: TestMessage = { id: 'user-9000-x', role: 'user', content: 'hello', timestamp: t(9000), streamSeq: 300 };
    const merged = mergeHistoryWithRealtime<TestMessage>({
      processedHistory: [U0, A0, justSent],
      existingMessages: [U0, A0, justSent, echo],
      streamingMessageId: null,
      historyFetchedAt: 5000,
      historyMaxStreamSeq: 100,
      realtimeSeenStreamSeq: 300,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, justSent.id]);
  });

  it('pins the streaming twin even when it carries a persisted history id (adoption path)', () => {
    // Chunk processors ADOPT an in-progress trailing assistant after a prior
    // merge, so the streaming twin can have the SAME Mongo id as history's
    // trailing message. The pin must beat the processed/raw id dedup or the
    // turn vanishes from both lists.
    const adopted: TestMessage = { id: 'aaaa0005', role: 'assistant', content: [batchSeg], timestamp: t(2100) };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, adopted],
      rawHistoryIds: new Set([U0.id, A0.id, U1.id, adopted.id]),
      existingMessages: [U0, A0, adopted],
      streamingMessageId: adopted.id,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, adopted.id]);
  });

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
    };
    const liveTwin: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [batchSeg],
      timestamp: t(2100),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, fullHistA],
      existingMessages: [U0, A0, OPT1, liveTwin],
      streamingMessageId: liveTwin.id,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(liveTwin.id);
    expect(ids(merged)).not.toContain(fullHistA.id);
  });

  it('resolves the approval batch against the most recent twin when several share the batch id', () => {
    const partialHistA: TestMessage = { id: 'aaaa0005', role: 'assistant', content: [batchSeg], timestamp: t(2100) };
    const staleTwin: TestMessage = {
      id: 'assistant-1000-old',
      role: 'assistant',
      content: [batchSeg],
      timestamp: t(1000),
    };
    const fullTwin: TestMessage = {
      id: 'assistant-2100-y',
      role: 'assistant',
      content: [...txt('second answer'), batchSeg],
      timestamp: t(2100),
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U1, partialHistA],
      existingMessages: [U0, A0, staleTwin, fullTwin],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(fullTwin.id);
    expect(ids(merged)).not.toContain(partialHistA.id);
    expect(ids(merged)).not.toContain(staleTwin.id);
  });

  it('keeps welcome bubbles (never persisted server-side)', () => {
    const welcome: TestMessage = { id: 'welcome-d1', role: 'assistant', content: 'Hi!', timestamp: t(100) };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0],
      existingMessages: [welcome],
      streamingMessageId: null,
      historyFetchedAt: 5000,
    });
    expect(ids(merged)).toContain(welcome.id);
  });

  // Production reality: the client consumes the non-persisted MESSAGE_END /
  // final TOKEN_USAGE chunks, so `realtimeSeenStreamSeq` always ends up ABOVE
  // `historyMaxStreamSeq` (no persisted message can carry the tail's seq).
  // The single global coverage signal therefore reads "not covered" forever
  // and a non-trailing synthetic survives next to its persisted twin (the
  // reported duplication). The per-message `streamSeq` makes the decision
  // exact and turn-local.
  describe('per-message streamSeq coverage', () => {
    const U2b: TestMessage = { id: 'aaaa0006', role: 'user', content: 'third question', timestamp: t(3000) };
    const A2b: TestMessage = { id: 'aaaa0007', role: 'assistant', content: txt('history three'), timestamp: t(3100) };

    it('drops an earlier finished synthetic by its own seq even though the global seq reads not-covered', () => {
      const synEarly: TestMessage = {
        id: 'assistant-2100-x',
        role: 'assistant',
        content: txt('second answer'),
        timestamp: t(2100),
        streamSeq: 40,
      };
      const synLate: TestMessage = {
        id: 'assistant-3100-x',
        role: 'assistant',
        content: txt('realtime three'),
        timestamp: t(3100),
        streamSeq: 80,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1, U2b, A2b],
        rawHistoryIds: new Set([U0.id, A0.id, U1.id, A1.id, U2b.id, A2b.id]),
        existingMessages: [U0, A0, U1, A1, U2b, A2b, synEarly, synLate],
        streamingMessageId: null,
        historyFetchedAt: 9000,
        historyMaxStreamSeq: 80, // both turns fully persisted
        realtimeSeenStreamSeq: 82, // biased past 80 by the consumed MESSAGE_END
      });
      // Global seq (80 >= 82) is false, but per-message seqs (40, 80) are both <= 80.
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, U2b.id, A2b.id]);
    });

    it('drops a partial mid-stream synthetic in favour of the full persisted turn', () => {
      const partial: TestMessage = {
        id: 'assistant-2100-x',
        role: 'assistant',
        content: txt('second ans'),
        timestamp: t(2100),
        streamSeq: 50,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1],
        rawHistoryIds: new Set([U0.id, A0.id, U1.id, A1.id]),
        existingMessages: [U0, A0, U1, A1, partial],
        streamingMessageId: null,
        historyFetchedAt: 9000,
        historyMaxStreamSeq: 80,
        realtimeSeenStreamSeq: 82,
      });
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id]);
    });

    it('keeps a still-streaming later turn while dropping an earlier finished one', () => {
      const synEarly: TestMessage = {
        id: 'assistant-2100-x',
        role: 'assistant',
        content: txt('second answer'),
        timestamp: t(2100),
        streamSeq: 40,
      };
      const synLive: TestMessage = {
        id: 'assistant-3100-x',
        role: 'assistant',
        content: txt('third in progress'),
        timestamp: t(3100),
        streamSeq: 70,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1], // only turn 1 persisted so far
        rawHistoryIds: new Set([U0.id, A0.id, U1.id, A1.id]),
        existingMessages: [U0, A0, U1, A1, synEarly, synLive],
        streamingMessageId: null,
        historyFetchedAt: 9000,
        historyMaxStreamSeq: 40, // turn 2 not persisted yet
        realtimeSeenStreamSeq: 70,
      });
      // synEarly (40 <= 40) is covered and dropped; synLive (70 > 40) survives.
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id, synLive.id]);
    });

    it('falls back to the global seq for an unstamped synthetic (legacy NATS)', () => {
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, U1, A1],
        existingMessages: [U0, A0, OPT1, SYN1], // SYN1 has no streamSeq
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
        realtimeSeenStreamSeq: 80,
      });
      expect(ids(merged)).toEqual([U0.id, A0.id, U1.id, A1.id]);
    });

    // The reported reconnect bug: a replayed direct/system message re-mints a
    // synthetic with a FRESH timestamp (wall-clock can't catch it), so dedup
    // must be by seq. Direct/system are role 'user' rows persisted with a
    // lastChunkStreamSeq equal to the realtime chunk's streamSeq.
    it('drops a replayed direct-message synthetic once history persisted it', () => {
      const histDirect: TestMessage = { id: 'aaaa0009', role: 'user', content: 'ping from tech', timestamp: t(2100) };
      const replayedDirect: TestMessage = {
        id: 'direct-9999-r',
        role: 'user',
        content: 'ping from tech',
        timestamp: t(9999), // re-minted on reconnect replay — newer than the snapshot
        streamSeq: 80,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, histDirect],
        rawHistoryIds: new Set([U0.id, A0.id, histDirect.id]),
        existingMessages: [U0, A0, histDirect, replayedDirect],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
      });
      expect(ids(merged)).toEqual([U0.id, A0.id, histDirect.id]);
    });

    it('keeps a live direct message history has not persisted yet (no loss)', () => {
      const liveDirect: TestMessage = {
        id: 'direct-3000-x',
        role: 'user',
        content: 'new tech msg',
        timestamp: t(3000),
        streamSeq: 90,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0],
        existingMessages: [U0, A0, liveDirect],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80, // history hasn't reached seq 90 yet
      });
      expect(ids(merged)).toContain(liveDirect.id);
    });

    it('dedups a system-message synthetic by seq coverage', () => {
      const histSystem: TestMessage = { id: 'aaaa0010', role: 'user', content: 'User joined', timestamp: t(2100) };
      const synSystem: TestMessage = {
        id: 'system-9999-r',
        role: 'user',
        content: 'User joined',
        timestamp: t(9999),
        streamSeq: 70,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, A0, histSystem],
        rawHistoryIds: new Set([U0.id, A0.id, histSystem.id]),
        existingMessages: [U0, A0, histSystem, synSystem],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
      });
      expect(ids(merged)).toEqual([U0.id, A0.id, histSystem.id]);
    });
  });

  // Per-ROLE coverage: when history rows carry their own streamSeq, a synthetic
  // is covered only by a persisted row of the SAME role reaching its seq. This
  // prevents the reload/stop message-loss bug where an unrelated other-role or
  // later row pushed the single global max past a synthetic whose own turn was
  // never persisted (interrupted / async), dropping a message the user saw.
  describe('per-role streamSeq coverage', () => {
    it('KEEPS an assistant synthetic when only an OTHER-role row advances the global max', () => {
      // The repro: after reload, an interrupted assistant turn (seq 100) is on
      // screen as a synthetic. A persisted USER row carries a high seq (90) but
      // the assistant turn itself was never persisted. A stop/new-message
      // recompute must NOT drop the assistant synthetic just because some row's
      // seq >= 100 — only a persisted ASSISTANT row reaching 100 may.
      const histUser: TestMessage = {
        id: 'aaaa0100',
        role: 'user',
        content: 'do a health check',
        timestamp: t(2000),
        streamSeq: 90,
      };
      const histAsst: TestMessage = {
        id: 'aaaa0101',
        role: 'assistant',
        content: txt('older answer'),
        timestamp: t(2100),
        streamSeq: 50,
      };
      const interrupted: TestMessage = {
        id: 'assistant-9000-x',
        role: 'assistant',
        content: txt('running tools…'),
        timestamp: t(9000),
        streamSeq: 100,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [histUser, histAsst],
        existingMessages: [histUser, histAsst, interrupted],
        streamingMessageId: null, // exemption already lost (stop / new turn)
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 90, // global max — advanced past 100? no, but a bigger user row would
      });
      expect(ids(merged)).toContain(interrupted.id);
    });

    it('KEEPS an assistant synthetic newer than the same-role persisted max', () => {
      const histAsst: TestMessage = {
        id: 'aaaa0201',
        role: 'assistant',
        content: txt('answer one'),
        timestamp: t(2100),
        streamSeq: 50,
      };
      const laterUser: TestMessage = {
        id: 'aaaa0202',
        role: 'user',
        content: 'and again',
        timestamp: t(2200),
        streamSeq: 120,
      };
      const liveAsst: TestMessage = {
        id: 'assistant-9000-y',
        role: 'assistant',
        content: txt('second answer growing'),
        timestamp: t(9000),
        streamSeq: 100,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [histAsst, laterUser],
        existingMessages: [histAsst, laterUser, liveAsst],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 120, // global would cover 100 and wrongly drop it
      });
      // assistant same-role max is 50 < 100 → kept.
      expect(ids(merged)).toContain(liveAsst.id);
    });

    it('DROPS an assistant synthetic once a same-role persisted row reaches its seq', () => {
      const histAsst: TestMessage = {
        id: 'aaaa0301',
        role: 'assistant',
        content: txt('final answer'),
        timestamp: t(2100),
        streamSeq: 100,
      };
      const synAsst: TestMessage = {
        id: 'assistant-9000-z',
        role: 'assistant',
        content: txt('final answer'),
        timestamp: t(9000),
        streamSeq: 100,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, histAsst],
        rawHistoryIds: new Set([U0.id, histAsst.id]),
        existingMessages: [U0, histAsst, synAsst],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 100,
      });
      // same-role assistant max is 100 >= 100 → the replay is deduped.
      expect(ids(merged)).toEqual([U0.id, histAsst.id]);
    });

    it('DROPS a partial assistant synthetic against the same-role full persisted turn', () => {
      // Partial realtime text differs from the full persisted text — coverage
      // is by seq, not content, and the same-role max proves the turn landed.
      const histAsst: TestMessage = {
        id: 'aaaa0401',
        role: 'assistant',
        content: txt('the full answer'),
        timestamp: t(2100),
        streamSeq: 80,
      };
      const partial: TestMessage = {
        id: 'assistant-9000-p',
        role: 'assistant',
        content: txt('the full ans'),
        timestamp: t(9000),
        streamSeq: 60,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, histAsst],
        rawHistoryIds: new Set([U0.id, histAsst.id]),
        existingMessages: [U0, histAsst, partial],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
      });
      expect(ids(merged)).toEqual([U0.id, histAsst.id]);
    });
  });

  // Adoption path for plain TOOL turns (no approval batch). After a mid-stream
  // reload the trailing assistant is a persisted Mongo-id row; the chunk
  // processors adopt it and append later chunks IN PLACE, so the store's
  // same-id copy is richer than history's async-lagging persisted version. The
  // merge must keep the richer copy or the bubble reverts to stale segments
  // (the "3 tools collapse to 2, one stuck pending" after reload + stop bug).
  describe('adopted trailing assistant (post-reload tool turns)', () => {
    it('pins the same-id realtime copy when it has MORE tool segments than history', () => {
      const id = 'aaaa0700';
      const persistedTrailing: TestMessage = {
        id,
        role: 'assistant',
        content: [tool('t1', 'EXECUTED_TOOL'), tool('t2', 'EXECUTING_TOOL')],
        timestamp: t(2100),
        streamSeq: 60,
      };
      const adoptedRicher: TestMessage = {
        id,
        role: 'assistant',
        content: [tool('t1', 'EXECUTED_TOOL'), tool('t2', 'EXECUTED_TOOL'), tool('t3', 'EXECUTED_TOOL')],
        timestamp: t(2100),
        streamSeq: 80,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, persistedTrailing],
        rawHistoryIds: new Set([U0.id, id]),
        existingMessages: [U0, adoptedRicher], // store holds only the adopted copy
        streamingMessageId: null, // stream is IDLE after stop — no exemption
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 60,
        realtimeSeenStreamSeq: 80,
      });
      const trailing = merged[merged.length - 1];
      expect(trailing).toBe(adoptedRicher);
      expect(Array.isArray(trailing.content) ? trailing.content.length : 0).toBe(3);
      expect(merged.filter(m => m.id === id)).toHaveLength(1); // no duplicate turn
    });

    it('pins the same-id realtime copy when counts tie but its consumed seq is higher', () => {
      const id = 'aaaa0701';
      const persistedTrailing: TestMessage = {
        id,
        role: 'assistant',
        content: [tool('t1', 'EXECUTED_TOOL'), tool('t2', 'EXECUTING_TOOL')],
        timestamp: t(2100),
        streamSeq: 60,
      };
      const adoptedResolved: TestMessage = {
        id,
        role: 'assistant',
        content: [tool('t1', 'EXECUTED_TOOL'), tool('t2', 'EXECUTED_TOOL')], // t2 resolved, same count
        timestamp: t(2100),
        streamSeq: 85,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, persistedTrailing],
        existingMessages: [U0, adoptedResolved],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 60,
        realtimeSeenStreamSeq: 85,
      });
      expect(merged[merged.length - 1]).toBe(adoptedResolved);
    });

    it('keeps the persisted trailing when the same-id realtime copy is NOT richer', () => {
      const id = 'aaaa0702';
      const persistedTrailing: TestMessage = {
        id,
        role: 'assistant',
        content: [tool('t1', 'EXECUTED_TOOL'), tool('t2', 'EXECUTED_TOOL')],
        timestamp: t(2100),
        streamSeq: 80,
      };
      const staleSameId: TestMessage = {
        id,
        role: 'assistant',
        content: [tool('t1', 'EXECUTED_TOOL')], // fewer segments, lower seq
        timestamp: t(2100),
        streamSeq: 50,
      };
      const merged = mergeHistoryWithRealtime<TestMessage>({
        processedHistory: [U0, persistedTrailing],
        existingMessages: [U0, staleSameId],
        streamingMessageId: null,
        historyFetchedAt: 5000,
        historyMaxStreamSeq: 80,
        realtimeSeenStreamSeq: 80,
      });
      expect(merged[merged.length - 1]).toBe(persistedTrailing);
      expect(merged.filter(m => m.id === id)).toHaveLength(1);
    });
  });
});

describe('computeHistoryPrepend', () => {
  it('collects only messages above the first known id', () => {
    const older: TestMessage = { id: 'aaaa0000', role: 'user', content: 'zeroth', timestamp: t(100) };
    const result = computeHistoryPrepend([older, U0, A0], [U0, A0, SYN1]);
    // Throw instead of `expect(...).not.toBeNull()` so the assertions below
    // see a narrowed `result` and a null return fails by name.
    if (!result) throw new Error('computeHistoryPrepend returned null for a page with an older message');
    expect(ids(result.newMessages)).toEqual([older.id]);
    expect(result.boundaryUpdates).toBeUndefined();
  });

  it('reports a boundary content refresh when the known boundary message changed', () => {
    const updatedU0: TestMessage = { ...U0, content: 'first question (edited)' };
    const result = computeHistoryPrepend([updatedU0, A0], [U0, A0]);
    if (!result) throw new Error('computeHistoryPrepend returned null for a changed boundary message');
    expect(result.newMessages).toEqual([]);
    expect(result.boundaryMessageId).toBe(U0.id);
    expect(result.boundaryUpdates).toEqual({ content: 'first question (edited)' });
  });

  it('returns null when there is nothing to apply', () => {
    expect(computeHistoryPrepend([U0, A0], [U0, A0])).toBeNull();
  });
});

describe('page helpers', () => {
  // Pages arrive DESC (newest page first, newest message first within a page).
  const pages: { messages: { id: string; lastChunkStreamSeq?: number | null }[] }[] = [
    {
      messages: [
        { id: 'd', lastChunkStreamSeq: 40 },
        { id: 'c', lastChunkStreamSeq: null },
      ],
    },
    { messages: [{ id: 'b', lastChunkStreamSeq: 20 }, { id: 'a' }] },
  ];

  it('flattenMessagePagesChronological reverses pages and messages into chronological order', () => {
    expect(flattenMessagePagesChronological(pages).map(m => m.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(flattenMessagePagesChronological(undefined)).toEqual([]);
  });

  it('maxPersistedStreamSeq returns the highest stamped seq, 0 when absent', () => {
    expect(maxPersistedStreamSeq(pages)).toBe(40);
    expect(maxPersistedStreamSeq([{ messages: [{}] }])).toBe(0);
    expect(maxPersistedStreamSeq(undefined)).toBe(0);
  });
});

/**
 * The scenario the reducer's `streamSeq` stamp exists for: a history refetch
 * lands MID-STREAM (a reconnect after the window lost focus fires one). History
 * holds only what the backend has persisted so far — often just the user row —
 * while the store holds several live assistant bubbles of the turn in flight.
 */
describe('mid-stream refetch (live turn not yet persisted)', () => {
  // Two bubbles of ONE live turn: the backend splits a turn (a preamble, then
  // the tool bubble), so only ONE of them can be `streamingMessageId`.
  const LIVE_A: TestMessage = {
    id: 'assistant-3000-a',
    role: 'assistant',
    content: txt('let me check that'),
    timestamp: t(3000),
    streamSeq: 41,
  };
  const LIVE_B: TestMessage = {
    id: 'assistant-3100-b',
    role: 'assistant',
    content: [tool('exec-7', 'EXECUTING_TOOL')],
    timestamp: t(3100),
    streamSeq: 42,
  };
  // What history returns mid-turn: the user row only. It carries no
  // `lastChunkStreamSeq` (the backend does not stamp user rows).
  const U_LIVE: TestMessage = { id: 'aaaa0009', role: 'user', content: 'check the disk', timestamp: t(2900) };

  it('keeps every live bubble, not just the streaming one', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U_LIVE],
      existingMessages: [U0, A0, U_LIVE, LIVE_A, LIVE_B],
      // Only the bubble currently being written is exempt by id — the earlier
      // one of the same turn has to survive on its own seq evidence.
      streamingMessageId: LIVE_B.id,
      // The refetch instant is AFTER both bubbles were created, which is
      // exactly what the wall-clock fallback misreads as "history has them".
      historyFetchedAt: 3500,
      historyMaxStreamSeq: 0,
      realtimeSeenStreamSeq: 42,
    });

    expect(ids(merged)).toEqual([U0.id, A0.id, U_LIVE.id, LIVE_A.id, LIVE_B.id]);
  });

  it('drops a live bubble once a persisted row of its role reaches its seq', () => {
    // Self-healing side of the same rule: when the turn IS persisted, the
    // synthetic must go or it renders twice.
    const persisted: TestMessage = {
      id: 'aaaa0010',
      role: 'assistant',
      content: txt('let me check that'),
      timestamp: t(3000),
      streamSeq: 41,
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, U_LIVE, persisted],
      existingMessages: [U0, A0, U_LIVE, LIVE_A],
      streamingMessageId: null,
      historyFetchedAt: 3500,
      historyMaxStreamSeq: 41,
      realtimeSeenStreamSeq: 41,
    });

    expect(ids(merged)).toEqual([U0.id, A0.id, U_LIVE.id, persisted.id]);
  });
});

/**
 * The other half of the mid-stream refetch: history has begun persisting the
 * turn that is STILL STREAMING. Its snapshot stops at whatever chunk the
 * backend had written, so the two copies disagree — the same tool row reads
 * `pending` in one and `failed` in the other. Ids cannot match here: adoption
 * only happens on a replay, and a refetch mid-stream has none.
 */
describe('mid-stream refetch (turn partially persisted)', () => {
  const LIVE: TestMessage = {
    id: 'assistant-4000-live',
    role: 'assistant',
    content: [tool('exec-1', 'EXECUTED_TOOL'), tool('exec-2', 'EXECUTED_TOOL'), tool('exec-3', 'EXECUTING_TOOL')],
    timestamp: t(4000),
    streamSeq: 90,
  };
  // History's snapshot of the SAME turn, under its Mongo id, two chunks behind.
  const PERSISTED_PARTIAL: TestMessage = {
    id: 'aaaa0020',
    role: 'assistant',
    content: [tool('exec-1', 'EXECUTED_TOOL'), tool('exec-2', 'EXECUTING_TOOL')],
    timestamp: t(3900),
    streamSeq: 70,
  };

  it('keeps ONE copy — the live one — when the turn is still streaming', () => {
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, PERSISTED_PARTIAL],
      existingMessages: [U0, A0, LIVE],
      streamingMessageId: LIVE.id,
      historyFetchedAt: 4200,
      historyMaxStreamSeq: 70,
      realtimeSeenStreamSeq: 90,
    });

    expect(ids(merged)).toEqual([U0.id, A0.id, LIVE.id]);
  });

  it('keeps the live copy when it is richer even after the stream ends', () => {
    // No `streamingMessageId` any more, but the turn's own request ids still
    // identify the twin and the live copy still holds more of it.
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, PERSISTED_PARTIAL],
      existingMessages: [U0, A0, LIVE],
      streamingMessageId: null,
      historyFetchedAt: 4200,
      historyMaxStreamSeq: 70,
      realtimeSeenStreamSeq: 90,
    });

    expect(ids(merged)).toEqual([U0.id, A0.id, LIVE.id]);
  });

  it('lets the persisted copy win once it has caught up (self-heals)', () => {
    const persistedFull: TestMessage = {
      ...PERSISTED_PARTIAL,
      content: [tool('exec-1', 'EXECUTED_TOOL'), tool('exec-2', 'EXECUTED_TOOL'), tool('exec-3', 'EXECUTED_TOOL')],
      streamSeq: 95,
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, persistedFull],
      existingMessages: [U0, A0, LIVE],
      streamingMessageId: null,
      historyFetchedAt: 4500,
      historyMaxStreamSeq: 95,
      realtimeSeenStreamSeq: 90,
    });

    expect(ids(merged)).toEqual([U0.id, A0.id, persistedFull.id]);
  });

  it('does not pair unrelated turns that merely sit next to each other', () => {
    // No shared request id → no turn identity → both stand. Guards the widened
    // match from swallowing a genuinely separate turn.
    const unrelatedLive: TestMessage = {
      id: 'assistant-4100-other',
      role: 'assistant',
      content: [tool('exec-77', 'EXECUTING_TOOL')],
      timestamp: t(4100),
      streamSeq: 91,
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [U0, A0, PERSISTED_PARTIAL],
      existingMessages: [U0, A0, unrelatedLive],
      streamingMessageId: unrelatedLive.id,
      historyFetchedAt: 4200,
      historyMaxStreamSeq: 70,
      realtimeSeenStreamSeq: 91,
    });

    expect(ids(merged)).toEqual([U0.id, A0.id, PERSISTED_PARTIAL.id, unrelatedLive.id]);
  });
});

describe('ordering of surviving realtime messages', () => {
  // The merge concatenates: all persisted history, then every realtime message
  // the coverage rules kept, each side in its own order. These pin that
  // contract, which nothing asserted before — the suite tested only WHICH
  // messages survive, never where they land — and which an attempt to
  // chronologically interleave the two sides repeatedly broke.
  const H_U0: TestMessage = { ...U0, streamSeq: 5 };
  const H_A0: TestMessage = { ...A0, streamSeq: 10 };
  /**
   * Sent from a notification while the window was away, and persisted. NO
   * `streamSeq`: the backend does not stamp user MESSAGE_REQUEST rows, which is
   * the missing signal that makes interleaving guesswork.
   */
  const AWAY_U: TestMessage = {
    id: 'bbbb0001',
    role: 'user',
    content: 'replied from a notification',
    timestamp: t(3000),
  };
  /** Mingo's answer to it. Assistant rows DO carry a sequence. */
  const AWAY_A: TestMessage = {
    id: 'bbbb0002',
    role: 'assistant',
    content: txt('answered while the window was away'),
    timestamp: t(3100),
    streamSeq: 80,
  };

  it('appends surviving realtime messages after all persisted history', () => {
    // A technician direct message the snapshot has not caught up with. Its own
    // role's persisted max (H_U0, seq 5) is below it, so coverage keeps it.
    const unpersistedDirect: TestMessage = {
      id: 'direct-1500-old',
      role: 'user',
      content: 'a direct message history has not persisted yet',
      timestamp: t(1500),
      streamSeq: 40,
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [H_U0, H_A0, AWAY_U, AWAY_A],
      existingMessages: [H_U0, H_A0, unpersistedDirect],
      streamingMessageId: null,
      historyFetchedAt: 9000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 40,
    });

    expect(ids(merged)).toEqual([H_U0.id, H_A0.id, AWAY_U.id, AWAY_A.id, unpersistedDirect.id]);
  });

  it('keeps survivors in store order, sequence or no sequence', () => {
    // The guard against reordering the two kinds against each other: an
    // optimistic bubble carries no sequence and a replayed direct message does,
    // and sorting by sequence would render the user's question below the reply
    // that came after it.
    const optimistic: TestMessage = {
      id: 'optimistic-9400-x',
      role: 'user',
      content: 'just typed, no seq of its own',
      timestamp: t(9400),
    };
    const laterDirect: TestMessage = {
      id: 'direct-9500-x',
      role: 'user',
      content: 'and a direct message after it',
      timestamp: t(9500),
      streamSeq: 40,
    };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [H_U0, H_A0, AWAY_U, AWAY_A],
      existingMessages: [H_U0, H_A0, optimistic, laterDirect],
      streamingMessageId: null,
      // Before either was minted, so neither can be in the snapshot.
      historyFetchedAt: 9000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 40,
    });

    expect(ids(merged)).toEqual([H_U0.id, H_A0.id, AWAY_U.id, AWAY_A.id, optimistic.id, laterDirect.id]);
  });

  it('keeps history in snapshot order even when its sequences do not climb', () => {
    // The snapshot is the server's account of the conversation; the merge is
    // not entitled to second-guess it from a `streamSeq` that looks out of
    // order, which is what any sort of the two sides together would do.
    const outOfOrder: TestMessage = { ...H_A0, id: 'aaaa0009', streamSeq: 3 };
    const merged = mergeHistoryWithRealtime({
      processedHistory: [H_U0, outOfOrder, AWAY_U, AWAY_A],
      existingMessages: [H_U0],
      streamingMessageId: null,
      historyFetchedAt: 9000,
      historyMaxStreamSeq: 80,
      realtimeSeenStreamSeq: 0,
    });

    expect(ids(merged)).toEqual([H_U0.id, outOfOrder.id, AWAY_U.id, AWAY_A.id]);
  });
});

describe('sliding history window (refetch after the thread grew)', () => {
  // Pages are fetched newest-first with a fixed count, so a refetch after the
  // thread has grown returns the newest rows and the head of what is on screen
  // is no longer in it. Everything older than that window must survive, in
  // place: it cannot have a twin the window could dedupe it against.
  const persisted = (n: number, role: 'user' | 'assistant', seq?: number): TestMessage => ({
    id: `dddd${String(n).padStart(4, '0')}`,
    role,
    content: role === 'user' ? `q${n}` : txt(`a${n}`),
    timestamp: t(10_000 + n),
    ...(seq !== undefined ? { streamSeq: seq } : {}),
  });
  const head = [persisted(1, 'user'), persisted(2, 'assistant', 2)];
  const refetched = [
    persisted(5, 'user'),
    persisted(6, 'assistant', 6),
    persisted(7, 'user'),
    persisted(8, 'assistant', 8),
  ];
  const windowWith = (sixth: TestMessage) => [refetched[0], sixth, refetched[2], refetched[3]];
  const merge = (existingMessages: TestMessage[], processedHistory: TestMessage[] = refetched, fetchedAt = 99_000) =>
    mergeHistoryWithRealtime({
      processedHistory,
      rawHistoryIds: new Set(ids(processedHistory)),
      existingMessages,
      streamingMessageId: null,
      historyFetchedAt: fetchedAt,
      historyMaxStreamSeq: maxPersistedStreamSeq([
        { messages: processedHistory.map(m => ({ lastChunkStreamSeq: m.streamSeq })) },
      ]),
      realtimeSeenStreamSeq: 8,
    });

  it('keeps persisted rows that fell out of the refetched window IN FRONT of it, in order', () => {
    // These used to be appended after the window — the start of the
    // conversation showed up below the newest reply on every refetch.
    const onScreen = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      return n % 2 === 0 ? persisted(n, 'assistant', n) : persisted(n, 'user');
    });
    expect(ids(merge(onScreen, onScreen.slice(4)))).toEqual(ids(onScreen));
  });

  it('keeps a live turn before the first window row even when its text repeats a window row', () => {
    // The thread's own window rows fix the boundary, so a row above them is
    // older whatever its content says — no clock, seq or text heuristics.
    const live: TestMessage[] = [
      { id: 'optimistic-3', role: 'user', content: 'q5', timestamp: t(10_003) },
      { id: 'assistant-4', role: 'assistant', content: txt('a6'), timestamp: t(10_004), streamSeq: 4 },
    ];
    expect(ids(merge([...head, ...live, ...refetched]))).toEqual([...ids(head), ...ids(live), ...ids(refetched)]);
  });

  it('judges rows on their own when the thread holds no window row — a live turn older than the window is kept', () => {
    // Turns streamed live and never refetched are still synthetics. Once the
    // window slid past them, same-role coverage read "a persisted row reached
    // this seq" and DROPPED the assistant reply — with no twin on screen to
    // stand in for it — while the optimistic prompt was kept out of order.
    const live: TestMessage[] = [
      { id: 'optimistic-3', role: 'user', content: 'q3', timestamp: t(10_003) },
      { id: 'assistant-4', role: 'assistant', content: txt('a4'), timestamp: t(10_004), streamSeq: 4 },
    ];
    expect(ids(merge([...head, ...live]))).toEqual([...ids(head), ...ids(live), ...ids(refetched)]);
  });

  it('pins the twin guard: a cut-short copy of a window turn is left to coverage even when its seq reads older', () => {
    // The window's first assistant row is unstamped (async stamping lag), so by
    // seq alone the live copy looks older than the window. Its answer text is
    // a prefix of that row's: it is the row's twin, and coverage drops it.
    const unstamped: TestMessage = {
      id: 'dddd0006',
      role: 'assistant',
      content: txt('a6 and then'),
      timestamp: t(10_006),
    };
    const snapshot = windowWith(unstamped);
    const cutShort: TestMessage = {
      id: 'assistant-6',
      role: 'assistant',
      content: txt('a6'),
      timestamp: t(10_006),
      streamSeq: 6,
    };
    expect(ids(merge([cutShort], snapshot))).toEqual(ids(snapshot));
  });

  it('pins the twin guard the other way: a persisted row still being written is the twin of the fuller live copy', () => {
    const lagging: TestMessage = { id: 'dddd0006', role: 'assistant', content: txt('a6'), timestamp: t(10_006) };
    const snapshot = windowWith(lagging);
    const fuller: TestMessage = {
      id: 'assistant-6',
      role: 'assistant',
      content: txt('a6 and then'),
      timestamp: t(10_006),
      streamSeq: 6,
    };
    expect(ids(merge([fuller], snapshot))).toEqual(ids(snapshot));
  });

  it('keeps a trailing live turn AFTER the window — the boundary only bounds what is older', () => {
    const live: TestMessage[] = [
      { id: 'optimistic-9', role: 'user', content: 'q9', timestamp: t(99_500) },
      { id: 'assistant-10', role: 'assistant', content: txt('a10'), timestamp: t(99_600), streamSeq: 10 },
    ];
    expect(ids(merge([...head, ...refetched, ...live]))).toEqual([...ids(head), ...ids(refetched), ...ids(live)]);
  });

  it('never pulls a host-minted tail row above the window it sits behind', () => {
    // A non-synthetic, non-optimistic id is read as persisted only when the
    // thread holds no window row; behind the window it is the live tail.
    const preview: TestMessage = {
      id: 'ticket-preview-1',
      role: 'assistant',
      content: txt('preview'),
      timestamp: t(99_500),
    };
    expect(ids(merge([...refetched, preview]))).toEqual([...ids(refetched), preview.id]);
  });

  it('never reads a host-minted row newer than the fetch as persisted history, even with no window row in the thread', () => {
    // openframe-chat's call shape: the thread is the live tail only. A ticket
    // preview it minted after the fetch must neither anchor the live rows in
    // front nor be dropped as a disjoint persisted row.
    const live: TestMessage[] = [
      { id: 'user-5', role: 'user', content: 'q5', timestamp: t(99_500), streamSeq: 5 },
      { id: 'assistant-6', role: 'assistant', content: txt('a6'), timestamp: t(99_600), streamSeq: 6 },
    ];
    const preview: TestMessage = {
      id: 'ticket-preview-1',
      role: 'assistant',
      content: txt('preview'),
      timestamp: t(99_900),
    };
    const snapshot = [persisted(5, 'user'), persisted(6, 'assistant', 6)];
    expect(ids(merge([...live, preview], snapshot))).toEqual([...ids(snapshot), preview.id]);
    expect(ids(merge([preview], snapshot))).toEqual([...ids(snapshot), preview.id]);
  });

  it('does not read a message sent AFTER the fetch as older than the window on a clock behind the server', () => {
    // Client clock 9_000, window rows stamped 10_005+ by the server, fetch at
    // client 8_000: the send happened after the fetch, so it cannot predate a
    // window that fetch returned.
    const sent: TestMessage = { id: 'optimistic-x', role: 'user', content: 'a new question', timestamp: t(9_000) };
    expect(ids(merge([sent], refetched, 8_000))).toEqual([...ids(refetched), sent.id]);
  });

  it('anchors on the last persisted row when the thread holds no window row: everything before it is older', () => {
    // Text collisions with the window ("continue"-style prompts, short
    // answers) cannot demote a row that precedes a persisted row the window
    // itself lacks.
    const live: TestMessage[] = [
      { id: 'optimistic-1', role: 'user', content: 'q5', timestamp: t(10_001) },
      { id: 'assistant-2', role: 'assistant', content: txt('a6'), timestamp: t(10_002), streamSeq: 2 },
    ];
    const older = [persisted(3, 'user'), persisted(4, 'assistant', 4)];
    expect(ids(merge([...live, ...older]))).toEqual([...ids(live), ...ids(older), ...ids(refetched)]);
  });

  it('heals a copy a previous merge placed in front once a window row proves it by request id', () => {
    // A tool turn whose persisted row was unstamped when first refetched read
    // as older and went in front. Now stamped and in the window, the shared
    // tool id says which turn the live copy is: back to coverage, gone.
    const toolTurn = (id: string, seq?: number): TestMessage => ({
      id,
      role: 'assistant',
      content: [tool('call-6', 'EXECUTED_TOOL')],
      timestamp: t(10_006),
      ...(seq !== undefined ? { streamSeq: seq } : {}),
    });
    const stale = toolTurn('assistant-6', 6);
    const snapshot = windowWith(toolTurn('dddd0006', 6));
    expect(ids(merge([stale, ...snapshot], snapshot))).toEqual(ids(snapshot));
  });

  it('keeps an older system notice on seq alone — its persisted twin is stamped, and empty text is no identity', () => {
    const notice: TestMessage = { id: 'system-3', role: 'user', content: '', timestamp: t(10_003), streamSeq: 3 };
    const windowNotice: TestMessage = { id: 'dddd0006', role: 'user', content: '', timestamp: t(10_006), streamSeq: 6 };
    const snapshot = windowWith(windowNotice);
    expect(ids(merge([notice], snapshot))).toEqual([notice.id, ...ids(snapshot)]);
  });

  it("drops a cut-short copy of the window's oldest stamped turn even though its seq reads older", () => {
    // A copy carries its LAST CONSUMED chunk's seq, which is below its twin's
    // stamp whenever the client missed the tail — the reconnect race. Every
    // window assistant is stamped, so seq alone would promote it; its text is a
    // prefix of the twin's, and the verdict wins.
    const full = { ...persisted(6, 'assistant', 6), content: txt('a6 and then more') };
    const snapshot = windowWith(full);
    const cutShort: TestMessage = {
      id: 'assistant-2',
      role: 'assistant',
      content: txt('a6'),
      timestamp: t(10_006),
      streamSeq: 4,
    };
    const prompt: TestMessage = { id: 'optimistic-1', role: 'user', content: 'q5', timestamp: t(10_005) };
    expect(ids(merge([prompt, cutShort], snapshot))).toEqual(ids(snapshot));
  });

  it('drops persisted rows disjoint from the window when nothing live bridges them', () => {
    // Rows added while this client was unsubscribed for a page or more: the
    // thread's persisted rows and the window share nothing, and the next older
    // page would land above the thread's rows. The window alone is the thread.
    expect(ids(merge(head))).toEqual(ids(refetched));
  });

  it('trusts seq for an assistant copy when every assistant row in the window is stamped, even a text-less one', () => {
    const thinkingOnly: TestMessage = {
      id: 'assistant-3',
      role: 'assistant',
      content: [{ type: 'thinking', text: 'hmm' }],
      timestamp: t(10_003),
      streamSeq: 3,
    };
    expect(ids(merge([thinkingOnly]))).toEqual([thinkingOnly.id, ...ids(refetched)]);
  });
});

describe('computeHistoryPrepend after a window slide', () => {
  const persisted = (
    n: number,
    role: 'user' | 'assistant',
    text = role === 'user' ? `q${n}` : `a${n}`,
  ): TestMessage => ({
    id: `cccc${String(n).padStart(4, '0')}`,
    role,
    content: role === 'user' ? text : txt(text),
    timestamp: t(20_000 + n),
    ...(role === 'assistant' ? { streamSeq: n } : {}),
  });
  const snapshot = [persisted(5, 'user'), persisted(6, 'assistant')];

  it('leaves out the persisted twins of live rows the thread still shows above the boundary', () => {
    // The thread kept turn 3/4 live (see the window-boundary tests); the older
    // page now carries their persisted rows. Prepending them would render the
    // turn twice; the persisted copy waits for the next full merge.
    const live: TestMessage[] = [
      { id: 'optimistic-3', role: 'user', content: 'q3', timestamp: t(20_003) },
      { id: 'assistant-4', role: 'assistant', content: txt('a4'), timestamp: t(20_004), streamSeq: 4 },
    ];
    const olderPages = [
      persisted(1, 'user'),
      persisted(2, 'assistant'),
      persisted(3, 'user'),
      persisted(4, 'assistant'),
      ...snapshot,
    ];
    const result = computeHistoryPrepend(olderPages, [...live, ...snapshot]);
    if (!result) throw new Error('computeHistoryPrepend returned null for a page with older messages');
    expect(ids(result.newMessages)).toEqual(['cccc0001', 'cccc0002']);
  });

  it('matches a repeated prompt positionally — the live row twins the NEWEST same-text row before the boundary', () => {
    const live: TestMessage[] = [{ id: 'optimistic-3', role: 'user', content: 'continue', timestamp: t(20_003) }];
    const olderPages = [
      persisted(1, 'user', 'continue'),
      persisted(2, 'assistant'),
      persisted(3, 'user', 'continue'),
      persisted(4, 'assistant'),
      ...snapshot,
    ];
    const result = computeHistoryPrepend(olderPages, [...live, ...snapshot]);
    if (!result) throw new Error('computeHistoryPrepend returned null for a page with older messages');
    expect(ids(result.newMessages)).toEqual(['cccc0001', 'cccc0002', 'cccc0004']);
  });

  it('prepends everything when nothing live sits above the boundary', () => {
    const olderPages = [persisted(3, 'user'), persisted(4, 'assistant'), ...snapshot];
    const result = computeHistoryPrepend(olderPages, snapshot);
    if (!result) throw new Error('computeHistoryPrepend returned null for a page with older messages');
    expect(ids(result.newMessages)).toEqual(['cccc0003', 'cccc0004']);
  });

  it('claims one persisted answer per live answer, newest first, and only in the cut-short direction', () => {
    // A live "Done." above the boundary twins the newest persisted "Done." on
    // the page — not an older turn that merely opens with it.
    const live: TestMessage[] = [
      { id: 'assistant-4', role: 'assistant', content: txt('Done.'), timestamp: t(20_004), streamSeq: 4 },
    ];
    const olderPages = [
      persisted(1, 'user'),
      persisted(2, 'assistant', 'Done. Anything else?'),
      persisted(3, 'user'),
      persisted(4, 'assistant', 'Done.'),
      ...snapshot,
    ];
    const result = computeHistoryPrepend(olderPages, [...live, ...snapshot]);
    if (!result) throw new Error('computeHistoryPrepend returned null for a page with older messages');
    expect(ids(result.newMessages)).toEqual(['cccc0001', 'cccc0002', 'cccc0003']);
  });
});
