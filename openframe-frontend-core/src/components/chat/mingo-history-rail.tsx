'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Button } from '../ui/button'
import { MessagesIcon } from '../icons-v2-generated/communication/messages-icon'
import { PlusCircleIcon } from '../icons-v2-generated/signs-and-symbols/plus-circle-icon'
import { AlertCircleIcon, Refresh01RightIcon } from '../icons-v2-generated'
import { MingoChatHistory, MingoChatHistorySkeleton } from './mingo-chat-history'
import type { DialogItem } from './types/component.types'

// =============================================================================
// Types
// =============================================================================

export interface MingoHistoryRailProps {
  /** Dialogs to list, assumed already sorted newest-first by the host. */
  dialogs: ReadonlyArray<DialogItem>
  /** Currently-open dialog id (highlighted). */
  activeDialogId?: string
  /** Open a dialog. */
  onSelectDialog?: (id: string) => void
  /** Start a fresh chat — clears the open conversation so the chat block shows
   *  the welcome. Rendered as the pinned "Start New Chat" button above the list. */
  onNewChat?: () => void
  /** Show the "Start New Chat" button even when there are no chats yet. Needed
   *  for the narrow single-column list, where there's no composer to fall back
   *  on; the wide rail leaves it off (the chat block already has a composer). */
  newChatAlways?: boolean
  /** Request rename — enables the row "Rename chat" action. */
  onRequestRename?: (dialog: DialogItem) => void
  /** Request archive — enables the row "Archive chat" action. */
  onRequestArchive?: (dialog: DialogItem) => void
  /** Current server-side search term. Drives the list's "No chats found"
   *  empty state; the search INPUT itself lives in the panel header now, not
   *  in the rail body. */
  searchQuery?: string
  /** Whether more dialogs remain (cursor pagination). */
  hasMore?: boolean
  /** True while the next page is loading. */
  isLoadingMore?: boolean
  /** Fetch the next page. */
  onLoadMore?: () => void
  /** True while the FIRST page of dialogs is still loading. Renders a skeleton
   *  so the rail doesn't flash the empty state before the list arrives. */
  isLoadingHistory?: boolean
  /** The dialog-list load FAILED with nothing cached — renders an error + retry
   *  block instead of the empty state. */
  loadError?: boolean
  /** Retry handler for the `loadError` state. */
  onRetry?: () => void
  /** Appended to the root element. */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * MingoHistoryRail — the persistent "Current Chats" left column of the split
 * (wide) Mingo layout (Figma 113:60931 / 113:63630).
 *
 * The dialog history that the stacked layout renders inline in the Mingo empty
 * state is hoisted here into a fixed-width rail beside the chat block. On top
 * sits a pinned "Start New Chat" button (shown once the user has chats); below
 * it the grouped Today / Yesterday / Older list (`MingoChatHistory`). With no
 * chats it collapses to a centred empty state; loading / error states mirror
 * the stacked empty state so the two layouts stay consistent.
 */
export function MingoHistoryRail({
  dialogs,
  activeDialogId,
  onSelectDialog,
  onNewChat,
  newChatAlways = false,
  onRequestRename,
  onRequestArchive,
  searchQuery,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isLoadingHistory = false,
  loadError = false,
  onRetry,
  className,
}: MingoHistoryRailProps) {
  const hasSearch = !!searchQuery?.trim()
  // The list (vs. the empty state) shows whenever there are chats OR an active
  // search is running — a no-match query must keep the search bar mounted
  // rather than flash the "No Current Chats" state.
  const hasList = dialogs.length > 0 || hasSearch

  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]',
        className,
      )}
    >
      {/* Pinned "Start New Chat". In the wide rail it's offered only once the
          user has chats (the chat block's composer is the empty-state entry);
          the narrow list forces it on (`newChatAlways`) since it has no composer. */}
      {onNewChat && (hasList || newChatAlways) && (
        <Button
          variant="outline"
          fullWidth
          leftIcon={<PlusCircleIcon size={20} />}
          onClick={onNewChat}
          className="shrink-0 justify-start"
        >
          Start New Chat
        </Button>
      )}

      {loadError ? (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-[var(--spacing-system-m)] text-center">
          <AlertCircleIcon className="h-8 w-8 text-ods-text-secondary shrink-0" />
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <p className="text-h4 text-ods-text-primary">Couldn’t load your chats</p>
            <p className="text-h6 text-ods-text-secondary">
              Something went wrong reaching the server. Try again.
            </p>
          </div>
          {onRetry && (
            <Button
              variant="outline"
              size="small"
              leftIcon={<Refresh01RightIcon />}
              onClick={onRetry}
            >
              Try again
            </Button>
          )}
        </div>
      ) : isLoadingHistory ? (
        <MingoChatHistorySkeleton />
      ) : hasList ? (
        <MingoChatHistory
          dialogs={dialogs}
          activeDialogId={activeDialogId}
          onSelectDialog={onSelectDialog}
          onRequestRename={onRequestRename}
          onRequestArchive={onRequestArchive}
          searchQuery={searchQuery}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
        />
      ) : (
        // Figma 113:60931 — no-chats empty state.
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] text-center">
          <MessagesIcon className="h-8 w-8 text-ods-text-secondary shrink-0" />
          <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
            <p className="text-h4 text-ods-text-primary">No Current Chats</p>
            <p className="text-h6 text-ods-text-secondary">
              Previous Mingo sessions will show here
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
