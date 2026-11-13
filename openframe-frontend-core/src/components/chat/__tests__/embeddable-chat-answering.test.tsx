/**
 * While an answer is written, the turn's own rows say it is working: no sources strip in a loading form under it, and
 * no second "Thinking…" indicator under the thread once the turn has drawn a row. Before the turn has drawn anything,
 * the indicator is the only sign of life and stays.
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

import type { ChatCitation, ChatPart } from '../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../chat-protocol/message-decoder';
import type { UiChunk } from '../../../chat-protocol/ui-chunks';
import { ChatRuntimeContext, type ChatRuntime } from '../../../contexts/chat-runtime-context';
import { EmbeddableChat } from '../embeddable-chat';
import { ChatEngineProvider } from '../engine/chat-engine-context';
import { createChatStreamReducer, type ChatStreamReducer } from '../stream/chat-stream-reducer';
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
    actions: {},
    dialogTokenUsage: null,
    connectionState: 'connected',
    ...overrides,
  };
}

const THREAD: UnifiedChatState['messages'] = [
  {
    id: 'm-1',
    role: 'user',
    metadata: { createdAt: new Date('2026-01-01T00:00:00Z').toISOString() },
    parts: [{ type: 'text', text: 'hello' }],
  },
  {
    id: 'm-2',
    role: 'assistant',
    metadata: { createdAt: new Date('2026-01-01T00:00:01Z').toISOString() },
    parts: [{ type: 'text', text: 'Working on it' }],
  },
];

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function chat(messages: UnifiedChatState['messages'], isLoading: boolean, over: Partial<UnifiedChatState> = {}) {
  return (
    <QueryClientProvider client={client}>
      <ChatRuntimeContext.Provider value={runtime}>
        <DialogPrimitive.Root open>
          <ChatEngineProvider
            engine={createState({
              activeDialogId: 'd-1',
              messages,
              isLoading,
              streamingPhase: isLoading ? 'streaming' : 'idle',
              ...over,
            })}
          >
            <EmbeddableChat shell="none" defaultOpen defaultActiveMode="mingo" showInternalTrigger={false} />
          </ChatEngineProvider>
        </DialogPrimitive.Root>
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  );
}

function renderAnswering(messages: UnifiedChatState['messages']) {
  return render(chat(messages, true));
}

/** The footer's working indicator: a card's own status line is a live region too, with no `aria-live` of its own. */
const loader = () => screen.queryAllByRole('status').find(status => status.getAttribute('aria-live') === 'polite');

/** A strip as a reader reads it, with one in the thread: its heading, its chips and what it holds back. */
function stripText(): string {
  const label = screen.queryByText('Top retrieved sources') ?? screen.queryByText('Sources');
  if (!label) return 'none';
  const chips = screen.queryAllByText(/\(\d+ records?\)$/).map(chip => chip.textContent);
  const more = screen.queryByRole('button', { name: /additional retrieved/ })?.textContent;
  return [label.textContent, ...chips, ...(more ? [more] : [])].join(' | ');
}

/** The thread of a reducer, as the panel is handed it: by a host that names the message being written, or by one that doesn't. */
const threadOf = (reducer: ChatStreamReducer, namesTheMessage: boolean) =>
  chat(reducer.state.messages, reducer.state.streamingPhase !== 'idle', {
    streamingPhase: reducer.state.streamingPhase,
    ...(namesTheMessage ? { writingMessageId: reducer.state.writingMessageId } : {}),
  });

describe('EmbeddableChat - an answer being written', () => {
  it('draws no sources strip under it', () => {
    renderAnswering(THREAD);
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });

  it('draws no second working indicator once the turn has drawn a row', () => {
    renderAnswering(THREAD);
    expect(loader()).toBeUndefined();
  });

  it('keeps the working indicator while the turn has drawn nothing yet', () => {
    renderAnswering(THREAD.slice(0, 1));
    expect(loader()).toBeDefined();
  });
});

describe('EmbeddableChat - a card whose answer continues its own message', () => {
  const STRIP = 'Top retrieved sources';
  const source: ChatPart = {
    type: 'source-url',
    sourceId: 'record://blog_post/1',
    url: 'https://x.test/a',
    title: 'A post',
  };
  const tool = {
    type: 'dynamic-tool',
    toolName: 'update_ticket',
    toolCallId: 'p1',
    title: 'Close',
    input: {},
  } as const;
  const asked: ChatPart = { ...tool, state: 'approval-requested', approval: { id: 'p1' } };
  const message = (...parts: ChatPart[]): UnifiedChatState['messages'] => [
    THREAD[0],
    { ...THREAD[1], parts: [source, { type: 'text', text: 'I can close that.' }, ...parts] },
  ];
  const approving: ChatPart = {
    ...tool,
    state: 'approval-responded',
    approval: { id: 'p1', approved: true },
    toolMetadata: { answerSent: true },
  };
  const rejecting: ChatPart = {
    ...tool,
    state: 'approval-responded',
    approval: { id: 'p1', approved: false },
    toolMetadata: { answerSent: true },
  };

  it('a turn still streaming that has only just made a proposal shows no strip early', () => {
    renderAnswering(message(asked));
    expect(screen.queryByText(STRIP)).not.toBeInTheDocument();
  });

  it.each([
    ['Approve', approving],
    ['Reject', rejecting],
  ])('%s keeps the strip, the row and its buttons, and adds no loader: the click moves nothing', (_, answered) => {
    const { rerender } = render(chat(message(asked), false));
    const strip = screen.getByText(STRIP);
    const body = screen.getByText('I can close that.');
    const button = screen.getByRole('button', { name: 'Approve' });

    rerender(chat(message(answered), true));

    expect(screen.getByText(STRIP)).toBe(strip);
    expect(screen.getByText('I can close that.')).toBe(body);
    expect(screen.getByRole('button', { name: 'Approve' })).toBe(button);
    expect(button).toBeDisabled();
    expect(loader()).toBeUndefined();
  });

  it('a row read back from history, which never said how its turn ended, keeps its strip too', () => {
    const [, read] = message(asked);
    expect(read.metadata?.finishReason).toBeUndefined();
    const { rerender } = render(chat([THREAD[0], read], false));
    const strip = screen.getByText(STRIP);
    rerender(chat(message(approving), true));
    expect(screen.getByText(STRIP)).toBe(strip);
  });
});

const POST = (id: string, title: string, type = 'blog_post') =>
  ({ type: 'source-url', sourceId: `record://${type}/${id}`, url: `https://x.test/${id}`, title }) as const;
const CITATION = (id: string, title: string, type = 'blog_post'): ChatCitation => ({
  source: { type: 'source', sourceType: 'url', id: `record://${type}/${id}`, url: `https://x.test/${id}`, title },
  startIndex: 0,
  endIndex: 10,
});

/** A Guide turn that proposes `update_ticket`, ended: what its reader holds with the card waiting. */
function guideTurn(leading: UiChunk[]): { reducer: ChatStreamReducer; feed: (...chunks: UiChunk[]) => void } {
  const reducer = createChatStreamReducer();
  const feed = (...chunks: UiChunk[]) => {
    for (const chunk of chunks) reducer.apply({ chunks: [chunk] });
  };
  reducer.beginSseSend({ text: 'close it' });
  feed(
    { type: 'start', messageId: 'a1' },
    ...leading,
    { type: 'text-start', id: 't1' },
    { type: 'text-delta', id: 't1', delta: 'I can close that.' },
    { type: 'text-end', id: 't1' },
    {
      type: 'tool-input-available',
      toolCallId: 'p1',
      toolName: 'update_ticket',
      input: {},
      dynamic: true,
      title: 'Close',
    },
    { type: 'tool-approval-request', approvalId: 'p1', toolCallId: 'p1', reason: 'Close it', approvalDescriptor: {} },
    { type: 'finish', finishReason: 'tool-calls' },
  );
  reducer.endSseTurn();
  return { reducer, feed };
}

/** The adapter's click: the part flips with the client's own mark, and the card's message becomes the one written. */
function clickApprove({ reducer, feed }: ReturnType<typeof guideTurn>) {
  feed({ type: 'tool-approval-response', approvalId: 'p1', approved: true, toolMetadata: { answerSent: true } });
  reducer.continueMessage(reducer.state.messages[reducer.state.messages.length - 1].id);
}

describe('EmbeddableChat - a strip holds still for the length of its turn', () => {
  const receipt: UiChunk[] = [
    { type: 'start' },
    { type: 'tool-output-available', toolCallId: 'p1', dynamic: true, output: {} },
    { type: 'text-start', id: 'r' },
    { type: 'text-delta', id: 'r', delta: 'Done.\n\n' },
    { type: 'text-end', id: 'r' },
    { type: 'message-metadata', messageMetadata: { willAutoContinue: true } },
  ];

  it('a card with a strip: the same words from the click to the end, then the turn`s, once', () => {
    const turn = guideTurn([POST('1', 'Post one'), POST('2', 'Atera', 'vendor')]);
    const { rerender } = render(threadOf(turn.reducer, true));
    const before = stripText();
    expect(before).toBe('Top retrieved sources | Blog Posts (1 record) | Vendor Directory (1 record)');

    const step = (...chunks: UiChunk[]) => {
      turn.feed(...chunks);
      rerender(threadOf(turn.reducer, true));
      expect(stripText()).toBe(before);
    };
    clickApprove(turn);
    rerender(threadOf(turn.reducer, true));
    expect(stripText()).toBe(before);
    step(...receipt);
    // A continuation's sources come first, then its cited sentences: none of them reaches the strip.
    step(POST('9', 'A question', 'faq'), POST('10', 'Post ten'), POST('11', 'Post eleven'));
    step({ type: 'text-start', id: 'c' }, { type: 'text-delta', id: 'c', delta: 'Closed per the FAQ.' });
    step({ type: 'text-end', id: 'c', citations: [CITATION('9', 'A question', 'faq')] });

    turn.feed({ type: 'finish', finishReason: 'stop' });
    turn.reducer.endSseTurn();
    rerender(threadOf(turn.reducer, true));
    expect(stripText()).toBe('Sources | [1] FAQs (1 record) | +4 more retrieved sources');
  });

  it('a card with no strip has none until the turn ends', () => {
    const turn = guideTurn([]);
    const { rerender } = render(threadOf(turn.reducer, true));
    const step = (...chunks: UiChunk[]) => {
      turn.feed(...chunks);
      rerender(threadOf(turn.reducer, true));
      expect(stripText()).toBe('none');
    };
    clickApprove(turn);
    step(...receipt);
    step(POST('1', 'Post one'), POST('2', 'Post two'), POST('3', 'Post three'), POST('9', 'A question', 'faq'));
    step({ type: 'text-start', id: 'c' }, { type: 'text-delta', id: 'c', delta: 'Closed per the post.' });
    step({ type: 'text-end', id: 'c', citations: [CITATION('1', 'Post one')] });

    turn.feed({ type: 'finish', finishReason: 'stop' });
    turn.reducer.endSseTurn();
    rerender(threadOf(turn.reducer, true));
    expect(stripText()).toBe('Sources | [1] Blog Posts (1 record) | +3 more retrieved sources');
  });

  describe('on Mingo, whose resume opens no message of its own', () => {
    const asked = {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req',
      approvalType: 'CLIENT',
      toolCalls: [
        {
          toolExecutionRequestId: 't1',
          toolName: 'a',
          toolTitle: 'Close ticket',
          requiresApproval: true,
          toolCallArguments: {},
        },
      ],
    };
    const attachments = (id: string, type = 'blog_post') => ({
      type: 'ATTACHMENTS',
      sources: [{ sourceId: `record://${type}/${id}`, url: `https://x.test/${id}`, title: `Record ${id}` }],
    });

    function mingoTurn() {
      const reducer = createChatStreamReducer();
      const decoder = createMingoDecoder();
      const feed = (...raws: object[]) => {
        for (const raw of raws) reducer.apply(decoder.decode(raw));
      };
      feed(
        { type: 'MESSAGE_REQUEST', text: 'close my ticket', ownerType: 'CLIENT' },
        { type: 'MESSAGE_START' },
        attachments('1'),
        { type: 'TEXT', text: 'I can close that.' },
        asked,
        { type: 'MESSAGE_END' },
      );
      return { reducer, feed };
    }

    /** Each step leaves the strip as it was; the end of the turn is the one change. */
    function runThrough(click: (reducer: ChatStreamReducer) => void, namesTheMessage: boolean, approved = true) {
      const { reducer, feed } = mingoTurn();
      const { rerender } = render(threadOf(reducer, namesTheMessage));
      const before = stripText();
      expect(before).toBe('Top retrieved sources | Blog Posts (1 record)');
      const step = (...raws: object[]) => {
        feed(...raws);
        rerender(threadOf(reducer, namesTheMessage));
        expect(stripText()).toBe(before);
      };
      click(reducer);
      rerender(threadOf(reducer, namesTheMessage));
      expect(stripText()).toBe(before);
      step({ type: 'APPROVAL_RESULT', approvalRequestId: 'req', approved, displayName: 'Jane' });
      if (approved) {
        step(
          { type: 'EXECUTING_TOOL', toolExecutionRequestId: 't1', toolFunction: 'a', integratedToolType: 'SHELL' },
          {
            type: 'EXECUTED_TOOL',
            toolExecutionRequestId: 't1',
            toolFunction: 'a',
            integratedToolType: 'SHELL',
            success: true,
            result: 'ok',
          },
        );
      }
      step({ type: 'TEXT', text: 'Closed it' });
      step(attachments('7', 'vendor'));
      step({ type: 'TEXT', text: ', all done.' });
      feed({ type: 'MESSAGE_END' });
      rerender(threadOf(reducer, namesTheMessage));
      return stripText();
    }
    const UPDATED_ONCE = 'Top retrieved sources | Blog Posts (1 record) | Vendor Directory (1 record)';

    it('the lib`s adapter: its click locks the phase and leaves the part', () => {
      const end = runThrough(reducer => {
        reducer.setApprovalStatus('req', 'approved');
        reducer.setPhase('thinking');
      }, true);
      expect(end).toBe(UPDATED_ONCE);
    });

    it('a host`s injected state: its click flips the part, and it names no message', () => {
      const end = runThrough(reducer => {
        reducer.projectApprovalResolution('req', 'approved');
        reducer.setPhase('thinking');
      }, false);
      expect(end).toBe(UPDATED_ONCE);
    });

    it('a rejection on the lib`s adapter takes no phase: no turn reads as running, so its strip follows its parts', () => {
      const { reducer, feed } = mingoTurn();
      const { rerender } = render(threadOf(reducer, true));
      expect(stripText()).toBe('Top retrieved sources | Blog Posts (1 record)');
      reducer.setApprovalStatus('req', 'rejected');
      feed(
        { type: 'APPROVAL_RESULT', approvalRequestId: 'req', approved: false, displayName: 'Jane' },
        { type: 'TEXT', text: 'Left it as it is' },
        attachments('7', 'vendor'),
      );
      rerender(threadOf(reducer, true));
      expect(stripText()).toBe(UPDATED_ONCE);
    });
  });
});

describe('EmbeddableChat - a strip with no turn it could hold still for', () => {
  it('a message whose stream never closed its text, on a chat no longer loading, draws its strip', () => {
    const cut: UnifiedChatState['messages'] = [
      THREAD[0],
      {
        ...THREAD[1],
        parts: [POST('1', 'Post one'), { type: 'text', text: 'Half an answer', state: 'streaming' }],
      },
    ];
    render(chat(cut, false));
    expect(stripText()).toBe('Top retrieved sources | Blog Posts (1 record)');
  });

  it('nor one settled before its turn: a turn that stopped and never heard the end draws the sources its message holds', () => {
    const settled: UnifiedChatState['messages'] = [
      THREAD[0],
      { ...THREAD[1], parts: [POST('1', 'Post one'), { type: 'text', text: 'A finished answer.' }] },
    ];
    const { rerender } = render(chat(settled, false));
    const before = 'Top retrieved sources | Blog Posts (1 record)';
    expect(stripText()).toBe(before);

    // The turn continues this message, with a source of its own.
    const cut: UnifiedChatState['messages'] = [
      THREAD[0],
      {
        ...THREAD[1],
        parts: [
          POST('1', 'Post one'),
          POST('7', 'Vendor seven', 'vendor'),
          { type: 'text', text: 'A finished answer.' },
          { type: 'text', text: 'Closed it', state: 'streaming' },
        ],
      },
    ];
    rerender(chat(cut, true));
    expect(stripText()).toBe(before);

    // Stop worked and the end of the turn was lost: the chat reads idle, with the text still marked as coming.
    rerender(chat(cut, false));
    expect(stripText()).toBe('Top retrieved sources | Blog Posts (1 record) | Vendor Directory (1 record)');
  });
});

describe('EmbeddableChat - a card whose message is not the last', () => {
  /** [question, card], [question, a finished answer with its strip]: the card unanswered, as the composer allows. */
  function olderCard(leading: UiChunk[] = []) {
    const turn = guideTurn(leading);
    turn.reducer.beginSseSend({ text: 'what is your name?' });
    turn.feed(
      { type: 'start', messageId: 'a2' },
      POST('7', 'Post seven'),
      { type: 'text-start', id: 't2' },
      { type: 'text-delta', id: 't2', delta: 'I am Mingo.' },
      { type: 'text-end', id: 't2' },
      { type: 'finish', finishReason: 'stop' },
    );
    turn.reducer.endSseTurn();
    return turn;
  }
  const clickOlder = ({ reducer, feed }: ReturnType<typeof guideTurn>) => {
    feed({ type: 'tool-approval-response', approvalId: 'p1', approved: true, toolMetadata: { answerSent: true } });
    reducer.continueMessage(reducer.state.messages[1].id);
  };

  it('the newer answer keeps its strip and its words, whole, at the click and to the end', () => {
    const turn = olderCard();
    const { rerender } = render(threadOf(turn.reducer, true));
    const strip = screen.getByText('Top retrieved sources');
    const words = screen.getByText('I am Mingo.');
    const card = screen.getByText('I can close that.');

    clickOlder(turn);
    rerender(threadOf(turn.reducer, true));
    expect(screen.getByText('Top retrieved sources')).toBe(strip);
    expect(screen.getByText('I am Mingo.')).toBe(words);
    expect(screen.getByText('I can close that.')).toBe(card);
    expect(screen.getByText('Approving')).toBeInTheDocument();
    expect(loader()).toBeUndefined();

    turn.feed(
      { type: 'start' },
      { type: 'tool-output-available', toolCallId: 'p1', dynamic: true, output: {} },
      { type: 'text-start', id: 'r' },
      { type: 'text-delta', id: 'r', delta: 'Closed.' },
      { type: 'text-end', id: 'r' },
    );
    rerender(threadOf(turn.reducer, true));
    expect(screen.getByText('Top retrieved sources')).toBe(strip);
    expect(screen.getByText('I am Mingo.')).toBe(words);

    turn.feed({ type: 'finish', finishReason: 'stop' });
    turn.reducer.endSseTurn();
    rerender(threadOf(turn.reducer, true));
    expect(screen.getByText('Top retrieved sources')).toBe(strip);
  });

  it('its own strip holds still while its answer is written, and the newer answer`s is left alone', () => {
    const turn = olderCard([POST('1', 'Post one')]);
    const { rerender } = render(threadOf(turn.reducer, true));
    expect(screen.getAllByText('Top retrieved sources')).toHaveLength(2);
    const faq = () => screen.queryByText('FAQs (1 record)');

    clickOlder(turn);
    turn.feed({ type: 'start' }, POST('9', 'A question', 'faq'));
    rerender(threadOf(turn.reducer, true));
    expect(faq()).toBeNull();

    turn.feed({ type: 'finish', finishReason: 'stop' });
    turn.reducer.endSseTurn();
    rerender(threadOf(turn.reducer, true));
    expect(faq()).toBeInTheDocument();
  });

  it('a host that names no message: the last one holds its strip still, and nothing moves', () => {
    const turn = olderCard();
    const { rerender } = render(threadOf(turn.reducer, false));
    const strip = screen.getByText('Top retrieved sources');
    turn.reducer.projectApprovalResolution('p1', 'approved');
    turn.reducer.setPhase('thinking');
    rerender(threadOf(turn.reducer, false));
    expect(screen.getByText('Top retrieved sources')).toBe(strip);
    expect(screen.getByText('I am Mingo.')).toBeInTheDocument();
  });

  it('a thread that ends in a question: no loader while the card says Approving', () => {
    const turn = guideTurn([]);
    turn.reducer.beginSseSend({ text: 'never mind' });
    turn.reducer.endSseTurn();
    const { rerender } = render(threadOf(turn.reducer, true));
    expect(loader()).toBeUndefined();
    clickOlder(turn);
    rerender(threadOf(turn.reducer, true));
    expect(screen.getByText('Approving')).toBeInTheDocument();
    expect(loader()).toBeUndefined();
  });
});

describe('EmbeddableChat - the context gauge', () => {
  const gauge = (over: Partial<UnifiedChatState>) =>
    render(chat(THREAD, false, { currentContextWindowMaxTokens: 150_000, ...over }));

  it('reads what the chat holds now, never the turn`s sum over its requests', () => {
    gauge({ currentContextTokens: 40_600, currentInputTokens: 81_017, currentOutputTokens: 500 });
    expect(screen.getByText(/context budget/).textContent).toMatch(/^40\.6K/);
  });

  it('a turn that states no context size reads input plus output', () => {
    gauge({ currentInputTokens: 12_000, currentOutputTokens: 300 });
    expect(screen.getByText(/context budget/).textContent).toMatch(/^12\.3K/);
  });
});
