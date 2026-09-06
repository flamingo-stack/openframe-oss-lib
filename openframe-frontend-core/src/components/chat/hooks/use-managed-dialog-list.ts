'use client';

/**
 * useManagedDialogList — the ONE cursor-paged dialog-list state machine. Two
 * consumers: the NATS/Mingo adapter's managed-dialog mode and the SSE/Guide
 * adapter (when `ChatRuntime.endpoints.chatConversationsUrl` is set).
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
  /** Gates the AUTOMATIC first-page load only (every other operation is
   *  caller-driven). The adapters pass their own `active` gate so an idle
   *  transport does no network. */
  autoLoad: boolean;
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
  /** Skeleton flag — true while a page request is in flight. */
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
  /** Move an existing row to the head of the list with a fresh `timestamp` —
   *  what a new turn does server-side (`last_message_at desc`). No-op for an
   *  id the list doesn't hold. */
  bumpDialogToTop: (id: string) => void;
}

export function useManagedDialogList({
  autoLoad,
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
  // Which `search` value's FIRST PAGE has settled (`null` = the no-search
  // case). `undefined` = nothing has settled yet. Seeded unsettled exactly when
  // a load is coming, so `isDialogsLoading` reads true from the FIRST render
  // rather than only once the effect fires — a consumer that branches on "the
  // list is empty" would otherwise see a one-frame empty list on mount, and
  // again on every search change, before the request starts.
  const [settledSearch, setSettledSearch] = useState<string | null | undefined>(
    autoLoad && fetchDialogs ? undefined : null,
  );
  // The seed above is a FIRST-RENDER value, so it misses a consumer that mounts
  // with `autoLoad: false` and turns it on later (a panel opened in the other
  // transport's mode, then switched into this one). Re-arm on that transition
  // — adjusting state during render, the documented React pattern, guarded so
  // the extra pass takes the early exit.
  const [autoLoadWas, setAutoLoadWas] = useState(autoLoad);
  if (autoLoad !== autoLoadWas) {
    setAutoLoadWas(autoLoad);
    if (autoLoad && fetchDialogs) setSettledSearch(undefined);
  }
  // A page request is in flight. A REF, not state: its only reader is
  // `loadMoreDialogs`, which must see a page-1 load dispatched in the SAME
  // tick — something a render-closure state value would miss.
  const pendingRef = useRef(false);
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

  // Monotonic request id. Page-1 loads overlap in normal use — a search-term
  // change, the end-of-turn refresh and an unarchive all trigger one — so
  // without this the LAST-RESOLVING response wins: the list can show results
  // for an earlier search term under a newer query, paginate with the wrong
  // cursor, or have its loading flag cleared while another fetch is still in
  // flight. Only the latest request may touch the list/cursor/flags. (Same
  // guard `useChatDialogManager.loadArchivedPage` has always carried.)
  const requestIdRef = useRef(0);

  const loadDialogsPage = useCallback(
    async (cursor?: string): Promise<void> => {
      if (!fetchDialogs) return;
      const requestId = ++requestIdRef.current;
      const isCurrent = () => requestIdRef.current === requestId;
      pendingRef.current = true;
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
        // Superseded by a newer load — drop the response entirely.
        if (!isCurrent()) return;
        setDialogsNextCursor(result.nextCursor);
        if (cursor === undefined) {
          setDialogs(result.dialogs);
        } else {
          // Dedupe on append: a row whose `last_message_at` moved between page
          // fetches can come back on a later page, and duplicate ids mean
          // duplicate React keys.
          setDialogs(prev => {
            const seen = new Set(prev.map(d => d.id));
            return [...prev, ...result.dialogs.filter(d => !seen.has(d.id))];
          });
        }
      } catch (err) {
        if (!isCurrent()) return;
        console.error(`${logTag} fetchDialogs failed:`, err);
        // Only the FIRST page failing is a "can't show the list" error — a
        // pagination failure keeps the already-loaded list intact. Flag it and
        // release the initial-load guard so a retry (or re-activation) re-runs.
        if (cursor === undefined) {
          setDialogsError(true);
          initialDialogsLoadedRef.current = false;
        }
      } finally {
        // Only the latest request owns the shared flags.
        if (isCurrent()) {
          pendingRef.current = false;
          if (cursor === undefined) setSettledSearch(search ?? null);
          setIsDialogsLoading(false);
        }
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
    if (!autoLoad) return;
    if (initialDialogsLoadedRef.current && loadedSearchRef.current === search) return;
    initialDialogsLoadedRef.current = true;
    loadedSearchRef.current = search;
    void loadDialogsPage();
  }, [autoLoad, fetchDialogs, search, loadDialogsPage]);

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
        // Re-thrown: a caller that opened a confirmation modal must be able to
        // keep it open and NOT tear down the open thread for a write that
        // never landed (`useChatDialogManager.handleConfirmArchive`).
        throw err;
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
        // SWALLOWED, unlike archive/delete. `useChatDialogManager` fires rename
        // as `void renameDialog(...)` and closes its modal immediately, so a
        // rejection here would surface only as an unhandled rejection. The
        // optimistic rollback below is the user-visible signal, exactly as the
        // pre-extraction NATS adapter behaved.
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
        console.error(`${logTag} archiveDialog failed:`, err);
        // Re-thrown so `useChatDialogManager.handleConfirmArchive` can keep the
        // confirmation modal open for a retry instead of closing it and wiping
        // the open conversation over a write the server rejected.
        throw err;
      }
    },
    [archiveDialogCallback, removeLocal, logTag],
  );

  const loadMoreDialogs = useCallback(async (): Promise<void> => {
    if (!dialogsNextCursor) return;
    // A page-1 reload in flight will REPLACE the list and the cursor, so an
    // append started now would land on a list that no longer exists, using a
    // stale cursor. Skip it; the reload's own result is the fresh page 1.
    if (pendingRef.current) return;
    await loadDialogsPage(dialogsNextCursor);
  }, [dialogsNextCursor, loadDialogsPage]);

  const upsertDialogTop = useCallback((item: DialogItem) => {
    setDialogs(prev => [item, ...prev.filter(d => d.id !== item.id)]);
  }, []);

  const bumpDialogToTop = useCallback((id: string) => {
    setDialogs(prev => {
      const row = prev.find(d => d.id === id);
      if (!row) return prev;
      return [{ ...row, timestamp: new Date() }, ...prev.filter(d => d.id !== id)];
    });
  }, []);

  const hasMoreDialogs = dialogsNextCursor != null;
  // Reported as loading until the first page for the CURRENT search settles —
  // see `settledSearch`.
  const awaitingFirstPage = !!fetchDialogs && settledSearch !== (search ?? null);
  const dialogsLoading = isDialogsLoading || awaitingFirstPage;

  return useMemo<UseManagedDialogListResult>(
    () => ({
      dialogs,
      dialogsNextCursor,
      isDialogsLoading: dialogsLoading,
      dialogsError,
      hasMoreDialogs,
      loadDialogsPage,
      reloadDialogs,
      loadMoreDialogs,
      renameDialog,
      archiveDialog,
      deleteDialog,
      upsertDialogTop,
      bumpDialogToTop,
    }),
    [
      dialogs,
      dialogsNextCursor,
      dialogsLoading,
      dialogsError,
      hasMoreDialogs,
      loadDialogsPage,
      reloadDialogs,
      loadMoreDialogs,
      renameDialog,
      archiveDialog,
      deleteDialog,
      upsertDialogTop,
      bumpDialogToTop,
    ],
  );
}
