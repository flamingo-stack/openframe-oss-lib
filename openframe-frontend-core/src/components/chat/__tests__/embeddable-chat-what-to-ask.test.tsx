/**
 * The v2 list's "What to ask?" is the `/what-can-you-do` slash command. The entry is the command catalog's: shown only
 * when the chat's commands list it, under the command's label. A click opens a new chat - never the open conversation -
 * and sends the command there; the server answers it as a turn. A suggestion chip in that answer sends its prompt through
 * the panel. The ⋯ menu takes the host's extra items after the chat's own.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, type Ref, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** What the chat's command catalog lists (`commandsUrl`), per test. */
let catalog: unknown[] = [];
vi.mock('../../../utils/embed-authed-fetch', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  embedAuthedFetch: vi.fn((url: string) =>
    String(url).includes('/api/docs/commands')
      ? Promise.resolve(new Response(JSON.stringify({ commands: catalog })))
      : new Promise(() => {}),
  ),
}));

import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { WHAT_CAN_YOU_DO_COMMAND, WHAT_CAN_YOU_DO_MESSAGE } from '../../../chat-protocol/what-can-you-do';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat, type EmbeddableChatHandle } from '../embeddable-chat';
import { ChatEngineProvider } from '../engine/chat-engine-context';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    // Absolute: this test's page has no origin to resolve a relative address against.
    commandsUrl: 'https://hub.test/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
};

const COMMAND = {
  id: WHAT_CAN_YOU_DO_COMMAND,
  label: 'What can you do?',
  description: 'Every quick action.',
  actions: [],
};

const HELLO: ChatMessage = {
  id: 'm-1',
  role: 'user',
  metadata: { createdAt: new Date(0).toISOString() },
  parts: [{ type: 'text', text: 'hello' }],
};

/** The server's answer to the command, as a stored turn: a line and the chips. */
const ANSWER: ChatMessage = {
  id: 'm-2',
  role: 'assistant',
  metadata: { createdAt: new Date(1).toISOString() },
  parts: [
    { type: 'text', text: 'Here is what you can ask me.' },
    {
      type: 'data-suggestions',
      data: { groups: [{ label: 'Check', prompts: [{ label: 'Which devices went offline today?' }] }] },
    },
  ],
};

/** A host that owns the dialogs; a send from a new chat creates `d-new`. */
function Host({
  initialDialogId = null,
  onReset,
  onSend,
  onAdapterSend,
  locked = false,
  openChat = [HELLO],
  busy = false,
  onWhatToAsk,
  handleRef,
}: {
  initialDialogId?: string | null;
  onReset?: () => void;
  onSend?: (text: string) => void;
  /** The adapter's own `actions`: nothing in the panel may reach past the panel's send to them. */
  onAdapterSend?: (text: string) => void;
  /** The chat cannot take a message. */
  locked?: boolean;
  /** What the open chat `d-1` holds. */
  openChat?: ChatMessage[];
  /** A turn is running in the open chat. */
  busy?: boolean;
  /** The host's own "What to ask?" surface. */
  onWhatToAsk?: () => void;
  handleRef?: Ref<EmbeddableChatHandle>;
}) {
  const [activeDialogId, setActiveDialogId] = useState<string | null>(initialDialogId);
  const [sent, setSent] = useState<ChatMessage[]>([]);
  const noop = () => {};
  const adapterSend = (text: string) => {
    onAdapterSend?.(text);
  };
  const asyncNoop = async () => {};
  const state: UnifiedChatState = {
    messages: activeDialogId === 'd-1' ? openChat : activeDialogId === 'd-new' ? sent : [],
    isLoading: busy && activeDialogId === 'd-1',
    streamingPhase: 'idle',
    sendMessage: text => {
      onSend?.(text);
      setSent([{ id: 'sent', role: 'user', parts: [{ type: 'text', text: text }] }]);
      setActiveDialogId(current => current ?? 'd-new');
      return Promise.resolve();
    },
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
    dialogs: [{ id: 'd-1', title: 'First' }, ...(activeDialogId === 'd-new' ? [{ id: 'd-new', title: 'Sent' }] : [])],
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
    // What every real adapter hands the thread: a send that knows nothing of the panel's lock.
    actions: {
      selectAsk: adapterSend,
      pickSuggestion: adapterSend,
    },
    dialogTokenUsage: null,
    connectionState: 'connected',
    dialogCapabilities: {
      canRename: true,
      fetchArchivedDialogs: () => Promise.resolve({ dialogs: [], nextCursor: null }),
    },
  };
  return (
    <ChatEngineProvider engine={state}>
      <EmbeddableChat
        ref={handleRef}
        shell="inline"
        appearance="v2"
        defaultOpen
        defaultActiveMode="mingo"
        showInternalTrigger={false}

        composerLock={locked ? { placeholder: 'Out of balance' } : null}
        onWhatToAsk={onWhatToAsk}
        chatMenuExtraItems={onReset ? [{ id: 'reset', label: 'Reset Onboarding', onClick: onReset }] : undefined}
      />
    </ChatEngineProvider>
  );
}

function renderHost(props: Parameters<typeof Host>[0] = {}, chatRuntime: ChatRuntime = runtime) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={chatRuntime}>
        <Host {...props} />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

const entry = () => screen.findByRole('button', { name: COMMAND.label });
const currentRows = () =>
  screen
    .getAllByRole('button')
    .filter(button => button.getAttribute('aria-current') === 'true')
    .map(button => button.textContent);

describe('EmbeddableChat - What to ask', () => {
  // Wide enough for the list beside the chat (jsdom measures 0 otherwise).
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1400);
    catalog = [COMMAND];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a new chat and sends the command there, not in the open conversation', async () => {
    const onSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', onSend });

    fireEvent.click(await entry());

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(WHAT_CAN_YOU_DO_MESSAGE));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });

  it('shows no entry when the catalog lists no such command', async () => {
    catalog = [{ id: 'blogs', label: 'Blogs', description: 'Blog posts.', actions: [] }];
    renderHost({ initialDialogId: 'd-1' });

    await screen.findByRole('button', { name: 'Chat Archive' });
    await waitFor(() => expect(screen.queryByRole('button', { name: COMMAND.label })).not.toBeInTheDocument());
  });

  it('sends the command from a new chat while a turn runs in the open one', async () => {
    const onSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', busy: true, onSend });

    fireEvent.click(await entry());

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(WHAT_CAN_YOU_DO_MESSAGE));
  });

  it('opens a new chat from the archive list, not into the chat open before it', async () => {
    const onSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', onSend });

    fireEvent.click(screen.getByRole('button', { name: 'Chat Archive' }));
    await screen.findAllByText(/archived/i);
    fireEvent.click(await entry());

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(WHAT_CAN_YOU_DO_MESSAGE));
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });

  it('sends a picked chip of the answer through the panel, not past it to the adapter', async () => {
    const onSend = vi.fn();
    const onAdapterSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', openChat: [HELLO, ANSWER], onSend, onAdapterSend });

    fireEvent.click(await screen.findByRole('button', { name: 'Which devices went offline today?' }));

    expect(onSend).toHaveBeenCalledWith('Which devices went offline today?');
    expect(onAdapterSend).not.toHaveBeenCalled();
  });

  it('does not send a picked chip while the chat cannot take a message', async () => {
    const onSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', openChat: [HELLO, ANSWER], onSend, locked: true });

    fireEvent.click(await screen.findByRole('button', { name: 'Which devices went offline today?' }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("lists the host's extra items after the chat's own in the ⋯ menu", () => {
    const onReset = vi.fn();
    renderHost({ initialDialogId: 'd-1', onReset });

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Chat actions' }), { button: 0, pointerType: 'mouse' });
    const items = screen.getAllByRole('menuitem').map(item => item.textContent);
    expect(items[items.length - 1]).toBe('Reset Onboarding');
    expect(items).toContain('Rename Chat');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reset Onboarding' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("hands the list's entry to the host's own page when it has one", async () => {
    const onSend = vi.fn();
    const onWhatToAsk = vi.fn();
    renderHost({ initialDialogId: 'd-1', onSend, onWhatToAsk });

    fireEvent.click(await entry());

    expect(onWhatToAsk).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("runs the command from the handle (the host's page), even when the host takes the entry", async () => {
    const handle = createRef<EmbeddableChatHandle>();
    const onSend = vi.fn();
    const onWhatToAsk = vi.fn();
    renderHost({ initialDialogId: 'd-1', handleRef: handle, onSend, onWhatToAsk });

    act(() => handle.current?.showWhatToAsk());

    await waitFor(() => expect(onSend).toHaveBeenCalledWith(WHAT_CAN_YOU_DO_MESSAGE));
    expect(onWhatToAsk).not.toHaveBeenCalled();
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    expect(currentRows()).not.toContain('First');
  });
});
