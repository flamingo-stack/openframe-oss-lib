/**
 * `EmbeddableChatHandle.openContextPicker`: a host's own entry to the composer's
 * context picker ("+ Add context" in its context strip) opens it as the `+` does,
 * and does nothing where the chat has no picker.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat, type EmbeddableChatHandle } from '../embeddable-chat';
import type { ChatContextPickerConfig } from '../types/context-item.types';
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

const PICKER: ChatContextPickerConfig = {
  entityTypes: [{ type: 'DEVICE', label: 'Device', marker: 'device' }],
  renderItems: () => null,
};

function newChatState(): UnifiedChatState {
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
    approveRequest: asyncNoop,
    rejectRequest: asyncNoop,
    dialogTokenUsage: null,
    connectionState: 'connected',
  };
}

function renderChat(contextPicker: ChatContextPickerConfig | undefined) {
  const handle = createRef<EmbeddableChatHandle>();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <EmbeddableChat
          ref={handle}
          shell="inline"
          appearance="v2"
          closable={false}
          open
          onOpenChange={vi.fn()}
          defaultActiveMode="mingo"
          showInternalTrigger={false}
          mingoState={newChatState()}
          contextPicker={contextPicker}
          rail="none"
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
  return handle;
}

describe('EmbeddableChatHandle.openContextPicker', () => {
  it('opens the context picker, as the composer + does', () => {
    const handle = renderChat(PICKER);
    expect(screen.queryByRole('dialog', { name: 'Add context' })).not.toBeInTheDocument();

    act(() => handle.current?.openContextPicker());

    expect(screen.getByRole('dialog', { name: 'Add context' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add context' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('does nothing in a chat without a picker', () => {
    const handle = renderChat(undefined);

    act(() => handle.current?.openContextPicker());

    expect(screen.queryByRole('dialog', { name: 'Add context' })).not.toBeInTheDocument();
  });
});
