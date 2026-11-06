/**
 * A dialog with sides: a ticket's end-user chat and its technician's, each one engine over one store of dialogs with
 * sides. What a ticket's client chat did by hand beside the engine is the engine's: the cross-side projections, the
 * direct-mode barrier the host knows of, the end user's direct reply drawn as theirs, the technician's own echo left out
 * while another technician's message is drawn, and the model the history's newest answer ran on.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isToolPart } from '../../../../chat-protocol/chat-message';
import type { HistoricalMessage } from '../../types';
import { chatDialogSideKey, chatDialogSideOf, createChatDialogSidesStore } from '../chat-dialog-sides';
import { createChatThreadStore } from '../chat-thread-store';
import type { ChatLiveTailOptions, ChatLiveTailTransport, FetchDialogMessagesResult } from '../chat-transport';
import { useChatEngine, type UseChatEngineConfig } from '../use-chat-engine';

type Side = 'client' | 'admin';

function sideEngine(
  side: Side,
  store: ReturnType<typeof createChatDialogSidesStore>,
  config: Partial<Omit<UseChatEngineConfig, 'transport' | 'store' | 'side'>> = {},
  history: HistoricalMessage[] = [],
) {
  const tail: { current: ChatLiveTailOptions | null } = { current: null };
  const transport: ChatLiveTailTransport = {
    replays: true,
    useLiveTail: options => {
      tail.current = options;
    },
    publish: vi.fn(),
  };
  const fetchDialogMessages = vi.fn((): Promise<FetchDialogMessagesResult> =>
    Promise.resolve({ messages: history, nextCursor: null }),
  );
  const hook = renderHook(
    (props: { directMode?: boolean }) =>
      useChatEngine({
        dialogId: 'd1',
        ...config,
        ...props,
        side,
        store,
        transport,
        history: { fetchDialogMessages },
      }),
    { initialProps: {} },
  );
  const feed = (raw: unknown) => act(() => tail.current?.onEvent(raw, 'message'));
  return { ...hook, tail, transport, feed };
}

const approvalRequest = {
  type: 'APPROVAL_REQUEST',
  approvalRequestId: 'ar-1',
  approvalType: 'ADMIN',
  streamSeq: 1,
  toolCalls: [{ toolExecutionRequestId: 'run-1', toolName: 'run_script', requiresApproval: true }],
};

describe('a store of dialogs with sides', () => {
  it('keys a thread by its dialog and side, and reads the pair back', () => {
    expect(chatDialogSideOf(chatDialogSideKey('d1', 'client'))).toEqual({ dialogId: 'd1', side: 'client' });
    expect(chatDialogSideOf('d1')).toEqual({ dialogId: 'd1', side: 'main' });
  });

  it("an approval answered on one side shows on the other side's card", async () => {
    const store = createChatDialogSidesStore<Side>({ sides: ['client', 'admin'] });
    const admin = sideEngine('admin', store);
    const client = sideEngine('client', store);
    await waitFor(() => expect(admin.tail.current?.fromSeq).toBeNull());
    await waitFor(() => expect(client.tail.current?.fromSeq).toBeNull());

    admin.feed(approvalRequest);
    client.feed({ type: 'APPROVAL_RESULT', approvalRequestId: 'ar-1', approved: false, streamSeq: 2 });

    const card = admin.result.current.messages.flatMap(message => message.parts).filter(isToolPart);
    expect(card.map(part => part.state)).toEqual(['output-denied']);
  });

  it('refuses a side over a store that keeps every key as a dialog', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      renderHook(() =>
        useChatEngine({
          dialogId: 'd1',
          side: 'client',
          store: createChatThreadStore<string>(),
          transport: { useLiveTail: () => undefined, publish: vi.fn() },
        }),
      ),
    ).toThrow(/createChatDialogSidesStore/);
  });
});

describe("a ticket's client chat on the engine", () => {
  it("drops the assistant's chunks once the host says the dialog is in direct mode", async () => {
    const store = createChatDialogSidesStore<Side>({ sides: ['client', 'admin'] });
    const client = sideEngine('client', store);
    await waitFor(() => expect(client.tail.current?.fromSeq).toBeNull());
    client.rerender({ directMode: true });
    client.feed({ type: 'MESSAGE_START', streamSeq: 1 });
    client.feed({ type: 'TEXT', text: 'the assistant again', streamSeq: 2 });
    expect(client.result.current.messages).toEqual([]);
  });

  it("draws the end user's direct reply as theirs, and the technician's as the technician's", async () => {
    const store = createChatDialogSidesStore<Side>({ sides: ['client', 'admin'] });
    const client = sideEngine('client', store);
    await waitFor(() => expect(client.tail.current?.fromSeq).toBeNull());
    client.feed({
      type: 'DIRECT_MESSAGE',
      text: 'my disk is full',
      ownerType: 'CLIENT',
      displayName: 'Ann PC',
      streamSeq: 1,
    });
    client.feed({ type: 'DIRECT_MESSAGE', text: 'on it', ownerType: 'ADMIN', displayName: 'Bob', streamSeq: 2 });
    expect(client.result.current.messages.map(message => message.metadata?.author)).toEqual([
      { name: 'Ann PC', authorType: 'user' },
      { name: 'Bob', authorType: 'admin' },
    ]);
  });

  it("leaves out the technician's own echo and closes the send's turn; another technician's message is drawn", async () => {
    const store = createChatDialogSidesStore<Side>({ sides: ['client', 'admin'] });
    const client = sideEngine('client', store, {
      directMessages: { ownDirectOwnerType: 'ADMIN', ownUserId: () => 'u-me' },
    });
    await waitFor(() => expect(client.tail.current?.fromSeq).toBeNull());
    await act(async () => {
      await client.result.current.sendMessage('restarting it now');
    });
    expect(client.result.current.streamingPhase).not.toBe('idle');

    client.feed({
      type: 'DIRECT_MESSAGE',
      text: 'restarting it now',
      ownerType: 'ADMIN',
      userId: 'u-me',
      streamSeq: 1,
    });
    client.feed({ type: 'DIRECT_MESSAGE', text: 'I can take it', ownerType: 'ADMIN', userId: 'u-other', streamSeq: 2 });

    expect(client.result.current.streamingPhase).toBe('idle');
    const texts = client.result.current.messages
      .filter(message => message.role === 'user')
      .map(message => message.parts.map(part => ('text' in part ? part.text : '')).join(''));
    expect(texts).toEqual(['restarting it now', 'I can take it']);
  });

  it('names the model the newest answer in the history ran on, before the host baseline', async () => {
    const store = createChatDialogSidesStore<Side>({ sides: ['client', 'admin'] });
    const history: HistoricalMessage[] = [
      {
        id: 'a1',
        createdAt: '2026-11-04T10:00:01Z',
        owner: { type: 'ASSISTANT', model: 'claude-x', modelName: 'Claude X', providerName: 'anthropic' },
        lastChunkStreamSeq: 3,
        parts: [{ type: 'TEXT', text: 'hello' }],
      },
    ];
    const client = sideEngine(
      'client',
      store,
      { modelProvider: 'openai', modelLabel: 'Baseline', historyModelLabel: (_provider, model) => `label:${model}` },
      history,
    );
    await waitFor(() => expect(client.tail.current?.fromSeq).toBe(3));
    expect(client.result.current.currentProvider).toBe('anthropic');
    expect(client.result.current.currentModelLabel).toBe('label:claude-x');
  });
});
