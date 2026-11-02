/**
 * A quick action in the chat's empty state sends its prompt on the click, and still runs the
 * host's own `onClick`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
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

const PROMPT = 'Check my fleet for pending patches.';

function emptyState(sendMessage: (text: string) => Promise<void>): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: [],
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage,
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
    dialogs: [],
    activeDialogId: null,
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
    actions: {},
    dialogTokenUsage: null,
    connectionState: 'connected',
  };
}

function renderChat({ onClick }: { onClick?: () => void } = {}) {
  const sendMessage = vi.fn((_text: string) => Promise.resolve());
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <EmbeddableChat
          shell="inline"
          appearance="v2"
          defaultOpen
          defaultActiveMode="mingo"
          showInternalTrigger={false}
          mingoState={emptyState(sendMessage)}
          mingoWelcome={{
            quickActions: [{ id: 'qa-1', label: 'Patching', prompt: PROMPT, onClick }],
          }}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
  return { sendMessage };
}

describe('EmbeddableChat quick actions', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1400);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the prompt at once', async () => {
    const { sendMessage } = renderChat();

    fireEvent.click(screen.getByRole('button', { name: 'Patching' }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(sendMessage.mock.calls[0][0]).toBe(PROMPT);
  });

  it("still runs the host's own click", async () => {
    const onClick = vi.fn();
    const { sendMessage } = renderChat({ onClick });

    fireEvent.click(screen.getByRole('button', { name: 'Patching' }));

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
