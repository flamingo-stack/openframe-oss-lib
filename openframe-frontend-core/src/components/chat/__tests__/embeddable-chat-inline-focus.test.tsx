/**
 * Where the composer's focus starts. An opened drawer is a request to type, so
 * its composer takes focus; an inline host's composer is part of the layout and
 * mounts once, on whatever page the session starts on, so it leaves the page's
 * focus alone (and a focused editor's caret keeps an idle WebKit page busy).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat, type EmbeddableChatProps } from '../embeddable-chat';
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

const noop = () => {};
const asyncNoop = async () => {};
const state: UnifiedChatState = {
  messages: [{ id: 'm-1', role: 'user', content: 'hello', timestamp: new Date(0) }],
  isLoading: false,
  streamingPhase: 'idle',
  sendMessage: () => Promise.resolve(),
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

function renderChat(shell: EmbeddableChatProps['shell']) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <EmbeddableChat
          shell={shell}
          appearance="v2"
          defaultOpen
          defaultActiveMode="mingo"
          showInternalTrigger={false}
          mingoState={state}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

describe('EmbeddableChat composer focus on mount', () => {
  it('takes focus in a drawer the user opened', () => {
    renderChat('drawer');
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('leaves the page its focus in an inline host', () => {
    renderChat('inline');
    expect(screen.getByRole('textbox')).not.toHaveFocus();
  });
});
