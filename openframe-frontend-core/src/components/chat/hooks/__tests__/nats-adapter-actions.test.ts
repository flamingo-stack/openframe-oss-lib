/**
 * What a card's buttons do on Mingo: a button names its row, the backend knows the request. The composer locks on an approve
 * and stays free on a reject, and a failed approve hands the lock back.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isToolPart } from '../../../../chat-protocol/chat-message';
import type { HistoricalMessage } from '../../types';
import { useNatsChatAdapter, type UseNatsChatAdapterConfig } from '../use-nats-chat-adapter';

const BATCH_ROW: HistoricalMessage = {
  id: 'a1',
  createdAt: '2026-08-01T10:00:00Z',
  owner: { type: 'ASSISTANT' },
  parts: [
    {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'batch-1',
      approvalType: 'CLIENT',
      toolCalls: [{ toolExecutionRequestId: 'exec-a', toolName: 'create_ticket', requiresApproval: true }],
    } as never,
  ],
};

function makeConfig(overrides: Partial<UseNatsChatAdapterConfig> = {}): UseNatsChatAdapterConfig {
  return {
    getNatsWsUrl: () => null,
    publishUserMessage: vi.fn(),
    fetchChunks: vi.fn(() => Promise.resolve([])),
    fetchDialogs: vi.fn(() =>
      Promise.resolve({
        dialogs: [{ id: 'd1', title: 'Chat', timestamp: new Date('2026-08-01T00:00:00Z') }],
        nextCursor: null,
      }),
    ),
    fetchDialogMessages: vi.fn(() => Promise.resolve({ messages: [BATCH_ROW], nextCursor: null })),
    ...overrides,
  };
}

async function withCard(config: UseNatsChatAdapterConfig) {
  const hook = renderHook(() => useNatsChatAdapter(config));
  await waitFor(() => expect(hook.result.current.dialogs).toHaveLength(1));
  act(() => hook.result.current.selectDialog('d1'));
  await waitFor(() => expect(hook.result.current.messages.flatMap(m => m.parts).filter(isToolPart)).toHaveLength(1));
  await waitFor(() => expect(hook.result.current.streamingPhase).toBe('idle'));
  return hook;
}

describe('useNatsChatAdapter — a card’s actions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('approve names the request the row is in, and locks the composer', async () => {
    const approveRequest = vi.fn(() => Promise.resolve());
    const { result } = await withCard(makeConfig({ approveRequest }));

    await act(async () => {
      await result.current.actions.approve?.('exec-a');
    });
    expect(approveRequest).toHaveBeenCalledWith('batch-1');
    expect(result.current.streamingPhase).toBe('thinking');
  });

  it('a failed approve hands the lock back, so the user can retry', async () => {
    const approveRequest = vi.fn(() => Promise.reject(new Error('nope')));
    const { result } = await withCard(makeConfig({ approveRequest }));

    await act(async () => {
      await result.current.actions.approve?.('exec-a');
    });
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('reject states its reason and keeps the composer free', async () => {
    const rejectRequest = vi.fn(() => Promise.resolve());
    const { result } = await withCard(makeConfig({ rejectRequest }));

    await act(async () => {
      await result.current.actions.reject?.('exec-a', 'not now');
    });
    expect(rejectRequest).toHaveBeenCalledWith('batch-1', 'not now');
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('with no approve callback a button does nothing', async () => {
    const { result } = await withCard(makeConfig());

    await act(async () => {
      await result.current.actions.approve?.('exec-a');
    });
    expect(result.current.streamingPhase).toBe('idle');
  });

  it('hands the render the tiers this side answers, and keeps one `actions` object across renders', async () => {
    const { result, rerender } = await withCard(makeConfig());
    const { actions } = result.current;
    expect(result.current.displayApprovalTypes).toEqual(['CLIENT']);

    rerender();
    expect(result.current.actions).toBe(actions);
  });

  it('passes offer answers through from the host', async () => {
    const approveEscalation = vi.fn();
    const rejectEscalation = vi.fn();
    const { result } = await withCard(makeConfig({ approveEscalation, rejectEscalation }));

    await act(async () => {
      await result.current.actions.approveEscalation?.('offer-1');
      await result.current.actions.rejectEscalation?.('offer-1');
    });
    expect(approveEscalation).toHaveBeenCalledWith('offer-1');
    expect(rejectEscalation).toHaveBeenCalledWith('offer-1');
  });
});
