/**
 * `createDeltaBatcher` — the SHARED (framework-free) delta batching policy.
 *
 * These tests exist because the batcher was previously inlined in the React
 * hook and re-implemented, near-verbatim but WITHOUT coalescing, by a product
 * app's non-React mirror. Coalescing is the difference between one `apply`
 * per frame and sixty.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatStreamEntry } from '../../../../chat-protocol/ui-chunks';
import { createDeltaBatcher, type DeltaEntry } from '../delta-batcher';

const text = (delta: string, { seq, id = 't1' }: { seq?: number; id?: string } = {}): ChatStreamEntry => ({
  ...(seq != null ? { seq } : {}),
  chunks: [{ type: 'text-delta', id, delta }],
});
const reasoning = (delta: string): ChatStreamEntry => ({ chunks: [{ type: 'reasoning-delta', id: 'r1', delta }] });
const FINISH: ChatStreamEntry = { chunks: [{ type: 'finish', finishReason: 'stop' }] };
const said = (entry: DeltaEntry): string => entry.chunks[0].delta;

beforeEach(() => {
  vi.useFakeTimers();
  // No rAF in this environment → the always-armed timer fallback drives flushes.
  vi.stubGlobal('requestAnimationFrame', undefined);
  vi.stubGlobal('cancelAnimationFrame', undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('createDeltaBatcher', () => {
  it('coalesces a burst of consecutive text deltas into ONE apply', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });

    for (let i = 0; i < 60; i += 1) b.push(text(`${i} `));
    expect(applied).toHaveLength(0);
    expect(b.pendingCount).toBe(1);

    b.flush();
    expect(applied).toHaveLength(1);
    expect(said(applied[0])).toBe(Array.from({ length: 60 }, (_, i) => `${i} `).join(''));
  });

  it('does NOT coalesce across delta types, or across wire ids', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });

    b.push(text('a'));
    b.push(reasoning('t1'));
    b.push(reasoning('t2'));
    b.push(text('b', { id: 't2' }));
    b.push(text('c', { id: 't2' }));
    b.push(text('d'));
    b.flush();

    expect(applied.map(e => [e.chunks[0].type, said(e)])).toEqual([
      ['text-delta', 'a'],
      ['reasoning-delta', 't1t2'],
      ['text-delta', 'bc'],
      ['text-delta', 'd'],
    ]);
  });

  it('carries the LATEST seq onto the coalesced entry', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    b.push(text('a', { seq: 1 }));
    b.push(text('b', { seq: 2 }));
    b.push(text('c', { seq: 3 }));
    b.flush();
    expect(applied).toHaveLength(1);
    expect(applied[0].seq).toBe(3);
  });

  /**
   * REGRESSION (round 3): coalescing must not swallow a redelivered /
   * out-of-order delta. Merging it would concatenate its text (the reducer
   * never sees a duplicate to drop) AND rewind the batch's seq below an
   * already-applied one, defeating the reducer's `seq <= lastAppliedSeq`
   * gate. It is pushed as its OWN entry so the gate can do its job.
   */
  it('does NOT coalesce a delta whose seq does not advance past the tail', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    b.push(text('a', { seq: 1 }));
    b.push(text('b', { seq: 2 }));
    // Redelivery of seq 2, then an out-of-order seq 1.
    b.push(text('b', { seq: 2 }));
    b.push(text('a', { seq: 1 }));
    expect(b.pendingCount).toBe(3);
    b.flush();
    expect(applied.map(e => [e.seq, said(e)])).toEqual([
      [2, 'ab'],
      [2, 'b'],
      [1, 'a'],
    ]);
  });

  /**
   * REGRESSION (round 4): a seq-LESS tail is not "always advancing". Merging a
   * seq-BEARING delta onto it stamps the merged entry with that seq, so on a
   * stream mixing both shapes a redelivered delta could still rewind the
   * batch's position past the reducer's gate.
   */
  it('does NOT coalesce a seq-bearing delta onto a seq-LESS tail', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    b.push(text('a'));
    b.push(text('b', { seq: 2 }));
    expect(b.pendingCount).toBe(2);
    b.flush();
    expect(applied.map(e => [e.seq, said(e)])).toEqual([
      [undefined, 'a'],
      [2, 'b'],
    ]);
  });

  it('does NOT coalesce a seq-less delta onto a seq-BEARING tail', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    b.push(text('a', { seq: 1 }));
    b.push(text('b'));
    expect(b.pendingCount).toBe(2);
    b.flush();
    expect(applied.map(e => [e.seq, said(e)])).toEqual([
      [1, 'a'],
      [undefined, 'b'],
    ]);
  });

  it('never mutates the caller-supplied entries', () => {
    const b = createDeltaBatcher({ applyOne: () => {} });
    const first = text('a');
    b.push(first);
    b.push(text('b'));
    b.flush();
    expect(first).toEqual(text('a'));
  });

  it('returns false for anything but a delta and leaves it unqueued', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    expect(b.push(text('a'))).toBe(true);
    expect(b.push(FINISH)).toBe(false);
    expect(b.pendingCount).toBe(1);
    expect(applied).toHaveLength(0);
  });

  it('an entry of several chunks is not a delta: its chunks stay together', () => {
    const b = createDeltaBatcher({ applyOne: () => {} });
    const entry: ChatStreamEntry = {
      chunks: [
        { type: 'text-delta', id: 't1', delta: 'a' },
        { type: 'text-delta', id: 't1', delta: 'b' },
      ],
    };
    expect(b.push(entry)).toBe(false);
  });

  it('flushes on the timer fallback when rAF is unavailable', () => {
    const applied: DeltaEntry[] = [];
    const flushes: number[] = [];
    const b = createDeltaBatcher({
      applyOne: e => applied.push(e),
      onFlushed: n => flushes.push(n),
    });

    b.push(text('a'));
    b.push(text('b'));
    expect(applied).toHaveLength(0);

    vi.advanceTimersByTime(50);
    expect(applied.map(said)).toEqual(['ab']);
    expect(flushes).toEqual([1]);

    // Timer is one-shot per batch: a later delta arms a fresh one.
    b.push(text('c'));
    vi.advanceTimersByTime(50);
    expect(applied.map(said)).toEqual(['ab', 'c']);
  });

  it('honours a custom fallbackMs', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e), fallbackMs: 200 });
    b.push(text('a'));
    vi.advanceTimersByTime(199);
    expect(applied).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(applied).toHaveLength(1);
  });

  it('flushes the pending batch against the PREVIOUS key when the key changes', () => {
    const applied: Array<[string, string]> = [];
    const b = createDeltaBatcher<string>({
      applyOne: (e, key) => applied.push([key ?? '<none>', said(e)]),
    });

    b.push(text('for-a1'), 'A');
    b.push(text('|for-a2'), 'A');
    // Switching keys must land the A batch on A BEFORE queueing for B.
    b.push(text('for-b'), 'B');
    expect(applied).toEqual([['A', 'for-a1|for-a2']]);

    b.flush();
    expect(applied).toEqual([
      ['A', 'for-a1|for-a2'],
      ['B', 'for-b'],
    ]);
  });

  it('flushes on key change even for an entry that is not a delta', () => {
    const applied: Array<[string, string]> = [];
    const b = createDeltaBatcher<string>({
      applyOne: (e, key) => applied.push([key ?? '<none>', said(e)]),
    });
    b.push(text('a'), 'A');
    expect(b.push(FINISH, 'B')).toBe(false);
    expect(applied).toEqual([['A', 'a']]);
  });

  it('dispose() flushes the tail and cancels the pending timer', () => {
    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    b.push(text('tail'));
    b.dispose();
    expect(applied.map(said)).toEqual(['tail']);
    vi.advanceTimersByTime(1000);
    expect(applied).toHaveLength(1);
  });

  it('flush() on an empty batch is a no-op (no applyOne, no onFlushed)', () => {
    const applyOne = vi.fn();
    const onFlushed = vi.fn();
    const b = createDeltaBatcher({ applyOne, onFlushed });
    b.flush();
    b.flush();
    expect(applyOne).not.toHaveBeenCalled();
    expect(onFlushed).not.toHaveBeenCalled();
  });
});

describe('createDeltaBatcher — rAF path', () => {
  it('prefers requestAnimationFrame and cancels it on an explicit flush', () => {
    // The scheduled callback is read back off the spy rather than latched into
    // a `let`: an outer `let` only ever written from inside the stub is still
    // `null` as far as control-flow analysis is concerned, which is what used
    // to force a non-null assertion on the replay call below.
    const raf = vi.fn((_cb: () => void) => 7);
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancel);

    const applied: DeltaEntry[] = [];
    const b = createDeltaBatcher({ applyOne: e => applied.push(e) });
    b.push(text('a'));
    const rafCb = raf.mock.calls[0]?.[0];
    expect(rafCb).toBeTypeOf('function');

    b.flush();
    expect(cancel).toHaveBeenCalledWith(7);
    expect(applied.map(said)).toEqual(['a']);

    // A late rAF callback for the already-flushed batch is harmless.
    if (!rafCb) throw new Error('the batcher never scheduled a rAF callback to replay');
    rafCb();
    expect(applied).toHaveLength(1);
  });
});
