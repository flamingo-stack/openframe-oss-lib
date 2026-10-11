/**
 * `shell="inline"`: the chat docked into the page layout. Its host is not a
 * dialog, so the panel must render without a Radix Dialog around it — the
 * `Dialog.Title` the `none` shell supplies throws outside one — and, with
 * `closable={false}`, without a close control.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    approvalToolUrl: '/api/chat/agent/confirm-tool',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
};

function createState(): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: [],
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage: asyncNoop,
    stopMessage: noop,
    clearMessages: noop,
    discussRef: noop,
    displayRef: noop,
    currentProvider: 'anthropic',
    currentModelLabel: 'Claude',
    currentContextWindowMaxTokens: null,
    currentInputTokens: null,
    currentOutputTokens: null,
    currentCacheHitRatePct: null,
    currentUsageBreakdown: null,
    dialogs: [{ id: 'd-1', title: 'First' }],
    activeDialogId: 'd-1',
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

describe('EmbeddableChat inline shell', () => {
  it('renders outside a dialog and offers no close control when not closable', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChatRuntimeContext.Provider value={runtime}>
          <EmbeddableChat
            shell="inline"
            closable={false}
            open
            onOpenChange={vi.fn()}
            defaultActiveMode="mingo"
            showInternalTrigger={false}
            mingoState={createState()}
          />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
    expect(screen.getAllByText('First').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close chat' })).not.toBeInTheDocument();
  });

  it('v2: the chat list as its own screen when narrow and nothing is open', () => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChatRuntimeContext.Provider value={runtime}>
          <EmbeddableChat
            shell="inline"
            appearance="v2"
            closable={false}
            open
            onOpenChange={vi.fn()}
            defaultActiveMode="mingo"
            showInternalTrigger={false}
            mingoState={createState()}
          />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('complementary', { name: 'Mingo chats' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start New Chat' })).toBeInTheDocument();
  });

  it('v2: the v2 header over a conversation', () => {
    const state = createState();
    state.messages = [{ id: 'm-1', role: 'user', content: 'hello', timestamp: new Date('2026-01-01T00:00:00Z') }];
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChatRuntimeContext.Provider value={runtime}>
          <EmbeddableChat
            shell="inline"
            appearance="v2"
            closable={false}
            open
            onOpenChange={vi.fn()}
            defaultActiveMode="mingo"
            showInternalTrigger={false}
            mingoState={state}
          />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
    // jsdom measures the panel at 0px: the narrow layout, where the list
    // toggle is the way back and there is no collapse arrow.
    expect(screen.getByRole('button', { name: 'Show chat list' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse chat' })).not.toBeInTheDocument();
  });
});
