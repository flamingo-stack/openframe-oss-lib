/**
 * EmbeddableChat sends an OpenFrame message with its files: the host's `onMessageSend` hands over the ready files
 * before the send, and they ride on `sendMessage` as `openframeAttachments`, the text empty for files alone. The staged
 * files' token estimates are gated against what is left of the chat's context.
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/embed-authed-fetch', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  embedAuthedFetch: vi.fn(() => new Promise(() => {})),
}));

import {
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
  type OpenFrameAttachmentItem,
  type OpenFrameMessageAttachment,
} from '../../../chat-protocol/attachment-profiles';
import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { ChatEngineProvider } from '../engine/chat-engine-context';
import type { OpenFrameChatAttachments } from '../types/component.types';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

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

const READY: OpenFrameAttachmentItem = {
  id: 'tray-1',
  name: 'disk.log',
  size: 2048,
  mediaType: 'text/plain',
  state: 'ready',
  tokenEstimate: 500,
};
const MESSAGE: UnifiedChatState['messages'][number] = {
  id: 'm-1',
  role: 'user',
  metadata: { createdAt: '2026-01-01T00:00:00.000Z' },
  parts: [{ type: 'text', text: 'hello' }],
};
const SENT: OpenFrameMessageAttachment = { id: 'att_1', name: 'disk.log', mediaType: 'text/plain', size: 2048 };

function createState(overrides: Partial<UnifiedChatState>): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: [MESSAGE],
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
    ...overrides,
  };
}

function renderPanel(state: UnifiedChatState, files: OpenFrameChatAttachments) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <DialogPrimitive.Root open>
          <ChatEngineProvider engine={state}>
            <EmbeddableChat
              shell="none"
              defaultOpen
              defaultActiveMode="mingo"
              showInternalTrigger={false}
              openframeAttachments={files}
            />
          </ChatEngineProvider>
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

function attachments(over: Partial<OpenFrameChatAttachments> = {}): OpenFrameChatAttachments {
  return {
    profile: OPENFRAME_MINGO_ATTACHMENT_PROFILE,
    items: [READY],
    chatFileCount: 0,
    onAddFiles: vi.fn(),
    onRemove: vi.fn(),
    ...over,
  };
}

const sendButton = () => screen.getByRole('button', { name: 'Send message' });

describe('EmbeddableChat with OpenFrame files', () => {
  it('takes the ready files from the host before the send, and sends them with an empty text', () => {
    const order: string[] = [];
    const sendMessage = vi.fn<UnifiedChatState['sendMessage']>(() => {
      order.push('send');
      return Promise.resolve();
    });
    const onMessageSend = vi.fn<NonNullable<OpenFrameChatAttachments['onMessageSend']>>(() => {
      order.push('take');
      return [SENT];
    });
    renderPanel(createState({ sendMessage }), attachments({ onMessageSend }));

    fireEvent.click(sendButton());

    expect(order).toEqual(['take', 'send']);
    expect(onMessageSend).toHaveBeenCalledWith('');
    expect(sendMessage).toHaveBeenCalledWith('', { openframeAttachments: [SENT] });
  });

  it('sends no files key when the host hands over none', () => {
    const sendMessage = vi.fn<UnifiedChatState['sendMessage']>(() => Promise.resolve());
    renderPanel(createState({ sendMessage }), attachments({ onMessageSend: () => [] }));
    fireEvent.click(sendButton());
    expect(sendMessage).toHaveBeenCalledWith('', {});
  });

  it("blocks Send while the files need more than the chat's context has left, and says so", () => {
    renderPanel(createState({ currentContextWindowMaxTokens: 1000, currentContextTokens: 800 }), attachments());
    expect(sendButton()).toBeDisabled();
    expect(screen.getByTestId('openframe-attachment-notes')).toHaveTextContent(
      'These files need ~500 tokens, but only ~200 are left in this chat. Remove a file to send',
    );
  });

  it('sends when the files fit, and gates nothing without a known budget', () => {
    const { unmount } = renderPanel(
      createState({ currentContextWindowMaxTokens: 1000, currentContextTokens: 400 }),
      attachments(),
    );
    expect(sendButton()).toBeEnabled();
    unmount();
    renderPanel(createState({ currentContextTokens: 400 }), attachments());
    expect(sendButton()).toBeEnabled();
  });

  it("takes the host's own context figure over the chat's", () => {
    renderPanel(
      createState({ currentContextWindowMaxTokens: 1000, currentContextTokens: 0 }),
      attachments({ contextTokensLeft: 100 }),
    );
    expect(sendButton()).toBeDisabled();
  });
});
