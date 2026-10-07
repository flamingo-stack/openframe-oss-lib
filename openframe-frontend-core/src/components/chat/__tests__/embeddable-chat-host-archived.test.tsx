/**
 * A conversation can arrive without a click in this panel - a shared link, a
 * notification, a reload adopting `?mingoDialog=` - so whether it is archived
 * has to come from the host's own record of it (`UnifiedChatState.activeDialog`).
 * Without that record the archived conversation opened writable and the backend
 * refused the message.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import type { DialogItem } from '../types/component.types';
import type { UnifiedChatMessage, UnifiedChatState } from '../types/unified-chat-state.types';

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

const READ_ONLY_BANNER = 'Unarchive the chat to continue';

/** The history a reloaded conversation comes back with. */
const HISTORY: UnifiedChatMessage[] = [{ id: 'm-1', role: 'user', content: 'How do I install the agent?' }];

/**
 * A host whose open conversation came from a link: it is NOT in `dialogs`, and
 * the host's record of it (`activeDialog`) is the only thing that says what it
 * is. `unarchiveDialog` is what the real host does - the record stops saying
 * archived by the time the promise resolves.
 */
function Host({
  activeDialogId,
  activeDialog,
  messages = [],
  onUnarchive = () => {},
}: {
  activeDialogId: string;
  activeDialog: DialogItem;
  messages?: UnifiedChatMessage[];
  onUnarchive?: (id: string) => void;
}) {
  const [record, setRecord] = useState(activeDialog);
  const noop = () => {};
  const asyncNoop = async () => {};
  const state: UnifiedChatState = {
    messages,
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
    dialogs: [{ id: 'd-1', title: 'Open chat' }],
    activeDialogId,
    activeDialog: record,
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
    dialogCapabilities: {
      fetchArchivedDialogs: () => Promise.resolve({ dialogs: [], nextCursor: null }),
      unarchiveDialog: async id => {
        onUnarchive(id);
        setRecord(current => ({ ...current, archived: false }));
      },
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

describe('EmbeddableChat: a conversation the host reports as archived', () => {
  it('opens read-only, under its own title, with the restore action', async () => {
    render(<Host activeDialogId="a-1" activeDialog={{ id: 'a-1', title: 'User Guide Request', archived: true }} />);

    await screen.findByText(READ_ONLY_BANNER);
    expect(screen.getByText('User Guide Request')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unarchive chat' })).toBeInTheDocument();
  });

  it('stays writable when the record does not say archived', async () => {
    render(<Host activeDialogId="a-1" activeDialog={{ id: 'a-1', title: 'User Guide Request' }} messages={HISTORY} />);

    await screen.findByText('User Guide Request');
    expect(screen.queryByText(READ_ONLY_BANNER)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unarchive chat' })).toBeNull();
  });

  it('ignores a record of another conversation', async () => {
    render(<Host activeDialogId="d-1" activeDialog={{ id: 'a-1', title: 'User Guide Request', archived: true }} />);

    await screen.findByText('Open chat');
    expect(screen.queryByText(READ_ONLY_BANNER)).toBeNull();
  });

  it('restores through the host and leaves read-only mode', async () => {
    const onUnarchive = vi.fn();
    render(
      <Host
        activeDialogId="a-1"
        activeDialog={{ id: 'a-1', title: 'User Guide Request', archived: true }}
        onUnarchive={onUnarchive}
      />,
    );
    await screen.findByText(READ_ONLY_BANNER);

    fireEvent.click(screen.getByRole('button', { name: 'Unarchive chat' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Unarchive Chat' }));

    await waitFor(() => expect(onUnarchive).toHaveBeenCalledWith('a-1'));
    await waitFor(() => expect(screen.queryByText(READ_ONLY_BANNER)).toBeNull());
  });
});
