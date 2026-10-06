/**
 * The stage a pending turn reports ("searching 28 sources") lives in reducer
 * state only while the turn is still thinking: it is replaced as the stage
 * moves, kept through a plain status frame, gone once text streams, and never
 * carried into the next turn.
 */
import { describe, expect, it } from 'vitest';

import { createChatStreamReducer } from '../chat-stream-reducer';

describe('SSE kernel: the stage a pending turn reports', () => {
  it('follows the stage, keeps it through a plain status frame, and drops it when text starts', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'what is the price', assistantName: 'Mingo AI' });
    expect(r.state.streamingProgress).toBeNull();

    r.apply({ type: 'status', phase: 'thinking', progress: { stage: 'understanding' } });
    expect(r.state.streamingProgress).toEqual({ stage: 'understanding' });

    r.apply({ type: 'status', phase: 'thinking', progress: { stage: 'searching', count: 28 } });
    expect(r.state.streamingProgress).toEqual({ stage: 'searching', count: 28 });

    // The model stream's own first frame carries no stage: the last one stands.
    r.apply({ type: 'status', phase: 'thinking' });
    expect(r.state.streamingProgress).toEqual({ stage: 'searching', count: 28 });

    r.apply({ type: 'turn-start' });
    expect(r.state.streamingPhase).toBe('streaming');
    expect(r.state.streamingProgress).toBeNull();
  });

  it('a new turn starts with no stage', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'first', assistantName: 'Mingo AI' });
    r.apply({ type: 'status', phase: 'thinking', progress: { stage: 'reading', count: 12 } });
    r.beginSseSend({ text: 'second', assistantName: 'Mingo AI' });
    expect(r.state.streamingPhase).toBe('thinking');
    expect(r.state.streamingProgress).toBeNull();
  });
});
