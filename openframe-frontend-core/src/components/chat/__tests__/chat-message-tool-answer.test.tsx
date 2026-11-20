import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { applyChunk, applyChunkToMessages, createWireState } from '../../../chat-protocol/apply-chunk';
import type { ChatPart } from '../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../chat-protocol/message-decoder';
import { historicalMessageOfNode } from '../../../chat-protocol/mingo-graphql';
import { CHAT_INTERRUPTED_NOTICE } from '../../../chat-protocol/ui-chunks';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import { ChatMessageList } from '../chat-message-list';

const noopRef = () => {};
vi.mock('use-stick-to-bottom', () => ({
  useStickToBottom: () => ({
    scrollRef: noopRef,
    contentRef: noopRef,
    scrollToBottom: vi.fn(),
    stopScroll: vi.fn(),
    isAtBottom: true,
  }),
}));

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', ObserverStub);

const darkIcon = 'https://hub.example/icons/patch-dark.png';
const result = JSON.stringify({
  text: 'Pick an action.',
  groups: [
    {
      label: 'Fix',
      prompts: [
        {
          label: 'Patching',
          prompt: 'Patch my fleet',
          icons: [
            { src: 'https://hub.example/icons/patch-light.png', theme: 'light' },
            { src: darkIcon, theme: 'dark' },
          ],
        },
        { label: 'Reboot' },
      ],
    },
  ],
});

const executed = {
  type: 'EXECUTED_TOOL' as const,
  integratedToolType: 'MCP',
  toolFunction: 'list_quick_actions',
  toolExecutionRequestId: 'quick-actions-1',
  result,
  success: true,
  resultIsAnswer: true,
};

function decodedParts(raws: unknown[]) {
  const decoder = createMingoDecoder();
  const wire = createWireState();
  return raws
    .flatMap(raw => decoder.decode(raw).chunks)
    .reduce<ChatPart[]>((parts, chunk) => applyChunk(parts, chunk, wire), []);
}

function reloadedParts() {
  const row = historicalMessageOfNode({ id: 'message-1', createdAt: '2026-11-19T15:00:00Z', parts: [executed] });
  const decoder = createMingoDecoder();
  const wire = createWireState();
  return (row.parts ?? [])
    .flatMap(part => decoder.decode(part, { row }).chunks)
    .reduce<ChatPart[]>((parts, chunk) => applyChunk(parts, chunk, wire), []);
}

describe('ChatMessageEnhanced direct tool answers', () => {
  it('renders the declared answer and sends the exact prompt before and after history reload', () => {
    const pickSuggestion = vi.fn();
    const actions = { pickSuggestion };
    const view = render(
      <ChatMessageEnhanced role="assistant" parts={decodedParts([executed, executed])} actions={actions} />,
    );
    expect(screen.getAllByRole('button', { name: 'Patching' })).toHaveLength(1);
    expect(screen.getAllByAltText('').some(icon => icon.getAttribute('src') === darkIcon)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Patching' }));
    expect(pickSuggestion).toHaveBeenLastCalledWith('Patch my fleet');
    view.unmount();

    render(<ChatMessageEnhanced role="assistant" parts={reloadedParts()} actions={actions} />);
    expect(screen.getAllByRole('button', { name: 'Patching' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Patching' }));
    expect(pickSuggestion).toHaveBeenCalledTimes(2);
    expect(pickSuggestion).toHaveBeenLastCalledWith('Patch my fleet');
    fireEvent.click(screen.getByRole('button', { name: 'Reboot' }));
    expect(pickSuggestion).toHaveBeenLastCalledWith('Reboot');
  });

  it('does not promote context results or failed marked tool calls', () => {
    const view = render(
      <ChatMessageEnhanced role="assistant" parts={decodedParts([{ ...executed, resultIsAnswer: false }])} />,
    );
    expect(screen.queryByRole('button', { name: 'Patching' })).toBeNull();
    view.rerender(<ChatMessageEnhanced role="assistant" parts={decodedParts([{ ...executed, success: false }])} />);
    expect(screen.queryByRole('button', { name: 'Patching' })).toBeNull();
  });

  it('does not show direct actions after an abort through the real message-list caller', () => {
    const wire = createWireState();
    const started = applyChunkToMessages([], { type: 'start', messageId: 'stopped' }, wire);
    const chunks = createMingoDecoder().decode(executed).chunks;
    const running = chunks.reduce((messages, chunk) => applyChunkToMessages(messages, chunk, wire), started);
    const stopped = applyChunkToMessages(running, { type: 'abort' }, wire);
    expect(stopped[0].metadata?.aborted).toBe(true);
    render(<ChatMessageList messages={stopped} actions={{ pickSuggestion: vi.fn() }} />);
    expect(screen.queryByRole('button', { name: 'Patching' })).toBeNull();
  });

  it('does not draw the interrupted notice on a turn the user stopped', () => {
    const wire = createWireState();
    const started = applyChunkToMessages([], { type: 'start', messageId: 'stopped' }, wire);
    const chunks = createMingoDecoder().decode(executed).chunks;
    const running = chunks.reduce((messages, chunk) => applyChunkToMessages(messages, chunk, wire), started);
    const stopped = applyChunkToMessages(running, { type: 'abort' }, wire);
    expect(stopped[0].metadata?.finishReason).not.toBe('interrupted');
    render(<ChatMessageList messages={stopped} actions={{ pickSuggestion: vi.fn() }} />);
    expect(screen.queryByText(CHAT_INTERRUPTED_NOTICE)).toBeNull();
  });
});
