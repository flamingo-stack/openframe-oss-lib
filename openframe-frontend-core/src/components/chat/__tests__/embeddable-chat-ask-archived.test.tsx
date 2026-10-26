/**
 * "Ask Mingo" about a row asks in the open conversation. An archived
 * conversation is read-only (the backend refuses writes), so asking from one
 * starts a new chat instead: the question reaches the host only once it has
 * let go of the archived dialog.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import type { ChatRef } from '../chat-ref.types';
import { EmbeddableChat } from '../embeddable-chat';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

const runtime: ChatRuntime = {
  source: 'openframe',
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

const QUICK_START: ChatRef = { type: 'markdown', id: 'kb-1', title: 'quick-start.md', url: null };

/** A host that owns the active dialog: `discussRef` reports where the question would be written. */
function Host({
  initialDialogId,
  onAsk,
}: {
  initialDialogId: string | null;
  onAsk: (dialogId: string | null) => void;
}) {
  const [activeDialogId, setActiveDialogId] = useState<string | null>(initialDialogId);
  const noop = () => {};
  const asyncNoop = async () => {};
  const state: UnifiedChatState = {
    messages: [],
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage: asyncNoop,
    stopMessage: noop,
    clearMessages: noop,
    discussRef: () => onAsk(activeDialogId),
    displayRef: noop,
    currentProvider: 'anthropic',
    currentModelLabel: 'Claude',
    currentContextWindowMaxTokens: null,
    currentInputTokens: null,
    currentOutputTokens: null,
    currentCacheHitRatePct: null,
    currentUsageBreakdown: null,
    dialogs: [{ id: 'd-1', title: 'Open chat' }],
    activeDialogId,
    selectDialog: setActiveDialogId,
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
    dialogCapabilities: {
      fetchArchivedDialogs: () =>
        Promise.resolve({ dialogs: [{ id: 'a-1', title: 'Archived chat' }], nextCursor: null }),
      unarchiveDialog: asyncNoop,
    },
  };
  return (
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
    </QueryClientProvider>
  );
}

function askMingoFromThePage() {
  act(() => {
    window.dispatchEvent(
      new CustomEvent('ask-ai:open-with-ref', { detail: { source: 'openframe', ref: QUICK_START } }),
    );
  });
}

describe('EmbeddableChat: Ask Mingo and archived chats', () => {
  it('asks in the open conversation', async () => {
    const onAsk = vi.fn();
    render(<Host initialDialogId="d-1" onAsk={onAsk} />);
    askMingoFromThePage();
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(1));
    expect(onAsk).toHaveBeenCalledWith('d-1');
  });

  it('from an archived conversation, starts a new chat instead of writing into it', async () => {
    const onAsk = vi.fn();
    render(<Host initialDialogId={null} onAsk={onAsk} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chat Archive' }));
    fireEvent.click(await screen.findByText('Archived chat'));
    await screen.findByText('Unarchive the chat to continue');

    askMingoFromThePage();
    await waitFor(() => expect(onAsk).toHaveBeenCalledTimes(1));
    expect(onAsk).toHaveBeenCalledWith(null);
    expect(onAsk).not.toHaveBeenCalledWith('a-1');
  });
});
