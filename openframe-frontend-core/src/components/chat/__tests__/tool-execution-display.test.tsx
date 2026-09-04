import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import { ToolExecutionDisplay } from '../tool-execution-display';
import type { ToolExecutionData } from '../types';

const execution = (overrides: Partial<ToolExecutionData>): ToolExecutionData => ({
  type: 'EXECUTING_TOOL',
  integratedToolType: 'OPENFRAME',
  toolFunction: 'search_docs',
  ...overrides,
});

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('ToolExecutionDisplay remote read activity', () => {
  it('keeps a completed remote read concise through the real wire pipeline', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      {
        type: 'EXECUTING_TOOL',
        integratedToolType: null,
        toolFunction: 'remote_read',
        title: 'Searching product documentation',
        parameters: null,
        toolExecutionRequestId: 'remote-read-1',
      },
      {
        type: 'EXECUTED_TOOL',
        integratedToolType: null,
        toolFunction: 'remote_read',
        result: null,
        success: true,
        toolExecutionRequestId: 'remote-read-1',
      },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }
    const toolSegment = reducer.state.messages
      .flatMap(message => message.segments ?? [])
      .find(segment => segment.type === 'tool_execution');

    expect(toolSegment?.type).toBe('tool_execution');
    if (toolSegment?.type !== 'tool_execution') return;
    render(<ToolExecutionDisplay message={toolSegment.data} />);

    expect(screen.getByText('Searching product documentation')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Remote read')).not.toBeInTheDocument();
  });

  it('keeps a typed local tool expandable when its body is absent', () => {
    render(
      <ToolExecutionDisplay
        message={execution({
          integratedToolType: 'OPENFRAME',
          toolTitle: 'Refresh device inventory',
        })}
      />,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('keeps a backend-described remote read concise while running', () => {
    render(
      <ToolExecutionDisplay
        message={execution({
          integratedToolType: undefined,
          toolTitle: 'Searching product documentation',
        })}
      />,
    );

    expect(screen.getByText('Searching product documentation')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
