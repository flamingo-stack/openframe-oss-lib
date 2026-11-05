/**
 * `useChatEngine` over a transport that replays (JetStream, the Tauri bridge): the tail opens after the history, from the
 * history's last sequence; its chunks go straight to the thread; a resync refetches the history; and a store handed in
 * keeps the thread across an unmount. The NATS WebSocket path (no replay, the back-fill) is pinned by the
 * `nats-adapter-*` tests, which run on this engine through `useNatsChatAdapter`.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { textOfParts } from '../../../../chat-protocol/chat-message';
import type { HistoricalMessage } from '../../types';
import { createChatThreadStore } from '../chat-thread-store';
import type { ChatLiveTailOptions, ChatTransport, FetchDialogMessagesResult } from '../chat-transport';
import { useChatEngine, type UseChatEngineConfig } from '../use-chat-engine';

const persisted: HistoricalMessage[] = [
  { id: 'u1', createdAt: '2026-11-04T10:00:00Z', owner: { type: 'CLIENT' }, parts: [{ type: 'TEXT', text: 'hi' }] },
  {
    id: 'a1',
    createdAt: '2026-11-04T10:00:01Z',
    owner: { type: 'ASSISTANT' },
    lastChunkStreamSeq: 7,
    parts: [{ type: 'TEXT', text: 'hello' }],
  },
];

function setup(overrides: Partial<UseChatEngineConfig> = {}) {
  const tail: { current: ChatLiveTailOptions | null } = { current: null };
  const transport: ChatTransport = {
    replays: true,
    useLiveTail: options => {
      tail.current = options;
    },
    publish: vi.fn(),
  };
  const fetchDialogMessages = vi.fn((): Promise<FetchDialogMessagesResult> =>
    Promise.resolve({ messages: persisted, nextCursor: null }),
  );
  const config: UseChatEngineConfig = { transport, history: { fetchDialogMessages }, dialogId: 'd1', ...overrides };
  const hook = renderHook(() => useChatEngine(config));
  return { ...hook, tail, transport, fetchDialogMessages };
}

const texts = (messages: { role: string; parts: Parameters<typeof textOfParts>[0] }[]) =>
  messages.map(message => [message.role, textOfParts(message.parts)]);

describe('useChatEngine over a replaying tail', () => {
  it('opens the tail only once the history is read, right after its last sequence', async () => {
    const { result, tail } = setup();
    expect(tail.current?.fromSeq).toBeUndefined();
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    expect(result.current.isMessagesLoading).toBe(false);
  });

  it("puts the tail's chunks straight into the thread", async () => {
    const { result, tail } = setup();
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 8 }, 'message');
      tail.current?.onEvent({ type: 'TEXT', text: 'more', streamSeq: 9 }, 'message');
      tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 10 }, 'message');
    });
    await waitFor(() =>
      expect(texts(result.current.messages)).toEqual([
        ['user', 'hi'],
        ['assistant', 'hello'],
        ['assistant', 'more'],
      ]),
    );
    expect(result.current.connectionState).toBe('connected');
  });

  it('refetches the history when the tail says it resynced after a gap', async () => {
    const { tail, fetchDialogMessages } = setup();
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    expect(fetchDialogMessages).toHaveBeenCalledTimes(1);
    act(() => tail.current?.onResync());
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(2));
  });

  it('sends through the transport, with what the composer attached', async () => {
    const { result, transport } = setup();
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    await act(async () => {
      await result.current.sendMessage('next', { contextItems: [{ type: 'DEVICE', id: 'm1', label: 'Mac' }] });
    });
    expect(transport.publish).toHaveBeenCalledWith(
      'next',
      expect.objectContaining({
        dialogId: 'd1',
        hidden: false,
        contextItems: [{ type: 'DEVICE', id: 'm1', label: 'Mac' }],
      }),
    );
    const drawn = texts(result.current.messages);
    expect(drawn[drawn.length - 2]).toEqual(['user', 'next']);
  });

  it('a store handed in keeps the thread across an unmount', async () => {
    const store = createChatThreadStore<string>();
    const first = setup({ store });
    await waitFor(() => expect(first.result.current.messages).toHaveLength(2));
    first.unmount();
    expect(store.snapshotOf('d1').messages).toHaveLength(2);
  });
});
