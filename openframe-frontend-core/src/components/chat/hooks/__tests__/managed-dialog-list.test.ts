/**
 * Unit tests for the shared `useManagedDialogList` hook — the parts the NATS
 * characterization test cannot reach: `upsertDialogTop` dedupe, `patchDialog`,
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

  it('is inert without fetchDialogs', () => {
    const { result } = renderHook(() => useManagedDialogList({ active: true, pageSize: 20, logTag: '[t]' }));
    expect(result.current.dialogs).toEqual([]);
    expect(result.current.hasMoreDialogs).toBe(false);
    expect(result.current.isDialogsLoading).toBe(false);
  });

  it('upsertDialogTop prepends + dedupes; patchDialog patches in place', async () => {
    const fetchDialogs = vi.fn(() => Promise.resolve(page(['a', 'b'])));
    const { result } = renderHook(() =>
      useManagedDialogList({ active: true, pageSize: 20, logTag: '[t]', fetchDialogs }),
    );
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));
    act(() => result.current.upsertDialogTop({ id: 'b', title: 'B again' }));
    expect(result.current.dialogs.map(d => [d.id, d.title])).toEqual([
      ['b', 'B again'],
      ['a', 'Chat a'],
    ]);
    act(() => result.current.patchDialog('a', { title: 'A patched' }));
    expect(result.current.dialogs.find(d => d.id === 'a')?.title).toBe('A patched');
  });

  it('reports removal reasons AFTER the local removal', async () => {
    const seen: Array<[string, string, number]> = [];
    let latest: string[] = [];
    const { result } = renderHook(() =>
      useManagedDialogList({
        active: true,
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
        active: true,
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
