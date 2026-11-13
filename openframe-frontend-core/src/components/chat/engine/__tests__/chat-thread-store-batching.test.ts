/**
 * The thread store's delta batching (`createChatThreadStore`, the one store every chat runs on).
 *
 * Text/reasoning deltas coalesce to ~one animation frame (≤50ms timer
 * fallback); any non-delta entry force-flushes the batch first so ordering
 * holds and completion always lands on fully-applied delta state.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChatMessage, ChatPart } from '../../../../chat-protocol/chat-message';
import type { ChatStreamEntry } from '../../../../chat-protocol/ui-chunks';
import { createChatThreadStore } from '../chat-thread-store';

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
  const store = createChatThreadStore<string>();
  const bound = store.bind('dlg-1');
  return { store, apply: bound.apply, messages: () => store.snapshotOf('dlg-1').messages };
}

describe('the thread store - delta batching', () => {
  it('coalesces text deltas and applies them on the <=50ms fallback timer', () => {
    const { apply, messages } = setup();
    apply(START);
    apply(text('a'));
    apply(text('b'));
    // Not yet applied: pending in the batch.
    expect(said(last(messages()))).toEqual([]);

    vi.advanceTimersByTime(50);
    expect(said(last(messages()))).toEqual([{ type: 'text', text: 'ab' }]);
  });

  it('a non-delta entry force-flushes the pending batch synchronously first', () => {
    const { store, apply, messages } = setup();
    apply(START);
    apply(text('partial '));
    apply(text('answer'));
    // Completion: must land on fully-applied delta state.
    apply(END);
    expect(said(last(messages()))).toEqual([{ type: 'text', text: 'partial answer' }]);
    expect(store.snapshotOf('dlg-1').phase).toBe('idle');
  });

  it('flush applies the batch on demand (end-of-stream path)', () => {
    const { store, apply, messages } = setup();
    apply(START);
    apply(reasoning('hmm '));
    apply(reasoning('ok'));
    store.flush();
    expect(said(last(messages()))).toEqual([{ type: 'reasoning', text: 'hmm ok' }]);
  });

  it('interleaved text/reasoning preserve their place across the batch', () => {
    const { store, apply, messages } = setup();
    apply(START);
    apply(reasoning('think'));
    apply(text('answer'));
    store.flush();
    expect(said(last(messages()))).toEqual([
      { type: 'reasoning', text: 'think' },
      { type: 'text', text: 'answer' },
    ]);
  });
});
