/**
 * The stages a hub turn reports ("Searching 28 sources") are held on the message being built, one row per stage, closed by
 * their own chunk, and never stored.
 */
import { describe, expect, it } from 'vitest';

import { storablePartsOf } from '../../../../chat-protocol/chat-message';
import { chatProgressChunk, chatProgressLabel } from '../../../../chat-protocol/progress';
import { createChatStreamReducer } from '../chat-stream-reducer';

type Reducer = ReturnType<typeof createChatStreamReducer>;
const rows = (r: Reducer) =>
  (r.state.messages[r.state.messages.length - 1]?.metadata?.progress ?? []).map(
    row => `${chatProgressLabel(row)} ${row.state}`,
  );

describe('the stages a hub turn reports', () => {
  it('draws each stage as a row, closed by its own chunk', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'what is the price' });
    const understanding = { stage: 'understanding' } as const;
    const searching = { stage: 'searching', count: 28 } as const;
    r.apply({ chunks: [{ type: 'start' }] });
    r.apply({ chunks: [chatProgressChunk(understanding, 'running', 't1')] });
    r.apply({ chunks: [chatProgressChunk(understanding, 'done', 't1')] });
    r.apply({ chunks: [chatProgressChunk(searching, 'running', 't1')] });
    expect(rows(r)).toEqual(['Understanding your question done', 'Searching 28 sources running']);

    r.apply({ chunks: [chatProgressChunk(searching, 'failed', 't1')] });
    r.apply({ chunks: [{ type: 'text-delta', id: 't1', delta: 'It costs $1.' }] });
    expect(rows(r)).toEqual(['Understanding your question done', 'Searching 28 sources failed']);
  });

  it('a stage of a new turn gets its own row, on its own message', () => {
    const r = createChatStreamReducer();
    const stage = { stage: 'reading', count: 12 } as const;
    r.beginSseSend({ text: 'first' });
    r.apply({ chunks: [chatProgressChunk(stage, 'running', 't1')] });
    r.apply({ chunks: [chatProgressChunk(stage, 'done', 't1')] });
    r.apply({ chunks: [{ type: 'text-delta', id: 't1', delta: 'Answer.' }] });
    r.endSseTurn();
    r.beginSseSend({ text: 'second' });
    r.apply({ chunks: [chatProgressChunk(stage, 'running', 't2')] });
    expect(rows(r)).toEqual(['Reading 12 results running']);
  });

  it('a stage is never a part: a stored row has none of it', () => {
    const r = createChatStreamReducer();
    r.beginSseSend({ text: 'q' });
    r.apply({ chunks: [chatProgressChunk({ stage: 'understanding' }, 'running', 't1')] });
    const message = r.state.messages[r.state.messages.length - 1];
    expect(message.parts).toEqual([]);
    expect(storablePartsOf(message.parts)).toEqual([]);
  });
});
