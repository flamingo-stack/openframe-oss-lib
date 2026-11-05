/**
 * `sourceSkeletonCount`: how many source chips the strip under an answer draws while the answer is written. The
 * host decides; one by default, and `0` draws no strip until the answer ends (openframe-oss-frontend, whose Mingo
 * answers rarely cite sources).
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
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

const THREAD: UnifiedChatState['messages'] = [
  { id: 'm-1', role: 'user', content: 'hello', timestamp: new Date('2026-01-01T00:00:00Z') },
  { id: 'm-2', role: 'assistant', content: 'Working on it', timestamp: new Date('2026-01-01T00:00:01Z') },
];

function renderAnswering(sourceSkeletonCount?: number) {
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
            mingoState={createState({
              activeDialogId: 'd-1',
              messages: THREAD,
              isLoading: true,
              streamingPhase: 'streaming',
            })}
            sourceSkeletonCount={sourceSkeletonCount}
          />
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

/** The strip's skeleton chips: the loading items inside its ruled frame (the thread has other loading items). */
const chipSkeletons = (container: HTMLElement) => container.querySelectorAll('.border-t [data-loading-item]');

describe('EmbeddableChat - sourceSkeletonCount', () => {
  it('draws one source chip in the loading strip by default', () => {
    const { container } = renderAnswering();
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(chipSkeletons(container)).toHaveLength(1);
  });

  it('draws the count the host passes', () => {
    const { container } = renderAnswering(3);
    expect(chipSkeletons(container)).toHaveLength(3);
  });

  it('draws no strip while the answer is written when the host passes 0', () => {
    const { container } = renderAnswering(0);
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    expect(chipSkeletons(container)).toHaveLength(0);
  });
});
