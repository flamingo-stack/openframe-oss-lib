/**
 * Phase-3 tests — `createChatDialogStore` cross-side projection.
 *
 * Exactly two operations fan out across sides of the same dialogId:
 * approval-resolution by requestId and tool-execution merge by execId.
 * The projection is recomputed from state (never re-injected into the other
 * side's seq stream), so per-side seq gates stay untouched and replays are
 * idempotent with full referential stability on untouched messages.
 */

import { describe, it, expect } from 'vitest'
import { createChatDialogStore, DEFAULT_MAX_REDUCERS } from '../chat-dialog-store'
import type { EvictedReducerState } from '../chat-dialog-store'
import type { ChatStreamEvent } from '../../../../chat-protocol/events'

const DIALOG = 'dlg-1'

const batchApproval = (seq?: number): ChatStreamEvent => ({
  type: 'approval-request',
  requestId: 'req-1',
  approvalType: 'CLIENT',
  toolCalls: [
    {
      toolExecutionRequestId: 'exec-1',
      toolName: 'run_command',
      requiresApproval: true,
      approvalType: 'CLIENT',
      toolCallArguments: null,
    },
  ],
  ...(seq != null ? { seq } : {}),
})

function seedBothSides(store: ReturnType<typeof createChatDialogStore>) {
  // Side A (client view) and side B (technician mirror) both saw the turn
  // with the approval card — each through its OWN seq stream.
  for (const side of ['main', 'observer'] as const) {
    store.apply(DIALOG, side, { type: 'turn-start', seq: 1 })
    store.apply(DIALOG, side, { type: 'text-delta', text: 'needs approval', seq: 2 })
    store.apply(DIALOG, side, batchApproval(3))
    store.apply(DIALOG, side, { type: 'turn-end', seq: 4 })
  }
}

describe('createChatDialogStore — cross-side projection', () => {
  it('(a) a same-id TEXT event on one side does NOT touch the other side', () => {
    const store = createChatDialogStore()
    seedBothSides(store)
    const bBefore = store.getSnapshot(DIALOG, 'observer')

    store.apply(DIALOG, 'main', { type: 'text-delta', text: 'main-only continuation', seq: 5 })

    expect(store.getSnapshot(DIALOG, 'observer')).toBe(bBefore)
    const aTrailing = store.getSnapshot(DIALOG, 'main').messages.at(-1)
    const bTrailing = store.getSnapshot(DIALOG, 'observer').messages.at(-1)
    expect(JSON.stringify(aTrailing)).not.toEqual(JSON.stringify(bTrailing))
  })

  it('(b) approval resolved on side A updates side B matching card (status + resolver)', () => {
    const store = createChatDialogStore()
    seedBothSides(store)

    store.apply(DIALOG, 'main', {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      approvalType: 'CLIENT',
      resolvedByName: 'Alice Client',
      seq: 5,
    })

    for (const side of ['main', 'observer'] as const) {
      const messages = store.getSnapshot(DIALOG, side).messages
      const card = messages
        .flatMap((m) => m.segments ?? [])
        .find((s) => s.type === 'approval_batch')
      expect(card).toBeDefined()
      expect((card as { status?: string }).status).toBe('approved')
      expect((card as { resolvedByName?: string | null }).resolvedByName).toBe('Alice Client')
      // Status map mirrored on both sides so future replays render resolved.
      expect(store.getSnapshot(DIALOG, side).approvalStatuses['req-1']).toBe('approved')
    }
  })

  it('(b2) tool execution on side A merges into side B batch card WITHOUT appending', () => {
    const store = createChatDialogStore()
    seedBothSides(store)
    store.apply(DIALOG, 'main', {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      seq: 5,
    })

    store.apply(DIALOG, 'main', {
      type: 'tool-execution',
      data: {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'SHELL',
        toolFunction: 'run_command',
        result: 'ok',
        success: true,
        toolExecutionRequestId: 'exec-1',
      },
      seq: 6,
    })

    const b = store.getSnapshot(DIALOG, 'observer')
    const bSegments = b.messages.flatMap((m) => m.segments ?? [])
    const batch = bSegments.find((s) => s.type === 'approval_batch')
    expect(
      (batch as { data: { executions?: Record<string, unknown> } }).data.executions,
    ).toEqual({ 'exec-1': { status: 'done', result: 'ok', success: true } })
    // Merge-only projection: no standalone tool card appeared on side B.
    expect(bSegments.filter((s) => s.type === 'tool_execution')).toHaveLength(0)
  })

  it('(c) replaying side A events after the projection: no double-application + Object.is stability on side B untouched messages', () => {
    const store = createChatDialogStore()
    seedBothSides(store)

    const resolve: ChatStreamEvent = {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      approvalType: 'CLIENT',
      resolvedByName: 'Alice Client',
      seq: 5,
    }
    const executedEvent: ChatStreamEvent = {
      type: 'tool-execution',
      data: {
        type: 'EXECUTED_TOOL',
        integratedToolType: 'SHELL',
        toolFunction: 'run_command',
        result: 'ok',
        success: true,
        toolExecutionRequestId: 'exec-1',
      },
      seq: 6,
    }
    store.apply(DIALOG, 'main', resolve)
    store.apply(DIALOG, 'main', executedEvent)

    const aState = store.getSnapshot(DIALOG, 'main')
    const bState = store.getSnapshot(DIALOG, 'observer')
    const bMessages = bState.messages

    // Replay side A's events (reconnect back-fill). Side A drops them via
    // its seq gate; the recomputed projection over side B is a value-level
    // no-op → identical references end-to-end.
    store.apply(DIALOG, 'main', resolve)
    store.apply(DIALOG, 'main', executedEvent)

    expect(store.getSnapshot(DIALOG, 'main')).toBe(aState)
    const bAfter = store.getSnapshot(DIALOG, 'observer')
    expect(bAfter.messages).toBe(bMessages)
    bAfter.messages.forEach((m, i) => expect(m).toBe(bMessages[i]))
    expect(bAfter).toBe(bState)
  })

  it("(c2) the projection never advances the other side's seq gate", () => {
    const store = createChatDialogStore()
    seedBothSides(store)

    // Side A resolves at a HIGH seq…
    store.apply(DIALOG, 'main', {
      type: 'approval-resolved',
      requestId: 'req-1',
      status: 'approved',
      seq: 100,
    })
    // …side B's own stream continues at ITS low seq — must still apply.
    store.apply(DIALOG, 'observer', { type: 'text-delta', text: ' b-continues', seq: 5 })
    const bTrailing = store.getSnapshot(DIALOG, 'observer').messages.at(-1)
    const texts = (bTrailing?.segments ?? []).filter((s) => s.type === 'text') as Array<{
      text: string
    }>
    expect(texts.at(-1)?.text).toContain('b-continues')
  })
})

describe('createChatDialogStore — snapshot purity + reducer lifecycle', () => {
  it('getSnapshot on an unknown key creates NO entry (returns the shared frozen EMPTY_STATE)', () => {
    const store = createChatDialogStore()

    const a = store.getSnapshot('never-seen-a')
    const b = store.getSnapshot('never-seen-b', 'observer')
    // One shared instance across every absent key → nothing was created
    // per-key, and useSyncExternalStore sees a stable identity.
    expect(a).toBe(b)
    expect(a).toBe(store.getServerSnapshot())
    expect(Object.isFrozen(a)).toBe(true)
    expect(a.messages).toEqual([])
    expect(a.streamingPhase).toBe('idle')

    // Behavioral proof that no entries were inserted: a real reducer created
    // BEFORE far more phantom reads than the LRU cap survives untouched.
    store.apply('real', 'main', { type: 'turn-start', seq: 1 })
    store.apply('real', 'main', { type: 'text-delta', text: 'kept', seq: 2 })
    for (let i = 0; i < DEFAULT_MAX_REDUCERS * 3; i += 1) {
      store.getSnapshot(`phantom-${i}`)
    }
    const kept = store.getSnapshot('real', 'main')
    expect(kept.messages.at(-1)?.segments?.at(-1)).toEqual({ type: 'text', text: 'kept' })
  })

  it('evicts least-recently-used reducers past the cap, keeping the recently-applied ones', () => {
    const store = createChatDialogStore({ maxReducers: 2 })

    for (const id of ['d1', 'd2', 'd3']) {
      finishedTurn(store, id, id)
    }

    // d1 is the LRU → evicted; its snapshot falls back to EMPTY_STATE.
    expect(store.getSnapshot('d1', 'main').messages).toEqual([])
    for (const id of ['d2', 'd3']) {
      expect(store.getSnapshot(id, 'main').messages.at(-1)?.segments?.at(-1)).toEqual({
        type: 'text',
        text: id,
      })
    }
  })

  it('applying to an existing reducer refreshes its LRU position', () => {
    const store = createChatDialogStore({ maxReducers: 2 })
    finishedTurn(store, 'd1', 'd1')
    finishedTurn(store, 'd2', 'd2')
    // Touch d1 so d2 becomes the least-recently-used…
    store.apply('d1', 'main', { type: 'text-delta', text: '!', seq: 5 })
    store.apply('d1', 'main', { type: 'turn-end', seq: 6 })
    // …then a third dialog evicts d2, not d1.
    finishedTurn(store, 'd3', 'd3')

    expect(store.getSnapshot('d2', 'main').messages).toEqual([])
    expect(store.getSnapshot('d1', 'main').messages.length).toBeGreaterThan(0)
    expect(store.getSnapshot('d3', 'main').messages.length).toBeGreaterThan(0)
  })
})

/** One complete (idle-at-the-end) turn — the only shape the LRU may evict. */
function finishedTurn(
  store: ReturnType<typeof createChatDialogStore>,
  dialogId: string,
  text: string,
): void {
  store.apply(dialogId, 'main', { type: 'turn-start', seq: 1 })
  store.apply(dialogId, 'main', { type: 'text-delta', text, seq: 2 })
  store.apply(dialogId, 'main', { type: 'turn-end', seq: 3 })
}

describe('createChatDialogStore — eviction safety', () => {
  it('NEVER evicts a reducer that is mid-stream (streamingPhase !== idle)', () => {
    const store = createChatDialogStore({ maxReducers: 1 })

    // A live turn on `live`: no turn-end, so the phase is still streaming.
    store.apply('live', 'main', { type: 'turn-start', seq: 1 })
    store.apply('live', 'main', { type: 'text-delta', text: 'half a sen', seq: 2 })
    expect(store.getSnapshot('live', 'main').streamingPhase).not.toBe('idle')

    // Ten other dialogs churn through the cap of 1.
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `other-${i}`, 'x')

    // The live thread survives — dropping it would blank a visible thread
    // that the host's seq cursor believes is already caught up.
    const live = store.getSnapshot('live', 'main')
    expect(live.messages.length).toBeGreaterThan(0)
    expect(live.streamingPhase).not.toBe('idle')

    // …and once the turn finishes it becomes evictable again.
    store.apply('live', 'main', { type: 'turn-end', seq: 3 })
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `later-${i}`, 'x')
    expect(store.getSnapshot('live', 'main').messages).toEqual([])
  })

  it('NEVER evicts a RETAINED key, and evicts it again after release', () => {
    const store = createChatDialogStore({ maxReducers: 1 })
    finishedTurn(store, 'pinned', 'pinned-text')
    const release = store.retain('pinned', 'main')

    for (let i = 0; i < 10; i += 1) finishedTurn(store, `noise-${i}`, 'x')
    expect(store.getSnapshot('pinned', 'main').messages.at(-1)?.segments?.at(-1)).toEqual({
      type: 'text',
      text: 'pinned-text',
    })

    release()
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `more-${i}`, 'x')
    expect(store.getSnapshot('pinned', 'main').messages).toEqual([])
  })

  /**
   * REGRESSION (round 4): eviction used to be UNPUBLISHED, so hosts inferred
   * it by comparing reducer OBJECT IDENTITY across `getReducer` calls and then
   * suppressing the pristine-empty snapshot a silently-recreated reducer
   * returns. The store knows the fact exactly — it states it.
   */
  it('onEvict publishes the (dialogId, side) an LRU eviction dropped', () => {
    const evicted: Array<[string, string]> = []
    const store = createChatDialogStore({
      maxReducers: 1,
      onEvict: (dialogId, side) => evicted.push([dialogId, side]),
    })
    finishedTurn(store, 'first', 'a')
    // Round-trip through a side whose name contains no separator ambiguity.
    store.getReducer('second', 'observer')
    expect(evicted).toEqual([['first', 'main']])

    // Host-initiated removal is NOT an eviction — the caller already knows.
    store.remove('second', 'observer')
    expect(evicted).toEqual([['first', 'main']])
  })

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
      approvalStatuses: Record<string, string>
      lastAppliedSeq: number
      messages: unknown[]
    }> = []
    const store = createChatDialogStore({
      maxReducers: 1,
      onEvict: (_dialogId, _side, state) =>
        parked.push({
          approvalStatuses: state.approvalStatuses,
          lastAppliedSeq: state.lastAppliedSeq,
          messages: state.messages,
        }),
    })
    finishedTurn(store, 'first', 'a')
    store.mutate('first', 'main', (r) => r.setApprovalStatus('req-1', 'approved'))

    // Churn the cap so `first` is evicted.
    store.getReducer('second', 'main')
    expect(parked).toHaveLength(1)
    expect(parked[0].approvalStatuses).toEqual({ 'req-1': 'approved' })
    expect(parked[0].lastAppliedSeq).toBe(3)
    expect(parked[0].messages.length).toBeGreaterThan(0)

    // The recreated instance is pristine…
    const recreated = store.getReducer('first', 'main')
    expect(recreated.state.approvalStatuses).toEqual({})
    expect(recreated.getLastAppliedSeq()).toBe(Number.NEGATIVE_INFINITY)

    // …until the host restores the parked payload alongside the refetched
    // messages, which is what the callback exists to make possible.
    recreated.initializeWithState([], {
      approvalStatuses: parked[0].approvalStatuses as never,
      lastAppliedSeq: parked[0].lastAppliedSeq,
    })
    expect(recreated.state.approvalStatuses).toEqual({ 'req-1': 'approved' })
    // The restored seq gate drops an already-applied replay.
    recreated.apply({ type: 'text-delta', text: 'replayed', seq: 2 })
    expect(recreated.state.messages).toEqual([])
  })

  /**
   * A key dropped between `pushOptimisticSend` and its `MESSAGE_REQUEST` echo
   * leaves the replacement reducer with NOTHING armed, so the echo renders a
   * duplicate user bubble. The armed entries ride along in the parked payload.
   */
  it('onEvict parks armed pendingEchoes, and echo dedup round-trips', () => {
    const realNow = Date.now
    try {
      let now = 2_000_000
      Date.now = () => now
      const parked: EvictedReducerState[] = []
      const store = createChatDialogStore({
        maxReducers: 1,
        defaultCreateOptions: () => ({
          transport: 'nats',
          ownEchoIncludesAdmin: true,
          selfUserId: 'me',
        }),
        onEvict: (_dialogId, _side, state) => parked.push(state),
      })
      // A send made DURING a turn: the turn ends (phase → idle, so the key is
      // evictable) while the send's echo is still in flight.
      store.apply('first', 'main', { type: 'turn-start', seq: 1 })
      now += 1
      store.mutate('first', 'main', (r) => r.pushOptimisticSend('hello world'))
      store.apply('first', 'main', { type: 'turn-end', seq: 2 })

      store.getReducer('second', 'main')
      expect(parked).toHaveLength(1)
      expect(parked[0].pendingEchoes).toEqual([{ text: 'hello world', at: now }])

      const recreated = store.getReducer('first', 'main')
      recreated.initializeWithState(parked[0].messages as never, {
        pendingEchoes: parked[0].pendingEchoes,
        lastAppliedSeq: parked[0].lastAppliedSeq,
      })
      recreated.apply({
        type: 'participant',
        kind: 'message-request',
        text: 'hello world',
        ownerType: 'ADMIN',
        userId: 'me',
        seq: 3,
      })
      expect(recreated.state.messages.filter((m) => m.role === 'user')).toHaveLength(1)
    } finally {
      Date.now = realNow
    }
  })

  it('setRetained pins exactly the given set and releases the rest', () => {
    const store = createChatDialogStore({ maxReducers: 2 })
    finishedTurn(store, 'a', 'a-text')
    finishedTurn(store, 'b', 'b-text')
    store.setRetained([
      { dialogId: 'a' },
      { dialogId: 'b', side: 'main' },
    ])
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `noise-${i}`, 'x')
    expect(store.getSnapshot('a', 'main').messages.length).toBeGreaterThan(0)
    expect(store.getSnapshot('b', 'main').messages.length).toBeGreaterThan(0)

    // Swap the set: `b` stays pinned (never dips to zero), `a` is released.
    store.setRetained([{ dialogId: 'b' }])
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `more-${i}`, 'x')
    expect(store.getSnapshot('a', 'main').messages).toEqual([])
    expect(store.getSnapshot('b', 'main').messages.length).toBeGreaterThan(0)

    // Empty set releases everything.
    store.setRetained([])
    for (let i = 0; i < 10; i += 1) finishedTurn(store, `last-${i}`, 'x')
    expect(store.getSnapshot('b', 'main').messages).toEqual([])
  })

  it('setRetained composes with (and never clobbers) a component retain()', () => {
    const store = createChatDialogStore({ maxReducers: 1 })
    finishedTurn(store, 'shared', 'shared-text')
    const release = store.retain('shared')
    store.setRetained([{ dialogId: 'shared' }])

    // Dropping the policy retain leaves the component's hold standing.
    store.setRetained([])
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `noise-${i}`, 'x')
    expect(store.getSnapshot('shared', 'main').messages.length).toBeGreaterThan(0)

    release()
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `more-${i}`, 'x')
    expect(store.getSnapshot('shared', 'main').messages).toEqual([])
  })

  it('retain() is refcounted and its release is idempotent', () => {
    const store = createChatDialogStore({ maxReducers: 1 })
    finishedTurn(store, 'pinned', 'pinned-text')
    const releaseA = store.retain('pinned')
    const releaseB = store.retain('pinned')

    releaseA()
    releaseA() // idempotent — must NOT decrement B's hold
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `noise-${i}`, 'x')
    expect(store.getSnapshot('pinned', 'main').messages.length).toBeGreaterThan(0)

    releaseB()
    for (let i = 0; i < 5; i += 1) finishedTurn(store, `more-${i}`, 'x')
    expect(store.getSnapshot('pinned', 'main').messages).toEqual([])
  })

  it('eviction never notifies SYNCHRONOUSLY (getReducer runs in the render phase)', async () => {
    const store = createChatDialogStore({ maxReducers: 1 })
    finishedTurn(store, 'd1', 'd1')

    let notifications = 0
    store.subscribe(() => {
      notifications += 1
    })

    // A render-phase `getReducer` for a NEW key evicts d1 — synchronously
    // notifying here is React's "cannot update a component while rendering".
    store.getReducer('d2', 'main')
    expect(notifications).toBe(0)
    await Promise.resolve()
    await Promise.resolve()
    expect(notifications).toBeGreaterThan(0)
  })

  /**
   * REGRESSION (round 3): `getReducer` inserted THEN evicted from the LRU
   * head. A brand-new key is unretained (the hook retains in an effect, i.e.
   * after render) and idle, so when every older key was protected the loop
   * walked to the tail and dropped the key it had just created — `getReducer`
   * handed back a DETACHED reducer whose mutations `getSnapshot` could never
   * see.
   */
  it('NEVER evicts the key getReducer just created (all older keys protected)', () => {
    const store = createChatDialogStore({ maxReducers: 1 })
    finishedTurn(store, 'pinned', 'pinned-text')
    store.retain('pinned', 'main')

    const reducer = store.getReducer('fresh', 'main')
    reducer.setMessages([
      { id: 'm1', role: 'assistant', content: 'hello', segments: [{ type: 'text', text: 'hello' }] },
    ])

    // The just-created reducer must still be the store's — not a detached
    // instance whose key resolves to EMPTY_STATE.
    expect(store.getReducer('fresh', 'main')).toBe(reducer)
    expect(store.getSnapshot('fresh', 'main').messages).toHaveLength(1)
    // The retained key survived too.
    expect(store.getSnapshot('pinned', 'main').messages.length).toBeGreaterThan(0)
  })

  /** `apply()`/`mutate()` can be a key's FIRST toucher; the reducer they
   *  create must carry the host's semantics, since create-options are
   *  consulted once and a later `getReducer(..., options)` gets that same
   *  instance. */
  it('reducers first created by apply() use the store-level defaultCreateOptions', () => {
    const store = createChatDialogStore({
      defaultCreateOptions: () => ({ transport: 'nats', ownEchoIncludesAdmin: true }),
    })
    // First touch is an EVENT, not a render.
    store.apply('d1', 'main', { type: 'participant', kind: 'system', text: 'joined', seq: 1 })
    store.mutate('d1', 'main', (r) => r.pushOptimisticSend('ok'))
    store.apply('d1', 'main', {
      type: 'participant',
      kind: 'message-request',
      text: 'ok',
      ownerType: 'ADMIN',
      seq: 2,
    })
    // ownEchoIncludesAdmin was honoured → the ADMIN echo was consumed.
    expect(store.getSnapshot('d1', 'main').messages.filter((m) => m.content === 'ok')).toHaveLength(1)
  })

  it('remove() notifies only when something was actually deleted', () => {
    const store = createChatDialogStore()
    finishedTurn(store, 'd1', 'd1')

    let notifications = 0
    store.subscribe(() => {
      notifications += 1
    })

    store.remove('never-existed')
    store.remove('never-existed', 'main')
    expect(notifications).toBe(0)

    store.remove('d1', 'main')
    expect(notifications).toBe(1)
  })
})
