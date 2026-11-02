/**
 * `createChatDialogStore` cross-side projection.
 *
 * Exactly two operations fan out across sides of the same dialogId:
 * approval-resolution by its id and a tool's run merged by its call id.
 * The projection is recomputed from state (never re-injected into the other
 * side's seq stream), so per-side seq gates stay untouched and replays are
 * idempotent with full referential stability on untouched messages.
 */

import { describe, it, expect } from 'vitest';
import { approvalStatusOf, isToolPart, textOfParts, type ChatMessage } from '../../../../chat-protocol/chat-message';
import type { ChatStreamEntry, UiChunk } from '../../../../chat-protocol/ui-chunks';
import { createChatDialogStore, DEFAULT_MAX_REDUCERS, MAX_PENDING_RETAIN_KEYS } from '../chat-dialog-store';
import type { EvictedReducerState } from '../chat-dialog-store';

/** ES2020-compatible `arr.at(-1)`. The package pins `lib: ES2020`
 *  (target ES2020 is the shipped contract), where `Array.prototype.at`
 *  is not declared — the source tree uses `xs[xs.length - 1]` for the
 *  same reason. */
const last = <T>(xs: readonly T[] | undefined): T | undefined => (xs === undefined ? undefined : xs[xs.length - 1]);

const DIALOG = 'dlg-1';

const entry = (seq: number, ...chunks: UiChunk[]): ChatStreamEntry => ({ seq, chunks });
const start = (seq: number): ChatStreamEntry => entry(seq, { type: 'start', messageId: `stream-${seq}` });
const end = (seq: number): ChatStreamEntry => entry(seq, { type: 'finish', finishReason: 'stop' });
const text = (delta: string, seq: number): ChatStreamEntry => entry(seq, { type: 'text-delta', id: 't1', delta });
const participant = (seq: number, data: Record<string, unknown>): ChatStreamEntry =>
  entry(seq, {
    type: 'data-chat-participant',
    transient: true,
    data: { kind: 'message-request', text: '', ...data },
  });

/** A batched card: its row asks, on the request's batch. */
const batchApproval = (seq: number): ChatStreamEntry =>
  entry(
    seq,
    { type: 'tool-input-available', toolCallId: 'exec-1', toolName: 'run_command', input: null },
    {
      type: 'tool-approval-request',
      approvalId: 'exec-1',
      toolCallId: 'exec-1',
      approvalDescriptor: { batchId: 'req-1', approvalType: 'CLIENT' },
    },
  );

const approved = (seq: number, resolvedByName?: string): ChatStreamEntry =>
  entry(seq, {
    type: 'tool-approval-response',
    approvalId: 'req-1',
    approved: true,
    ...(resolvedByName ? { toolMetadata: { resolvedByName } } : {}),
  });

const executed = (seq: number): ChatStreamEntry =>
  entry(seq, { type: 'tool-output-available', toolCallId: 'exec-1', output: 'ok' });

const textOf = (state: { messages: readonly ChatMessage[] }): string => textOfParts(last(state.messages)?.parts ?? []);
const assistantSaying = (id: string, said: string): ChatMessage => ({
  id,
  role: 'assistant',
  parts: [{ type: 'text', text: said }],
});

function seedBothSides(store: ReturnType<typeof createChatDialogStore>) {
  // Side A (client view) and side B (technician mirror) both saw the turn
  // with the approval card — each through its OWN seq stream.
  for (const side of ['main', 'observer'] as const) {
    store.apply(DIALOG, side, start(1));
    store.apply(DIALOG, side, text('needs approval', 2));
    store.apply(DIALOG, side, batchApproval(3));
    store.apply(DIALOG, side, end(4));
  }
}

const rowOf = (state: { messages: readonly ChatMessage[] }) =>
  state.messages.flatMap(message => message.parts).find(isToolPart);

describe('createChatDialogStore — cross-side projection', () => {
  it('(a) a same-id TEXT chunk on one side does NOT touch the other side', () => {
    const store = createChatDialogStore();
    seedBothSides(store);
    const bBefore = store.getSnapshot(DIALOG, 'observer');

    store.apply(DIALOG, 'main', text('main-only continuation', 5));

    expect(store.getSnapshot(DIALOG, 'observer')).toBe(bBefore);
    const aTrailing = last(store.getSnapshot(DIALOG, 'main').messages);
    const bTrailing = last(store.getSnapshot(DIALOG, 'observer').messages);
    expect(JSON.stringify(aTrailing)).not.toEqual(JSON.stringify(bTrailing));
  });

  it('(b) approval resolved on side A updates side B matching card (status + resolver)', () => {
    const store = createChatDialogStore();
    seedBothSides(store);

    store.apply(DIALOG, 'main', approved(5, 'Alice Client'));

    for (const side of ['main', 'observer'] as const) {
      const state = store.getSnapshot(DIALOG, side);
      const card = rowOf(state);
      expect(card && approvalStatusOf(card)).toBe('approved');
      expect(card?.toolMetadata?.resolvedByName).toBe('Alice Client');
      // Status map mirrored on both sides so future replays render resolved.
      expect(state.approvalStatuses['req-1']).toBe('approved');
    }
  });

  it('(b2) tool execution on side A merges into side B batch card WITHOUT appending', () => {
    const store = createChatDialogStore();
    seedBothSides(store);
    store.apply(DIALOG, 'main', approved(5));

    store.apply(DIALOG, 'main', executed(6));

    const b = store.getSnapshot(DIALOG, 'observer');
    expect(rowOf(b)).toMatchObject({ toolCallId: 'exec-1', state: 'output-available', output: 'ok' });
    // Merge-only projection: no standalone tool card appeared on side B.
    expect(b.messages.flatMap(m => m.parts).filter(isToolPart)).toHaveLength(1);
  });

  it('(b3) a tool side B never held is not grown on it', () => {
    const store = createChatDialogStore();
    seedBothSides(store);
    const bBefore = store.getSnapshot(DIALOG, 'observer').messages;

    store.apply(
      DIALOG,
      'main',
      entry(5, { type: 'tool-input-available', toolCallId: 'exec-other', toolName: 'x', input: {} }),
    );

    expect(store.getSnapshot(DIALOG, 'observer').messages).toBe(bBefore);
  });

  it('(c) replaying side A chunks after the projection: no double-application + Object.is stability on side B untouched messages', () => {
    const store = createChatDialogStore();
    seedBothSides(store);

    const resolve = approved(5, 'Alice Client');
    const executedEntry = executed(6);
    store.apply(DIALOG, 'main', resolve);
    store.apply(DIALOG, 'main', executedEntry);

    const aState = store.getSnapshot(DIALOG, 'main');
    const bState = store.getSnapshot(DIALOG, 'observer');
    const bMessages = bState.messages;

    // Replay side A's chunks (reconnect back-fill). Side A drops them via
    // its seq gate; the recomputed projection over side B is a value-level
    // no-op → identical references end-to-end.
    store.apply(DIALOG, 'main', resolve);
    store.apply(DIALOG, 'main', executedEntry);

    expect(store.getSnapshot(DIALOG, 'main')).toBe(aState);
    const bAfter = store.getSnapshot(DIALOG, 'observer');
    expect(bAfter.messages).toBe(bMessages);
    bAfter.messages.forEach((m, i) => {
      expect(m).toBe(bMessages[i]);
    });
    expect(bAfter).toBe(bState);
  });

  it("(c2) the projection never advances the other side's seq gate", () => {
    const store = createChatDialogStore();
    seedBothSides(store);

    // Side A resolves at a HIGH seq…
    store.apply(DIALOG, 'main', approved(100));
    // …side B's own stream continues at ITS low seq — must still apply.
    store.apply(DIALOG, 'observer', text(' b-continues', 5));
    expect(textOf(store.getSnapshot(DIALOG, 'observer'))).toContain('b-continues');
  });

  /**
   * The projection reaches the sides that EXIST when the chunk lands — it is a
   * fan-out over the live reducer map, not a durable log. A side materialized
   * later (panel opened after the fact, or its key LRU-evicted and recreated)
   * therefore starts from history + the parked status map, NOT from replayed
   * projections.
   *
   * Untested until now, and the tempting "fix" — having `otherSides` create the
   * missing sides — is wrong twice over: it would materialize reducers for
   * panels nobody is rendering (defeating the LRU cap that exists to bound
   * exactly that), and it would seed them with a card they never received the
   * APPROVAL_REQUEST for. This fixture states the host contract so that
   * refactor fails loudly instead of silently changing the memory profile.
   */
  it('(d) a side materialized AFTER the projection does not receive it retroactively', () => {
    const store = createChatDialogStore();
    // ONLY side A exists when the resolution arrives.
    store.apply(DIALOG, 'main', start(1));
    store.apply(DIALOG, 'main', batchApproval(2));
    store.apply(DIALOG, 'main', approved(3));

    // The projection created NO reducer for the absent side.
    expect(store.getSnapshot(DIALOG, 'observer').messages).toHaveLength(0);
    expect(store.getSnapshot(DIALOG, 'observer').approvalStatuses).toEqual({});

    // Side B opens now and replays its own history: it must learn the
    // resolution from the host (parked / persisted statuses), not from the
    // projection that already fired.
    store.apply(DIALOG, 'observer', start(1));
    store.apply(DIALOG, 'observer', batchApproval(2));
    expect(store.getSnapshot(DIALOG, 'observer').approvalStatuses).toEqual({});

    store.mutate(DIALOG, 'observer', r => r.mergeApprovalStatuses({ 'req-1': 'approved' }));
    expect(store.getSnapshot(DIALOG, 'observer').approvalStatuses).toEqual({
      'req-1': 'approved',
    });
  });
});

describe('createChatDialogStore — snapshot purity + reducer lifecycle', () => {
  it('getSnapshot on an unknown key creates NO entry (returns the shared frozen EMPTY_STATE)', () => {
    const store = createChatDialogStore();

    const a = store.getSnapshot('never-seen-a');
    const b = store.getSnapshot('never-seen-b', 'observer');
    // One shared instance across every absent key → nothing was created
    // per-key, and useSyncExternalStore sees a stable identity.
    expect(a).toBe(b);
    expect(a).toBe(store.getServerSnapshot());
    expect(Object.isFrozen(a)).toBe(true);
    expect(a.messages).toEqual([]);
    expect(a.streamingPhase).toBe('idle');

    // Behavioral proof that no entries were inserted: a real reducer created
    // BEFORE far more phantom reads than the LRU cap survives untouched.
    store.apply('real', 'main', start(1));
    store.apply('real', 'main', text('kept', 2));
    for (let i = 0; i < DEFAULT_MAX_REDUCERS * 3; i += 1) {
      store.getSnapshot(`phantom-${i}`);
    }
    const kept = store.getSnapshot('real', 'main');
    expect(textOf(kept)).toBe('kept');
  });

  it('evicts least-recently-used reducers past the cap, keeping the recently-applied ones', () => {
    const store = createChatDialogStore({ maxReducers: 2 });

    for (const id of ['d1', 'd2', 'd3']) {
      finishedTurn(store, id, id);
    }

    // d1 is the LRU → evicted; its snapshot falls back to EMPTY_STATE.
    expect(store.getSnapshot('d1', 'main').messages).toEqual([]);
    for (const id of ['d2', 'd3']) {
      expect(textOf(store.getSnapshot(id, 'main'))).toBe(id);
    }
  });

  it('applying to an existing reducer refreshes its LRU position', () => {
    const store = createChatDialogStore({ maxReducers: 2 });
    finishedTurn(store, 'd1', 'd1');
    finishedTurn(store, 'd2', 'd2');
    // Touch d1 so d2 becomes the least-recently-used…
    store.apply('d1', 'main', text('!', 5));
    store.apply('d1', 'main', end(6));
    // …then a third dialog evicts d2, not d1.
    finishedTurn(store, 'd3', 'd3');

    expect(store.getSnapshot('d2', 'main').messages).toEqual([]);
    expect(store.getSnapshot('d1', 'main').messages.length).toBeGreaterThan(0);
    expect(store.getSnapshot('d3', 'main').messages.length).toBeGreaterThan(0);
  });
});

/** One complete (idle-at-the-end) turn — the only shape the LRU may evict. */
function finishedTurn(store: ReturnType<typeof createChatDialogStore>, dialogId: string, said: string): void {
  store.apply(dialogId, 'main', start(1));
  store.apply(dialogId, 'main', text(said, 2));
  store.apply(dialogId, 'main', end(3));
}

describe('createChatDialogStore — eviction safety', () => {
  it('NEVER evicts a reducer that is mid-stream (streamingPhase !== idle)', () => {
    const store = createChatDialogStore({ maxReducers: 1 });

    // A live turn on `live`: no turn-end, so the phase is still streaming.
    store.apply('live', 'main', start(1));
    store.apply('live', 'main', text('half a sen', 2));
    expect(store.getSnapshot('live', 'main').streamingPhase).not.toBe('idle');

    // Ten other dialogs churn through the cap of 1.
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `other-${i}`, 'x');

    // The live thread survives — dropping it would blank a visible thread
    // that the host's seq cursor believes is already caught up.
    const live = store.getSnapshot('live', 'main');
    expect(live.messages.length).toBeGreaterThan(0);
    expect(live.streamingPhase).not.toBe('idle');

    // …and once the turn finishes it becomes evictable again.
    store.apply('live', 'main', end(3));
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `later-${i}`, 'x');
    expect(store.getSnapshot('live', 'main').messages).toEqual([]);
  });

  it('NEVER evicts a RETAINED key, and evicts it again after release', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'pinned', 'pinned-text');
    const release = store.retain('pinned', 'main');

    for (let i = 0; i < 10; i += 1) finishedTurn(store, `noise-${i}`, 'x');
    expect(textOf(store.getSnapshot('pinned', 'main'))).toBe('pinned-text');

    release();
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `more-${i}`, 'x');
    expect(store.getSnapshot('pinned', 'main').messages).toEqual([]);
  });

  /**
   * REGRESSION (round 4): eviction used to be UNPUBLISHED, so hosts inferred
   * it by comparing reducer OBJECT IDENTITY across `getReducer` calls and then
   * suppressing the pristine-empty snapshot a silently-recreated reducer
   * returns. The store knows the fact exactly — it states it.
   */
  it('onEvict publishes the (dialogId, side) an LRU eviction dropped', () => {
    const evicted: Array<[string, string]> = [];
    const store = createChatDialogStore({
      maxReducers: 1,
      onEvict: (dialogId, side) => evicted.push([dialogId, side]),
    });
    finishedTurn(store, 'first', 'a');
    // Round-trip through a side whose name contains no separator ambiguity.
    store.getReducer('second', 'observer');
    expect(evicted).toEqual([['first', 'main']]);

    // Host-initiated removal is NOT an eviction — the caller already knows.
    store.remove('second', 'observer');
    expect(evicted).toEqual([['first', 'main']]);
  });

  /**
   * REGRESSION (round 5): the eviction handoff used to carry MESSAGES only, so
   * a host re-seeding the recreated reducer got back a pristine
   * `approvalStatuses = {}` and `lastAppliedSeq = -Infinity` — a resolved
   * approval whose APPROVAL_RESULT row is not in the refetched history page
   * re-renders as ACTIONABLE (exactly what `resetForDialogSwitch` preserves
   * that map to prevent), and a replay from the host's cursor re-applies
   * events the dropped instance had consumed.
   */
  it('onEvict parks approvalStatuses + lastAppliedSeq, and the state round-trips', () => {
    const parked: Array<{
      approvalStatuses: Record<string, string>;
      lastAppliedSeq: number;
      messages: unknown[];
    }> = [];
    const store = createChatDialogStore({
      maxReducers: 1,
      onEvict: (_dialogId, _side, state) =>
        parked.push({
          approvalStatuses: state.approvalStatuses,
          lastAppliedSeq: state.lastAppliedSeq,
          messages: state.messages,
        }),
    });
    finishedTurn(store, 'first', 'a');
    store.mutate('first', 'main', r => r.setApprovalStatus('req-1', 'approved'));

    // Churn the cap so `first` is evicted.
    store.getReducer('second', 'main');
    expect(parked).toHaveLength(1);
    expect(parked[0].approvalStatuses).toEqual({ 'req-1': 'approved' });
    expect(parked[0].lastAppliedSeq).toBe(3);
    expect(parked[0].messages.length).toBeGreaterThan(0);

    // The recreated instance is pristine…
    const recreated = store.getReducer('first', 'main');
    expect(recreated.state.approvalStatuses).toEqual({});
    expect(recreated.getLastAppliedSeq()).toBe(Number.NEGATIVE_INFINITY);

    // …until the host restores the parked payload alongside the refetched
    // messages, which is what the callback exists to make possible.
    recreated.initializeWithState([], {
      approvalStatuses: parked[0].approvalStatuses as never,
      lastAppliedSeq: parked[0].lastAppliedSeq,
    });
    expect(recreated.state.approvalStatuses).toEqual({ 'req-1': 'approved' });
    // The restored seq gate drops an already-applied replay.
    recreated.apply(text('replayed', 2));
    expect(recreated.state.messages).toEqual([]);
  });

  /**
   * A key dropped between `pushOptimisticSend` and its `MESSAGE_REQUEST` echo
   * leaves the replacement reducer with NOTHING armed, so the echo renders a
   * duplicate user bubble. The armed entries ride along in the parked payload.
   */
  it('onEvict parks armed pendingEchoes, and echo dedup round-trips', () => {
    const realNow = Date.now;
    try {
      let now = 2_000_000;
      Date.now = () => now;
      const parked: EvictedReducerState[] = [];
      const store = createChatDialogStore({
        maxReducers: 1,
        defaultCreateOptions: () => ({ ownEchoIncludesAdmin: true, selfUserId: 'me' }),
        onEvict: (_dialogId, _side, state) => parked.push(state),
      });
      // A send made DURING a turn: the turn ends (phase → idle, so the key is
      // evictable) while the send's echo is still in flight.
      store.apply('first', 'main', start(1));
      now += 1;
      store.mutate('first', 'main', r => r.pushOptimisticSend('hello world'));
      store.apply('first', 'main', end(2));

      store.getReducer('second', 'main');
      expect(parked).toHaveLength(1);
      expect(parked[0].pendingEchoes).toEqual([{ text: 'hello world', at: now }]);

      const recreated = store.getReducer('first', 'main');
      recreated.initializeWithState(parked[0].messages, {
        pendingEchoes: parked[0].pendingEchoes,
        lastAppliedSeq: parked[0].lastAppliedSeq,
      });
      recreated.apply(participant(3, { text: 'hello world', ownerType: 'ADMIN', userId: 'me' }));
      expect(recreated.state.messages.filter(m => m.role === 'user')).toHaveLength(1);
    } finally {
      Date.now = realNow;
    }
  });

  it('setRetained pins exactly the given set and releases the rest', () => {
    const store = createChatDialogStore({ maxReducers: 2 });
    finishedTurn(store, 'a', 'a-text');
    finishedTurn(store, 'b', 'b-text');
    store.setRetained([{ dialogId: 'a' }, { dialogId: 'b', side: 'main' }]);
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `noise-${i}`, 'x');
    expect(store.getSnapshot('a', 'main').messages.length).toBeGreaterThan(0);
    expect(store.getSnapshot('b', 'main').messages.length).toBeGreaterThan(0);

    // Swap the set: `b` stays pinned (never dips to zero), `a` is released.
    store.setRetained([{ dialogId: 'b' }]);
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `more-${i}`, 'x');
    expect(store.getSnapshot('a', 'main').messages).toEqual([]);
    expect(store.getSnapshot('b', 'main').messages.length).toBeGreaterThan(0);

    // Empty set releases everything.
    store.setRetained([]);
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `last-${i}`, 'x');
    expect(store.getSnapshot('b', 'main').messages).toEqual([]);
  });

  it('setRetained composes with (and never clobbers) a component retain()', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'shared', 'shared-text');
    const release = store.retain('shared');
    store.setRetained([{ dialogId: 'shared' }]);

    // Dropping the policy retain leaves the component's hold standing.
    store.setRetained([]);
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `noise-${i}`, 'x');
    expect(store.getSnapshot('shared', 'main').messages.length).toBeGreaterThan(0);

    release();
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `more-${i}`, 'x');
    expect(store.getSnapshot('shared', 'main').messages).toEqual([]);
  });

  it('retain() is refcounted and its release is idempotent', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'pinned', 'pinned-text');
    const releaseA = store.retain('pinned');
    const releaseB = store.retain('pinned');

    releaseA();
    releaseA(); // idempotent — must NOT decrement B's hold
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `noise-${i}`, 'x');
    expect(store.getSnapshot('pinned', 'main').messages.length).toBeGreaterThan(0);

    releaseB();
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `more-${i}`, 'x');
    expect(store.getSnapshot('pinned', 'main').messages).toEqual([]);
  });

  it('eviction never notifies SYNCHRONOUSLY (getReducer runs in the render phase)', async () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'd1', 'd1');

    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    // A render-phase `getReducer` for a NEW key evicts d1 — synchronously
    // notifying here is React's "cannot update a component while rendering".
    store.getReducer('d2', 'main');
    expect(notifications).toBe(0);
    await Promise.resolve();
    await Promise.resolve();
    expect(notifications).toBeGreaterThan(0);
  });

  /**
   * REGRESSION (round 3): `getReducer` inserted THEN evicted from the LRU
   * head. A brand-new key is unretained (the hook retains in an effect, i.e.
   * after render) and idle, so when every older key was protected the loop
   * walked to the tail and dropped the key it had just created — `getReducer`
   * handed back a DETACHED reducer whose mutations `getSnapshot` could never
   * see.
   */
  it('NEVER evicts the key getReducer just created (all older keys protected)', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'pinned', 'pinned-text');
    store.retain('pinned', 'main');

    const reducer = store.getReducer('fresh', 'main');
    reducer.setMessages([assistantSaying('m1', 'hello')]);

    // The just-created reducer must still be the store's — not a detached
    // instance whose key resolves to EMPTY_STATE.
    expect(store.getReducer('fresh', 'main')).toBe(reducer);
    expect(store.getSnapshot('fresh', 'main').messages).toHaveLength(1);
    // The retained key survived too.
    expect(store.getSnapshot('pinned', 'main').messages.length).toBeGreaterThan(0);
  });

  /**
   * REGRESSION (round 10): the round-3 guard protected only the ONE key
   * `getReducer` was inserting. `useChatStreamReducer` calls `getReducer`
   * during RENDER and `retain()` in an EFFECT, so React renders every panel of
   * a commit before ANY retain lands — mounting `maxReducers + 1` panels with
   * distinct dialogIds in one commit let render #(cap+1) evict the key render
   * #1 had just created. Panel #1 kept its reducer object, but `getSnapshot`
   * is a pure map read, so its thread rendered as EMPTY_STATE forever.
   */
  it('protects EVERY key created in one commit, not just the newest (>MAX panels mounted together)', () => {
    const max = 4;
    const evicted: string[] = [];
    const store = createChatDialogStore({
      maxReducers: max,
      onEvict: dialogId => evicted.push(dialogId),
    });

    // One React commit: N renders, each a `getReducer`, ZERO retains yet.
    const reducers = Array.from({ length: max + 3 }, (_, i) => store.getReducer(`panel-${i}`, 'main'));
    reducers.forEach((r, i) => {
      r.setMessages([assistantSaying(`m-${i}`, `thread ${i}`)]);
    });

    // Nothing was dropped, and every panel still sees its OWN thread.
    expect(evicted).toEqual([]);
    reducers.forEach((r, i) => {
      expect(store.getReducer(`panel-${i}`, 'main')).toBe(r);
      expect(textOf(store.getSnapshot(`panel-${i}`, 'main'))).toBe(`thread ${i}`);
    });

    // The effects that follow the commit pin what is still mounted.
    reducers.forEach((_, i) => {
      store.retain(`panel-${i}`, 'main');
    });
    reducers.forEach((_, i) => {
      expect(store.getSnapshot(`panel-${i}`, 'main').messages).toHaveLength(1);
    });
  });

  /** The group protection is a stand-in for the retain that has not landed
   *  yet, not a licence to grow: once the retains land (and the panels later
   *  unmount), the LRU catches all the way back down to the cap. */
  it('resumes evicting to the cap once the pending retains land', () => {
    const store = createChatDialogStore({ maxReducers: 2 });
    const ids = ['p-0', 'p-1', 'p-2', 'p-3', 'p-4'];
    const reducers = ids.map(id => store.getReducer(id, 'main'));
    expect(reducers).toHaveLength(5);

    // The effects run (retain), then the panels unmount (release).
    ids
      .map(id => store.retain(id, 'main'))
      .forEach(release => {
        release();
      });

    // A later, unrelated commit creates one more key — the now-unprotected
    // ones are evictable again.
    store.getReducer('p-late', 'main');
    expect(store.getSnapshot('p-0', 'main')).toBe(store.getSnapshot('nope', 'main'));
  });

  /**
   * REGRESSION (round 11): the round-10 group protection expired on a
   * MICROTASK, on the assumption that a render/commit pass never yields to the
   * microtask queue. Under CONCURRENT rendering React time-slices — it suspends
   * the render and resumes in a later macrotask, flushing microtasks in between
   * — so keys created before the yield lost their protection while their
   * `retain()` was still pending, and the resumed render evicted them: the
   * exact blank-thread defect round 10 closed. Protection now ends at the first
   * `retain()`, an event that cannot be re-ordered by the scheduler.
   */
  it('keeps pending-retain keys protected across a mid-render microtask yield', async () => {
    const max = 2;
    const evicted: string[] = [];
    const store = createChatDialogStore({
      maxReducers: max,
      onEvict: dialogId => evicted.push(dialogId),
    });

    const early = Array.from({ length: max }, (_, i) => store.getReducer(`panel-${i}`, 'main'));
    early.forEach((r, i) => {
      r.setMessages([assistantSaying(`m-${i}`, `thread ${i}`)]);
    });

    // React yields mid-render; the microtask queue drains before it resumes.
    await Promise.resolve();
    await Promise.resolve();

    // …the SAME render resumes and mounts the remaining panels.
    const late = [store.getReducer('panel-2', 'main'), store.getReducer('panel-3', 'main')];
    expect(late).toHaveLength(2);

    // No retain has landed yet, so nothing may have been dropped.
    expect(evicted).toEqual([]);
    early.forEach((r, i) => {
      expect(store.getReducer(`panel-${i}`, 'main')).toBe(r);
      expect(textOf(store.getSnapshot(`panel-${i}`, 'main'))).toBe(`thread ${i}`);
    });

    // The effects that follow the commit pin what is still mounted.
    early.forEach((_, i) => {
      store.retain(`panel-${i}`, 'main');
    });
    early.forEach((_, i) => {
      expect(store.getSnapshot(`panel-${i}`, 'main').messages).toHaveLength(1);
    });
  });

  /** Protection stands in for a retain that has not landed. The moment it
   *  lands the key is protected by the RETAIN COUNT instead, so a release must
   *  make the key evictable again inside the same task — no timer involved. */
  it('drops the pending-retain protection at the first retain(), not on a timer', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    store.getReducer('a', 'main').setMessages([assistantSaying('m1', 'a-text')]);

    // The effect lands, then the panel unmounts — all in the same task.
    store.retain('a', 'main')();

    store.getReducer('b', 'main');
    expect(store.getSnapshot('a', 'main').messages).toEqual([]);
  });

  /**
   * The protected set is itself bounded (`MAX_PENDING_RETAIN_KEYS`), so a
   * caller that reads a reducer once and drops it — never retaining — cannot
   * grow the map without limit. Beyond the bound the oldest pending key falls
   * through to ordinary LRU.
   */
  it('bounds the map when thousands of keys are created without ever retaining', () => {
    const total = MAX_PENDING_RETAIN_KEYS * 4;
    const evicted = new Set<string>();
    const store = createChatDialogStore({
      maxReducers: 10,
      onEvict: dialogId => evicted.add(dialogId),
    });

    for (let i = 0; i < total; i += 1) store.getReducer(`d-${i}`, 'main');

    const survivors = Array.from({ length: total }, (_, i) => `d-${i}`).filter(id => !evicted.has(id));
    expect(survivors).toHaveLength(MAX_PENDING_RETAIN_KEYS);
    expect(survivors).toEqual(
      Array.from({ length: MAX_PENDING_RETAIN_KEYS }, (_, i) => `d-${total - MAX_PENDING_RETAIN_KEYS + i}`),
    );
  });

  /** Chunk-phase creations are NOT group-protected: nobody holds those
   *  instances past the call, so a burst of chunks across many dialogs must
   *  still evict down to the cap inside the same task. */
  it('apply()-created keys still evict synchronously within one task', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'd1', 'd1-text');
    finishedTurn(store, 'd2', 'd2-text');
    finishedTurn(store, 'd3', 'd3-text');
    expect(store.getSnapshot('d1', 'main').messages).toEqual([]);
    expect(store.getSnapshot('d3', 'main').messages.length).toBeGreaterThan(0);
  });

  /** `apply()`/`mutate()` can be a key's FIRST toucher; the reducer they
   *  create must carry the host's semantics, since create-options are
   *  consulted once and a later `getReducer(..., options)` gets that same
   *  instance. */
  it('reducers first created by apply() use the store-level defaultCreateOptions', () => {
    const store = createChatDialogStore({
      defaultCreateOptions: () => ({ ownEchoIncludesAdmin: true }),
    });
    // First touch is a CHUNK, not a render.
    store.apply('d1', 'main', participant(1, { kind: 'system', text: 'joined' }));
    store.mutate('d1', 'main', r => r.pushOptimisticSend('ok'));
    store.apply('d1', 'main', participant(2, { text: 'ok', ownerType: 'ADMIN' }));
    // ownEchoIncludesAdmin was honoured → the ADMIN echo was consumed.
    expect(store.getSnapshot('d1', 'main').messages.filter(m => textOfParts(m.parts) === 'ok')).toHaveLength(1);
  });

  it('remove() notifies only when something was actually deleted', () => {
    const store = createChatDialogStore();
    finishedTurn(store, 'd1', 'd1');

    let notifications = 0;
    store.subscribe(() => {
      notifications += 1;
    });

    store.remove('never-existed');
    store.remove('never-existed', 'main');
    expect(notifications).toBe(0);

    store.remove('d1', 'main');
    expect(notifications).toBe(1);
  });

  /**
   * A retain is a claim on the KEY, not on the reducer instance — so it
   * deliberately SURVIVES `remove()` (and the recreate that usually follows).
   * Clearing the retain counter in `remove()` would unpin a key its consumer is
   * still holding; the counter is bounded by live retainers and drains when the
   * last release runs.
   */
  it('retain() survives remove() and still pins the recreated key', () => {
    const store = createChatDialogStore({ maxReducers: 1 });
    finishedTurn(store, 'd1', 'd1-text');
    const releaseA = store.retain('d1');
    const releaseB = store.retain('d1');

    store.remove('d1', 'main');
    expect(store.getSnapshot('d1', 'main').messages).toEqual([]);

    // Recreated key: the retains taken before the removal still protect it.
    finishedTurn(store, 'd1', 'd1-again');
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `noise-${i}`, 'x');
    expect(store.getSnapshot('d1', 'main').messages.length).toBeGreaterThan(0);

    // Refcount was NOT reset by remove(): one release still leaves B's hold.
    releaseA();
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `more-${i}`, 'x');
    expect(store.getSnapshot('d1', 'main').messages.length).toBeGreaterThan(0);

    // Last release drains the entry — the key becomes evictable again.
    releaseB();
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `last-${i}`, 'x');
    expect(store.getSnapshot('d1', 'main').messages).toEqual([]);
  });
});
