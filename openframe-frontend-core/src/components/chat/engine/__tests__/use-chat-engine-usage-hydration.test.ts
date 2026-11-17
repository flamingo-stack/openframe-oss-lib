import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DialogTokenUsage } from '../../types/unified-chat-state.types';
import type {
  ChatDialogRecord,
  ChatHistoryBackend,
  ChatLiveTailOptions,
  ChatLiveTailTransport,
} from '../chat-transport';
import { createMingoGraphqlDialogs, type MingoGraphqlPost } from '../mingo-graphql-history';
import { useChatEngine } from '../use-chat-engine';

const usage: DialogTokenUsage = {
  inputTokensSize: 11_860,
  outputTokensSize: 940,
  totalTokensSize: 12_800,
  contextSize: 200_000,
};
const split = {
  uncachedInputTokensSize: 1_200,
  cacheReadTokensSize: 10_100,
  cacheWriteTokensSize: 560,
  compactionThreshold: 0.8,
};
const record = (tokenUsage: DialogTokenUsage): ChatDialogRecord => ({
  dialog: { id: 'd1', title: 'Usage' },
  tokenUsage,
});

function ports(fetchDialog: NonNullable<ChatHistoryBackend['fetchDialog']>) {
  const tail: { current: ChatLiveTailOptions | null } = { current: null };
  const transport: ChatLiveTailTransport = {
    replays: true,
    useLiveTail: options => {
      tail.current = options;
    },
    publish: vi.fn(),
  };
  const history: ChatHistoryBackend = {
    fetchDialog,
    fetchDialogMessages: () => Promise.resolve({ messages: [], nextCursor: null }),
  };
  return { tail, transport, history };
}

afterEach(() => vi.useRealTimers());

describe('useChatEngine usage hydration', () => {
  it.each([false, true])(
    'does not carry the previous effective budget into an optimistic send when opted in %s',
    async effectiveContextBudget => {
      let finish: () => void = () => undefined;
      const pending = new Promise<void>(resolve => {
        finish = resolve;
      });
      const { transport, history, tail } = ports(() => Promise.resolve(record({ ...usage, contextSize: 150_000 })));
      transport.publish = () => pending;
      const { result } = renderHook(() =>
        useChatEngine({ effectiveContextBudget, transport, history, dialogId: 'd1', modelLabel: 'Luna' }),
      );
      await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(150_000));
      act(() => {
        tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
        tail.current?.onEvent(
          {
            type: 'AI_METADATA',
            modelName: 'opus',
            providerName: 'Anthropic',
            contextWindow: 1_000_000,
            contextBudget: 200_000,
            streamSeq: 2,
          },
          'message',
        );
        tail.current?.onEvent({ type: 'TOKEN_USAGE', streamSeq: 3, ...usage }, 'message');
        tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 4 }, 'message');
      });
      expect(result.current.currentContextWindowMaxTokens).toBe(effectiveContextBudget ? 150_000 : 200_000);
      let sent: Promise<void | boolean> = Promise.resolve(false);
      act(() => {
        sent = result.current.sendMessage('owned next Luna turn');
      });
      expect(result.current.streamingPhase).toBe('thinking');
      expect(result.current.currentContextWindowMaxTokens).toBe(effectiveContextBudget ? null : 200_000);
      expect(result.current.currentInputTokens).toBe(usage.inputTokensSize);
      act(() =>
        tail.current?.onEvent(
          {
            type: 'AI_METADATA',
            modelName: 'luna',
            providerName: 'OpenAI',
            contextWindow: 1_050_000,
            contextBudget: 150_000,
            streamSeq: 5,
          },
          'message',
        ),
      );
      expect(result.current.currentContextWindowMaxTokens).toBe(effectiveContextBudget ? 150_000 : 200_000);
      await act(async () => {
        finish();
        await sent;
      });
    },
  );

  it.each([false, true])('preserves the default legacy budget with prior usage %s', async withUsage => {
    const fetchDialog = vi
      .fn()
      .mockResolvedValue(
        withUsage
          ? record({ ...usage, contextSize: 150_000 })
          : { dialog: { id: 'd1', title: 'Usage' }, tokenUsage: null },
      );
    const { transport, history, tail } = ports(fetchDialog);
    const { result } = renderHook(() => useChatEngine({ transport, history, dialogId: 'd1' }));
    await waitFor(() => expect(result.current.isMessagesLoading).toBe(false));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent(
        {
          type: 'AI_METADATA',
          modelName: 'opus',
          providerName: 'Anthropic',
          contextWindow: 1_000_000,
          contextBudget: 200_000,
          streamSeq: 2,
        },
        'message',
      );
    });
    expect(result.current.currentContextWindowMaxTokens).toBe(withUsage ? 150_000 : 1_000_000);
  });

  it('uses the effective pinned run budget independently of the physical model window on a busy reload', async () => {
    const fetchDialog = vi.fn().mockResolvedValue(record({ ...usage, contextSize: 150_000 }));
    const { transport, history, tail } = ports(fetchDialog);
    const { result } = renderHook(() =>
      useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: 'Luna' }),
    );
    await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(150_000));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent(
        {
          type: 'AI_METADATA',
          modelName: 'opus',
          modelDisplayName: 'Opus',
          providerName: 'Anthropic',
          contextWindow: 1_000_000,
          contextBudget: 200_000,
          streamSeq: 2,
        },
        'message',
      );
    });
    expect(result.current.currentContextWindowMaxTokens).toBe(200_000);
    expect(result.current.dialogTokenUsage?.contextSize).toBe(200_000);
    act(() => tail.current?.onEvent({ type: 'TOKEN_USAGE', streamSeq: 3, ...usage, ...split }, 'message'));
    expect(result.current.currentContextWindowMaxTokens).toBe(200_000);
    act(() => tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 4 }, 'message'));
    expect(result.current.currentContextWindowMaxTokens).toBe(150_000);
  });

  it('keeps an old-backend busy budget unknown until same-run token usage establishes it', async () => {
    const fetchDialog = vi.fn().mockResolvedValue(record({ ...usage, contextSize: 150_000 }));
    const { transport, history, tail } = ports(fetchDialog);
    const { result } = renderHook(() =>
      useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: 'Luna' }),
    );
    await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(150_000));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent(
        { type: 'AI_METADATA', modelName: 'opus', providerName: 'Anthropic', contextWindow: 1_000_000, streamSeq: 2 },
        'message',
      );
    });
    expect(result.current.currentContextWindowMaxTokens).toBeNull();
    act(() => tail.current?.onEvent({ type: 'TOKEN_USAGE', streamSeq: 3, ...usage }, 'message'));
    expect(result.current.currentContextWindowMaxTokens).toBe(200_000);
    act(() => tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 4 }, 'message'));
    expect(result.current.currentContextWindowMaxTokens).toBeNull();
  });

  it('clears a prior effective budget when replacement model metadata omits it', async () => {
    const fetchDialog = vi.fn().mockResolvedValue(record(usage));
    const { transport, history, tail } = ports(fetchDialog);
    const { result } = renderHook(() =>
      useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1' }),
    );
    await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(200_000));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent(
        {
          type: 'AI_METADATA',
          modelName: 'opus',
          providerName: 'Anthropic',
          contextWindow: 1_000_000,
          contextBudget: 200_000,
          streamSeq: 2,
        },
        'message',
      );
    });
    expect(result.current.currentContextWindowMaxTokens).toBe(200_000);
    act(() =>
      tail.current?.onEvent(
        { type: 'AI_METADATA', modelName: 'other', providerName: 'Anthropic', contextWindow: 1_000_000, streamSeq: 3 },
        'message',
      ),
    );
    expect(result.current.currentContextWindowMaxTokens).toBeNull();
  });

  it.each([false, true])(
    'keeps the current idle budget after retained token usage, with start metadata %s',
    async withStart => {
      const fetchDialog = vi.fn().mockResolvedValue(record({ ...usage, contextSize: 150_000 }));
      const { transport, history, tail } = ports(fetchDialog);
      const { result } = renderHook(() =>
        useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: 'Luna' }),
      );
      await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(150_000));
      act(() => {
        if (withStart) {
          tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
          tail.current?.onEvent(
            {
              type: 'AI_METADATA',
              modelName: 'opus',
              modelDisplayName: 'Opus',
              providerName: 'Anthropic',
              contextWindow: 1_000_000,
              contextBudget: 200_000,
              streamSeq: 2,
            },
            'message',
          );
        }
        tail.current?.onEvent(
          { type: 'TOKEN_USAGE', streamSeq: 3, ...usage, ...split, totalTokensSize: 15_000 },
          'message',
        );
      });
      expect(result.current.currentContextWindowMaxTokens).toBe(withStart ? 200_000 : 150_000);
      act(() => tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 4 }, 'message'));
      await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(150_000));
      expect(result.current.dialogTokenUsage).toMatchObject({
        ...split,
        totalTokensSize: 15_000,
        contextSize: 150_000,
      });
      expect(fetchDialog).toHaveBeenCalledTimes(1);
    },
  );

  it('restores an earlier dialog usage immediately after switching away and back without a stream event', async () => {
    const fetchDialog = vi.fn((id: string) =>
      Promise.resolve({
        dialog: { id, title: id },
        tokenUsage: { ...usage, totalTokensSize: id === 'd1' ? 12_800 : 18_000 },
      }),
    );
    const { transport, history } = ports(fetchDialog);
    const { result, rerender } = renderHook(
      ({ id }) => useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: id }),
      {
        initialProps: { id: 'd1' },
      },
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(12_800));
    rerender({ id: 'd2' });
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(18_000));
    rerender({ id: 'd1' });
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(12_800));
  });

  it('enriches an already open aggregate record when optional usage details become enabled', async () => {
    let enabled = false;
    const post = vi.fn((query: string) =>
      Promise.resolve({
        dialog: {
          id: 'd1',
          dialogId: 'd1',
          title: 'Usage',
          status: 'ACTIVE',
          createdAt: '2026-11-17T10:00:00Z',
          tokenUsage: [
            { ...usage, chatType: 'ADMIN_AI_CHAT', ...(query.includes('cacheReadTokensSize') ? split : {}) },
          ],
        },
      }),
    ) as unknown as MingoGraphqlPost & ReturnType<typeof vi.fn>;
    const dialogs = createMingoGraphqlDialogs(post, {
      agentTypes: ['ADMIN'],
      statuses: ['ACTIVE'],
      chatType: 'ADMIN_AI_CHAT',
      tokenUsageSplit: () => enabled,
    });
    const { transport, history } = ports(dialogs.fetchDialog);
    const { result, rerender } = renderHook(
      ({ details }) =>
        useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', recordReadKey: details }),
      { initialProps: { details: false } },
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(12_800));
    expect(result.current.dialogTokenUsage?.cacheReadTokensSize).toBeUndefined();
    enabled = true;
    rerender({ details: true });
    await waitFor(() => expect(result.current.dialogTokenUsage).toMatchObject(split));
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('does not let the initial aggregate read block a later expanded read', async () => {
    let finishAggregate: (value: ChatDialogRecord) => void = vi.fn();
    let finishExpanded: (value: ChatDialogRecord) => void = vi.fn();
    const aggregate = new Promise<ChatDialogRecord>(resolve => {
      finishAggregate = resolve;
    });
    const expanded = new Promise<ChatDialogRecord>(resolve => {
      finishExpanded = resolve;
    });
    const fetchDialog = vi.fn().mockReturnValueOnce(aggregate).mockReturnValueOnce(expanded);
    const { transport, history } = ports(fetchDialog);
    const { result, rerender } = renderHook(
      ({ details }) =>
        useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', recordReadKey: details }),
      { initialProps: { details: false } },
    );
    await waitFor(() => expect(fetchDialog).toHaveBeenCalledTimes(1));
    rerender({ details: true });
    await waitFor(() => expect(fetchDialog).toHaveBeenCalledTimes(2));
    await act(() => Promise.resolve(finishAggregate(record(usage))));
    await act(() => Promise.resolve(finishExpanded(record({ ...usage, ...split }))));
    await waitFor(() => expect(result.current.dialogTokenUsage).toMatchObject(split));
  });

  it('keeps a newer pinned stream usage when an earlier model-change read completes', async () => {
    let finish: (value: ChatDialogRecord) => void = vi.fn();
    const pending = new Promise<ChatDialogRecord>(resolve => {
      finish = resolve;
    });
    const fetchDialog = vi
      .fn()
      .mockResolvedValueOnce(record({ ...usage, ...split }))
      .mockReturnValueOnce(pending);
    const { transport, history, tail } = ports(fetchDialog);
    const { result, rerender } = renderHook(
      ({ model }) =>
        useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: model }),
      { initialProps: { model: 'Opus' } },
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(12_800));
    rerender({ model: 'Luna' });
    await waitFor(() => expect(fetchDialog).toHaveBeenCalledTimes(2));
    const newer = {
      inputTokensSize: 14_000,
      outputTokensSize: 1_000,
      totalTokensSize: 15_000,
      contextSize: 200_000,
      uncachedInputTokensSize: 1_000,
      cacheReadTokensSize: 12_000,
      cacheWriteTokensSize: 1_000,
      compactionThreshold: 0.8,
    };
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent({ type: 'TOKEN_USAGE', streamSeq: 2, ...newer }, 'message');
    });
    await waitFor(() => expect(result.current.dialogTokenUsage).toMatchObject(newer));
    await act(() => Promise.resolve(finish(record({ ...usage, ...split, contextSize: 150_000 }))));
    expect(result.current.dialogTokenUsage).toMatchObject(newer);
  });

  it('updates an idle budget when the model changes without a concurrent usage event', async () => {
    const fetchDialog = vi
      .fn()
      .mockResolvedValueOnce(record(usage))
      .mockResolvedValueOnce(record({ ...usage, contextSize: 150_000 }));
    const { transport, history } = ports(fetchDialog);
    const { result, rerender } = renderHook(
      ({ model }) =>
        useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: model }),
      { initialProps: { model: 'Opus' } },
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.contextSize).toBe(200_000));
    rerender({ model: 'Luna' });
    await waitFor(() => expect(result.current.dialogTokenUsage?.contextSize).toBe(150_000));
  });

  it('defers a busy model change and applies the configured budget automatically once idle', async () => {
    const fetchDialog = vi
      .fn()
      .mockResolvedValueOnce(record(usage))
      .mockResolvedValue(record({ ...usage, contextSize: 150_000 }));
    const { transport, history, tail } = ports(fetchDialog);
    const { result, rerender } = renderHook(
      ({ model }) =>
        useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: model }),
      { initialProps: { model: 'Opus' } },
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.contextSize).toBe(200_000));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent(
        {
          type: 'AI_METADATA',
          modelName: 'opus',
          modelDisplayName: 'Opus',
          providerName: 'Anthropic',
          contextWindow: 1_000_000,
          contextBudget: 200_000,
          streamSeq: 2,
        },
        'message',
      );
    });
    rerender({ model: 'Luna' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchDialog).toHaveBeenCalledTimes(1);
    expect(result.current.currentContextWindowMaxTokens).toBe(200_000);
    expect(result.current.dialogTokenUsage?.contextSize).toBe(200_000);
    act(() => tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 3 }, 'message'));
    await waitFor(() => expect(result.current.currentContextWindowMaxTokens).toBe(150_000));
  });

  it('shows the pinned live model window before its usage arrives, even after current-model record hydration', async () => {
    const fetchDialog = vi.fn().mockResolvedValue(record({ ...usage, contextSize: 150_000 }));
    const { transport, history, tail } = ports(fetchDialog);
    const { result } = renderHook(() =>
      useChatEngine({ effectiveContextBudget: true, transport, history, dialogId: 'd1', modelLabel: 'Luna' }),
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.contextSize).toBe(150_000));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 1 }, 'message');
      tail.current?.onEvent(
        {
          type: 'AI_METADATA',
          modelName: 'opus',
          modelDisplayName: 'Opus',
          providerName: 'Anthropic',
          contextWindow: 1_000_000,
          contextBudget: 200_000,
          streamSeq: 2,
        },
        'message',
      );
    });
    expect(result.current.currentContextWindowMaxTokens).toBe(200_000);
    act(() => tail.current?.onEvent({ type: 'MESSAGE_END', streamSeq: 3 }, 'message'));
    expect(result.current.currentContextWindowMaxTokens).toBe(150_000);
  });

  it('does not replace stream usage with a routine refresh of an older persisted round', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchDialog = vi.fn().mockResolvedValue(record(usage));
    const { transport, history, tail } = ports(fetchDialog);
    const { result } = renderHook(() =>
      useChatEngine({
        effectiveContextBudget: true,
        transport,
        history,
        dialogId: 'd1',
        refresh: { intervalMs: 1_000 },
      }),
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(12_800));
    act(() =>
      tail.current?.onEvent({ type: 'TOKEN_USAGE', streamSeq: 1, ...usage, totalTokensSize: 15_000 }, 'message'),
    );
    await waitFor(() => expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(15_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(fetchDialog.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.dialogTokenUsage?.totalTokensSize).toBe(15_000);
  });
});
