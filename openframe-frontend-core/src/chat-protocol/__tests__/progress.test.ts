import { describe, expect, it } from 'vitest';
import { createSseFrameDecoder } from '../decode';
import { chatProgressLabel, chatProgressOf } from '../progress';

const frame = (o: unknown) => new TextEncoder().encode(`${JSON.stringify(o)}\0`);

describe('chat progress: the stage a turn reports before its first token', () => {
  it('a status frame with a stage decodes to a status event carrying it', () => {
    const d = createSseFrameDecoder();
    expect(d.push(frame({ status: 'thinking', stage: 'searching', count: 28 }))).toEqual([
      { type: 'status', phase: 'thinking', progress: { stage: 'searching', count: 28 } },
    ]);
  });

  it('a plain status frame, and one whose stage this client does not know, is a plain "thinking"', () => {
    const d = createSseFrameDecoder();
    expect(d.push(frame({ status: 'thinking' }))).toEqual([{ type: 'status', phase: 'thinking' }]);
    expect(d.push(frame({ status: 'thinking', stage: 'a-stage-from-the-future' }))).toEqual([
      { type: 'status', phase: 'thinking' },
    ]);
  });

  it('keeps only a real count', () => {
    expect(chatProgressOf({ stage: 'reading', count: 0 })).toEqual({ stage: 'reading' });
    expect(chatProgressOf({ stage: 'reading', count: '12' })).toEqual({ stage: 'reading' });
    expect(chatProgressOf({ stage: 'reading', count: 12.7 })).toEqual({ stage: 'reading', count: 12 });
    expect(chatProgressOf({ stage: 'nope' })).toBeNull();
  });

  it('words each stage, specific when a count is known', () => {
    expect(chatProgressLabel({ stage: 'understanding' })).toBe('Understanding your question');
    expect(chatProgressLabel({ stage: 'searching', count: 28 })).toBe('Searching 28 sources');
    expect(chatProgressLabel({ stage: 'searching', count: 1 })).toBe('Searching 1 source');
    expect(chatProgressLabel({ stage: 'searching' })).toBe('Searching');
    expect(chatProgressLabel({ stage: 'searching_again' })).toBe('Searching more broadly');
    expect(chatProgressLabel({ stage: 'reading', count: 43 })).toBe('Reading 43 results');
    expect(chatProgressLabel({ stage: 'reading' })).toBe('Reading the results');
  });
});
