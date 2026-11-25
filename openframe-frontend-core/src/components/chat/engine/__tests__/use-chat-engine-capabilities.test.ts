/**
 * What every web chat gets from the engine by naming its backend's capabilities, so no host writes them again: the list's
 * server-side search and owner scope, the open dialog's record and why it could not be read, a dialog created on the
 * first send or for a launcher, a publish that waits for the tail, the optimistic answer of an escalation offer, a send
 * over a pending card, a failed send's row, and the at-least-once tail's redelivery gate.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { approvalStatusOf, isToolPart, textOfParts } from '../../../../chat-protocol/chat-message';
import type { DialogItem, HistoricalMessage } from '../../types';
import type { FetchDialogsParams } from '../../types/unified-chat-state.types';
import {
  redeliveryGate,
  type ChatHistoryBackend,
  type ChatLiveTailOptions,
  type ChatLiveTailTransport,
  type FetchDialogMessagesResult,
} from '../chat-transport';
import { useChatEngine, type UseChatEngineConfig } from '../use-chat-engine';

const persisted: HistoricalMessage[] = [
  {
    id: 'a1',
    createdAt: '2026-11-04T10:00:01Z',
    owner: { type: 'ASSISTANT' },
    lastChunkStreamSeq: 7,
    parts: [{ type: 'TEXT', text: 'hello' }],
  },
];

function setup(
  config: Partial<Omit<UseChatEngineConfig, 'transport'>> & {
    history?: ChatHistoryBackend;
    transport?: Partial<ChatLiveTailTransport>;
  } = {},
) {
  const tail: { current: ChatLiveTailOptions | null } = { current: null };
  const transport: ChatLiveTailTransport = {
    replays: true,
    useLiveTail: options => {
      tail.current = options;
    },
    publish: vi.fn(),
    ...config.transport,
  };
  const history: ChatHistoryBackend = {
    fetchDialogMessages: vi.fn((): Promise<FetchDialogMessagesResult> =>
      Promise.resolve({ messages: persisted, nextCursor: null }),
    ),
    ...config.history,
  };
  const hook = renderHook(() => useChatEngine({ ...config, transport, history }));
  return { ...hook, tail, transport, history };
}

const texts = (messages: { role: string; parts: Parameters<typeof textOfParts>[0] }[]) =>
  messages.map(message => [message.role, textOfParts(message.parts)]);

describe('redeliveryGate', () => {
  it('drops a chunk at or below the last sequence delivered, and starts over with the dialog', () => {
    const passes = redeliveryGate();
    expect(passes('d1', { streamSeq: 5 })).toBe(true);
    expect(passes('d1', { streamSeq: 5 })).toBe(false);
    expect(passes('d1', { streamSeq: 4 })).toBe(false);
    expect(passes('d1', { streamSeq: 6 })).toBe(true);
    expect(passes('d1', { type: 'TEXT' })).toBe(true);
    expect(passes('d2', { streamSeq: 1 })).toBe(true);
  });
});

describe('useChatEngine: the dialog list', () => {
  const row: DialogItem = { id: 'd1', title: 'First' };

  it('searches and scopes on the server, the first page reloading on a change of either', async () => {
    const fetchDialogs = vi.fn((_params: FetchDialogsParams) => Promise.resolve({ dialogs: [row], nextCursor: null }));
    const { result } = setup({ dialogScopes: true, history: { fetchDialogs } });
    await waitFor(() => expect(result.current.dialogs).toEqual([row]));
    expect(fetchDialogs).toHaveBeenLastCalledWith(expect.objectContaining({ scope: 'my' }));
    expect(fetchDialogs.mock.lastCall?.[0]).not.toHaveProperty('search');

    act(() => result.current.dialogCapabilities?.onSearchChange?.('printer'));
    await waitFor(() =>
      expect(fetchDialogs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'printer', scope: 'my' })),
    );
    act(() => result.current.setDialogScope?.('all'));
    await waitFor(() =>
      expect(fetchDialogs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'printer', scope: 'all' })),
    );
  });

  it("opening someone else's dialog moves the list to everyone's, once", async () => {
    const fetchDialogs = vi.fn(() => Promise.resolve({ dialogs: [], nextCursor: null }));
    const fetchDialog = vi.fn((id: string) =>
      Promise.resolve({ dialog: { id, title: 'Theirs', owner: { id: 'u2' } } }),
    );
    const { result } = setup({ dialogScopes: true, currentUserId: 'u1', history: { fetchDialogs, fetchDialog } });
    act(() => result.current.selectDialog('d9'));
    await waitFor(() => expect(result.current.activeDialog?.title).toBe('Theirs'));
    expect(result.current.dialogScope).toBe('all');
  });

  it('says why the open dialog could not be read', async () => {
    const fetchDialogs = vi.fn(() => Promise.resolve({ dialogs: [], nextCursor: null }));
    const fetchDialog = vi.fn(() => Promise.resolve(null));
    const { result } = setup({ history: { fetchDialogs, fetchDialog } });
    act(() => result.current.selectDialog('gone'));
    await waitFor(() => expect(result.current.dialogError).toBe('This conversation could not be found.'));
  });
});

describe('useChatEngine: a dialog this chat creates', () => {
  it('a send with no dialog open creates one, greets in it and sends into it, its thread kept', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'new1' }));
    const { result, transport, history } = setup({ newDialogGreeting: 'Hi there', history: { createDialog } });
    await act(async () => {
      await result.current.sendMessage('first');
    });
    expect(createDialog).toHaveBeenCalledWith(expect.objectContaining({ firstMessage: 'first' }));
    expect(transport.publish).toHaveBeenCalledWith('first', expect.objectContaining({ dialogId: 'new1' }));
    expect(result.current.activeDialogId).toBe('new1');
    await waitFor(() =>
      expect(texts(result.current.messages).slice(0, 2)).toEqual([
        ['assistant', 'Hi there'],
        ['user', 'first'],
      ]),
    );
    // No history is read for it: there is none, and reading would replace the send.
    expect(history.fetchDialogMessages).not.toHaveBeenCalled();
  });

  it('startNewDialog names the dialog it creates, or opens it for an intent', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'named' }));
    const renameDialog = vi.fn(() => Promise.resolve());
    const { result, transport } = setup({ history: { createDialog, renameDialog } });
    let id: string | null = null;
    await act(async () => {
      id = await result.current.startNewDialog({ title: 'Getting started' });
    });
    expect(id).toBe('named');
    expect(renameDialog).toHaveBeenCalledWith('named', 'Getting started');
    expect(transport.publish).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_SCRIPT' });
    });
    expect(createDialog).toHaveBeenLastCalledWith(expect.objectContaining({ intent: 'CREATE_SCRIPT' }));
  });

  it("an intent dialog is read from history when it opens: the server's greeting shows in it", async () => {
    const greeting: HistoricalMessage[] = [
      {
        id: 'g1',
        createdAt: '2026-11-23T12:00:00Z',
        owner: { type: 'ASSISTANT' },
        parts: [{ type: 'TEXT', text: 'What do you want to monitor?' }],
      },
    ];
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent1' }));
    const fetchDialogMessages = vi.fn(() => Promise.resolve({ messages: greeting, nextCursor: null }));
    const { result } = setup({ history: { createDialog, fetchDialogMessages } });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_POLICY' });
    });
    expect(result.current.activeDialogId).toBe('intent1');
    await waitFor(() =>
      expect(texts(result.current.messages)).toEqual([['assistant', 'What do you want to monitor?']]),
    );
    expect(fetchDialogMessages).toHaveBeenCalledWith(expect.objectContaining({ dialogId: 'intent1' }));
  });

  it('a dialog started with a prompt keeps its thread: no history read, the send shown once', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'prompted' }));
    const { result, transport, history } = setup({ history: { createDialog } });
    await act(async () => {
      await result.current.startNewDialog({ prompt: 'check disk space' });
    });
    expect(transport.publish).toHaveBeenCalledWith(
      'check disk space',
      expect.objectContaining({ dialogId: 'prompted' }),
    );
    await waitFor(() => expect(texts(result.current.messages)).toEqual([['user', 'check disk space']]));
    expect(history.fetchDialogMessages).not.toHaveBeenCalled();
  });

  it("a new intent dialog the server does not serve yet is read again, and its greeting shows: it isn't left", async () => {
    const greeting: HistoricalMessage[] = [
      {
        id: 'g1',
        createdAt: '2026-11-23T12:00:00Z',
        owner: { type: 'ASSISTANT' },
        parts: [{ type: 'TEXT', text: 'What should this script do?' }],
      },
    ];
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent2' }));
    const fetchDialogMessages = vi
      .fn((): Promise<FetchDialogMessagesResult> => Promise.resolve({ messages: greeting, nextCursor: null }))
      .mockResolvedValueOnce({ messages: [], nextCursor: null, missing: true });
    const { result } = setup({ history: { createDialog, fetchDialogMessages } });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_SCRIPT' });
    });
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await waitFor(() => expect(texts(result.current.messages)).toEqual([['assistant', 'What should this script do?']]));
    expect(result.current.activeDialogId).toBe('intent2');
  });

  it('a new intent dialog still missing on the second read stays open', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent3' }));
    const fetchDialogMessages = vi.fn((): Promise<FetchDialogMessagesResult> =>
      Promise.resolve({ messages: [], nextCursor: null, missing: true }),
    );
    const { result } = setup({ history: { createDialog, fetchDialogMessages } });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_POLICY' });
    });
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await waitFor(() => expect(result.current.isMessagesLoading).toBe(false));
    expect(result.current.activeDialogId).toBe('intent3');
  });

  it('an intent dialog started with a prompt keeps its send: no history read clears it', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent4' }));
    const { result, transport, history } = setup({ history: { createDialog } });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_POLICY', prompt: 'disk above 90%' });
    });
    expect(transport.publish).toHaveBeenCalledWith('disk above 90%', expect.objectContaining({ dialogId: 'intent4' }));
    await waitFor(() => expect(texts(result.current.messages)).toEqual([['user', 'disk above 90%']]));
    expect(history.fetchDialogMessages).not.toHaveBeenCalled();
  });

  it('startNewDialog with nothing to start opens the draft', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'x' }));
    const { result } = setup({ history: { createDialog } });
    await act(async () => {
      expect(await result.current.startNewDialog()).toBeNull();
    });
    expect(createDialog).not.toHaveBeenCalled();
    expect(result.current.activeDialogId).toBeNull();
  });
});

describe('useChatEngine: sending', () => {
  it('waits for the tail to subscribe before publishing, when the transport needs it', async () => {
    const publish = vi.fn();
    const { result, tail } = setup({
      dialogId: 'd1',
      transport: { awaitsSubscription: true, publish },
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    let sent: Promise<void | boolean> | undefined;
    act(() => {
      sent = result.current.sendMessage('go');
    });
    expect(publish).not.toHaveBeenCalled();
    act(() => tail.current?.onSubscribed?.());
    await act(async () => {
      await sent;
    });
    expect(publish).toHaveBeenCalledWith('go', expect.objectContaining({ dialogId: 'd1' }));
  });

  it("a failed send leaves its row in the thread, in the host's words, and frees the composer", async () => {
    const publish = vi.fn(() => Promise.reject(new Error('boom')));
    const { result } = setup({
      dialogId: 'd1',
      sendFailureText: () => 'Could not send.',
      transport: { publish },
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    await act(async () => {
      expect(await result.current.sendMessage('x')).toBe(false);
    });
    expect(result.current.streamingPhase).toBe('idle');
    expect(JSON.stringify(result.current.messages)).toContain('Could not send.');
  });

  it('a send over a pending escalation offer cancels it', async () => {
    const { result, tail } = setup({ dialogId: 'd1', sendSupersedesPending: true });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 8 }, 'message');
      tail.current?.onEvent(
        { type: 'ESCALATION_OFFER', offerId: 'o1', state: 'PENDING', text: 'Hand off?', streamSeq: 9 },
        'message',
      );
      tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 10 }, 'message');
    });
    const offerStatus = () =>
      result.current.messages.flatMap(message => message.parts).find(part => part.type === 'data-escalation-offer')
        ?.data.status;
    await waitFor(() => expect(offerStatus()).toBe('pending'));
    await act(async () => {
      await result.current.sendMessage('no thanks');
    });
    expect(offerStatus()).toBe('cancelled');
  });

  it('an escalation answer flips the card at once and puts it back when it fails', async () => {
    const onActionError = vi.fn();
    const approveEscalation = vi.fn(() => Promise.reject(new Error('down')));
    const { result, tail } = setup({
      dialogId: 'd1',
      onActionError,
      transport: { approveEscalation },
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 8 }, 'message');
      tail.current?.onEvent(
        { type: 'ESCALATION_OFFER', offerId: 'o1', state: 'PENDING', text: 'Hand off?', streamSeq: 9 },
        'message',
      );
      tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 10 }, 'message');
    });
    await waitFor(() => expect(result.current.actions.approveEscalation).toBeDefined());
    await act(async () => {
      await result.current.actions.approveEscalation?.('o1');
    });
    expect(onActionError).toHaveBeenCalledWith('approveEscalation', expect.any(Error));
    const offer = result.current.messages
      .flatMap(message => message.parts)
      .find(p => p.type === 'data-escalation-offer');
    expect(offer?.data.status).toBe('pending');
  });
});

/**
 * A send typed while its dialog's first history page is still read (CU-17tkuw6924d): the bubble shows at once, the
 * publish waits for the final page and the tail, and the page goes before the send instead of replacing it.
 */
describe('useChatEngine: a send while the first page is read', () => {
  const GREETING: HistoricalMessage[] = [
    {
      id: 'g1',
      createdAt: '2026-11-23T12:00:00Z',
      owner: { type: 'ASSISTANT' },
      parts: [{ type: 'TEXT', text: 'What do you want to monitor?' }],
    },
  ];

  function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>(settle => {
      resolve = settle;
    });
    return { promise, resolve };
  }

  it('a fresh intent dialog read again: the send waits for the re-read and the tail, and stays under the greeting', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent5' }));
    const fetchDialogMessages = vi
      .fn((): Promise<FetchDialogMessagesResult> => Promise.resolve({ messages: GREETING, nextCursor: null }))
      .mockResolvedValueOnce({ messages: [], nextCursor: null, missing: true });
    const publish = vi.fn();
    const { result, tail } = setup({ history: { createDialog, fetchDialogMessages }, transport: { publish } });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_POLICY' });
    });
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(1));
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('disk above 90%');
    });
    expect(texts(result.current.messages)).toContainEqual(['user', 'disk above 90%']);
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(2), { timeout: 3000 });
    await waitFor(() => expect(tail.current?.fromSeq).toBeNull());
    expect(publish).not.toHaveBeenCalled();
    act(() => tail.current?.onSubscribed?.());
    await act(async () => {
      expect(await sent).toBe(true);
    });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(
      texts(result.current.messages)
        .filter(([role]) => role !== 'assistant' || true)
        .slice(0, 2),
    ).toEqual([
      ['assistant', 'What do you want to monitor?'],
      ['user', 'disk above 90%'],
    ]);
  });

  it('a send while the first read is in flight: the page goes before it, the echo spends its entry, one bubble', async () => {
    const page = deferred<FetchDialogMessagesResult>();
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent6' }));
    const fetchDialogMessages = vi.fn(() => page.promise);
    const publish = vi.fn();
    const { result, tail } = setup({ history: { createDialog, fetchDialogMessages }, transport: { publish } });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_POLICY' });
    });
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(1));
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('disk above 90%');
    });
    await act(async () => {
      page.resolve({ messages: GREETING, nextCursor: null });
      await Promise.resolve();
    });
    expect(publish).not.toHaveBeenCalled();
    act(() => tail.current?.onSubscribed?.());
    await act(async () => {
      await sent;
    });
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_REQUEST', text: 'disk above 90%', streamSeq: 3 }, 'message');
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 4 }, 'message');
      tail.current?.onEvent({ type: 'TEXT', text: 'On it', streamSeq: 5 }, 'message');
      tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 6 }, 'message');
    });
    await waitFor(() => expect(result.current.streamingPhase).toBe('idle'));
    expect(texts(result.current.messages)).toEqual([
      ['assistant', 'What do you want to monitor?'],
      ['user', 'disk above 90%'],
      ['assistant', 'On it'],
    ]);
  });

  it('a repeat of an earlier text sent while an existing dialog loads shows as its own bubble', async () => {
    const page = deferred<FetchDialogMessagesResult>();
    const yes: HistoricalMessage[] = [
      { id: 'u1', createdAt: '2026-11-24T09:00:00Z', owner: { type: 'ADMIN' }, parts: [{ type: 'TEXT', text: 'yes' }] },
      {
        id: 'a1',
        createdAt: '2026-11-24T09:00:01Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 7,
        parts: [{ type: 'TEXT', text: 'Done' }],
      },
    ];
    const publish = vi.fn();
    const { result, tail } = setup({
      dialogId: 'd1',
      history: { fetchDialogMessages: () => page.promise },
      transport: { publish },
    });
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('yes');
    });
    await act(async () => {
      page.resolve({ messages: yes, nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    act(() => tail.current?.onSubscribed?.());
    await act(async () => {
      await sent;
    });
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_REQUEST', text: 'yes', streamSeq: 8 }, 'message');
    });
    expect(texts(result.current.messages).filter(([role]) => role === 'user')).toEqual([
      ['user', 'yes'],
      ['user', 'yes'],
    ]);
  });

  it('the publish waits for the tail: the echo of a history with no seq is not published before it subscribes', async () => {
    const page = deferred<FetchDialogMessagesResult>();
    const publish = vi.fn();
    const { result, tail } = setup({
      dialogId: 'd2',
      history: { fetchDialogMessages: () => page.promise },
      transport: { publish },
    });
    act(() => {
      void result.current.sendMessage('hello');
    });
    await act(async () => {
      page.resolve({ messages: GREETING, nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBeNull());
    expect(publish).not.toHaveBeenCalled();
    act(() => tail.current?.onSubscribed?.());
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
  });

  it('a dialog still missing after the re-read takes no send: it fails where it was typed', async () => {
    const createDialog = vi.fn(() => Promise.resolve({ dialogId: 'intent7' }));
    const fetchDialogMessages = vi.fn((): Promise<FetchDialogMessagesResult> =>
      Promise.resolve({ messages: [], nextCursor: null, missing: true }),
    );
    const publish = vi.fn();
    const { result } = setup({
      history: { createDialog, fetchDialogMessages },
      transport: { publish },
      sendFailureText: () => 'Could not send.',
    });
    await act(async () => {
      await result.current.startNewDialog({ intent: 'CREATE_POLICY' });
    });
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('anything');
    });
    await act(async () => {
      expect(await sent).toBe(false);
    });
    expect(publish).not.toHaveBeenCalled();
    expect(result.current.streamingPhase).toBe('idle');
    expect(JSON.stringify(result.current.messages)).toContain('Could not send.');
  });

  it('Stop before the page lands cancels the send: nothing is published, and no turn is stopped on the server', async () => {
    const page = deferred<FetchDialogMessagesResult>();
    const publish = vi.fn();
    const stop = vi.fn(() => Promise.resolve());
    const { result, tail } = setup({
      dialogId: 'd3',
      history: { fetchDialogMessages: () => page.promise },
      transport: { publish, stop },
    });
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('wait');
    });
    act(() => result.current.stopMessage());
    await act(async () => {
      expect(await sent).toBe(false);
    });
    await act(async () => {
      page.resolve({ messages: GREETING, nextCursor: null });
      await Promise.resolve();
    });
    act(() => tail.current?.onSubscribed?.());
    expect(publish).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(result.current.streamingPhase).toBe('idle');
    expect(texts(result.current.messages)).toContainEqual(['user', 'wait']);
  });

  it('leaving the dialog before its page lands fails the send instead of publishing it', async () => {
    const page = deferred<FetchDialogMessagesResult>();
    const publish = vi.fn();
    const { result } = setup({
      history: { fetchDialogMessages: () => page.promise },
      transport: { publish },
    });
    act(() => result.current.selectDialog('d4'));
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('going');
    });
    act(() => result.current.selectDialog('d5'));
    await act(async () => {
      expect(await sent).toBe(false);
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('a pending approval the page brings is resolved when the held send goes out', async () => {
    const page = deferred<FetchDialogMessagesResult>();
    const pendingApproval: HistoricalMessage[] = [
      {
        id: 'a1',
        createdAt: '2026-11-24T09:00:00Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 7,
        parts: [
          {
            type: 'APPROVAL_REQUEST',
            approvalRequestId: 'ar-1',
            approvalType: 'ADMIN',
            toolCalls: [{ toolExecutionRequestId: 'ar-1', toolName: 'run_script', requiresApproval: true }],
          },
        ],
      },
    ];
    const { result, tail } = setup({
      dialogId: 'd6',
      sendSupersedesPending: true,
      history: { fetchDialogMessages: () => page.promise },
    });
    let sent: Promise<boolean | void> | undefined;
    act(() => {
      sent = result.current.sendMessage('never mind');
    });
    await act(async () => {
      page.resolve({ messages: pendingApproval, nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    act(() => tail.current?.onSubscribed?.());
    await act(async () => {
      await sent;
    });
    const card = result.current.messages.flatMap(message => message.parts).find(isToolPart);
    expect(card && approvalStatusOf(card)).not.toBe('pending');
  });
});

/**
 * A replaying tail back from a gap (CU-17tkuw691j4): its catch-up replays turns that began before a send made since.
 * The engine opens the backlog window for it, so their boundaries do not spend the send's echo entry.
 */
describe('useChatEngine: a send across a reconnect catch-up', () => {
  const withSend = (text: string): HistoricalMessage[] => [
    ...persisted,
    { id: 'u-sent', createdAt: '2026-11-04T10:00:05Z', owner: { type: 'CLIENT' }, parts: [{ type: 'TEXT', text }] },
  ];

  async function opened(fetchDialogMessages: ChatHistoryBackend['fetchDialogMessages']) {
    const hook = setup({ dialogId: 'd1', history: { fetchDialogMessages } });
    await waitFor(() => expect(hook.tail.current?.fromSeq).toBe(7));
    act(() => {
      hook.tail.current?.onSubscribed?.();
      hook.tail.current?.onReplayComplete?.();
    });
    return hook;
  }
  const users = (messages: Parameters<typeof texts>[0]) => texts(messages).filter(([role]) => role === 'user');

  it("the catch-up's replayed turn does not spend the send's echo: one bubble after the resync refetch", async () => {
    const fetchDialogMessages = vi
      .fn((): Promise<FetchDialogMessagesResult> => Promise.resolve({ messages: withSend('again'), nextCursor: null }))
      .mockResolvedValueOnce({ messages: persisted, nextCursor: null });
    const { result, tail } = await opened(fetchDialogMessages);
    await act(async () => {
      await result.current.sendMessage('again');
    });
    act(() => {
      tail.current?.onCatchUpStart?.();
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 8 }, 'message');
      tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 9 }, 'message');
      tail.current?.onResync();
    });
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(users(result.current.messages)).toEqual([['user', 'again']]));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_REQUEST', text: 'again', streamSeq: 10 }, 'message');
    });
    expect(users(result.current.messages)).toEqual([['user', 'again']]);
  });

  it('a catch-up that never reports closes its window on the cap: boundaries purge again', async () => {
    const { result, tail } = await opened(() => Promise.resolve({ messages: persisted, nextCursor: null }));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      act(() => tail.current?.onCatchUpStart?.());
      act(() => {
        vi.advanceTimersByTime(10_000);
      });
    } finally {
      vi.useRealTimers();
    }
    await act(async () => {
      await result.current.sendMessage('later');
    });
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 8 }, 'message');
      tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 9 }, 'message');
      tail.current?.onEvent({ type: 'MESSAGE_REQUEST', text: 'later', streamSeq: 10 }, 'message');
    });
    // The documented limit outside a window: the replayed end purged the entry, so the echo draws its own row.
    expect(users(result.current.messages)).toEqual([
      ['user', 'later'],
      ['user', 'later'],
    ]);
  });
});
