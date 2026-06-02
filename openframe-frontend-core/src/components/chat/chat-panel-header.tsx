'use client'

import * as React from 'react'
import { Chevron01LeftIcon } from '../icons-v2-generated/arrows/chevron-01-left-icon'
import {
  Ellipsis01Icon,
  ClockHistoryIcon,
  Refresh01LeftIcon,
} from '../icons-v2-generated'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { MoreActionsMenu } from '../ui/more-actions-menu'

export interface ChatPanelHeaderProps {
  /** Show the back-chevron + bold (h3) title. When false, the static list
   *  title (h4) is shown with no back affordance. */
  showBack?: boolean
  /** Title text (next to the back chevron, or the static list title). */
  title: string
  /** Accessible label for the back chevron. */
  backAriaLabel?: string
  /** The open conversation is an archived chat (read-only). */
  isArchivedView?: boolean
  /** Back-chevron handler. */
  onBack: () => void
  /** Close the panel. */
  onClose: () => void
  /** Restore/unarchive — renders the refresh button (archived view only). */
  onRestore?: () => void
  /** Rename — adds the "Rename chat" item to the ⋯ menu. */
  onRename?: () => void
  /** Archive — adds the "Archive chat" item to the ⋯ menu. */
  onArchive?: () => void
  /** Open the Chat Archive page — renders the clock button (list view only). */
  onOpenArchive?: () => void
}

/**
 * Chat panel top-navigation (Figma node 7363:205930). One bar across the
 * list / active-conversation / archived-conversation / guide views: a
 * back-chevron + title (or the static list title), then state-dependent
 * right-hand actions (restore, ⋯ rename/archive, archive entry) and close.
 */
export function ChatPanelHeader({
  showBack = false,
  title,
  backAriaLabel = 'Back',
  isArchivedView = false,
  onBack,
  onClose,
  onRestore,
  onRename,
  onArchive,
  onOpenArchive,
}: ChatPanelHeaderProps) {
  const menuItems = [
    onRename && { label: 'Rename chat', onClick: onRename },
    onArchive && { label: 'Archive chat', onClick: onArchive },
  ].filter(Boolean) as { label: string; onClick: () => void }[]

  return (
    <div className="flex-shrink-0 flex h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card">
      <div className="flex flex-1 min-w-0 items-center gap-2 px-4 py-3">
        {showBack ? (
          <>
            <button
              type="button"
              onClick={onBack}
              aria-label={backAriaLabel}
              className="inline-flex shrink-0 items-center justify-center size-8 -ml-1 rounded-md text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
            >
              <Chevron01LeftIcon size={20} />
            </button>
            <span className="truncate text-h3 text-ods-text-primary">{title}</span>
          </>
        ) : (
          <p className="truncate text-h4 text-ods-text-primary">{title}</p>
        )}
      </div>

      {/* Restore (refresh) — archived chat header (Figma node 7361:425441). */}
      {isArchivedView && onRestore && (
        <ChatHeaderIconButton onClick={onRestore} aria-label="Unarchive chat">
          <Refresh01LeftIcon size={24} />
        </ChatHeaderIconButton>
      )}

      {/* Rename / Archive menu — active (non-archived) conversation only. */}
      {showBack && !isArchivedView && menuItems.length > 0 && (
        <MoreActionsMenu
          ariaLabel="Chat actions"
          onCloseAutoFocus={(e) => e.preventDefault()}
          items={menuItems}
          trigger={
            <ChatHeaderIconButton aria-label="Chat actions">
              <Ellipsis01Icon size={24} />
            </ChatHeaderIconButton>
          }
        />
      )}

      {/* Chat Archive entry (Figma node 7532:225034) — list view only. */}
      {!showBack && onOpenArchive && (
        <ChatHeaderIconButton onClick={onOpenArchive} aria-label="Chat archive">
          <ClockHistoryIcon size={24} />
        </ChatHeaderIconButton>
      )}

      <ChatHeaderIconButton onClick={onClose} aria-label="Close">
        <XmarkIcon size={24} />
      </ChatHeaderIconButton>
    </div>
  )
}
