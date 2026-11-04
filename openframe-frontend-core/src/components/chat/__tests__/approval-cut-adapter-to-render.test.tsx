/**
 * What a reader sees when an approved card's answer is cut, from the wire to the words: the real adapter and the real panel,
 * with only `fetch` answered here. Each half is pinned on its own elsewhere; nothing else would fail if the sentence stopped
 * telling the reader to check before trying again, and that half is the one that keeps a write from running twice.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_INTERRUPTED_NOTICE, encodeUiChunk, encodeUiDone } from '../../../chat-protocol/ui-chunks';
import { APPROVAL_STREAM } from '../../../chat-protocol/wire-fixtures';
import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { APPROVAL_OUTCOME_UNKNOWN, useSseChatAdapter } from '../hooks/use-sse-chat-adapter';
import type { UnifiedChatState } from '../types/unified-chat-state.types';

const THE_SENTENCE =
  'The answer stopped before saying how this ended, so it may or may not have gone through. Check before trying again.';

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

/** The panel over the real adapter, as a host mounts it. */
function Host({ onState }: { onState: (state: UnifiedChatState) => void }) {
  const state = useSseChatAdapter(undefined, { active: false });
  onState(state);
  return (
    <DialogPrimitive.Root open>
      <EmbeddableChat
        shell="none"
        defaultOpen
        defaultActiveMode="mingo"
        showInternalTrigger={false}
        mingoState={state}
      />
    </DialogPrimitive.Root>
  );
}

const encoded = (chunks: Parameters<typeof encodeUiChunk>[0][]) => chunks.map(encodeUiChunk);

function bodyOf(chunks: Uint8Array[], end: 'close' | 'error' | 'done') {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at < chunks.length) controller.enqueue(chunks[at++]);
      else if (end === 'error') controller.error(new TypeError('network error'));
      else if (end === 'done') {
        controller.enqueue(encodeUiDone());
        controller.close();
      } else controller.close();
    },
  });
}

/** The chat's two answers: the proposal, whole, then one cut as `how` says. Anything else the panel asks for is empty. */
function answerChat(how: 'close' | 'error') {
  const answers = [() => bodyOf(encoded(APPROVAL_STREAM), 'done'), () => bodyOf(encoded([{ type: 'start' }]), how)];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/docs/chat') && init?.method === 'POST') {
        const next = answers.shift();
        return Promise.resolve({ ok: true, status: 200, body: next?.() } as unknown as Response);
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }),
  );
}

// jsdom lays nothing out, and the thread scrolls a new message into view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe('an approved card whose answer was cut, read from the wire', () => {
  it.each(['close', 'error'] as const)('(%s) says the whole sentence, and no second notice', async how => {
    answerChat(how);
    let state: UnifiedChatState | undefined;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ChatRuntimeContext.Provider value={runtime}>
          <Host onState={next => (state = next)} />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>,
    );
    await act(async () => {
      await state?.sendMessage('close it');
    });
    const foot = screen.getByRole('status');
    expect(foot).toHaveTextContent('Waiting for you');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Outcome unknown')).toBeInTheDocument();
    expect(APPROVAL_OUTCOME_UNKNOWN).toBe(THE_SENTENCE);
    expect(screen.getByRole('status')).toBe(foot);
    expect(foot.textContent).toBe(`Outcome unknown${THE_SENTENCE}`);
    expect(screen.queryByText(CHAT_INTERRUPTED_NOTICE)).toBeNull();
    expect(screen.queryByText(/interrupted/)).toBeNull();
    expect(screen.queryByText('Failed')).toBeNull();
    expect(screen.queryByText(/Approved/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});
