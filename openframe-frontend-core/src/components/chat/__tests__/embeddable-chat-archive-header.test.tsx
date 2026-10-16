/**
 * v2, the list and the chat side by side: the Chat Archive opens in the chat
 * column, and the header above it is the archive's. The open conversation stays selected underneath (closing the
 * archive returns to it), but while the archive is on screen the header does
 * not name it, offer its ⋯ actions, or mark it in the chat list.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

const OPEN_CHAT = 'Critical CVEs This Week';

function Host({ initialDialogId }: { initialDialogId: string | null }) {
  const [activeDialogId, setActiveDialogId] = useState<string | null>(initialDialogId);
  const noop = () => {};
  const asyncNoop = async () => {};
  const state: UnifiedChatState = {
    messages: activeDialogId ? [{ id: 'm-1', role: 'user', content: 'hello', timestamp: new Date(0) }] : [],
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
    dialogs: [
      { id: 'd-1', title: OPEN_CHAT, owner: { name: 'Maria Klymenko' } },
      { id: 'd-2', title: 'Online Devices List' },
    ],
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
      canRename: true,
      canArchive: true,
      onCopyLink: noop,
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
          chatMenuExtraItems={[{ id: 'extra', label: 'Reset Onboarding', onClick: noop }]}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

/** jsdom lays nothing out: the panel measures this wide, so the list and the chat fit side by side. */
function panelWidth(px: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(px);
}

/** The header's title and owner lines (the chat list draws its titles in other elements). */
function headerText(text: string) {
  return screen.queryByText(text, { selector: 'p' });
}

/** The ⋯ menu of the open chat (the list's rows label theirs by title). */
function chatActions() {
  return screen.queryByRole('button', { name: 'Chat actions' });
}

/** The list row marked as the chat on screen. */
function markedRow(title: string) {
  return screen.queryByRole('button', { name: new RegExp(title), current: true });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EmbeddableChat v2: the Chat Archive header', () => {
  it('opened from a chat, shows the archive instead of that chat, and gives it back on close', async () => {
    panelWidth(1200);
    render(<Host initialDialogId="d-1" />);

    expect(headerText(OPEN_CHAT)).toBeTruthy();
    expect(chatActions()).toBeTruthy();
    expect(markedRow(OPEN_CHAT)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Chat Archive' }));
    await screen.findByText('Archived chat');

    expect(headerText('Chat Archive')).toBeTruthy();
    expect(headerText(OPEN_CHAT)).toBeNull();
    expect(headerText('Maria Klymenko')).toBeNull();
    expect(chatActions()).toBeNull();
    expect(markedRow(OPEN_CHAT)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Chat Archive' }));

    expect(headerText(OPEN_CHAT)).toBeTruthy();
    expect(chatActions()).toBeTruthy();
    expect(markedRow(OPEN_CHAT)).toBeTruthy();
  });
});
