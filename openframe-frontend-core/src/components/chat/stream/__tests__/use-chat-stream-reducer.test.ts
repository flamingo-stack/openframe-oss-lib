/**
 * Phase-3 tests — `useChatStreamReducer` delta batching.
 *
 * Text/thinking deltas coalesce to ~one animation frame (≤50ms timer
 * fallback); any non-delta event force-flushes the batch first so ordering
 * holds and completion always lands on fully-applied delta state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createChatDialogStore } from '../chat-dialog-store'
import { useChatStreamReducer } from '../use-chat-stream-reducer'

beforeEach(() => {
  vi.useFakeTimers()
  // Force the timer fallback path (deterministic under fake timers).
  vi.stubGlobal('requestAnimationFrame', undefined)
  vi.stubGlobal('cancelAnimationFrame', undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function setup() {
  const store = createChatDialogStore()
  const hook = renderHook(() =>
    useChatStreamReducer({
      store,
      dialogId: 'dlg-1',
      createReducerOptions: () => ({ transport: 'nats' }),
    }),
  )
  return { store, hook }
}

describe('useChatStreamReducer — delta batching', () => {
  it('coalesces text deltas and applies them on the ≤50ms fallback timer', () => {
    const { store, hook } = setup()
    act(() => {
      hook.result.current.applyEvent({ type: 'turn-start' })
      hook.result.current.applyEvent({ type: 'text-delta', text: 'a' })
      hook.result.current.applyEvent({ type: 'text-delta', text: 'b' })
    })
    // Not yet applied — pending in the batch.
    let trailing = store.getSnapshot('dlg-1').messages.at(-1)
    expect(trailing?.segments ?? []).toEqual([])

    act(() => {
      vi.advanceTimersByTime(50)
    })
    trailing = store.getSnapshot('dlg-1').messages.at(-1)
    expect(trailing?.segments).toEqual([{ type: 'text', text: 'ab' }])
  })

  it('a non-delta event force-flushes the pending batch synchronously first', () => {
    const { store, hook } = setup()
    act(() => {
      hook.result.current.applyEvent({ type: 'turn-start' })
      hook.result.current.applyEvent({ type: 'text-delta', text: 'partial ' })
      hook.result.current.applyEvent({ type: 'text-delta', text: 'answer' })
      // Completion — must land on fully-applied delta state.
      hook.result.current.applyEvent({ type: 'turn-end' })
    })
    const state = store.getSnapshot('dlg-1')
    const trailing = state.messages.at(-1)
    expect(trailing?.segments).toEqual([{ type: 'text', text: 'partial answer' }])
    expect(state.streamingPhase).toBe('idle')
  })

  it('flushDeltas applies the batch on demand (SSE end-of-stream path)', () => {
    const { store, hook } = setup()
    act(() => {
      hook.result.current.applyEvent({ type: 'turn-start' })
      hook.result.current.applyEvent({ type: 'thinking-delta', text: 'hmm ' })
      hook.result.current.applyEvent({ type: 'thinking-delta', text: 'ok' })
      hook.result.current.flushDeltas()
    })
    const trailing = store.getSnapshot('dlg-1').messages.at(-1)
    expect(trailing?.segments).toEqual([{ type: 'thinking', text: 'hmm ok' }])
  })

  it('interleaved text/thinking preserve order across the batch', () => {
    const { store, hook } = setup()
    act(() => {
      hook.result.current.applyEvent({ type: 'turn-start' })
      hook.result.current.applyEvent({ type: 'thinking-delta', text: 'think' })
      hook.result.current.applyEvent({ type: 'text-delta', text: 'answer' })
      hook.result.current.flushDeltas()
    })
    const trailing = store.getSnapshot('dlg-1').messages.at(-1)
    expect(trailing?.segments).toEqual([
      { type: 'thinking', text: 'think' },
      { type: 'text', text: 'answer' },
    ])
  })
})
