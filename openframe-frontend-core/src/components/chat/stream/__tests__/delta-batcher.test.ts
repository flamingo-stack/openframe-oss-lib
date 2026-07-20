/**
 * `createDeltaBatcher` — the SHARED (framework-free) delta batching policy.
 *
 * These tests exist because the batcher was previously inlined in the React
 * hook and re-implemented, near-verbatim but WITHOUT coalescing, by a product
 * app's non-React mirror. Coalescing is the difference between one `apply`
 * per frame and sixty.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDeltaBatcher, type DeltaEvent } from '../delta-batcher'
import type { ChatStreamEvent } from '../../../../chat-protocol/events'

const text = (t: string, extra: Partial<ChatStreamEvent> = {}): ChatStreamEvent =>
  ({ type: 'text-delta', text: t, ...extra }) as ChatStreamEvent
const thinking = (t: string): ChatStreamEvent => ({ type: 'thinking-delta', text: t }) as ChatStreamEvent

beforeEach(() => {
  vi.useFakeTimers()
  // No rAF in this environment → the always-armed timer fallback drives flushes.
  vi.stubGlobal('requestAnimationFrame', undefined)
  vi.stubGlobal('cancelAnimationFrame', undefined)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('createDeltaBatcher', () => {
  it('coalesces a burst of consecutive text-deltas into ONE apply', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })

    for (let i = 0; i < 60; i += 1) b.push(text(`${i} `))
    expect(applied).toHaveLength(0)
    expect(b.pendingCount).toBe(1)

    b.flush()
    expect(applied).toHaveLength(1)
    expect(applied[0].text).toBe(
      Array.from({ length: 60 }, (_, i) => `${i} `).join(''),
    )
  })

  it('does NOT coalesce across delta types, or across a differing `leading` flag', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })

    b.push(text('a'))
    b.push(thinking('t1'))
    b.push(thinking('t2'))
    b.push(text('b', { leading: true } as Partial<ChatStreamEvent>))
    b.push(text('c', { leading: true } as Partial<ChatStreamEvent>))
    b.push(text('d'))
    b.flush()

    expect(applied.map((e) => [e.type, e.text])).toEqual([
      ['text-delta', 'a'],
      ['thinking-delta', 't1t2'],
      ['text-delta', 'bc'],
      ['text-delta', 'd'],
    ])
  })

  it('carries the LATEST seq onto the coalesced event', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })
    b.push(text('a', { seq: 1 } as Partial<ChatStreamEvent>))
    b.push(text('b', { seq: 2 } as Partial<ChatStreamEvent>))
    b.push(text('c', { seq: 3 } as Partial<ChatStreamEvent>))
    b.flush()
    expect(applied).toHaveLength(1)
    expect(applied[0].seq).toBe(3)
  })

  /**
   * REGRESSION (round 3): coalescing must not swallow a redelivered /
   * out-of-order delta. Merging it would concatenate its text (the reducer
   * never sees a duplicate to drop) AND rewind the batch's seq below an
   * already-applied one, defeating the reducer's `seq <= lastAppliedSeq`
   * gate. It is pushed as its OWN entry so the gate can do its job.
   */
  it('does NOT coalesce a delta whose seq does not advance past the tail', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })
    b.push(text('a', { seq: 1 } as Partial<ChatStreamEvent>))
    b.push(text('b', { seq: 2 } as Partial<ChatStreamEvent>))
    // Redelivery of seq 2, then an out-of-order seq 1.
    b.push(text('b', { seq: 2 } as Partial<ChatStreamEvent>))
    b.push(text('a', { seq: 1 } as Partial<ChatStreamEvent>))
    expect(b.pendingCount).toBe(3)
    b.flush()
    expect(applied.map((e) => [e.seq, e.text])).toEqual([
      [2, 'ab'],
      [2, 'b'],
      [1, 'a'],
    ])
  })

  it('never mutates the caller-supplied event objects', () => {
    const b = createDeltaBatcher({ applyOne: () => {} })
    const first = text('a')
    b.push(first)
    b.push(text('b'))
    b.flush()
    expect((first as DeltaEvent).text).toBe('a')
  })

  it('returns false for non-delta events and leaves them unqueued', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })
    expect(b.push(text('a'))).toBe(true)
    expect(b.push({ type: 'turn-end' } as ChatStreamEvent)).toBe(false)
    expect(b.pendingCount).toBe(1)
    expect(applied).toHaveLength(0)
  })

  it('flushes on the timer fallback when rAF is unavailable', () => {
    const applied: DeltaEvent[] = []
    const flushes: number[] = []
    const b = createDeltaBatcher({
      applyOne: (e) => applied.push(e),
      onFlushed: (n) => flushes.push(n),
    })

    b.push(text('a'))
    b.push(text('b'))
    expect(applied).toHaveLength(0)

    vi.advanceTimersByTime(50)
    expect(applied.map((e) => e.text)).toEqual(['ab'])
    expect(flushes).toEqual([1])

    // Timer is one-shot per batch: a later delta arms a fresh one.
    b.push(text('c'))
    vi.advanceTimersByTime(50)
    expect(applied.map((e) => e.text)).toEqual(['ab', 'c'])
  })

  it('honours a custom fallbackMs', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e), fallbackMs: 200 })
    b.push(text('a'))
    vi.advanceTimersByTime(199)
    expect(applied).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(applied).toHaveLength(1)
  })

  it('flushes the pending batch against the PREVIOUS key when the key changes', () => {
    const applied: Array<[string, string]> = []
    const b = createDeltaBatcher<string>({
      applyOne: (e, key) => applied.push([key ?? '<none>', e.text]),
    })

    b.push(text('for-a1'), 'A')
    b.push(text('|for-a2'), 'A')
    // Switching keys must land the A batch on A BEFORE queueing for B.
    b.push(text('for-b'), 'B')
    expect(applied).toEqual([['A', 'for-a1|for-a2']])

    b.flush()
    expect(applied).toEqual([
      ['A', 'for-a1|for-a2'],
      ['B', 'for-b'],
    ])
  })

  it('flushes on key change even for a NON-delta event', () => {
    const applied: Array<[string, string]> = []
    const b = createDeltaBatcher<string>({
      applyOne: (e, key) => applied.push([key ?? '<none>', e.text]),
    })
    b.push(text('a'), 'A')
    expect(b.push({ type: 'turn-end' } as ChatStreamEvent, 'B')).toBe(false)
    expect(applied).toEqual([['A', 'a']])
  })

  it('dispose() flushes the tail and cancels the pending timer', () => {
    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })
    b.push(text('tail'))
    b.dispose()
    expect(applied.map((e) => e.text)).toEqual(['tail'])
    vi.advanceTimersByTime(1000)
    expect(applied).toHaveLength(1)
  })

  it('flush() on an empty batch is a no-op (no applyOne, no onFlushed)', () => {
    const applyOne = vi.fn()
    const onFlushed = vi.fn()
    const b = createDeltaBatcher({ applyOne, onFlushed })
    b.flush()
    b.flush()
    expect(applyOne).not.toHaveBeenCalled()
    expect(onFlushed).not.toHaveBeenCalled()
  })
})

describe('createDeltaBatcher — rAF path', () => {
  it('prefers requestAnimationFrame and cancels it on an explicit flush', () => {
    let rafCb: (() => void) | null = null
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
      rafCb = cb
      return 7
    })
    vi.stubGlobal('cancelAnimationFrame', cancel)

    const applied: DeltaEvent[] = []
    const b = createDeltaBatcher({ applyOne: (e) => applied.push(e) })
    b.push(text('a'))
    expect(rafCb).toBeTypeOf('function')

    b.flush()
    expect(cancel).toHaveBeenCalledWith(7)
    expect(applied.map((e) => e.text)).toEqual(['a'])

    // A late rAF callback for the already-flushed batch is harmless.
    rafCb!()
    expect(applied).toHaveLength(1)
  })
})
