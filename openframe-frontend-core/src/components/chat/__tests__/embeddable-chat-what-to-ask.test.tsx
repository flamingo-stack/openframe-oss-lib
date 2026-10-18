/**
 * `whatToAsk`: the v2 list's "What to ask Mingo?" answered in the panel.
 *
 * With a conversation open the exchange is added at its end; with none a new
 * chat opens holding it, and the send from there keeps it in the dialog the
 * send creates. A chip sends its prompt in that chat, like a quick action.
 * The ⋯ menu takes the host's extra items after the chat's own.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import type { WhatToAskContent } from '../hooks/use-what-to-ask';
import type { UnifiedChatMessage, UnifiedChatState } from '../types/unified-chat-state.types';

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

const WHAT_TO_ASK: WhatToAskContent = {
  question: 'What can I ask you?',
  reply: 'Describe the outcome you want.',
  groups: [{ label: 'Check', prompts: [{ label: 'Which devices went offline today?' }] }],
  note: 'A note under the chips.',
};

const HELLO: UnifiedChatMessage = { id: 'm-1', role: 'user', content: 'hello', timestamp: new Date(0) };

/** A host that owns the dialogs; a send from a new chat creates `d-new`. */
function Host({
  initialDialogId = null,
  onReset,
  onSend,
  openChat = [HELLO],
  busy = false,
  whatToAsk = WHAT_TO_ASK,
}: {
  initialDialogId?: string | null;
  onReset?: () => void;
  onSend?: (text: string) => void;
  /** What the open chat `d-1` holds. */
  openChat?: UnifiedChatMessage[];
  /** A turn is running in the open chat. */
  busy?: boolean;
  whatToAsk?: WhatToAskContent | (() => Promise<WhatToAskContent>);
}) {
  const [activeDialogId, setActiveDialogId] = useState<string | null>(initialDialogId);
  const [sent, setSent] = useState<UnifiedChatMessage[]>([]);
  const noop = () => {};
  const asyncNoop = async () => {};
  const state: UnifiedChatState = {
    messages: activeDialogId === 'd-1' ? openChat : activeDialogId === 'd-new' ? sent : [],
    isLoading: busy && activeDialogId === 'd-1',
    streamingPhase: 'idle',
    sendMessage: text => {
      onSend?.(text);
      setSent([{ id: 'sent', role: 'user', content: text, timestamp: new Date() }]);
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
    approveRequest: asyncNoop,
    rejectRequest: asyncNoop,
    dialogTokenUsage: null,
    connectionState: 'connected',
  };
  return (
    <EmbeddableChat
      shell="inline"
      appearance="v2"
      defaultOpen
      defaultActiveMode="mingo"
      showInternalTrigger={false}
      mingoState={state}
      mingoDialogCapabilities={{
        canRename: true,
        fetchArchivedDialogs: () => Promise.resolve({ dialogs: [], nextCursor: null }),
      }}
      whatToAsk={whatToAsk}
      chatMenuExtraItems={onReset ? [{ id: 'reset', label: 'Reset Onboarding', onClick: onReset }] : undefined}
    />
  );
}

function renderHost(props: Parameters<typeof Host>[0] = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <Host {...props} />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

const whatToAsk = () => screen.getByRole('button', { name: 'What to ask Mingo?' });
const editor = () => screen.getByRole('textbox');

describe('EmbeddableChat - whatToAsk', () => {
  // Wide enough for the list beside the chat (jsdom measures 0 otherwise).
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1400);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds the exchange at the end of the open conversation', () => {
    renderHost({ initialDialogId: 'd-1' });

    fireEvent.click(whatToAsk());

    const hello = screen.getByText('hello');
    const question = screen.getByText('What can I ask you?');
    expect(hello.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Describe the outcome you want.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Which devices went offline today?' })).toBeInTheDocument();
  });

  it('opens a new chat with the exchange when no conversation is open', () => {
    renderHost();

    fireEvent.click(whatToAsk());

    expect(screen.getByText('What can I ask you?')).toBeInTheDocument();
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    // The list keeps the new chat as the active row.
    const active = screen.getAllByRole('button').filter(button => button.getAttribute('aria-current') === 'true');
    expect(active.map(button => button.textContent)).toEqual(['New Chat']);
  });

  it('sends a picked prompt in the open chat and leaves the composer alone', () => {
    const onSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', onSend });

    fireEvent.click(whatToAsk());
    fireEvent.click(screen.getByRole('button', { name: 'Which devices went offline today?' }));

    expect(onSend).toHaveBeenCalledWith('Which devices went offline today?');
    expect(editor()).toHaveTextContent('');
  });

  it('keeps a new chat exchange in the dialog a picked prompt creates', async () => {
    renderHost();

    fireEvent.click(whatToAsk());
    fireEvent.click(screen.getByRole('button', { name: 'Which devices went offline today?' }));

    // The send went out and made its dialog (it is in the list now).
    expect((await screen.findAllByText('Sent')).length).toBeGreaterThan(0);
    expect(screen.getByText('What can I ask you?')).toBeInTheDocument();
  });

  it('opens a new chat from the archive list, not into the chat open before it', async () => {
    renderHost({ initialDialogId: 'd-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Chat Archive' }));
    // The archive list is up (the chat open before it is still the active dialog).
    await screen.findAllByText(/archived/i);
    fireEvent.click(whatToAsk());

    expect(await screen.findByText('What can I ask you?')).toBeInTheDocument();
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    const active = screen.getAllByRole('button').filter(button => button.getAttribute('aria-current') === 'true');
    expect(active.map(button => button.textContent)).toEqual(['New Chat']);
  });

  it('opens a new chat instead when the open one waits on an approval', () => {
    const pendingApproval: UnifiedChatMessage = {
      id: 'm-2',
      role: 'assistant',
      content: '',
      segments: [
        {
          type: 'approval_request',
          data: { requestId: 'r-1', command: 'restart spooler', explanation: 'Restart it', approvalType: 'COMMAND' },
        },
      ],
      timestamp: new Date(1),
    };
    renderHost({ initialDialogId: 'd-1', openChat: [HELLO, pendingApproval] });

    fireEvent.click(whatToAsk());

    expect(screen.getByText('What can I ask you?')).toBeInTheDocument();
    expect(screen.queryByText('hello')).not.toBeInTheDocument();
  });

  it('opens a new chat instead while a turn runs in the open one, and a chip there sends', () => {
    const onSend = vi.fn();
    renderHost({ initialDialogId: 'd-1', busy: true, onSend });

    fireEvent.click(whatToAsk());

    expect(screen.queryByText('hello')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Which devices went offline today?' }));
    expect(onSend).toHaveBeenCalledWith('Which devices went offline today?');
  });

  it('waits for an async whatToAsk and shows the exchange whole, once per pending click', async () => {
    let settle: (content: WhatToAskContent) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<WhatToAskContent>(resolve => {
          settle = resolve;
        }),
    );
    renderHost({ initialDialogId: 'd-1', whatToAsk: load });

    fireEvent.click(whatToAsk());
    fireEvent.click(whatToAsk());
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('What can I ask you?')).not.toBeInTheDocument();

    settle({ ...WHAT_TO_ASK, reply: 'Live devices:' });

    expect(await screen.findByText('Live devices:')).toBeInTheDocument();
    expect(screen.getAllByText('What can I ask you?')).toHaveLength(1);
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
});
