/**
 * A shell that keeps ONE chat mounted for the whole session splits it: the
 * composer stays where the panel is mounted (a dock under every page), the
 * header + thread portal into the chat page's node (`threadContainer`), or
 * render nowhere (`null`). The composer must survive the container coming and
 * going — draft, staged context and all — and a host that owns the chat list
 * (`rail="none"`) must never see the panel's own list.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Identity + every other authed fetch: a promise that never settles keeps the
// panel offline and free of state updates landing outside `act`.
vi.mock('../../../utils/embed-authed-fetch', () => ({
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat, type EmbeddableChatHandle, type EmbeddableChatProps } from '../embeddable-chat';
import type { DialogItem } from '../types/component.types';
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

const DIALOG: DialogItem = {
  id: 'd-1',
  title: 'Exchange migration',
  timestamp: new Date(),
  owner: { name: 'Roman Smith' },
};

const MESSAGES: UnifiedChatState['messages'] = [
  { id: 'm-1', role: 'user', content: 'hello there', timestamp: new Date('2026-01-01T00:00:00Z') },
  { id: 'm-2', role: 'assistant', content: 'Hi, how can I help?', timestamp: new Date('2026-01-01T00:00:01Z') },
];

const PICKER: ChatContextPickerConfig = {
  entityTypes: [{ type: 'DEVICE', label: 'Device', marker: 'device' }],
  renderItems: () => null,
};
const DEVICE = { type: 'DEVICE', id: 'machine-7', label: 'ELK-PROD-07' };

/** The injected-state path (`mingoState`): no transport, the test drives it. */
function createState(overrides: Partial<UnifiedChatState> = {}): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: MESSAGES,
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage: asyncNoop,
    stopMessage: noop,
    clearMessages: noop,
    discussRef: noop,
    displayRef: noop,
    currentProvider: 'anthropic',
    currentModelLabel: 'Claude Opus',
    currentContextWindowMaxTokens: 50000,
    currentInputTokens: 300,
    currentOutputTokens: 72,
    currentCacheHitRatePct: null,
    currentUsageBreakdown: null,
    dialogs: [DIALOG, { id: 'd-2', title: 'Second' }],
    activeDialogId: 'd-1',
    activeDialog: DIALOG,
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

type ChatProps = Partial<EmbeddableChatProps>;

function renderChat(
  state: UnifiedChatState,
  props: ChatProps = {},
  handleRef?: React.Ref<EmbeddableChatHandle>,
): { rerender: (props: ChatProps) => void } {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (p: ChatProps) => (
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <EmbeddableChat
          ref={handleRef}
          shell="inline"
          appearance="v2"
          closable={false}
          open
          onOpenChange={vi.fn()}
          defaultActiveMode="mingo"
          showInternalTrigger={false}
          mingoState={state}
          mingoDialogCapabilities={{ canRename: true, canArchive: true }}
          {...p}
        />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
  const view = render(tree(props));
  return { rerender: next => view.rerender(tree(next)) };
}

/** The chat page's node the thread portals into. */
function pageNode(): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('data-testid', 'chat-page');
  document.body.appendChild(node);
  return node;
}

const editor = (name = 'Enter your Request...') => screen.getByRole('textbox', { name });

/** Type into the uncontrolled editor the way the browser does. */
function type(text: string) {
  const el = editor();
  el.textContent = `${el.textContent ?? ''}${text}`;
  fireEvent.input(el);
}

function openMenu(name: string) {
  fireEvent.pointerDown(screen.getByRole('button', { name }), { button: 0, pointerType: 'mouse' });
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('EmbeddableChat split: composer only (threadContainer null)', () => {
  it('renders the composer and no header or thread', () => {
    renderChat(createState(), { threadContainer: null });

    expect(editor()).toBeInTheDocument();
    expect(screen.queryByText('hello there')).not.toBeInTheDocument();
    expect(screen.queryByText('Exchange migration')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chat actions' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mingo chats')).not.toBeInTheDocument();
  });

  it('takes a placeholder from the host', () => {
    renderChat(createState(), { threadContainer: null, composerPlaceholder: 'Ask Mingo or describe a task…' });
    expect(editor('Ask Mingo or describe a task…')).toBeInTheDocument();
  });
});

describe('EmbeddableChat split: thread portalled into the page', () => {
  it('renders the header and the thread into the container, the composer in place', () => {
    const page = pageNode();
    renderChat(createState(), { threadContainer: page });

    expect(within(page).getByText('hello there')).toBeInTheDocument();
    expect(within(page).getByText('Exchange migration')).toBeInTheDocument();
    expect(page.contains(editor())).toBe(false);
  });

  it("lays the thread's column out with the host's class; the column fills the container without one", () => {
    const page = pageNode();
    const { rerender } = renderChat(createState(), { threadContainer: page });
    // jsdom has no layout: the class is the contract.
    expect(page.innerHTML).not.toContain('max-w-[760px]');
    rerender({ threadContainer: page, threadContentClassName: 'mx-auto max-w-[760px]' });
    expect(within(page).getByText('hello there')).toBeInTheDocument();
    expect(page.innerHTML).toContain('mx-auto max-w-[760px]');
  });

  it("loads the thread in the host's column, where its messages will land", () => {
    const page = pageNode();
    renderChat(createState({ messages: [], isMessagesLoading: true }), {
      threadContainer: page,
      threadContentClassName: 'mx-auto max-w-[760px]',
    });
    expect(within(page).getByText('Loading messages')).toBeInTheDocument();
    expect(page.innerHTML).toContain('mx-auto max-w-[760px]');
  });

  it('draws the page header: title, "· owner · day", ⋯ — nothing that closes, collapses or toggles a list', () => {
    const page = pageNode();
    renderChat(createState(), { threadContainer: page, onCollapse: vi.fn(), onExpand: vi.fn(), closable: true });

    expect(within(page).getByText('· Roman Smith · Today')).toBeInTheDocument();
    expect(within(page).getByRole('button', { name: 'Chat actions' })).toBeInTheDocument();
    for (const name of ['Close', 'Collapse chat', 'Expand chat', 'Show chat list', 'Hide chat list']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it("puts Compact in the header's ⋯, before Archive, and the host's items in the composer's", () => {
    const page = pageNode();
    const compact = vi.fn();
    const hostItem = vi.fn();
    renderChat(createState(), {
      threadContainer: page,
      mingoDialogCapabilities: { canRename: true, canArchive: true, compactDialog: compact },
      composerMenuItems: [{ id: 'host', label: 'Host Action', onClick: hostItem }],
    });

    openMenu('Chat actions');
    const headerItems = screen.getAllByRole('menuitem').map(item => item.textContent);
    expect(headerItems).toEqual(['Rename Chat', 'Compact Chat Memory', 'Archive Chat']);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Compact Chat Memory' }));
    expect(compact).toHaveBeenCalledWith(expect.objectContaining({ id: 'd-1' }));

    openMenu('Composer actions');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Host Action' }));
    expect(hostItem).toHaveBeenCalledTimes(1);
  });
});

describe('EmbeddableChat split: the container comes and goes', () => {
  it('keeps the draft — the same editor, still holding it', () => {
    const page = pageNode();
    const { rerender } = renderChat(createState(), { threadContainer: page });
    type('half-typed question');
    const before = editor();

    rerender({ threadContainer: null });
    expect(within(page).queryByText('hello there')).not.toBeInTheDocument();
    expect(editor()).toBe(before);
    expect(editor()).toHaveTextContent('half-typed question');

    const nextPage = pageNode();
    rerender({ threadContainer: nextPage });
    expect(within(nextPage).getByText('hello there')).toBeInTheDocument();
    expect(editor()).toBe(before);
    expect(editor()).toHaveTextContent('half-typed question');
  });

  it('keeps the staged context items', () => {
    const page = pageNode();
    const handle = createRef<EmbeddableChatHandle>();
    const { rerender } = renderChat(
      createState({ messages: [], activeDialogId: null, activeDialog: null }),
      { threadContainer: page, contextPicker: PICKER },
      handle,
    );
    act(() => handle.current?.prefillDraft({ text: 'why is it slow?', mentions: [DEVICE] }));
    expect(screen.getByRole('group', { name: 'Context ELK-PROD-07' })).toBeInTheDocument();

    rerender({ threadContainer: null, contextPicker: PICKER });
    expect(screen.getByRole('group', { name: 'Context ELK-PROD-07' })).toBeInTheDocument();
    expect(editor()).toHaveTextContent('why is it slow?');

    rerender({ threadContainer: pageNode(), contextPicker: PICKER });
    expect(screen.getByRole('group', { name: 'Context ELK-PROD-07' })).toBeInTheDocument();
    expect(editor()).toHaveTextContent('why is it slow?');
  });
});

describe('EmbeddableChat rail="none": the host owns the chat list', () => {
  // jsdom lays nothing out; a wide panel is what puts the rail beside the chat.
  const widen = () => vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1600);

  it('draws the rail at a wide width by default (control)', () => {
    widen();
    renderChat(createState());
    expect(screen.getByLabelText('Mingo chats')).toBeInTheDocument();
  });

  it('never draws the rail at a wide width', () => {
    widen();
    renderChat(createState(), { rail: 'none' });
    expect(screen.queryByLabelText('Mingo chats')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show chat list' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hide chat list' })).not.toBeInTheDocument();
    expect(screen.getByText('hello there')).toBeInTheDocument();
  });

  it('shows a new chat, not a list, with nothing open', () => {
    renderChat(createState({ messages: [], activeDialogId: null, activeDialog: null }), { rail: 'none' });
    expect(screen.queryByLabelText('Mingo chats')).not.toBeInTheDocument();
    expect(editor()).toBeInTheDocument();
  });
});

describe('EmbeddableChat: the model row', () => {
  it('is under the composer by default', () => {
    renderChat(createState(), { threadContainer: null });
    expect(screen.getByText('Claude Opus')).toBeInTheDocument();
  });

  it('is left out with showModel={false}', () => {
    renderChat(createState(), { threadContainer: null, showModel: false });
    expect(screen.queryByText('Claude Opus')).not.toBeInTheDocument();
    expect(screen.queryByText(/tokens used/)).not.toBeInTheDocument();
  });

  it('makes the model name a button with onModelClick', () => {
    const onModelClick = vi.fn();
    renderChat(createState(), {
      threadContainer: null,
      onModelClick,
      modelTooltip: 'Change in Settings → AI Settings',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Claude Opus' }));
    expect(onModelClick).toHaveBeenCalledTimes(1);
  });
});

describe('EmbeddableChat renameMode="inline"', () => {
  function startRename(renameDialog = vi.fn(async () => {})) {
    const page = pageNode();
    renderChat(createState({ renameDialog }), { threadContainer: page, renameMode: 'inline' });
    openMenu('Chat actions');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename Chat' }));
    return { field: screen.getByRole<HTMLInputElement>('textbox', { name: 'Chat name' }), renameDialog };
  }

  it('turns the title into a field with its text selected', () => {
    const { field } = startRename();
    expect(field).toHaveValue('Exchange migration');
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe('Exchange migration'.length);
    // No modal on the way.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('saves on Enter', () => {
    const { field, renameDialog } = startRename();
    fireEvent.change(field, { target: { value: '  Exchange cutover  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(renameDialog).toHaveBeenCalledWith('d-1', 'Exchange cutover');
    expect(screen.queryByRole('textbox', { name: 'Chat name' })).not.toBeInTheDocument();
  });

  it('cancels on Escape', () => {
    const { field, renameDialog } = startRename();
    fireEvent.change(field, { target: { value: 'Something else' } });
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(renameDialog).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Chat name' })).not.toBeInTheDocument();
    expect(screen.getByText('Exchange migration')).toBeInTheDocument();
  });

  it('saves on blur, once', () => {
    const { field, renameDialog } = startRename();
    fireEvent.change(field, { target: { value: 'Exchange cutover' } });
    fireEvent.blur(field);
    fireEvent.blur(field);
    expect(renameDialog).toHaveBeenCalledTimes(1);
    expect(renameDialog).toHaveBeenCalledWith('d-1', 'Exchange cutover');
  });

  it('saves nothing for an empty or unchanged title', () => {
    const { field, renameDialog } = startRename();
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(renameDialog).not.toHaveBeenCalled();
    expect(screen.getByText('Exchange migration')).toBeInTheDocument();
  });
});

describe('EmbeddableChat safeAreaBottom', () => {
  // The composer's root carries the inset inline; nothing else in a lone composer does.
  const insetInMarkup = () => document.body.innerHTML.includes('safe-area-inset-bottom');

  it('clears the bottom safe-area inset by default', () => {
    renderChat(createState(), { threadContainer: null });
    expect(insetInMarkup()).toBe(true);
  });

  it('leaves it to the host layout with safeAreaBottom={false}', () => {
    renderChat(createState(), { threadContainer: null, safeAreaBottom: false });
    expect(editor()).toBeInTheDocument();
    expect(insetInMarkup()).toBe(false);
  });
});

describe('EmbeddableChat onDialogCreated', () => {
  /** A send from no dialog, left in flight: the host is creating the dialog. */
  function startNewChatSend(onDialogCreated: (id: string) => void) {
    const sendMessage = vi.fn<UnifiedChatState['sendMessage']>(() => new Promise<void>(() => {}));
    const empty = { messages: [], activeDialogId: null, activeDialog: null, sendMessage };
    const props: ChatProps = { threadContainer: null, onDialogCreated };
    const view = renderChat(createState(empty), props);
    type('check the backups');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(sendMessage).toHaveBeenCalledTimes(1);
    return {
      land: (id: string) =>
        view.rerender({
          ...props,
          mingoState: createState({ activeDialogId: id, activeDialog: { id, title: '' }, sendMessage }),
        }),
    };
  }

  it('tells the host the id a send created, once', () => {
    const onDialogCreated = vi.fn();
    const send = startNewChatSend(onDialogCreated);
    expect(onDialogCreated).not.toHaveBeenCalled();
    send.land('d-new');
    expect(onDialogCreated).toHaveBeenCalledExactlyOnceWith('d-new');
    // Later switches are no creation.
    send.land('d-1');
    expect(onDialogCreated).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when an existing dialog is opened', () => {
    const onDialogCreated = vi.fn();
    const empty = createState({ messages: [], activeDialogId: null, activeDialog: null });
    const { rerender } = renderChat(empty, { threadContainer: null, onDialogCreated });
    rerender({ threadContainer: null, onDialogCreated, mingoState: createState() });
    expect(onDialogCreated).not.toHaveBeenCalled();
  });
});

describe('EmbeddableChat composerPreviewText', () => {
  const ghost = () => screen.queryByText('Find devices with less than 10% free disk');

  it('shows the host’s preview as ghost text in the composer, and drops it when cleared', () => {
    const empty = createState({ messages: [], activeDialogId: null, activeDialog: null });
    const { rerender } = renderChat(empty, {
      threadContainer: null,
      composerPreviewText: 'Find devices with less than 10% free disk',
    });
    expect(ghost()).toBeInTheDocument();
    expect(editor()).toHaveTextContent('');

    rerender({ threadContainer: null, composerPreviewText: null });
    expect(ghost()).not.toBeInTheDocument();
  });

  it('gives way to typing, as the chip hover preview does', () => {
    renderChat(createState({ messages: [], activeDialogId: null, activeDialog: null }), {
      threadContainer: null,
      composerPreviewText: 'Find devices with less than 10% free disk',
    });
    expect(ghost()).toBeInTheDocument();
    type('my own question');
    expect(ghost()).not.toBeInTheDocument();
    expect(editor()).toHaveTextContent('my own question');
  });

  it('shows nothing without one', () => {
    renderChat(createState({ messages: [], activeDialogId: null, activeDialog: null }), { threadContainer: null });
    expect(ghost()).not.toBeInTheDocument();
  });
});
