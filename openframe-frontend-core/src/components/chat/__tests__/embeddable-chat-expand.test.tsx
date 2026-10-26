/**
 * v2, the panel at its minimum (the chat list alone): the |← control widens it
 * back to the list and the chat. The chat opens the conversation open last, or
 * the newest in the list, or a new chat when there is none.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import type { DialogItem } from '../types/component.types';
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

/** A host that owns the active dialog; jsdom measures the panel at 0px, its narrowest. */
function Host({
  dialogs,
  initialDialogId = null,
  onSelect,
  onExpand,
}: {
  dialogs: DialogItem[];
  initialDialogId?: string | null;
  onSelect: (id: string | null) => void;
  onExpand?: () => void;
}) {
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
    dialogs,
    activeDialogId,
    selectDialog: id => {
      onSelect(id);
      setActiveDialogId(id);
    },
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
          onExpand={onExpand}
          mingoState={state}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

const DIALOGS: DialogItem[] = [
  { id: 'd-1', title: 'Newest' },
  { id: 'd-2', title: 'Older' },
];

describe('EmbeddableChat v2: expanding from the chat list', () => {
  it('offers no |← control unless the host can widen its panel', () => {
    render(<Host dialogs={DIALOGS} onSelect={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Expand chat' })).not.toBeInTheDocument();
  });

  it('opens the newest chat when none was open', () => {
    const onSelect = vi.fn();
    const onExpand = vi.fn();
    render(<Host dialogs={DIALOGS} onSelect={onSelect} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));
    expect(onSelect).toHaveBeenLastCalledWith('d-1');
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('brings back the chat open last', () => {
    const onSelect = vi.fn();
    const onExpand = vi.fn();
    render(<Host dialogs={DIALOGS} initialDialogId="d-2" onSelect={onSelect} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show chat list' }));
    expect(onSelect).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));
    expect(onSelect).toHaveBeenLastCalledWith('d-2');
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('starts a new chat when there is none', () => {
    const onSelect = vi.fn();
    const onExpand = vi.fn();
    render(<Host dialogs={[]} onSelect={onSelect} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));
    expect(onSelect).not.toHaveBeenCalledWith(expect.any(String));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
