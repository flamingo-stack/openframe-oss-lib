/**
 * The viewer's own just-sent message in Mingo. A send draws its bubble at once with no author at all, and it keeps
 * none until history replaces it, so it used to fall back to the generic 'You' (initials "Y", no photo) while the rest
 * of the panel showed the viewer's photo. Only a row with NO author is the viewer's own: a row that carries an author,
 * even one with its name or photo missing, belongs to whoever wrote it and must never take the viewer's identity
 * (stamping the viewer's photo onto every participant's bubble was the earlier bug). Guide mode's overlay is
 * covered by `withEmbeddedChatAuthor`'s own tests (`utils/__tests__/thread-display.test.ts`).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import type { ChatMessage } from '../../../chat-protocol/chat-message';
import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { ChatEngineProvider } from '../engine/chat-engine-context';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

const runtime: ChatRuntime = {
  source: 'openframe',
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

const VIEWER = 'Michael Doe';
const VIEWER_PHOTO = 'https://cdn.example.com/avatars/michael.png';

/** The bubble a send draws before any echo or history: no author at all. */
const OWN_SEND: ChatMessage = { id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'what can you do' }] };

function Host({ messages, avatarUrl = VIEWER_PHOTO }: { messages: ChatMessage[]; avatarUrl?: string }) {
  const noop = () => {};
  const asyncNoop = async () => {};
  const state: UnifiedChatState = {
    messages,
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
    dialogs: [{ id: 'd-1', title: 'Capabilities Overview' }],
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
  };
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatRuntimeContext.Provider value={runtime}>
        <ChatEngineProvider engine={state}>
          <EmbeddableChat
            shell="inline"
            appearance="v2"
            closable={false}
            open
            onOpenChange={vi.fn()}
            defaultActiveMode="mingo"
            showInternalTrigger={false}
            userDisplayName={VIEWER}
            userAvatarUrl={avatarUrl}
          />
        </ChatEngineProvider>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

/** A message row's face: titled with the row's display name. */
/** The message rows' faces titled with this name (a row's face is a span; the header's own avatar is not one). */
const facesOf = (name: string): HTMLElement[] =>
  screen.queryAllByTitle(name).filter(element => element.tagName === 'SPAN');
const face = (name: string): HTMLElement => {
  const [only, ...more] = facesOf(name);
  if (!only || more.length > 0) throw new Error(`expected one message face titled "${name}"`);
  return only;
};

const photoIn = (element: HTMLElement) => within(element).queryByRole('img')?.getAttribute('src') ?? null;

describe('EmbeddableChat (Mingo): the author of the viewer’s own just-sent message', () => {
  it('shows the viewer’s name and photo on a row with no author, not "You"', () => {
    render(<Host messages={[OWN_SEND]} />);
    expect(screen.getByText('what can you do')).toBeInTheDocument();
    expect(photoIn(face(VIEWER))).toContain('michael.png');
    expect(facesOf('You')).toHaveLength(0);
  });

  it('shows the initials of the viewer’s name when the viewer has no photo, never "Y"', () => {
    render(<Host messages={[OWN_SEND]} avatarUrl="" />);
    const own = face(VIEWER);
    expect(photoIn(own)).toBeNull();
    expect(own).toHaveTextContent('MD');
  });

  it('keeps another admin’s name and initials on a history row with no photo', () => {
    const jane: ChatMessage = {
      id: 'm-1',
      role: 'user',
      metadata: { author: { name: 'Jane Smith', authorType: 'admin' } },
      parts: [{ type: 'text', text: 'Restarted the agent' }],
    };
    render(<Host messages={[jane, OWN_SEND]} />);
    const other = face('Jane Smith');
    expect(photoIn(other)).toBeNull();
    expect(other).toHaveTextContent('JS');
    // The viewer's own send still shows the viewer.
    expect(photoIn(face(VIEWER))).toContain('michael.png');
  });

  it('gives an authored row with no name neither the viewer’s name nor photo', () => {
    const echo: ChatMessage = {
      id: 'm-2',
      role: 'user',
      metadata: { author: { authorType: 'admin' } },
      parts: [{ type: 'text', text: 'Checking the logs' }],
    };
    render(<Host messages={[echo]} />);
    const nameless = face('You');
    expect(photoIn(nameless)).toBeNull();
    expect(facesOf(VIEWER)).toHaveLength(0);
  });
});
