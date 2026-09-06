'use client';

/**
 * useManagedDialogList — the ONE dialog-list state machine shared by both
 * transport adapters (NATS/Mingo managed-dialog mode and the SSE/Guide
 * adapter when `ChatRuntime.endpoints.chatConversationsUrl` is set).
 *
 * Owns: the loaded page of `DialogItem`s, the server cursor, first-page
 * loading/error state (with the retry re-arm), cursor pagination, an
 * optional server-side search term (a change re-runs page 1), and the
 * optimistic rename / archive / delete mutations with rollback.
 *
 * Does NOT own: which dialog is active, message history for a dialog, or
 * the transport (`fetchDialogMessages`, subscriptions, catch-up). Those stay
 * in the adapters — they are transport-specific. The adapters react to a
 * row leaving the list through `onDialogRemoved` (drop the active id, evict
 * the reducer store …) so ordering stays: host callback → local removal →
 * adapter side effect, exactly as the NATS adapter did before extraction.
 *
 * Host callbacks are all optional: without `fetchDialogs` the hook is inert
 * (empty list, no network) and a mutation without its callback is a no-op —
 * the presence of a callback IS the capability, mirroring the NATS config.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DialogItem } from '../types/component.types';
import type { FetchDialogsParams, FetchDialogsResult } from '../types/unified-chat-state.types';

export interface UseManagedDialogListArgs {
  /** Mirrors the adapter's `active` gate — the initial load waits for it. */
  active: boolean;
  /** Pages the active dialog list. Absent = the hook is inert. */
  fetchDialogs?: (params: FetchDialogsParams) => Promise<FetchDialogsResult>;
  /** Backend rename — absent = `renameDialog` is a no-op. */
  renameDialog?: (id: string, title: string) => Promise<void>;
  /** Backend archive — absent = `archiveDialog` is a no-op. */
  archiveDialog?: (id: string) => Promise<void>;
  /** Backend delete — absent = `deleteDialog` is a no-op. */
  deleteDialog?: (id: string) => Promise<void>;
  /** Page size sent as `limit`. */
  pageSize: number;
  /** Server-side search term. `undefined` = no search support (the NATS
   *  adapter never sets it, so its wire params stay `{cursor, limit}`); any
   *  string change — including back to `''` — reloads page 1 with `search`. */
  search?: string;
  /** Fires AFTER a row was removed locally by a successful archive/delete.
   *  Read through a latest-ref so its identity never enters the mutation
   *  callbacks' deps. */
  onDialogRemoved?: (id: string, reason: 'archived' | 'deleted') => void;
  /** Console prefix for failure logs (`[useNatsChatAdapter]`, `[useSseChatAdapter]`). */
  logTag: string;
}

export interface UseManagedDialogListResult {
  dialogs: DialogItem[];
  dialogsNextCursor: string | null;
  /** True while ANY page request is in flight (first page or pagination). */
  isDialogsLoading: boolean;
  /** True when the FIRST page failed — a pagination failure keeps the loaded rows. */
  dialogsError: boolean;
  hasMoreDialogs: boolean;
  /** Load a page: `undefined` cursor = (re)load the first page. */
  loadDialogsPage: (cursor?: string) => Promise<void>;
  /** Retry / refresh the first page. */
  reloadDialogs: () => void;
  loadMoreDialogs: () => Promise<void>;
  renameDialog: (id: string, title: string) => Promise<void>;
  archiveDialog: (id: string) => Promise<void>;
  deleteDialog: (id: string) => Promise<void>;
  /** Prepend a row (dedupes by id) — a freshly created conversation. */
  upsertDialogTop: (item: DialogItem) => void;
  /** Patch fields on an existing row (e.g. bump `timestamp` after a turn). */
  patchDialog: (id: string, patch: Partial<DialogItem>) => void;
}

export function useManagedDialogList({
  active,
  fetchDialogs,
  renameDialog: renameDialogCallback,
  archiveDialog: archiveDialogCallback,
  deleteDialog: deleteDialogCallback,
  pageSize,
  search,
  onDialogRemoved,
  logTag,
}: UseManagedDialogListArgs): UseManagedDialogListResult {
  const [dialogs, setDialogs] = useState<DialogItem[]>([]);
  const [dialogsNextCursor, setDialogsNextCursor] = useState<string | null>(null);
  const [isDialogsLoading, setIsDialogsLoading] = useState<boolean>(false);
  const [dialogsError, setDialogsError] = useState<boolean>(false);

  // Latest-list mirror for the optimistic mutations: the rollback title must
  // be read SYNCHRONOUSLY at call time. Capturing it inside a `setDialogs`
  // updater is not reliable — React may run the updater only at render time,
  // after an immediately-rejecting callback has already reached the catch.
  const dialogsRef = useRef<DialogItem[]>(dialogs);
  useEffect(() => {
    dialogsRef.current = dialogs;
  });

  const onDialogRemovedRef = useRef(onDialogRemoved);
  useEffect(() => {
    onDialogRemovedRef.current = onDialogRemoved;
  });

  // Released on a first-page failure so a retry / re-activation re-runs the
  // initial load.
  const initialDialogsLoadedRef = useRef(false);

  const loadDialogsPage = useCallback(
    async (cursor?: string): Promise<void> => {
      if (!fetchDialogs) return;
      setIsDialogsLoading(true);
      // Clear a prior first-page error when (re)loading the first page.
      if (cursor === undefined) setDialogsError(false);
      try {
        const result = await fetchDialogs({
          cursor,
          limit: pageSize,
          // Only hosts that run a search ever see the key.
          ...(search !== undefined ? { search } : {}),
        });
        setDialogsNextCursor(result.nextCursor);
        if (cursor === undefined) {
          setDialogs(result.dialogs);
        } else {
          setDialogs(prev => [...prev, ...result.dialogs]);
        }
      } catch (err) {
        console.error(`${logTag} fetchDialogs failed:`, err);
        // Only the FIRST page failing is a "can't show the list" error — a
        // pagination failure keeps the already-loaded list intact. Flag it and
        // release the initial-load guard so a retry (or re-activation) re-runs.
        if (cursor === undefined) {
          setDialogsError(true);
          initialDialogsLoadedRef.current = false;
        }
      } finally {
        setIsDialogsLoading(false);
      }
    },
    [fetchDialogs, pageSize, search, logTag],
  );

  const reloadDialogs = useCallback(() => {
    void loadDialogsPage();
  }, [loadDialogsPage]);

  // Initial dialog list load — and, for hosts that run a search, the page-1
  // reload on every term change (the term the loaded page was fetched for is
  // remembered so the same term never double-loads). Inert for hosts that
  // never set `search` (NATS): `loadedSearchRef` stays `undefined` there and
  // the once-guard alone decides.
  const loadedSearchRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!fetchDialogs) return;
    if (!active) return;
    if (initialDialogsLoadedRef.current && loadedSearchRef.current === search) return;
    initialDialogsLoadedRef.current = true;
    loadedSearchRef.current = search;
    void loadDialogsPage();
  }, [active, fetchDialogs, search, loadDialogsPage]);

  const removeLocal = useCallback((id: string) => {
    setDialogs(prev => prev.filter(d => d.id !== id));
  }, []);

  const deleteDialog = useCallback(
    async (id: string): Promise<void> => {
      if (!deleteDialogCallback) return;
      try {
        await deleteDialogCallback(id);
        removeLocal(id);
        onDialogRemovedRef.current?.(id, 'deleted');
      } catch (err) {
        console.error(`${logTag} deleteDialog failed:`, err);
      }
    },
    [deleteDialogCallback, removeLocal, logTag],
  );

  const renameDialog = useCallback(
    async (id: string, title: string): Promise<void> => {
      if (!renameDialogCallback) return;
      // Optimistic — update the local title immediately, roll back on error.
      const previous = dialogsRef.current.find(d => d.id === id)?.title;
      setDialogs(prev => prev.map(d => (d.id === id ? { ...d, title } : d)));
      try {
        await renameDialogCallback(id, title);
      } catch (err) {
        console.error(`${logTag} renameDialog failed:`, err);
        if (previous !== undefined) {
          setDialogs(prev => prev.map(d => (d.id === id ? { ...d, title: previous } : d)));
        }
      }
    },
    [renameDialogCallback, logTag],
  );

  const archiveDialog = useCallback(
    async (id: string): Promise<void> => {
      if (!archiveDialogCallback) return;
      try {
        await archiveDialogCallback(id);
        removeLocal(id);
        onDialogRemovedRef.current?.(id, 'archived');
      } catch (err) {
        // Logged and swallowed — parity with the pre-extraction NATS adapter
        // (the row stays; the host sees the failure in the console).
        console.error(`${logTag} archiveDialog failed:`, err);
      }
    },
    [archiveDialogCallback, removeLocal, logTag],
  );

  const loadMoreDialogs = useCallback(async (): Promise<void> => {
    if (!dialogsNextCursor) return;
    await loadDialogsPage(dialogsNextCursor);
  }, [dialogsNextCursor, loadDialogsPage]);

  const upsertDialogTop = useCallback((item: DialogItem) => {
    setDialogs(prev => [item, ...prev.filter(d => d.id !== item.id)]);
  }, []);

  const patchDialog = useCallback((id: string, patch: Partial<DialogItem>) => {
    setDialogs(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  const hasMoreDialogs = dialogsNextCursor != null;

  return useMemo<UseManagedDialogListResult>(
    () => ({
      dialogs,
      dialogsNextCursor,
      isDialogsLoading,
      dialogsError,
      hasMoreDialogs,
      loadDialogsPage,
      reloadDialogs,
      loadMoreDialogs,
      renameDialog,
      archiveDialog,
      deleteDialog,
      upsertDialogTop,
      patchDialog,
    }),
    [
      dialogs,
      dialogsNextCursor,
      isDialogsLoading,
      dialogsError,
      hasMoreDialogs,
      loadDialogsPage,
      reloadDialogs,
      loadMoreDialogs,
      renameDialog,
      archiveDialog,
      deleteDialog,
      upsertDialogTop,
      patchDialog,
    ],
  );
}
