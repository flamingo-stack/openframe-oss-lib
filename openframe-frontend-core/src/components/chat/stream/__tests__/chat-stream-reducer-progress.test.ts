/**
 * The stages a hub turn reports ("Searching 28 sources") arrive as tool-run frames and are drawn as the rows a NATS
 * tool run gets: decoded by the NATS decoder, applied by the same message updater.
 */
import { describe, expect, it } from 'vitest';

import { createSseFrameDecoder } from '../../../../chat-protocol/decode';
import { encodeEndOfLeading, encodeLeadingFrame, encodeTextDelta } from '../../../../chat-protocol/encode';
import { chatProgressFrame } from '../../../../chat-protocol/progress';
import { createChatStreamReducer } from '../chat-stream-reducer';

type Row = { type: string; data?: { type: string; toolTitle?: string; success?: boolean } };
type Reducer = ReturnType<typeof createChatStreamReducer>;
const lastSegments = (r: Reducer) => r.state.messages[r.state.messages.length - 1]?.segments ?? [];
const rows = (r: Reducer) =>
  (lastSegments(r) as Row[])
    .filter(s => s.type === 'tool_execution')
    .map(
      s =>
        `${s.data?.toolTitle} ${s.data?.type === 'EXECUTED_TOOL' ? (s.data.success ? 'done' : 'failed') : 'running'}`,
    );

function feed(r: Reducer, frames: Uint8Array[]) {
  const decoder = createSseFrameDecoder();
  for (const bytes of frames) for (const event of decoder.push(bytes)) r.apply(event);
}

describe('SSE kernel: the stages a hub turn reports', () => {
  it('draws each stage as a tool-run row, closed by its own frame', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    r.beginSseSend({ text: 'what is the price', assistantName: 'Mingo AI' });
    const understanding = { stage: 'understanding' } as const;
    const searching = { stage: 'searching', count: 28 } as const;
    feed(r, [
      encodeLeadingFrame({ status: 'thinking' }),
      encodeLeadingFrame(chatProgressFrame(understanding, 'running', 't1')),
      encodeLeadingFrame(chatProgressFrame(understanding, 'done', 't1')),
      encodeLeadingFrame(chatProgressFrame(searching, 'running', 't1')),
    ]);
    expect(rows(r)).toEqual(['Understanding your question done', 'Searching 28 sources running']);

    feed(r, [
      encodeLeadingFrame(chatProgressFrame(searching, 'failed', 't1')),
      encodeEndOfLeading(),
      encodeTextDelta('It costs $1.'),
    ]);
    expect(rows(r)).toEqual(['Understanding your question done', 'Searching 28 sources failed']);
  });

  it('a stage of a new turn gets its own row', () => {
    const r = createChatStreamReducer({ transport: 'sse' });
    const stage = { stage: 'reading', count: 12 } as const;
    r.beginSseSend({ text: 'first', assistantName: 'Mingo AI' });
    feed(r, [
      encodeLeadingFrame(chatProgressFrame(stage, 'running', 't1')),
      encodeLeadingFrame(chatProgressFrame(stage, 'done', 't1')),
    ]);
    r.endSseTurn();
    r.beginSseSend({ text: 'second', assistantName: 'Mingo AI' });
    feed(r, [encodeLeadingFrame(chatProgressFrame(stage, 'running', 't2'))]);
    expect(rows(r)).toEqual(['Reading 12 results running']);
  });
});
