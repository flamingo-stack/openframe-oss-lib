/**
 * What every host used to write beside the engine, now the engine's: the link to copy, the list and the open record
 * asked again on a timer, a composer locked by a turn whose end never arrived released by an idle record, a history read
 * again on request, the viewer's own direct message closing the turn it opened, a card's Display from the catalog, the
 * faces of history rows, and a rename or a restore laid on the open record.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DialogItem, HistoricalMessage, SlashCommandSummary } from '../../types';
import type { FetchDialogsParams } from '../../types/unified-chat-state.types';
import type {
  ChatDialogRecord,
  ChatHistoryBackend,
  ChatLiveTailOptions,
  ChatLiveTailTransport,
  FetchDialogMessagesResult,
} from '../chat-transport';
import { displayCommandFor, soonestRefreshMs, useChatEngine, type UseChatEngineConfig } from '../use-chat-engine';

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
  const fetchDialogMessages = vi.fn((): Promise<FetchDialogMessagesResult> =>
    Promise.resolve({ messages: persisted, nextCursor: null }),
  );
  const history: ChatHistoryBackend = { fetchDialogMessages, ...config.history };
  const hook = renderHook(() => useChatEngine({ ...config, transport, history }));
  return { ...hook, tail, transport, fetchDialogMessages };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useChatEngine: the dialog list a host keeps', () => {
  it("offers the host's link to copy beside the list's own capabilities", async () => {
    const copyDialogLink = vi.fn();
    const fetchDialogs = vi.fn(() => Promise.resolve({ dialogs: [], nextCursor: null }));
    const { result } = setup({ copyDialogLink, history: { fetchDialogs } });
    await waitFor(() => expect(result.current.isDialogsLoading).toBe(false));
    expect(result.current.dialogCapabilities?.onCopyLink).toBe(copyDialogLink);
  });

  it('a rename and a restore are laid on the open record once the backend took them, and a restore reloads the list', async () => {
    const fetchDialogs = vi.fn(() => Promise.resolve({ dialogs: [], nextCursor: null }));
    const fetchDialog = vi.fn((id: string): Promise<ChatDialogRecord> =>
      Promise.resolve({ dialog: { id, title: 'Old', archived: true } }),
    );
    const renameDialog = vi.fn(() => Promise.resolve());
    const unarchiveDialog = vi.fn(() => Promise.resolve());
    const { result } = setup({ history: { fetchDialogs, fetchDialog, renameDialog, unarchiveDialog } });
    act(() => result.current.selectDialog('d1'));
    await waitFor(() => expect(result.current.activeDialog?.title).toBe('Old'));
    await act(async () => {
      await result.current.renameDialog('d1', 'New');
    });
    expect(result.current.activeDialog?.title).toBe('New');
    const listReads = fetchDialogs.mock.calls.length;
    await act(async () => {
      await result.current.dialogCapabilities?.unarchiveDialog?.('d1');
    });
    expect(result.current.activeDialog?.archived).toBe(false);
    await waitFor(() => expect(fetchDialogs.mock.calls.length).toBeGreaterThan(listReads));
  });

  it('reads the first page and the open record again on its timer, sooner while a title is on its way', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const row: DialogItem = { id: 'd1', title: 'New Chat', awaitsTitle: true };
    let titled = false;
    const fetchDialogs = vi.fn((_params: FetchDialogsParams) =>
      Promise.resolve({ dialogs: [titled ? { id: 'd1', title: 'Disk space' } : row], nextCursor: null }),
    );
    const fetchDialog = vi.fn((id: string): Promise<ChatDialogRecord> =>
      Promise.resolve({ dialog: titled ? { id, title: 'Disk space' } : { ...row, id } }),
    );
    const { result } = setup({
      history: { fetchDialogs, fetchDialog },
      refresh: { intervalMs: 60_000, awaitingTitleMs: 10_000 },
    });
    await waitFor(() => expect(result.current.dialogs).toEqual([row]));
    act(() => result.current.selectDialog('d1'));
    await waitFor(() => expect(result.current.activeDialog?.title).toBe('New Chat'));
    titled = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await waitFor(() => expect(result.current.dialogs[0]?.title).toBe('Disk space'));
    await waitFor(() => expect(result.current.activeDialog?.title).toBe('Disk space'));
  });

  it('reads the list sooner while the host expects it to change, and at the usual pace once it does not', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchDialogs = vi.fn(() => Promise.resolve({ dialogs: [], nextCursor: null }));
    const transport: ChatLiveTailTransport = { replays: true, useLiveTail: () => undefined, publish: vi.fn() };
    const history: ChatHistoryBackend = {
      fetchDialogMessages: () => Promise.resolve({ messages: [], nextCursor: null }),
      fetchDialogs,
    };
    const { rerender } = renderHook(
      ({ expecting }: { expecting: boolean }) =>
        useChatEngine({ transport, history, refresh: { intervalMs: 60_000, expectingMs: 10_000, expecting } }),
      { initialProps: { expecting: true } },
    );
    await waitFor(() => expect(fetchDialogs).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchDialogs).toHaveBeenCalledTimes(2);

    rerender({ expecting: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchDialogs).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(fetchDialogs).toHaveBeenCalledTimes(3);
  });

  it('asks nothing while the host says no read may run', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchDialogs = vi.fn(() => Promise.resolve({ dialogs: [], nextCursor: null }));
    setup({ history: { fetchDialogs }, refresh: { intervalMs: 1_000, allowed: () => false } });
    await waitFor(() => expect(fetchDialogs).toHaveBeenCalledTimes(1));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(fetchDialogs).toHaveBeenCalledTimes(1);
  });
});

describe('soonestRefreshMs', () => {
  it('is the usual interval while no sooner reason holds', () => {
    expect(soonestRefreshMs(60_000, [undefined, undefined])).toBe(60_000);
    expect(soonestRefreshMs(undefined, [])).toBeUndefined();
  });

  it('is the shortest of the sooner intervals that hold, whatever the usual one is', () => {
    expect(soonestRefreshMs(60_000, [10_000, undefined])).toBe(10_000);
    expect(soonestRefreshMs(60_000, [15_000, 10_000])).toBe(10_000);
    expect(soonestRefreshMs(undefined, [10_000])).toBe(10_000);
  });

  it('ignores a sooner interval of zero: unset, not "at once"', () => {
    expect(soonestRefreshMs(60_000, [0])).toBe(60_000);
  });
});

describe('useChatEngine: a turn whose end never arrived', () => {
  it('an idle record read after the lock and after the last chunk frees the composer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let streamState: ChatDialogRecord['streamState'] = 'STREAMING';
    const fetchDialog = vi.fn((id: string): Promise<ChatDialogRecord> =>
      Promise.resolve({ dialog: { id, title: 'Chat' }, streamState }),
    );
    const { result, tail } = setup({
      dialogId: 'd1',
      history: { fetchDialog },
      refresh: { intervalMs: 0, busyMs: 15_000 },
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    act(() => {
      tail.current?.onEvent({ type: 'MESSAGE_START', streamSeq: 8 }, 'message');
    });
    await waitFor(() => expect(result.current.streamingPhase).not.toBe('idle'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.streamingPhase).not.toBe('idle');
    streamState = 'IDLE';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    await waitFor(() => expect(result.current.streamingPhase).toBe('idle'));
  });
});

describe('useChatEngine: what a host asked for by hand', () => {
  it('reloadHistory reads the open dialog again through the hydration door', async () => {
    const { result, fetchDialogMessages } = setup({ dialogId: 'd1' });
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(1));
    act(() => result.current.reloadHistory?.());
    await waitFor(() => expect(fetchDialogMessages).toHaveBeenCalledTimes(2));
  });

  it("the viewer's own direct message closes the turn its send opened", async () => {
    const { result, tail } = setup({
      dialogId: 'd1',
      directMessages: { ownDirectOwnerType: 'CLIENT' },
    });
    await waitFor(() => expect(tail.current?.fromSeq).toBe(7));
    await act(async () => {
      await result.current.sendMessage('hello technician');
    });
    expect(result.current.streamingPhase).not.toBe('idle');
    act(() => {
      tail.current?.onEvent(
        { type: 'DIRECT_MESSAGE', text: 'hello technician', ownerType: 'CLIENT', streamSeq: 8 },
        'message',
      );
    });
    await waitFor(() => expect(result.current.streamingPhase).toBe('idle'));
  });

  it('draws every face as a full address', async () => {
    const { result } = setup({
      dialogId: 'd1',
      assistantAvatar: 'avatars/mingo.png',
      avatarUrlOf: stored => `https://cdn.example.test/${stored}`,
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    expect(result.current.messages[0].metadata?.author?.avatar).toBe('https://cdn.example.test/avatars/mingo.png');
  });
});

describe('useChatEngine: Display from the catalog', () => {
  const commands: SlashCommandSummary[] = [
    { id: 'devices', primarySourceId: 'devices-table', actions: [{ id: 'display' }] } as unknown as SlashCommandSummary,
    { id: 'search', primarySourceId: 'docs', actions: [{ id: 'search' }] } as unknown as SlashCommandSummary,
  ];

  it('is offered only when a command can display, and sends the table command', async () => {
    const without = setup({ dialogId: 'd1' });
    expect(without.result.current.displayRef).toBeUndefined();
    const { result, transport } = setup({ dialogId: 'd1', slashCommands: commands });
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    act(() => {
      result.current.displayRef?.({ type: 'device', id: 'm1', title: 'Mac', sourceRepo: 'devices-table', url: null });
    });
    await waitFor(() =>
      expect(transport.publish).toHaveBeenCalledWith(
        '/devices display "Mac"',
        expect.objectContaining({ dialogId: 'd1' }),
      ),
    );
  });

  it("finds a row's command by its own table first, then by its document type's", () => {
    expect(
      displayCommandFor({ type: 'device', id: 'm1', title: 'Mac', sourceRepo: 'devices-table', url: null }, commands),
    ).toBe('/devices display "Mac"');
    expect(
      displayCommandFor({ type: 'device', id: 'm1', title: 'Mac', sourceRepo: 'docs', url: null }, commands),
    ).toBeNull();
  });
});
