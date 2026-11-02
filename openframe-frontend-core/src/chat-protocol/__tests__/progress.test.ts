import { describe, expect, it } from 'vitest';
import { createSseFrameDecoder } from '../decode';
import { encodeLeadingFrame } from '../encode';
import { chatProgressFrame, chatProgressLabel } from '../progress';

describe('chat progress: the stages a turn reports before its first token', () => {
  it('a stage frame decodes to the tool-execution event a NATS tool run has', () => {
    const d = createSseFrameDecoder();
    const progress = { stage: 'searching', count: 28 } as const;
    expect(d.push(encodeLeadingFrame(chatProgressFrame(progress, 'running', 't1')))).toEqual([
      {
        type: 'tool-execution',
        data: {
          type: 'EXECUTING_TOOL',
          integratedToolType: 'OPENFRAME',
          toolFunction: 'searching',
          toolTitle: 'Searching 28 sources',
          toolExplanation: undefined,
          parameters: undefined,
          toolExecutionRequestId: 't1:searching',
        },
      },
    ]);
    expect(d.push(encodeLeadingFrame(chatProgressFrame(progress, 'done', 't1')))[0]).toMatchObject({
      type: 'tool-execution',
      data: { type: 'EXECUTED_TOOL', success: true, toolExecutionRequestId: 't1:searching' },
    });
  });

  it('a status frame is a plain "thinking"', () => {
    const d = createSseFrameDecoder();
    expect(d.push(encodeLeadingFrame({ status: 'thinking' }))).toEqual([{ type: 'status', phase: 'thinking' }]);
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
