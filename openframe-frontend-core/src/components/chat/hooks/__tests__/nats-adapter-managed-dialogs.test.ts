/**
 * CHARACTERIZATION TESTS — `useNatsChatAdapter` managed-dialog mode.
 *
 * Pins the dialog-list state machine (initial load, retry, pagination,
 * optimistic rename/archive/delete) BEFORE that block moves into the shared
 * `useManagedDialogList` hook consumed by both transport adapters. Every
 * assertion here is observable host behaviour that must survive the
 * extraction byte-for-byte: the wire params sent to `fetchDialogs`, the
 * list contents after each mutation, and the active-id side effects.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DialogItem } from '../../types/component.types';
import { useNatsChatAdapter, type FetchDialogsParams, type UseNatsChatAdapterConfig } from '../use-nats-chat-adapter';

const page = (ids: string[], nextCursor: string | null = null) => ({
  dialogs: ids.map<DialogItem>(id => ({ id, title: `Chat ${id}`, timestamp: new Date('2026-01-01T00:00:00Z') })),
  nextCursor,
});

function makeConfig(overrides: Partial<UseNatsChatAdapterConfig> = {}): UseNatsChatAdapterConfig {
  return {
    getNatsWsUrl: () => null,
    publishUserMessage: vi.fn(),
    fetchChunks: vi.fn(() => Promise.resolve([])),
    fetchDialogs: vi.fn((_p: FetchDialogsParams) => Promise.resolve(page(['a', 'b']))),
    fetchDialogMessages: vi.fn(() => Promise.resolve({ messages: [], nextCursor: null })),
    renameDialog: vi.fn(() => Promise.resolve()),
    archiveDialog: vi.fn(() => Promise.resolve()),
    deleteDialog: vi.fn(() => Promise.resolve()),
    dialogsPageSize: 2,
    ...overrides,
  };
}

describe('useNatsChatAdapter — managed-dialog mode (characterization)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads the first page only when active, with exactly {cursor, limit} (no search key)', async () => {
    const config = makeConfig();
    const { result, rerender } = renderHook(({ active }) => useNatsChatAdapter(config, { active }), {
      initialProps: { active: false },
    });
    expect(config.fetchDialogs).not.toHaveBeenCalled();
    expect(result.current.dialogs).toEqual([]);

    rerender({ active: true });
    await waitFor(() => expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b']));
    expect(config.fetchDialogs).toHaveBeenCalledTimes(1);
    const params = (config.fetchDialogs as ReturnType<typeof vi.fn>).mock.calls[0][0] as FetchDialogsParams;
    expect(params).toEqual({ cursor: undefined, limit: 2 });
    expect(Object.keys(params)).toEqual(['cursor', 'limit']);
    expect(result.current.dialogsError).toBe(false);
    expect(result.current.isDialogsLoading).toBe(false);
  });

  it('first-page failure flags dialogsError and reloadDialogs retries', async () => {
    const fetchDialogs = vi
      .fn<(p: FetchDialogsParams) => Promise<ReturnType<typeof page>>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(page(['a']));
    const config = makeConfig({ fetchDialogs });
    const { result } = renderHook(() => useNatsChatAdapter(config));
    await waitFor(() => expect(result.current.dialogsError).toBe(true));
    expect(result.current.dialogs).toEqual([]);

    act(() => result.current.reloadDialogs());
    await waitFor(() => expect(result.current.dialogs.map(d => d.id)).toEqual(['a']));
    expect(result.current.dialogsError).toBe(false);
    expect(fetchDialogs).toHaveBeenCalledTimes(2);
  });

  it('paginates with the server cursor; a pagination failure keeps the loaded rows', async () => {
    const fetchDialogs = vi
      .fn<(p: FetchDialogsParams) => Promise<ReturnType<typeof page>>>()
      .mockResolvedValueOnce(page(['a', 'b'], 'c2'))
      .mockRejectedValueOnce(new Error('page 2 down'))
      .mockResolvedValueOnce(page(['c'], null));
    const config = makeConfig({ fetchDialogs });
    const { result } = renderHook(() => useNatsChatAdapter(config));
    await waitFor(() => expect(result.current.hasMoreDialogs).toBe(true));

    await act(async () => {
      await result.current.loadMoreDialogs();
    });
    expect(fetchDialogs.mock.calls[1][0]).toEqual({ cursor: 'c2', limit: 2 });
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b']);
    expect(result.current.dialogsError).toBe(false);
    expect(result.current.hasMoreDialogs).toBe(true);

    await act(async () => {
      await result.current.loadMoreDialogs();
    });
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMoreDialogs).toBe(false);
  });

  it('rename is optimistic and rolls back on failure', async () => {
    const renameDialog = vi
      .fn<(id: string, title: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('nope'));
    const config = makeConfig({ renameDialog });
    const { result } = renderHook(() => useNatsChatAdapter(config));
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));

    await act(async () => {
      await result.current.renameDialog('a', 'Renamed');
    });
    expect(result.current.dialogs.find(d => d.id === 'a')?.title).toBe('Renamed');

    await act(async () => {
      await result.current.renameDialog('a', 'Will fail');
    });
    expect(result.current.dialogs.find(d => d.id === 'a')?.title).toBe('Renamed');
    expect(renameDialog).toHaveBeenCalledTimes(2);
  });

  it('archiving the ACTIVE dialog removes it and clears activeDialogId; delete removes too', async () => {
    const config = makeConfig();
    const { result } = renderHook(() => useNatsChatAdapter(config));
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));

    act(() => result.current.selectDialog('a'));
    expect(result.current.activeDialogId).toBe('a');

    await act(async () => {
      await result.current.archiveDialog('a');
    });
    expect(config.archiveDialog).toHaveBeenCalledWith('a');
    expect(result.current.dialogs.map(d => d.id)).toEqual(['b']);
    expect(result.current.activeDialogId).toBeNull();

    await act(async () => {
      await result.current.deleteDialog('b');
    });
    expect(config.deleteDialog).toHaveBeenCalledWith('b');
    expect(result.current.dialogs).toEqual([]);
  });

  it('archive failure keeps the row and the active id', async () => {
    const config = makeConfig({ archiveDialog: vi.fn(() => Promise.reject(new Error('down'))) });
    const { result } = renderHook(() => useNatsChatAdapter(config));
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));
    act(() => result.current.selectDialog('a'));
    await act(async () => {
      await result.current.archiveDialog('a');
    });
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b']);
    expect(result.current.activeDialogId).toBe('a');
  });

  it('bare-transport mode (no fetchDialogs) never lists and ignores selectDialog', () => {
    const config = makeConfig({ fetchDialogs: undefined, dialogId: 'host-owned' });
    const { result } = renderHook(() => useNatsChatAdapter(config));
    act(() => result.current.selectDialog('other'));
    expect(result.current.activeDialogId).toBe('host-owned');
    expect(result.current.dialogs).toEqual([]);
    expect(result.current.hasMoreDialogs).toBe(false);
  });
});
