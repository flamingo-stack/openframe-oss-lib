/**
 * The thread's own Ask and Display are sends, so while a turn runs nothing offers one, and what asks from outside the thread
 * waits for the stream to close: the real adapter and the real panel, with only `fetch` answered here.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_CHAT_WIRE, readChatWire } from '../../../chat-protocol/__fixtures__/hub-contracts';
import { encodeUiChunk, encodeUiDone, type UiChunk } from '../../../chat-protocol/ui-chunks';
import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { useSseChatAdapter } from '../hooks/use-sse-chat-adapter';
import type { UnifiedChatState } from '../types/unified-chat-state.types';
import { ASK_AI_OPEN_WITH_REF_EVENT } from '../utils/ask-ai-events';

// The chat wire the hub serves (`chat-wire.json`): the cases that read it are skipped when this run cannot read the hub.
const WIRE = await readChatWire();
const { APPROVAL_STREAM, FIXTURE_PROPOSAL_ID } = WIRE ?? NO_CHAT_WIRE;

const runtime: ChatRuntime = {
  source: 'hub',
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    commandsUrl: '/api/docs/commands',
    buildListUrl: (_type, ids) => `/api/cards?ids=${ids.join(',')}`,
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

function renderHost(onState: (state: UnifiedChatState) => void) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <ChatRuntimeContext.Provider value={runtime}>
        <Host onState={onState} />
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>,
  );
}

const RECORD = 'record://blog_post/1';
const FINISH: UiChunk = { type: 'finish', finishReason: 'stop' };
/** The proposing turn, with a record the thread can act on: a chip in its text, with a page to open. */
const PROPOSAL: UiChunk[] = [
  { type: 'source-url', sourceId: RECORD, url: 'https://www.flamingo.run/blog/post-one', title: 'Post one' },
  { type: 'text-start', id: 'chip' },
  { type: 'text-delta', id: 'chip', delta: `See [Post one](${RECORD}).\n\n` },
  { type: 'text-end', id: 'chip' },
  ...APPROVAL_STREAM.filter(chunk => chunk.type !== 'finish'),
  FINISH,
];

function streamOf(chunks: readonly UiChunk[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encodeUiChunk(chunk));
      controller.enqueue(encodeUiDone());
      controller.close();
    },
  });
}

/** The chat answers the proposal whole, then a stream the test writes to; a card's row is always there. */
function answerChat() {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
  const heldStream = () =>
    new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
  const posts: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/docs/chat') && init?.method === 'POST') {
        posts.push(String(init.body));
        const body = posts.length === 1 ? streamOf(PROPOSAL) : heldStream();
        return Promise.resolve({ ok: true, status: 200, body } as unknown as Response);
      }
      if (String(url).includes('/api/cards')) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [{ id: '1', title: 'Post one', slug: 'post-one' }] }), { status: 200 }),
        );
      }
      return Promise.resolve(new Response('{}', { status: 200 }));
    }),
  );
  return {
    posts,
    write: (...chunks: UiChunk[]) => {
      for (const chunk of chunks) controller?.enqueue(encodeUiChunk(chunk));
    },
    end: () => {
      controller?.enqueue(encodeUiDone());
      controller?.close();
    },
  };
}

// jsdom lays nothing out, and the thread scrolls a new message into view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

/** The record's Ask row, opened and closed again: there and live, or there and disabled. */
async function askRowOfRecord(): Promise<'live' | 'disabled'> {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions for Post one' }), {
    button: 0,
    pointerType: 'mouse',
  });
  const menu = await screen.findByRole('menu', { hidden: true });
  const row = within(menu)
    .getAllByRole('menuitem', { hidden: true })
    .find(item => item.textContent === 'Ask Mingo');
  const state = row?.getAttribute('aria-disabled') === 'true' ? 'disabled' : 'live';
  fireEvent.keyDown(menu, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('menu', { hidden: true })).toBeNull());
  return state;
}

describe.skipIf(!WIRE)('the thread`s Ask, across an answer', () => {
  it('is live until the click, disabled for the answer, and live again when its stream has closed', async () => {
    const chat = answerChat();
    let state: UnifiedChatState | undefined;
    renderHost(next => (state = next));
    await act(async () => {
      await state?.sendMessage('close it');
    });
    expect(await askRowOfRecord()).toBe('live');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(chat.posts).toHaveLength(2));
    expect(await askRowOfRecord()).toBe('disabled');

    await act(async () => {
      chat.write({ type: 'start' }, { type: 'tool-output-available', toolCallId: FIXTURE_PROPOSAL_ID, output: {} });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await askRowOfRecord()).toBe('disabled');

    // `finish` alone leaves the stream open: a send would still be refused, so Ask is not back yet.
    await act(async () => {
      chat.write(FINISH);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(await askRowOfRecord()).toBe('disabled');

    await act(async () => {
      chat.end();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(async () => expect(await askRowOfRecord()).toBe('live'));
    expect(chat.posts).toHaveLength(2);
  });
});

describe.skipIf(!WIRE)('a host`s launcher prompt during an answer', () => {
  it('waits for the stream to close, and the host keeps it until it went out', async () => {
    const chat = answerChat();
    const consumed = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const panel = (prompt: string | null) => (
      <QueryClientProvider client={client}>
        <ChatRuntimeContext.Provider value={runtime}>
          <DialogPrimitive.Root open>
            <EmbeddableChat
              shell="none"
              defaultOpen
              defaultActiveMode="guide"
              showInternalTrigger={false}
              guidePendingPrompt={prompt}
              onGuidePromptConsumed={consumed}
            />
          </DialogPrimitive.Root>
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>
    );
    const { rerender } = render(panel('close it'));
    await waitFor(() => expect(chat.posts).toHaveLength(1));
    expect(consumed).toHaveBeenCalledTimes(1);
    rerender(panel(null));

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(chat.posts).toHaveLength(2));

    rerender(panel('what is new?'));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(chat.posts).toHaveLength(2);
    expect(consumed).toHaveBeenCalledTimes(1);

    await act(async () => {
      chat.write(FINISH);
      chat.end();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(chat.posts).toHaveLength(3));
    expect(chat.posts[2]).toContain('what is new?');
    expect(consumed).toHaveBeenCalledTimes(2);
  });
});

describe.skipIf(!WIRE)('a page`s ask during an answer', () => {
  const askFromThePage = (id: string, title: string) =>
    act(async () => {
      window.dispatchEvent(
        new CustomEvent(ASK_AI_OPEN_WITH_REF_EVENT, {
          detail: { source: runtime.source, ref: { type: 'blog_post', id, title, url: null } },
        }),
      );
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  const answerAndClose = (chat: ReturnType<typeof answerChat>) =>
    act(async () => {
      chat.write(FINISH);
      chat.end();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  const questionOf = (post: string) =>
    (JSON.parse(post) as { messages: { parts: { text?: string }[] }[] }).messages[0].parts[0].text;

  it('waits for the stream to close, then goes out once, in order, with nothing lost', async () => {
    const chat = answerChat();
    let state: UnifiedChatState | undefined;
    renderHost(next => (state = next));
    await act(async () => {
      await state?.sendMessage('close it');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(chat.posts).toHaveLength(2));

    await askFromThePage('1', 'Post one');
    await askFromThePage('2', 'Post two');
    expect(chat.posts).toHaveLength(2);

    // `finish` alone leaves the stream open: it is still not the question's turn.
    await act(async () => {
      chat.write(FINISH);
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    expect(chat.posts).toHaveLength(2);

    await act(async () => {
      chat.end();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(chat.posts).toHaveLength(3));
    expect(questionOf(chat.posts[2])).toContain('Post one');
    expect(chat.posts[2]).toContain('"entityIdFilter"');

    await answerAndClose(chat);
    await waitFor(() => expect(chat.posts).toHaveLength(4));
    expect(questionOf(chat.posts[3])).toContain('Post two');

    await answerAndClose(chat);
    await waitFor(() => expect(state?.isLoading).toBe(false));
    expect(chat.posts).toHaveLength(4);
  });

  it('goes out at once when nothing is being written', async () => {
    const chat = answerChat();
    let state: UnifiedChatState | undefined;
    renderHost(next => (state = next));
    await act(async () => {
      await state?.sendMessage('close it');
    });
    await askFromThePage('1', 'Post one');
    await waitFor(() => expect(chat.posts).toHaveLength(2));
    expect(questionOf(chat.posts[1])).toContain('Post one');
  });
});
