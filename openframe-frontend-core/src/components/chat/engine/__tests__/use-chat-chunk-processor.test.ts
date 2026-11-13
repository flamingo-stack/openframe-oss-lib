/**
 * `useChatChunkProcessor`, the one raw-chunk-to-thread path of every NATS chat. Moved here with the Fae client's
 * `useRealtimeChunkProcessor` and `chatThread.ts` (whose direct-message and observer cases these are) and the OpenFrame web
 * app's processor (the eviction re-seed and the persisted approval statuses).
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createChatDialogStore } from '../../stream/chat-dialog-store';
import { createChatThreadStore } from '../chat-thread-store';
import { useChatChunkProcessor, type ChatChunkObservers } from '../use-chat-chunk-processor';

function setup(
  options: { ownDirectOwnerType?: string; otherDisplayName?: string; ownUserId?: () => string | undefined } = {},
) {
  const store = createChatThreadStore<string>();
  const observers: Required<ChatChunkObservers> = {
    onTokenUsage: vi.fn(),
    onDialogClosed: vi.fn(),
    onTicketEvent: vi.fn(),
    onOtherDirectMessage: vi.fn(),
    onOwnDirectEcho: vi.fn(),
    onOfferResolved: vi.fn(),
    onApprovalResolved: vi.fn(),
    onError: vi.fn(),
  };
  const { result } = renderHook(() => useChatChunkProcessor({ thread: store.bind('d'), observers, ...options }));
  const thread = () => {
    store.flush();
    return store.snapshotOf('d').messages;
  };
  return { store, observers, feed: result.current, thread };
}

describe('a live turn', () => {
  it('draws its text and its record cards in one message, and locks only while it runs', () => {
    const { store, feed, thread } = setup();
    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    expect(store.snapshotOf('d').phase).toBe('streaming');
    feed({ type: 'TEXT', text: 'See ', streamSeq: 2 });
    feed({ type: 'RECORD_CARDS', records: ['record://onboarding_guide/mac'], streamSeq: 3 });
    feed({ type: 'MESSAGE_END', streamSeq: 4 });

    expect(thread()).toHaveLength(1);
    expect(thread()[0].parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'See ' }),
      { type: 'data-record-cards', data: { records: ['record://onboarding_guide/mac'] } },
    ]);
    expect(store.snapshotOf('d').phase).toBe('idle');
  });

  it('tells the host what is not the thread: tokens, a closed dialog, a ticket event, an error', () => {
    const { feed, observers } = setup();
    feed({ type: 'TOKEN_USAGE', inputTokensSize: 3, outputTokensSize: 4, totalTokensSize: 7, contextSize: 9 });
    feed({ type: 'DIALOG_CLOSED' });
    feed({ type: 'TICKET_EVENT', kind: 'REOPENED', sequenceId: 9 });
    feed({ type: 'ERROR', error: 'Boom' });

    expect(observers.onTokenUsage).toHaveBeenCalledWith(expect.objectContaining({ totalTokensSize: 7 }));
    expect(observers.onDialogClosed).toHaveBeenCalledOnce();
    expect(observers.onTicketEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: 'REOPENED' }));
    expect(observers.onError).toHaveBeenCalledOnce();
  });

  it('an answered card reaches the host with who answered; a run granting its own row is no answer', () => {
    const { feed, observers } = setup();
    feed({
      type: 'EXECUTING_TOOL',
      integratedToolType: 'A',
      toolFunction: 'b',
      toolExecutionRequestId: 'x',
      streamSeq: 1,
    });
    expect(observers.onApprovalResolved).not.toHaveBeenCalled();

    feed({
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'r1',
      approvalType: 'CLIENT',
      toolCalls: [{ toolExecutionRequestId: 't1', toolName: 'restart', requiresApproval: true }],
      streamSeq: 2,
    });
    feed({ type: 'APPROVAL_RESULT', approvalRequestId: 'r1', approved: true, resolvedByName: 'Ann', streamSeq: 3 });
    expect(observers.onApprovalResolved).toHaveBeenCalledWith('r1', 'approved', 'Ann');
  });

  it("an offer's resolution reaches the host", () => {
    const { feed, observers } = setup();
    feed({ type: 'ESCALATION_OFFER', offerId: 'o1', state: 'PENDING', text: 'Hand off?', streamSeq: 1 });
    feed({ type: 'ESCALATION_OFFER', offerId: 'o1', state: 'APPROVED', streamSeq: 2 });
    expect(observers.onOfferResolved).toHaveBeenCalledWith('o1', 'approved');
  });
});

describe('a chat a person writes into', () => {
  it("the viewer's own echo is no row: the optimistic bubble already shows it", () => {
    const { store, feed, thread, observers } = setup({ ownDirectOwnerType: 'CLIENT', otherDisplayName: 'Technician' });
    store.pushOptimisticSend('d', 'Hello');
    feed({ type: 'DIRECT_MESSAGE', text: 'Hello', ownerType: 'CLIENT', streamSeq: 5 });

    expect(thread().filter(message => message.role === 'user')).toHaveLength(1);
    expect(observers.onOwnDirectEcho).toHaveBeenCalledWith(5);
    expect(observers.onOtherDirectMessage).not.toHaveBeenCalled();
  });

  it("another person's message is a row, named by the chat when it names nobody", () => {
    const { feed, thread, observers } = setup({ ownDirectOwnerType: 'CLIENT', otherDisplayName: 'Technician' });
    feed({ type: 'DIRECT_MESSAGE', text: 'On it', ownerType: 'ADMIN', streamSeq: 1 });
    feed({ type: 'DIRECT_MESSAGE', text: 'Still on it', ownerType: 'ADMIN', displayName: 'Ann', streamSeq: 2 });

    expect(thread().map(message => message.metadata?.author?.name)).toEqual(['Technician', 'Ann']);
    expect(observers.onOtherDirectMessage).toHaveBeenCalledTimes(2);
  });

  // The backend's direct messages name no author (`userId`): two technicians in one chat are both ADMIN, so a nameless
  // ADMIN message is the viewer's only when it answers a send of theirs.
  it("a colleague's nameless message is a row and does not close the viewer's turn", () => {
    const { feed, thread, observers } = setup({ ownDirectOwnerType: 'ADMIN', ownUserId: () => 'tech-a' });
    feed({ type: 'DIRECT_MESSAGE', text: 'I will take it', ownerType: 'ADMIN', displayName: 'Bob', streamSeq: 1 });

    expect(thread().map(message => message.metadata?.author?.name)).toEqual(['Bob']);
    expect(observers.onOwnDirectEcho).not.toHaveBeenCalled();
    expect(observers.onOtherDirectMessage).toHaveBeenCalledTimes(1);
  });

  it("a nameless message answering the viewer's send is its echo, once", () => {
    const { store, feed, thread, observers } = setup({ ownDirectOwnerType: 'ADMIN', ownUserId: () => 'tech-a' });
    store.pushOptimisticSend('d', 'On it');
    feed({ type: 'DIRECT_MESSAGE', text: 'On it', ownerType: 'ADMIN', streamSeq: 1 });
    // The same words from a colleague right after: the viewer's send is spent, so this one is theirs.
    feed({ type: 'DIRECT_MESSAGE', text: 'On it', ownerType: 'ADMIN', displayName: 'Bob', streamSeq: 2 });

    expect(thread().filter(message => message.role === 'user')).toHaveLength(2);
    expect(observers.onOwnDirectEcho).toHaveBeenCalledTimes(1);
    expect(observers.onOwnDirectEcho).toHaveBeenCalledWith(1);
    expect(observers.onOtherDirectMessage).toHaveBeenCalledTimes(1);
  });

  it('a message naming the viewer is their echo, one naming another technician is not', () => {
    const { feed, thread, observers } = setup({ ownDirectOwnerType: 'ADMIN', ownUserId: () => 'tech-a' });
    feed({ type: 'DIRECT_MESSAGE', text: 'Mine', ownerType: 'ADMIN', userId: 'tech-a', streamSeq: 1 });
    feed({ type: 'DIRECT_MESSAGE', text: 'Theirs', ownerType: 'ADMIN', userId: 'tech-b', streamSeq: 2 });

    expect(thread().map(message => message.parts.map(part => ('text' in part ? part.text : '')).join(''))).toEqual([
      'Theirs',
    ]);
    expect(observers.onOwnDirectEcho).toHaveBeenCalledWith(1);
  });

  it('without the rules, a direct message is drawn as it came', () => {
    const { feed, thread } = setup();
    feed({ type: 'DIRECT_MESSAGE', text: 'Hello', ownerType: 'CLIENT', streamSeq: 1 });
    expect(thread()).toHaveLength(1);
  });
});

describe('an evicted reducer', () => {
  it('is re-seeded from the thread the host holds, and gets the persisted statuses again', () => {
    const store = createChatThreadStore<string>({
      createStore: storeOptions => createChatDialogStore({ ...storeOptions, maxReducers: 1 }),
    });
    const held = [{ id: 'u1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'hello' }] }];
    store.hydrate('a', held);
    store.setActiveKeys(['a']);
    store.setActiveKeys([]);

    const { rerender } = renderHook(
      ({ epoch: _epoch }) =>
        useChatChunkProcessor({ thread: store.bind('a'), messages: held, approvalStatuses: { r: 'approved' } }),
      { initialProps: { epoch: 0 } },
    );
    store.hydrate('b', []);
    rerender({ epoch: 1 });

    expect(store.snapshotOf('a').messages).toEqual(held);
    expect(store.snapshotOf('a').state.approvalStatuses).toEqual({ r: 'approved' });
  });
});
