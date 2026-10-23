/**
 * `aboveComposer`: host content pinned between the thread and the composer.
 *
 * A host that walks a new user through the product attaches its tour to one
 * conversation and needs it to stay put while the thread grows - in the
 * thread it would scroll away, under the composer it would push the model row
 * off the panel. The slot sits above the composer, renders wherever the
 * composer does (a conversation, the new-chat surface) and nowhere else, and
 * an absent value leaves the panel exactly as it was.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
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

const MESSAGE: UnifiedChatState['messages'][number] = {
  id: 'm-1',
  role: 'user',
  content: 'hello',
  timestamp: new Date('2026-01-01T00:00:00Z'),
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

function renderPanel(state: UnifiedChatState, aboveComposer?: ReactNode) {
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
            mingoState={state}
            aboveComposer={aboveComposer}
          />
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

const editor = () => screen.getByRole('textbox', { name: 'Ask a question...' });

describe('EmbeddableChat - aboveComposer', () => {
  it('renders the block between the thread and the composer of an open conversation', () => {
    renderPanel(createState({ activeDialogId: 'd-1', messages: [MESSAGE] }), <p>Getting started</p>);

    const block = screen.getByText('Getting started');
    const message = screen.getByText('hello');
    expect(message.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(block.compareDocumentPosition(editor()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('stays off the chat list, where there is no composer', () => {
    renderPanel(createState({ activeDialogId: null }), <p>Getting started</p>);

    expect(screen.queryByText('Getting started')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Ask a question...' })).not.toBeInTheDocument();
  });

  it('leaves the panel as it was when nothing is passed', () => {
    renderPanel(createState({ activeDialogId: 'd-1', messages: [MESSAGE] }));

    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(editor()).toBeInTheDocument();
    expect(screen.queryByTestId('chat-above-composer')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-content-panel')).not.toHaveClass('min-h-32');
  });

  // jsdom has no layout: the classes are the contract. In a short panel the
  // block gives way and the thread keeps room for a line and the working
  // status, which otherwise spilled onto the block.
  it('keeps room for the thread in a short panel: the block shrinks instead', () => {
    renderPanel(createState({ activeDialogId: 'd-1', messages: [MESSAGE] }), <p>Getting started</p>);

    expect(screen.getByTestId('chat-content-panel')).toHaveClass('flex-1', 'min-h-32');
    const slot = screen.getByTestId('chat-above-composer');
    expect(slot).toHaveClass('min-h-0', 'shrink', 'flex', 'flex-col');
    expect(slot).not.toHaveClass('shrink-0');
  });
});
