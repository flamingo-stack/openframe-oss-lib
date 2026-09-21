/**
 * Unit tests for the shared `useManagedDialogList` hook — the parts the NATS
 * characterization test cannot reach: `upsertDialogTop` dedupe,
 * `bumpDialogToTop` ordering, append dedupe, out-of-order page-1 responses,
 * the `onDialogRemoved` reasons, and the inert no-`fetchDialogs` shape.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useManagedDialogList } from '../use-managed-dialog-list';

const page = (ids: string[], nextCursor: string | null = null) => ({
  dialogs: ids.map(id => ({ id, title: `Chat ${id}` })),
  nextCursor,
});

describe('useManagedDialogList', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports loading from the FIRST render when a load is coming', async () => {
    let resolve: ((v: ReturnType<typeof page>) => void) | undefined;
    const fetchDialogs = vi.fn(
      () =>
        new Promise<ReturnType<typeof page>>(r => {
          resolve = r;
        }),
    );
    const { result } = renderHook(() =>
      useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]', fetchDialogs }),
    );
    // Before the effect has even run: a consumer branching on "empty list" must
    // not see a settled-and-empty state.
    expect(result.current.isDialogsLoading).toBe(true);
    expect(result.current.dialogs).toEqual([]);
    await act(async () => {
      resolve?.(page(['a']));
      await Promise.resolve();
    });
    expect(result.current.isDialogsLoading).toBe(false);
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a']);
  });

  it('re-enters loading synchronously on a search change, including clearing it', async () => {
    const resolvers: Array<(v: ReturnType<typeof page>) => void> = [];
    const fetchDialogs = vi.fn(
      () =>
        new Promise<ReturnType<typeof page>>(r => {
          resolvers.push(r);
        }),
    );
    const { result, rerender } = renderHook(
      ({ search }) => useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]', fetchDialogs, search }),
      { initialProps: { search: '' } },
    );
    await act(async () => {
      resolvers[0](page(['a']));
      await Promise.resolve();
    });
    expect(result.current.isDialogsLoading).toBe(false);

    rerender({ search: 'zzz' });
    expect(result.current.isDialogsLoading).toBe(true);
    await act(async () => {
      resolvers[1](page([]));
      await Promise.resolve();
    });
    expect(result.current.isDialogsLoading).toBe(false);
    expect(result.current.dialogs).toEqual([]);

    // Clearing the term must ALSO read as loading again, not as "settled empty".
    rerender({ search: '' });
    expect(result.current.isDialogsLoading).toBe(true);
  });

  it('a REJECTED first page still settles — the list must not stick on a skeleton', async () => {
    const fetchDialogs = vi.fn(() => Promise.reject(new Error('down')));
    const { result } = renderHook(() =>
      useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]', fetchDialogs }),
    );
    expect(result.current.isDialogsLoading).toBe(true);
    await waitFor(() => expect(result.current.dialogsError).toBe(true));
    expect(result.current.isDialogsLoading).toBe(false);
  });

  it('a superseded response never settles the NEWER search term', async () => {
    const resolvers: Array<(v: ReturnType<typeof page>) => void> = [];
    const fetchDialogs = vi.fn(
      () =>
        new Promise<ReturnType<typeof page>>(r => {
          resolvers.push(r);
        }),
    );
    const { result, rerender } = renderHook(
      ({ search }) => useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]', fetchDialogs, search }),
      { initialProps: { search: 'a' } },
    );
    await waitFor(() => expect(resolvers.length).toBe(1));
    rerender({ search: 'ab' });
    await waitFor(() => expect(resolvers.length).toBe(2));
    await act(async () => {
      resolvers[0](page([]));
      await Promise.resolve();
    });
    expect(result.current.isDialogsLoading).toBe(true);
    await act(async () => {
      resolvers[1](page([]));
      await Promise.resolve();
    });
    expect(result.current.isDialogsLoading).toBe(false);
  });

  it('re-arms when autoLoad turns on after mount (panel opened in the other mode)', async () => {
    let resolve: ((v: ReturnType<typeof page>) => void) | undefined;
    const fetchDialogs = vi.fn(
      () =>
        new Promise<ReturnType<typeof page>>(r => {
          resolve = r;
        }),
    );
    const { result, rerender } = renderHook(
      ({ autoLoad }) => useManagedDialogList({ autoLoad, pageSize: 20, logTag: '[t]', fetchDialogs }),
      { initialProps: { autoLoad: false } },
    );
    expect(result.current.isDialogsLoading).toBe(false);
    expect(fetchDialogs).not.toHaveBeenCalled();

    rerender({ autoLoad: true });
    // Must NOT read as settled-and-empty for a frame before the effect fires.
    expect(result.current.isDialogsLoading).toBe(true);
    await waitFor(() => expect(fetchDialogs).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolve?.(page(['a']));
      await Promise.resolve();
    });
    expect(result.current.isDialogsLoading).toBe(false);
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a']);
  });

  it('an archive-style consumer (autoLoad false) is settled from the start', () => {
    const { result } = renderHook(() =>
      useManagedDialogList({
        autoLoad: false,
        pageSize: 20,
        logTag: '[t]',
        fetchDialogs: () => Promise.resolve(page([])),
      }),
    );
    expect(result.current.isDialogsLoading).toBe(false);
  });

  it('is inert without fetchDialogs', () => {
    const { result } = renderHook(() => useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]' }));
    expect(result.current.dialogs).toEqual([]);
    expect(result.current.hasMoreDialogs).toBe(false);
    expect(result.current.isDialogsLoading).toBe(false);
  });

  it('upsertDialogTop prepends + dedupes; bumpDialogToTop re-heads the row', async () => {
    const fetchDialogs = vi.fn(() => Promise.resolve(page(['a', 'b'])));
    const { result } = renderHook(() =>
      useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]', fetchDialogs }),
    );
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));
    act(() => result.current.upsertDialogTop({ id: 'b', title: 'B again' }));
    expect(result.current.dialogs.map(d => [d.id, d.title])).toEqual([
      ['b', 'B again'],
      ['a', 'Chat a'],
    ]);
    act(() => result.current.bumpDialogToTop('a'));
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b']);
    expect(result.current.dialogs[0].timestamp).toBeInstanceOf(Date);
    // Unknown id is a no-op, not an insert.
    act(() => result.current.bumpDialogToTop('nope'));
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b']);
  });

  it('drops a superseded page-1 response and dedupes appended pages', async () => {
    const resolvers: Array<(v: ReturnType<typeof page>) => void> = [];
    const fetchDialogs = vi.fn(() => new Promise<ReturnType<typeof page>>(resolve => resolvers.push(resolve)));
    const { result, rerender } = renderHook(
      ({ search }) => useManagedDialogList({ autoLoad: true, pageSize: 20, logTag: '[t]', fetchDialogs, search }),
      { initialProps: { search: 'a' } },
    );
    await waitFor(() => expect(resolvers.length).toBe(1));
    rerender({ search: 'ab' });
    await waitFor(() => expect(resolvers.length).toBe(2));

    // The NEWER request resolves first, then the stale one lands.
    await act(async () => {
      resolvers[1](page(['new'], 'cursor-new'));
      await Promise.resolve();
    });
    await act(async () => {
      resolvers[0](page(['stale'], 'cursor-stale'));
      await Promise.resolve();
    });
    expect(result.current.dialogs.map(d => d.id)).toEqual(['new']);
    expect(result.current.hasMoreDialogs).toBe(true);

    // Appended pages drop ids already rendered (a row can move between pages).
    await act(async () => {
      const p = result.current.loadMoreDialogs();
      resolvers[2](page(['new', 'later'], null));
      await p;
    });
    expect(result.current.dialogs.map(d => d.id)).toEqual(['new', 'later']);
  });

  it('re-throws a failed archive/delete so a confirmation modal can stay open', async () => {
    const { result } = renderHook(() =>
      useManagedDialogList({
        autoLoad: true,
        pageSize: 20,
        logTag: '[t]',
        fetchDialogs: () => Promise.resolve(page(['a'])),
        archiveDialog: () => Promise.reject(new Error('429')),
        deleteDialog: () => Promise.reject(new Error('boom')),
      }),
    );
    await waitFor(() => expect(result.current.dialogs.length).toBe(1));
    await act(async () => {
      await expect(result.current.archiveDialog('a')).rejects.toThrow('429');
      await expect(result.current.deleteDialog('a')).rejects.toThrow('boom');
    });
    // The row survives a failed write.
    expect(result.current.dialogs.map(d => d.id)).toEqual(['a']);
  });

  it('reports removal reasons AFTER the local removal', async () => {
    const seen: Array<[string, string, number]> = [];
    let latest: string[] = [];
    const { result } = renderHook(() =>
      useManagedDialogList({
        autoLoad: true,
        pageSize: 20,
        logTag: '[t]',
        fetchDialogs: () => Promise.resolve(page(['a', 'b'])),
        archiveDialog: () => Promise.resolve(),
        deleteDialog: () => Promise.resolve(),
        onDialogRemoved: (id, reason) => seen.push([id, reason, latest.length]),
      }),
    );
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));
    latest = result.current.dialogs.map(d => d.id);
    await act(async () => {
      await result.current.archiveDialog('a');
    });
    await act(async () => {
      await result.current.deleteDialog('b');
    });
    expect(seen.map(([id, reason]) => [id, reason])).toEqual([
      ['a', 'archived'],
      ['b', 'deleted'],
    ]);
    expect(result.current.dialogs).toEqual([]);
  });

  it('mutations without their callback are no-ops', async () => {
    const { result } = renderHook(() =>
      useManagedDialogList({
        autoLoad: true,
        pageSize: 20,
        logTag: '[t]',
        fetchDialogs: () => Promise.resolve(page(['a'])),
      }),
    );
    await waitFor(() => expect(result.current.dialogs.length).toBe(1));
    await act(async () => {
      await result.current.renameDialog('a', 'x');
      await result.current.archiveDialog('a');
      await result.current.deleteDialog('a');
    });
    expect(result.current.dialogs.map(d => [d.id, d.title])).toEqual([['a', 'Chat a']]);
  });
});
