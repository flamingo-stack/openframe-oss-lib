/**
 * While an answer is written, the turn's own rows say it is working: no sources strip in a loading form under it, and
 * no second "Thinking…" indicator under the thread once the turn has drawn a row. Before the turn has drawn anything,
 * the indicator is the only sign of life and stays.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Identity + every other authed fetch: a promise that never settles keeps the
// panel offline and free of state updates landing outside `act`.
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

function createState(overrides: Partial<UnifiedChatState>): UnifiedChatState {
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
    approveRequest: asyncNoop,
    rejectRequest: asyncNoop,
    dialogTokenUsage: null,
    connectionState: 'connected',
    ...overrides,
  };
}

const THREAD: UnifiedChatState['messages'] = [
  { id: 'm-1', role: 'user', content: 'hello', timestamp: new Date('2026-01-01T00:00:00Z') },
  { id: 'm-2', role: 'assistant', content: 'Working on it', timestamp: new Date('2026-01-01T00:00:01Z') },
];

function renderAnswering(messages: UnifiedChatState['messages']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <DialogPrimitive.Root open>
          <EmbeddableChat
            shell="none"
            defaultOpen
            defaultActiveMode="mingo"
            showInternalTrigger={false}
            mingoState={createState({
              activeDialogId: 'd-1',
              messages,
              isLoading: true,
              streamingPhase: 'streaming',
            })}
          />
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

describe('EmbeddableChat - an answer being written', () => {
  it('draws no sources strip under it', () => {
    renderAnswering(THREAD);
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('draws no second working indicator once the turn has drawn a row', () => {
    renderAnswering(THREAD);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps the working indicator while the turn has drawn nothing yet', () => {
    renderAnswering(THREAD.slice(0, 1));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
