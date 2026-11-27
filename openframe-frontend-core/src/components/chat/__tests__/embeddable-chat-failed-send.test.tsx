/**
 * A send that fails gives the composer back what it took: the draft and the context staged with it. The engine
 * resolves `false` for any failed send (a refused publish, a Stop before it went out, a stream that failed mid-answer
 * — its own tests pin that); the panel hands that outcome to the composer, which puts the draft back while its box is
 * still empty, and the panel puts the context back first so the draft's chips find their items. Also `composerMaxLength`
 * reaching the composer.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { ChatEngineProvider } from '../engine/chat-engine-context';
import type { ChatContextItem, ChatContextPickerConfig } from '../types/context-item.types';
import type { UnifiedChatState, UnifiedSendMessageOptions } from '../types/unified-chat-state.types';

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
};

const DEVICE: ChatContextItem = { type: 'DEVICE', id: 'dev-1', label: 'Reception PC' };

const PICKER: ChatContextPickerConfig = {
  entityTypes: [{ type: 'DEVICE', label: 'Device', marker: 'device' }],
  renderItems: ({ onToggle }) => (
    <button type="button" onClick={() => onToggle(DEVICE)}>
      Pick {DEVICE.label}
    </button>
  ),
};

const MESSAGE: UnifiedChatState['messages'][number] = {
  id: 'm-1',
  role: 'user',
  metadata: { createdAt: '2026-01-01T00:00:00.000Z' },
  parts: [{ type: 'text', text: 'hello' }],
};

type Send = (text: string, options?: UnifiedSendMessageOptions) => Promise<void | boolean>;

function createState(sendMessage: Send): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: [MESSAGE],
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage,
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
    actions: {},
    dialogTokenUsage: null,
    connectionState: 'connected',
    dialogCapabilities: { canRename: true, canArchive: true },
  };
}

function renderPanel(sendMessage: Send, extra: { composerMaxLength?: number } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <DialogPrimitive.Root open>
          <ChatEngineProvider engine={createState(sendMessage)}>
            <EmbeddableChat
              shell="none"
              defaultOpen
              defaultActiveMode="mingo"
              showInternalTrigger={false}
              contextPicker={PICKER}
              {...extra}
            />
          </ChatEngineProvider>
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

const editor = () => screen.getByRole('textbox', { name: 'Ask a question...' });

/** Type the way the browser does: mutate the DOM, then fire `input` so the editor reads it back. */
function type(text: string) {
  const el = editor();
  el.textContent = `${el.textContent ?? ''}${text}`;
  fireEvent.input(el);
}

function send() {
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
}

/** Stage the device through the `+` picker: Add context → Assign Item → Device → the host's row. */
async function stageDevice() {
  fireEvent.click(screen.getByRole('button', { name: 'Add context' }));
  const picker = await screen.findByRole('dialog', { name: 'Add context' });
  fireEvent.click(within(picker).getByText('Assign Item'));
  fireEvent.click(within(picker).getByText('Device'));
  fireEvent.click(await screen.findByRole('button', { name: `Pick ${DEVICE.label}` }));
}

/** The staged item's chip in the strip over the editor. */
const stagedChip = () => screen.queryAllByLabelText(`Context ${DEVICE.label}`);

describe('EmbeddableChat — a failed send gives the composer back what it took', () => {
  it('puts the draft back when the send resolves false', async () => {
    const sendMessage = vi.fn<Send>(() => Promise.resolve(false));
    renderPanel(sendMessage);
    type('restart the print spooler');
    send();
    expect(sendMessage).toHaveBeenCalledWith('restart the print spooler', {});
    await waitFor(() => expect(editor()).toHaveTextContent('restart the print spooler'));
  });

  it('puts the staged context back with it, and the next send carries it again', async () => {
    const sendMessage = vi.fn<Send>().mockResolvedValueOnce(false).mockResolvedValue(true);
    renderPanel(sendMessage);
    await stageDevice();
    await waitFor(() => expect(stagedChip()).not.toHaveLength(0));
    type('why is it offline');
    send();
    expect(sendMessage).toHaveBeenLastCalledWith('why is it offline', { contextItems: [DEVICE] });
    await waitFor(() => expect(editor()).toHaveTextContent('why is it offline'));
    expect(stagedChip()).not.toHaveLength(0);

    send();
    expect(sendMessage).toHaveBeenLastCalledWith('why is it offline', { contextItems: [DEVICE] });
  });

  it('clears the draft and the context when the send goes out', async () => {
    const sendMessage = vi.fn<Send>(() => Promise.resolve(true));
    renderPanel(sendMessage);
    await stageDevice();
    type('why is it offline');
    send();
    await act(async () => {
      await Promise.resolve();
    });
    expect(editor()).toHaveTextContent('');
    expect(stagedChip()).toHaveLength(0);
  });

  it('a send whose adapter settles with no outcome (void) is not a failure', async () => {
    const sendMessage = vi.fn<Send>(() => Promise.resolve());
    renderPanel(sendMessage);
    type('hello');
    send();
    await act(async () => {
      await Promise.resolve();
    });
    expect(editor()).toHaveTextContent('');
  });

  it('a rejected send is a failure: the draft comes back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sendMessage = vi.fn<Send>(() => Promise.reject(new Error('publish refused')));
    renderPanel(sendMessage);
    type('hello');
    send();
    await waitFor(() => expect(editor()).toHaveTextContent('hello'));
  });

  it('a send that fails late (a stream failing mid-answer) never overwrites a new draft, nor brings its context back', async () => {
    let fail!: () => void;
    const sendMessage = vi.fn<Send>(
      () =>
        new Promise<boolean>(resolve => {
          fail = () => resolve(false);
        }),
    );
    renderPanel(sendMessage);
    await stageDevice();
    type('first question');
    send();
    expect(editor()).toHaveTextContent('');
    type('second question');
    await act(async () => {
      fail();
      await Promise.resolve();
    });
    expect(editor()).toHaveTextContent('second question');
    expect(editor()).not.toHaveTextContent('first question');
    expect(stagedChip()).toHaveLength(0);
  });

  it('passes composerMaxLength to the composer: over it Send is off', () => {
    const sendMessage = vi.fn<Send>(() => Promise.resolve(true));
    renderPanel(sendMessage, { composerMaxLength: 10 });
    type('a'.repeat(11));
    expect(screen.getByRole('status')).toHaveTextContent('Messages can be up to 10 characters');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });
});
