import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeNatsChunk } from '../../../chat-protocol/nats-decoder';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { createChatStreamReducer } from '../stream/chat-stream-reducer';
import type { UnifiedChatMessage, UnifiedChatState } from '../types/unified-chat-state.types';

vi.mock('@mux/mux-player-react', () => ({
  default: ({ src }: { src?: string }) => <div data-testid="mux-player" data-src={src} />,
}));

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/test/chat',
    approvalToolUrl: '/test/approve',
    commandsUrl: '/test/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/test/upload',
    attachmentViewUrlPrefix: '/test/view/',
    identityUrl: '/test/identity',
  },
  navigation: { mode: 'host' },
  source: 'openframe',
};

function stateFor(messages: UnifiedChatMessage[]): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages,
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage: asyncNoop,
    stopMessage: noop,
    clearMessages: noop,
    discussRef: noop,
    displayRef: noop,
    currentProvider: null,
    currentModelLabel: null,
    currentContextWindowMaxTokens: null,
    currentInputTokens: null,
    currentOutputTokens: null,
    currentCacheHitRatePct: null,
    currentUsageBreakdown: null,
    dialogs: [{ id: 'dialog-1', title: 'Sources' }],
    activeDialogId: 'dialog-1',
    selectDialog: noop,
    startNewDialog: () => Promise.resolve(null),
    deleteDialog: asyncNoop,
    renameDialog: asyncNoop,
    archiveDialog: asyncNoop,
    isDialogsLoading: false,
    dialogsError: false,
    reloadDialogs: noop,
    isMessagesLoading: false,
    hasMoreDialogs: false,
    loadMoreDialogs: asyncNoop,
    hasMoreMessages: false,
    loadMoreMessages: asyncNoop,
    approveRequest: asyncNoop,
    rejectRequest: asyncNoop,
    dialogTokenUsage: null,
    connectionState: 'connected',
  };
}

function renderChat(messages: UnifiedChatMessage[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChatRuntimeContext.Provider value={runtime}>
        <DialogPrimitive.Root open>
          <EmbeddableChat
            shell="none"
            defaultOpen
            defaultActiveMode="mingo"
            showInternalTrigger={false}
            previewMode
            mingoState={stateFor(messages)}
          />
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    },
  );
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ commands: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EmbeddableChat source strip', () => {
  it('renders live SOURCES metadata in citation order with uncited overflow', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      {
        type: 'SOURCES',
        payload: {
          sources: [
            { index: 1, name: 'First source', path: 'first', documentType: 'docs' },
            { index: 2, name: 'Second source', path: 'second', documentType: 'docs' },
            { index: 3, name: 'Third source', path: 'third', documentType: 'docs' },
            { index: 4, name: 'Fourth source', path: 'fourth', documentType: 'docs' },
          ],
          videos: [
            {
              ref: '[card://video:mux-9b6586b494]',
              title: 'Product overview',
              url: 'https://stream.mux.com/product-overview.m3u8',
            },
          ],
        },
        streamSeq: 2,
      },
      {
        type: 'TEXT',
        text:
          'Compare the third source [3] with the first [1] and cite [3] once. ' +
          'Watch [card://video:mux-9b6586b494].',
        streamSeq: 3,
      },
      { type: 'MESSAGE_END', streamSeq: 4 },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }

    renderChat(reducer.state.messages);

    const chips = screen.getAllByTitle(/source$/i);
    expect(chips.map(chip => chip.textContent)).toEqual(['[3] Third source', '[1] First source']);
    expect(screen.queryByText('[2] Second source')).not.toBeInTheDocument();
    const expander = screen.getByRole('button', { name: 'Show 2 additional retrieved sources' });
    expect(expander).toHaveTextContent('+2 more retrieved sources');

    fireEvent.click(expander);

    expect(screen.getByText('[2] Second source')).toBeInTheDocument();
    expect(screen.getByText('[4] Fourth source')).toBeInTheDocument();
    expect(screen.getByTestId('mux-player')).toHaveAttribute(
      'data-src',
      'https://stream.mux.com/product-overview.m3u8',
    );
  });

  it('keeps every uncited source accessible behind the top-three fallback', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      {
        type: 'SOURCES',
        payload: {
          sources: Array.from({ length: 5 }, (_, index) => ({
            index: index + 1,
            name: `Source ${index + 1}`,
            path: `source-${index + 1}`,
            documentType: 'docs',
          })),
        },
        streamSeq: 2,
      },
      { type: 'TEXT', text: 'Here are the relevant materials.', streamSeq: 3 },
      { type: 'MESSAGE_END', streamSeq: 4 },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }

    renderChat(reducer.state.messages);

    expect(screen.getByText('[1] Source 1')).toBeInTheDocument();
    expect(screen.getByText('[3] Source 3')).toBeInTheDocument();
    expect(screen.queryByText('[4] Source 4')).not.toBeInTheDocument();

    const expander = screen.getByRole('button', { name: 'Show 2 additional retrieved sources' });
    fireEvent.click(expander);

    expect(screen.getByText('[4] Source 4')).toBeInTheDocument();
    expect(screen.getByText('[5] Source 5')).toBeInTheDocument();
  });

  it('renders a markdown card from matching source metadata when hydration is unavailable', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      {
        type: 'SOURCES',
        payload: {
          sources: [
            {
              index: 1,
              id: 'install-agent',
              name: 'Install the OpenFrame agent on Windows',
              path: 'getting-started/install-agent.md',
              documentType: 'markdown',
              sourceRepo: 'openframe-docs',
            },
          ],
          cards: [
            {
              ref: '[card://markdown:install-agent]',
              entityType: 'markdown',
              entityId: 'install-agent',
            },
          ],
        },
        streamSeq: 2,
      },
      {
        type: 'TEXT',
        text: 'Follow [card://markdown:install-agent].',
        streamSeq: 3,
      },
      { type: 'MESSAGE_END', streamSeq: 4 },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }

    renderChat(reducer.state.messages);

    expect(screen.getByText('Install the OpenFrame agent on Windows')).toBeInTheDocument();
    expect(screen.queryByText('FAILED')).not.toBeInTheDocument();
  });

  it('renders a matched source card when its display name equals its id', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      {
        type: 'SOURCES',
        payload: {
          sources: [
            {
              index: 1,
              id: 'install-agent',
              name: 'install-agent',
              path: 'getting-started/install-agent.md',
              documentType: 'markdown',
            },
          ],
          cards: [
            {
              ref: '[card://markdown:install-agent]',
              entityType: 'markdown',
              entityId: 'install-agent',
            },
          ],
        },
        streamSeq: 2,
      },
      { type: 'TEXT', text: 'Follow [card://markdown:install-agent].', streamSeq: 3 },
      { type: 'MESSAGE_END', streamSeq: 4 },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }

    renderChat(reducer.state.messages);

    expect(screen.getAllByText('install-agent').length).toBeGreaterThan(0);
    expect(screen.queryByText('FAILED')).not.toBeInTheDocument();
  });

  it('does not treat an arbitrary enriched ref as matched source metadata', () => {
    renderChat([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Follow [card://markdown:unmatched-doc].',
        refs: [
          {
            type: 'markdown',
            id: 'unmatched-doc',
            title: 'Plausible but unmatched document',
            url: null,
            metadata: { path: 'docs/unmatched.md' },
          },
        ],
      },
    ]);

    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.queryByText('Plausible but unmatched document')).not.toBeInTheDocument();
  });

  it('opens every item carried by a grouped source', () => {
    const reducer = createChatStreamReducer({ transport: 'nats' });
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      {
        type: 'SOURCES',
        payload: {
          sources: [
            {
              index: 1,
              name: 'Case Studies (3 records)',
              path: 'case-studies',
              documentType: 'case-study',
              items: [
                {
                  id: 'case-study-1',
                  name: 'Northstar MSP',
                  path: 'case-studies/northstar',
                  documentType: 'case-study',
                },
                {
                  id: 'case-study-2',
                  name: 'Blue Harbor IT',
                  path: 'case-studies/blue-harbor',
                  documentType: 'case-study',
                },
                {
                  id: 'case-study-3',
                  name: 'Summit Technology',
                  path: 'case-studies/summit',
                  documentType: 'case-study',
                },
              ],
            },
          ],
        },
        streamSeq: 2,
      },
      { type: 'TEXT', text: 'Here are three customer stories [1].', streamSeq: 3 },
      { type: 'MESSAGE_END', streamSeq: 4 },
    ]) {
      const event = decodeNatsChunk(chunk);
      if (event) reducer.apply(event);
    }

    renderChat(reducer.state.messages);

    fireEvent.click(screen.getByText('[1] Case Studies (3 records)'));

    expect(screen.getByText('Northstar MSP')).toBeInTheDocument();
    expect(screen.getByText('Blue Harbor IT')).toBeInTheDocument();
    expect(screen.getByText('Summit Technology')).toBeInTheDocument();
  });
});
