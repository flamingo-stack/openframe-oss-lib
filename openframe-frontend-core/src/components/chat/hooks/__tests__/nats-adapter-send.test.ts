/**
 * A send over a turn that ended with no MESSAGE_END (a crash, a lost chunk): what the decoder still holds of that turn stays
 * in its bubble, above the new message. Driven through the adapter's own subscription callback, so the decoder, the catch-up
 * and the reducer are the real ones.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { textOfParts } from '../../../../chat-protocol/chat-message';
import { useNatsChatAdapter } from '../use-nats-chat-adapter';

const subscription = vi.hoisted(() => ({ onEvent: (_payload: unknown, _messageType: string): void => {} }));

vi.mock('../use-nats-dialog-subscription', () => ({
  useNatsDialogSubscription: (options: { onEvent: typeof subscription.onEvent }) => {
    subscription.onEvent = options.onEvent;
  },
}));

async function openDialog() {
  const hook = renderHook(() =>
    useNatsChatAdapter({
      getNatsWsUrl: () => null,
      publishUserMessage: vi.fn(),
      fetchChunks: vi.fn(() => Promise.resolve([])),
      fetchDialogs: vi.fn(() =>
        Promise.resolve({
          dialogs: [{ id: 'd1', title: 'Chat', timestamp: new Date('2026-08-01T00:00:00Z') }],
          nextCursor: null,
        }),
      ),
      fetchDialogMessages: vi.fn(() => Promise.resolve({ messages: [], nextCursor: null })),
    }),
  );
  await waitFor(() => expect(hook.result.current.dialogs).toHaveLength(1));
  act(() => hook.result.current.selectDialog('d1'));
  await waitFor(() => expect(hook.result.current.streamingPhase).toBe('idle'));
  return hook;
}

describe('useNatsChatAdapter: the message a turn writes', () => {
  it('is named while the stream runs, and by nothing between turns', async () => {
    const { result } = await openDialog();
    const feed = (chunk: Record<string, unknown>) => act(() => subscription.onEvent(chunk, 'message'));
    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'hello', streamSeq: 2 });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.writingMessageId).toBe(result.current.messages[0].id);
    feed({ type: 'MESSAGE_END', streamSeq: 3 });
    await waitFor(() => expect(result.current.writingMessageId).toBeNull());
  });
});

describe('useNatsChatAdapter: a send', () => {
  it('lands what the decoder holds in the turn it belongs to, not below the new message', async () => {
    const { result } = await openDialog();
    const feed = (chunk: Record<string, unknown>) => act(() => subscription.onEvent(chunk, 'message'));
    const thread = () => result.current.messages.map(message => [message.role, textOfParts(message.parts)]);

    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'answer with `open code', streamSeq: 2 });
    await act(async () => {
      await result.current.sendMessage('next q');
    });
    feed({ type: 'MESSAGE_START', streamSeq: 3 });
    feed({ type: 'TEXT', text: 'fresh', streamSeq: 4 });
    feed({ type: 'MESSAGE_END', streamSeq: 5 });

    await waitFor(() =>
      expect(thread()).toEqual([
        ['assistant', 'answer with `open code'],
        ['user', 'next q'],
        ['assistant', 'fresh'],
      ]),
    );
  });
});
