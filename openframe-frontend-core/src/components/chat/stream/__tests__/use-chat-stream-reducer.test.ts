/**
 * `useChatStreamReducer` delta batching.
 *
 * Text/reasoning deltas coalesce to ~one animation frame (≤50ms timer
 * fallback); any non-delta entry force-flushes the batch first so ordering
 * holds and completion always lands on fully-applied delta state.
 */

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChatMessage, ChatPart } from '../../../../chat-protocol/chat-message';
import type { ChatStreamEntry } from '../../../../chat-protocol/ui-chunks';
import { createChatDialogStore } from '../chat-dialog-store';
import { useChatStreamReducer } from '../use-chat-stream-reducer';

/** ES2020-compatible `arr.at(-1)`. The package pins `lib: ES2020`
 *  (target ES2020 is the shipped contract), where `Array.prototype.at`
 *  is not declared — the source tree uses `xs[xs.length - 1]` for the
 *  same reason. */
const last = <T>(xs: readonly T[] | undefined): T | undefined => (xs === undefined ? undefined : xs[xs.length - 1]);

/** What a part says, without how far the stream had got. */
const said = (message: ChatMessage | undefined): ChatPart[] =>
  (message?.parts ?? []).map(part => {
    if (part.type !== 'text' && part.type !== 'reasoning') return part;
    const { state: _state, ...content } = part;
    return content;
  });

const START: ChatStreamEntry = { chunks: [{ type: 'start' }] };
const END: ChatStreamEntry = { chunks: [{ type: 'finish', finishReason: 'stop' }] };
const text = (delta: string): ChatStreamEntry => ({ chunks: [{ type: 'text-delta', id: 't1', delta }] });
const reasoning = (delta: string): ChatStreamEntry => ({ chunks: [{ type: 'reasoning-delta', id: 'r1', delta }] });

beforeEach(() => {
  vi.useFakeTimers();
  // Force the timer fallback path (deterministic under fake timers).
  vi.stubGlobal('requestAnimationFrame', undefined);
  vi.stubGlobal('cancelAnimationFrame', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function setup() {
  const store = createChatDialogStore();
  const hook = renderHook(() =>
    useChatStreamReducer({
      store,
      dialogId: 'dlg-1',
    }),
  );
  return { store, hook };
}

describe('useChatStreamReducer — delta batching', () => {
  it('coalesces text deltas and applies them on the ≤50ms fallback timer', () => {
    const { store, hook } = setup();
    act(() => {
      hook.result.current.applyEntry(START);
      hook.result.current.applyEntry(text('a'));
      hook.result.current.applyEntry(text('b'));
    });
    // Not yet applied: pending in the batch.
    expect(said(last(store.getSnapshot('dlg-1').messages))).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(said(last(store.getSnapshot('dlg-1').messages))).toEqual([{ type: 'text', text: 'ab' }]);
  });

  it('a non-delta entry force-flushes the pending batch synchronously first', () => {
    const { store, hook } = setup();
    act(() => {
      hook.result.current.applyEntry(START);
      hook.result.current.applyEntry(text('partial '));
      hook.result.current.applyEntry(text('answer'));
      // Completion: must land on fully-applied delta state.
      hook.result.current.applyEntry(END);
    });
    const state = store.getSnapshot('dlg-1');
    expect(said(last(state.messages))).toEqual([{ type: 'text', text: 'partial answer' }]);
    expect(state.streamingPhase).toBe('idle');
  });

  it('flushDeltas applies the batch on demand (end-of-stream path)', () => {
    const { store, hook } = setup();
    act(() => {
      hook.result.current.applyEntry(START);
      hook.result.current.applyEntry(reasoning('hmm '));
      hook.result.current.applyEntry(reasoning('ok'));
      hook.result.current.flushDeltas();
    });
    expect(said(last(store.getSnapshot('dlg-1').messages))).toEqual([{ type: 'reasoning', text: 'hmm ok' }]);
  });

  it('interleaved text/reasoning preserve their place across the batch', () => {
    const { store, hook } = setup();
    act(() => {
      hook.result.current.applyEntry(START);
      hook.result.current.applyEntry(reasoning('think'));
      hook.result.current.applyEntry(text('answer'));
      hook.result.current.flushDeltas();
    });
    expect(said(last(store.getSnapshot('dlg-1').messages))).toEqual([
      { type: 'reasoning', text: 'think' },
      { type: 'text', text: 'answer' },
    ]);
  });
});
