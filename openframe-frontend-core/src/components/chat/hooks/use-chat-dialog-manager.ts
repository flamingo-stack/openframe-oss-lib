'use client'

import { useCallback, useMemo, useState } from 'react'
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
  const handleConfirmArchive = useCallback(() => {
    if (archiveTarget) {
      void archiveDialog(archiveTarget.id)
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
  const loadArchivedPage = useCallback(
    async (cursor?: string): Promise<void> => {
      if (!fetchArchivedDialogs) return
      setArchivedLoading(true)
      try {
        const result = await fetchArchivedDialogs({ cursor, limit: 20 })
        setArchivedCursor(result.nextCursor)
        setArchivedDialogs((prev) =>
          cursor ? [...prev, ...result.dialogs] : result.dialogs,
        )
      } catch (err) {
        console.error('[useChatDialogManager] fetchArchivedDialogs failed:', err)
      } finally {
        setArchivedLoading(false)
      }
    },
    [fetchArchivedDialogs],
  )
  const openArchive = useCallback(() => {
    setArchiveOpen(true)
    setArchivedDialogs([])
    setArchivedCursor(null)
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
  const handleConfirmRestore = useCallback(() => {
    if (restoreTarget) {
      void unarchiveDialog?.(restoreTarget.id)
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
