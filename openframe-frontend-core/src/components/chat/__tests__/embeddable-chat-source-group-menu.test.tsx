/**
 * A grouped source chip ("[1-3] Onboarding guides") opens its rows in the shared `DropdownMenu`, portalled out of the
 * thread: drawn inside the thread, the list faded with the thread's end and sat under the composer dock, so its
 * last rows could not be picked.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Identity + every other authed fetch: a promise that never settles keeps the
// panel offline and free of state updates landing outside `act`.
vi.mock('../../../utils/embed-authed-fetch', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
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

const SOURCES = [
  {
    index: 1,
    name: 'Onboarding Guides',
    path: '',
    documentType: 'onboarding_guide',
    items: [
      {
        index: 1,
        id: 'g-1',
        documentType: 'onboarding_guide',
        name: 'Install on Windows',
        externalUrl: 'https://example.test/g-1',
      },
      {
        index: 2,
        id: 'g-2',
        documentType: 'onboarding_guide',
        name: 'Install on macOS',
        externalUrl: 'https://example.test/g-2',
      },
    ],
  },
];

const THREAD: UnifiedChatState['messages'] = [
  { id: 'm-1', role: 'user', content: 'how do I add a device', timestamp: new Date('2026-01-01T00:00:00Z') },
  {
    id: 'm-2',
    role: 'assistant',
    content: 'Install the agent [1][2].',
    sources: SOURCES,
    timestamp: new Date('2026-01-01T00:00:01Z'),
  },
];

function renderAnswer() {
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
            mingoState={createState({ activeDialogId: 'd-1', messages: THREAD })}
          />
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

/** Radix opens a menu on the pointer going down (jsdom's click carries no pointer). */
function openMenu(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
}

describe('EmbeddableChat - grouped source chip', () => {
  it('opens its rows in a menu, each row a link with its Ask', async () => {
    renderAnswer();
    const chip = screen.getByRole('button', { name: /\[1-2\] Onboarding Guides/ });
    expect(chip).toHaveAttribute('aria-haspopup', 'menu');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    openMenu(chip);
    const menu = await screen.findByRole('menu');
    // `hidden`: jsdom lays nothing out, so Radix reads the chip as scrolled out of the thread (`hideWhenDetached`)
    // and hides the rows from the accessibility tree; a browser shows them.
    const links = within(menu)
      .getAllByRole('menuitem', { hidden: true })
      .filter(item => item.tagName === 'A');
    expect(links.map(link => link.textContent)).toEqual([
      expect.stringContaining('Windows'),
      expect.stringContaining('macOS'),
    ]);
    expect(within(menu).getAllByTestId('source-group-row')).toHaveLength(2);
  });

  it('closes on Escape', async () => {
    renderAnswer();
    openMenu(screen.getByRole('button', { name: /\[1-2\] Onboarding Guides/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
