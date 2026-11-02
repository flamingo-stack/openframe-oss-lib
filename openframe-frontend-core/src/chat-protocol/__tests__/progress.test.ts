import { describe, expect, it } from 'vitest';
import { chatProgressChunk, chatProgressLabel } from '../progress';

describe('chat progress: the stages a turn reports before its first token', () => {
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

describe('chatProgressChunk: a stage on the UI message stream', () => {
  it('is transient, its id unique to the turn and the stage', () => {
    expect(chatProgressChunk({ stage: 'searching', count: 29 }, 'running', 't1')).toEqual({
      type: 'data-chat-progress',
      id: 't1:searching',
      transient: true,
      data: { stage: 'searching', count: 29, state: 'running' },
    });
  });

  it('states no count it was not given, and closes the row of the same id', () => {
    expect(chatProgressChunk({ stage: 'understanding' }, 'done', 't1')).toEqual({
      type: 'data-chat-progress',
      id: 't1:understanding',
      transient: true,
      data: { stage: 'understanding', state: 'done' },
    });
    expect(chatProgressChunk({ stage: 'reading' }, 'failed', 't1').data.state).toBe('failed');
  });
});
