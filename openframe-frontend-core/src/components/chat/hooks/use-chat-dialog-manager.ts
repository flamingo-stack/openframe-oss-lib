'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { DialogItem } from '../types/component.types'
import type {
  FetchDialogsParams,
  FetchDialogsResult,
} from './use-nats-chat-adapter'

export interface UseChatDialogManagerArgs {
  /** Active (non-archived) dialogs from the unified chat state. */
  dialogs: ReadonlyArray<DialogItem>
  /** Currently-open dialog id. */
  activeDialogId: string | null | undefined
  /** Open a dialog by id. */
  selectDialog: (id: string | null) => void
  /** Reset the open conversation (drops back to the list / empty state). */
  clearMessages: () => void
  /** Rename a dialog (wired through the active adapter). */
  renameDialog: (id: string, title: string) => Promise<void>
  /** Archive a dialog (wired through the active adapter). */
  archiveDialog: (id: string) => Promise<void>
  /** Host callback that pages archived dialogs — gates the archive UI. */
  fetchArchivedDialogs?: (
    params: FetchDialogsParams,
  ) => Promise<FetchDialogsResult>
  /** Host callback that restores an archived dialog — gates the restore UI. */
  unarchiveDialog?: (id: string) => Promise<void>
}

/**
 * Owns the chat panel's dialog-history concerns so `EmbeddableChat` stays an
 * orchestrator rather than a state dump:
 *   - the Chat Archive page (open / paginate the archived list),
 *   - read-only "archived conversation" mode (open from the archive, restore,
 *     back-to-archive navigation),
 *   - the Rename / Archive / Unarchive confirmation-modal targets + handlers.
 *
 * Returns flat fields (intentionally the same names the JSX already uses) so
 * the consuming component reads as a thin wiring layer.
 */
export function useChatDialogManager({
  dialogs,
  activeDialogId,
  selectDialog,
  clearMessages,
  renameDialog,
  archiveDialog,
  fetchArchivedDialogs,
  unarchiveDialog,
}: UseChatDialogManagerArgs) {
  // ─── Rename / Archive confirmation modals ───
  const [renameTarget, setRenameTarget] = useState<DialogItem | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<DialogItem | null>(null)
  const handleConfirmRename = useCallback(
    (name: string) => {
      if (renameTarget) void renameDialog(renameTarget.id, name)
      setRenameTarget(null)
    },
    [renameTarget, renameDialog],
  )
  const handleConfirmArchive = useCallback(async () => {
    if (archiveTarget) {
      try {
        await archiveDialog(archiveTarget.id)
      } catch (err) {
        // Keep the modal open (don't clear the target) so the user can retry;
        // don't tear down the open conversation for an archive that failed.
        console.error('[useChatDialogManager] archive failed:', err)
        return
      }
      // Archiving the open conversation drops back to the chat list.
      if (archiveTarget.id === activeDialogId) {
        setOpeningDialogId(null)
        clearMessages()
      }
    }
    setArchiveTarget(null)
  }, [archiveTarget, archiveDialog, activeDialogId, clearMessages])

  // ─── Chat Archive page ───
  // The archived list is paged locally (it's a secondary, on-demand view).
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [archivedDialogs, setArchivedDialogs] = useState<DialogItem[]>([])
  const [archivedCursor, setArchivedCursor] = useState<string | null>(null)
  const [archivedLoading, setArchivedLoading] = useState(false)
  // A fetch is in flight, tracked SEPARATELY from the delayed skeleton
  // (`archivedLoading`). Set synchronously so the empty state stays suppressed
  // during the 120ms skeleton delay — otherwise an uncached first open flashes
  // "No archived chats" before the skeleton/data appears.
  const [archivedPending, setArchivedPending] = useState(false)
  // Monotonic request id — a background page-1 refresh and a pagination fetch
  // can overlap (the retained list stays interactive while page 1 revalidates).
  // Only the LATEST request may mutate the list / cursor / loading flags, so a
  // slow earlier response can't clobber newer rows, append stale ones, or clear
  // the shared loading flag while another request is still in flight.
  const archivedRequestIdRef = useRef(0)
  const loadArchivedPage = useCallback(
    async (cursor?: string): Promise<void> => {
      if (!fetchArchivedDialogs) return
      const requestId = ++archivedRequestIdRef.current
      const isCurrent = () => archivedRequestIdRef.current === requestId
      // Only a first-page load drives the full-view skeleton, and only if it's
      // actually slow: a 120ms delay means a cached/fast fetch (the host caches
      // page 1) resolves first and never flashes a skeleton. Pagination
      // (`cursor`) keeps the current list visible.
      const isInitial = !cursor
      setArchivedPending(true)
      let skeletonTimer: ReturnType<typeof setTimeout> | undefined
      if (isInitial) {
        // Delay the full-view skeleton so a cached/fast page-1 fetch never
        // flashes it (and skip it if a newer request already superseded us).
        skeletonTimer = setTimeout(() => {
          if (isCurrent()) setArchivedLoading(true)
        }, 120)
      } else {
        // Pagination shows its "load more" indicator immediately (the list
        // stays visible), so no delay here.
        setArchivedLoading(true)
      }
      try {
        const result = await fetchArchivedDialogs({ cursor, limit: 20 })
        // A newer request superseded this one — drop the response so overlapping
        // refresh / pagination can't append stale rows or clobber newer results.
        if (!isCurrent()) return
        setArchivedCursor(result.nextCursor)
        setArchivedDialogs((prev) =>
          cursor ? [...prev, ...result.dialogs] : result.dialogs,
        )
      } catch (err) {
        if (!isCurrent()) return
        console.error('[useChatDialogManager] fetchArchivedDialogs failed:', err)
      } finally {
        if (skeletonTimer) clearTimeout(skeletonTimer)
        // Only the latest request owns the shared loading / pending flags.
        if (isCurrent()) {
          setArchivedLoading(false)
          setArchivedPending(false)
        }
      }
    },
    [fetchArchivedDialogs],
  )
  const openArchive = useCallback(() => {
    setArchiveOpen(true)
    // Don't clear the list — keep any already-loaded page visible and refresh
    // page 1 in the background (stale-while-revalidate), so reopening the
    // archive within a session doesn't blank out to a skeleton.
    void loadArchivedPage()
  }, [loadArchivedPage])
  const closeArchive = useCallback(() => setArchiveOpen(false), [])

  // ─── Read-only "archived conversation" mode ───
  // Set when a chat is opened FROM the archive page — flips the open
  // conversation into read-only mode (restore button + disabled composer).
  const [viewingArchivedId, setViewingArchivedId] = useState<string | null>(
    null,
  )

  // ─── Open-conversation tracking ───
  // `openingDialogId` is set synchronously the moment a dialog is selected from
  // the current-chats list, so the panel can flip to the conversation surface
  // immediately — matching the archived-chat open (`viewingArchivedId` above)
  // instead of waiting for `messages` to finish loading. Without it the normal
  // open lagged behind the archived one (grey → load → flip vs. instant flip).
  const [openingDialogId, setOpeningDialogId] = useState<string | null>(null)
  const handleSelectDialog = useCallback(
    (id: string) => {
      setViewingArchivedId(null)
      setOpeningDialogId(id)
      selectDialog(id)
    },
    [selectDialog],
  )
  const isOpeningDialog =
    openingDialogId != null && openingDialogId === activeDialogId

  const handleArchivedSelect = useCallback(
    (id: string) => {
      setArchiveOpen(false)
      setOpeningDialogId(null)
      setViewingArchivedId(id)
      selectDialog(id)
    },
    [selectDialog],
  )
  const [restoreTarget, setRestoreTarget] = useState<DialogItem | null>(null)
  const handleConfirmRestore = useCallback(async () => {
    if (restoreTarget) {
      try {
        await unarchiveDialog?.(restoreTarget.id)
      } catch (err) {
        // Backend restore failed — leave the local archived cache untouched so
        // the dialog doesn't vanish from the archive only to resurface on the
        // next fetch. Keep the modal open for a retry.
        console.error('[useChatDialogManager] unarchive failed:', err)
        return
      }
      // Drop it from the locally-cached archived list and exit read-only mode
      // so the composer returns and the user can keep chatting.
      setArchivedDialogs((prev) => prev.filter((d) => d.id !== restoreTarget.id))
      setViewingArchivedId((cur) => (cur === restoreTarget.id ? null : cur))
    }
    setRestoreTarget(null)
  }, [restoreTarget, unarchiveDialog])

  const isViewingArchived =
    viewingArchivedId != null && viewingArchivedId === activeDialogId

  // Header back-chevron: from an archived chat, return to the Chat Archive
  // page (not the current-chats list); otherwise reset to the list.
  const handleBack = useCallback(() => {
    const wasArchived = isViewingArchived
    setViewingArchivedId(null)
    setOpeningDialogId(null)
    // Reset the adapter's active dialog id (not just the message buffer):
    // `clearMessages` empties `messages` but leaves `activeDialogId` pointing at
    // the just-closed dialog, so re-selecting that same dialog from the list is
    // a no-op the history-load effect skips → a blank conversation. Selecting
    // `null` lets the next selection register as a real change and reload.
    selectDialog(null)
    clearMessages()
    if (wasArchived) setArchiveOpen(true)
  }, [isViewingArchived, selectDialog, clearMessages])

  // "Start New Chat" reset — clears the open conversation and ALWAYS lands on
  // the new-chat welcome. Unlike `handleBack`, it never reopens the archive
  // (backing out of an archived chat returns to the archive; starting a NEW
  // chat must not), so the archive is force-closed here regardless of state.
  const resetToNewChat = useCallback(() => {
    setViewingArchivedId(null)
    setOpeningDialogId(null)
    selectDialog(null)
    clearMessages()
    setArchiveOpen(false)
  }, [selectDialog, clearMessages])

  // Active-conversation dialog — resolved from the active list, or the
  // archived list when an archived chat is open (archived dialogs aren't in
  // `dialogs`, so the header title and ⋯ / restore actions need this).
  const activeDialog = useMemo(
    () =>
      dialogs.find((d) => d.id === activeDialogId) ??
      archivedDialogs.find((d) => d.id === activeDialogId),
    [dialogs, archivedDialogs, activeDialogId],
  )

  return {
    // capability passthroughs (gate the archive / restore affordances)
    fetchArchivedDialogs,
    unarchiveDialog,
    // archive page
    archiveOpen,
    archivedDialogs,
    archivedCursor,
    archivedLoading,
    archivedPending,
    openArchive,
    closeArchive,
    loadArchivedPage,
    handleArchivedSelect,
    // open conversation (current-chats list)
    handleSelectDialog,
    isOpeningDialog,
    // archived conversation
    isViewingArchived,
    handleBack,
    resetToNewChat,
    activeDialog,
    // action modals
    renameTarget,
    setRenameTarget,
    archiveTarget,
    setArchiveTarget,
    restoreTarget,
    setRestoreTarget,
    handleConfirmRename,
    handleConfirmArchive,
    handleConfirmRestore,
  }
}
