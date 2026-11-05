/**
 * What every web chat gets from the engine by naming its backend's capabilities, so no host writes them again: the list's
 * server-side search and owner scope, the open dialog's record and why it could not be read, a dialog created on the
 * first send or for a launcher, a publish that waits for the tail, the optimistic answer of an escalation offer, a send
 * over a pending card, a failed send's row, and the at-least-once tail's redelivery gate.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { textOfParts } from '../../../../chat-protocol/chat-message';
import type { DialogItem, HistoricalMessage } from '../../types';
import type { FetchDialogsParams } from '../../types/unified-chat-state.types';
import {
  redeliveryGate,
  type ChatHistoryBackend,
  type ChatLiveTailOptions,
  type ChatTransport,
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

function setup(config: Partial<UseChatEngineConfig> & { history?: ChatHistoryBackend } = {}) {
  const tail: { current: ChatLiveTailOptions | null } = { current: null };
  const transport: ChatTransport = {
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
      transport: { awaitsSubscription: true, publish } as unknown as ChatTransport,
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
      transport: { publish } as unknown as ChatTransport,
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
      transport: { approveEscalation } as unknown as ChatTransport,
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
