/**
 * The composer belongs to the conversation on screen — pinned.
 *
 * `ChatInput` is an uncontrolled contenteditable that owns its draft, and the
 * slash-command menu is derived from that draft (`/` at the start keeps it
 * open). The panel already dropped the staged context chips on a dialog
 * change, but the text stayed, so opening another conversation — from the
 * list, or from a notification the host resolves straight into the store —
 * landed with the previous one's half-typed `/` and its menu still open over
 * the new thread. The composer is now keyed on the conversation: leaving one
 * remounts it fresh in the same commit.
 *
 * The one id change that must NOT reset it: a send from the new-chat surface
 * creates the dialog, and the id the panel then lands on is this conversation
 * being named. The editor stays typable while that first turn streams, so a
 * follow-up already being typed has to survive.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Identity + every other authed fetch: a promise that never settles keeps the
// panel offline and free of state updates landing outside `act`.
vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

// One canned command, so `/` opens a real suggestions menu.
vi.mock('../hooks/use-slash-commands', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    fetchSlashCommands: vi.fn(() =>
      Promise.resolve([
        {
          id: 'roadmap',
          label: 'ClickUp Roadmap',
          description: 'Browse the public ClickUp roadmap',
          argumentHint: '[task id or name]',
          actions: [{ id: 'recent', label: 'Recent' }],
        },
      ]),
    ),
  };
});

import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat, type EmbeddableChatHandle } from '../embeddable-chat';
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

/** The injected-state path (`mingoState`): the panel renders this object and
 *  opens no transport, so the test drives `activeDialogId` by re-rendering. */
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
    dialogs: [
      { id: 'd-1', title: 'First' },
      { id: 'd-2', title: 'Second' },
    ],
    activeDialogId: null,
    selectDialog: noop,
    startNewDialog: async () => null,
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

function Harness({ state, handleRef }: { state: UnifiedChatState; handleRef?: React.Ref<EmbeddableChatHandle> }) {
  return (
    <ChatRuntimeContext.Provider value={runtime}>
      <DialogPrimitive.Root open>
        <EmbeddableChat
          ref={handleRef}
          shell="none"
          defaultOpen
          defaultActiveMode="mingo"
          showInternalTrigger={false}
          mingoState={state}
          mingoDialogCapabilities={{ canRename: true, canArchive: true }}
        />
      </DialogPrimitive.Root>
    </ChatRuntimeContext.Provider>
  );
}

function renderPanel(state: UnifiedChatState, handleRef?: React.Ref<EmbeddableChatHandle>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <Harness state={state} handleRef={handleRef} />
    </QueryClientProvider>,
  );
  return {
    ...view,
    rerender: (next: UnifiedChatState) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <Harness state={next} handleRef={handleRef} />
        </QueryClientProvider>,
      ),
  };
}

const editor = () => screen.getByRole('textbox', { name: 'Ask a question...' });

/** Type into the uncontrolled editor the way the browser does: mutate the DOM,
 *  then fire `input` so the component reads it back. */
function type(text: string) {
  const el = editor();
  el.textContent = `${el.textContent ?? ''}${text}`;
  fireEvent.input(el);
}

const menu = () => screen.queryByRole('menu', { name: 'Slash command suggestions' });

beforeEach(() => {
  vi.useRealTimers();
});

describe('EmbeddableChat — the composer belongs to the conversation on screen', () => {
  it('opening another dialog drops the draft and the slash menu it kept open', async () => {
    const { rerender } = renderPanel(createState({ activeDialogId: 'd-1', messages: [MESSAGE] }));

    type('/');
    expect(await screen.findByRole('menu', { name: 'Slash command suggestions' })).toBeInTheDocument();
    expect(editor()).toHaveTextContent('/');

    rerender(createState({ activeDialogId: 'd-2', messages: [MESSAGE] }));

    expect(menu()).not.toBeInTheDocument();
    expect(editor()).toHaveTextContent('');
  });

  it('opening a dialog from the new-chat surface drops the draft typed there', async () => {
    const handle = createRef<EmbeddableChatHandle>();
    const { rerender } = renderPanel(createState({ activeDialogId: null }), handle);
    // Narrow layout: the list has no composer; the compose view does.
    act(() => handle.current?.startNewChat());

    type('/');
    expect(await screen.findByRole('menu', { name: 'Slash command suggestions' })).toBeInTheDocument();

    rerender(createState({ activeDialogId: 'd-1', messages: [MESSAGE] }));

    expect(menu()).not.toBeInTheDocument();
    expect(editor()).toHaveTextContent('');
  });

  it('a new chat being named by its first send keeps the follow-up already being typed', async () => {
    let settleSend: () => void = () => {};
    const sendMessage = vi.fn<UnifiedChatState['sendMessage']>(
      () =>
        new Promise<void>(resolve => {
          settleSend = resolve;
        }),
    );
    const handle = createRef<EmbeddableChatHandle>();
    const { rerender } = renderPanel(createState({ activeDialogId: null, sendMessage }), handle);
    act(() => handle.current?.startNewChat());

    type('first question');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(sendMessage.mock.calls[0]?.[0]).toBe('first question');
    expect(editor()).toHaveTextContent('');

    // The host is creating the dialog; the user is already typing the next one.
    type('and also');
    rerender(createState({ activeDialogId: 'd-new', messages: [MESSAGE], sendMessage }));
    expect(editor()).toHaveTextContent('and also');

    await act(async () => {
      settleSend();
    });
    expect(editor()).toHaveTextContent('and also');

    // A real switch afterwards still resets.
    rerender(createState({ activeDialogId: 'd-1', messages: [MESSAGE], sendMessage }));
    expect(editor()).toHaveTextContent('');
  });
});
