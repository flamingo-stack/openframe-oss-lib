'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Chevron01LeftIcon } from '../icons-v2-generated/arrows/chevron-01-left-icon'
import {
  Ellipsis01Icon,
  ClockHistoryIcon,
  Refresh01LeftIcon,
} from '../icons-v2-generated'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu'
import { ChatPanelHeaderMobile } from './chat-panel-header-mobile'

/**
 * Compact rounded header button used for the desktop back chevron. Borderless
 * square with a hover background. (Mobile uses its own header component —
 * `ChatPanelHeaderMobile`.)
 */
export const COMPACT_HEADER_BUTTON =
  'inline-flex shrink-0 items-center justify-center size-8 rounded-md text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent'

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
  /** Force the COMPACT (`h-14` desktop-style) bar at every width, skipping the
   *  full-screen mobile header. For EMBEDDED surfaces (e.g. a small preview
   *  panel) where the phone-sized full-bleed header (large `text-h2` title) is
   *  wrong regardless of viewport. Default false = viewport-responsive. */
  compact?: boolean
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
  compact = false,
}: ChatPanelHeaderProps) {
  // Desktop ⋯ menu (active, non-archived conversation only) — rename / archive.
  const menuItems = [
    onRename && { id: 'rename', label: 'Rename chat', onClick: onRename },
    onArchive && { id: 'archive', label: 'Archive chat', onClick: onArchive },
  ].filter(Boolean) as ActionsMenuItem[]

  return (
    <>
      {/* Mobile (<md): a distinct full-screen layout (Figma node 7363:85532).
          Skipped in `compact` mode — an embedded preview keeps the small bar
          at every width. */}
      {!compact && (
        <ChatPanelHeaderMobile
          className="flex md:hidden"
          showBack={showBack}
          title={title}
          backAriaLabel={backAriaLabel}
          isArchivedView={isArchivedView}
          onBack={onBack}
          onClose={onClose}
          onRestore={onRestore}
          onRename={onRename}
          onArchive={onArchive}
          onOpenArchive={onOpenArchive}
        />
      )}

      {/* Compact bar: `md+` normally, or ALL widths when `compact`. Fixed-height
          bar with full-height divider action cells. */}
      <div className={cn('flex-shrink-0 h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card', compact ? 'flex' : 'hidden md:flex')}>
        <div className="flex flex-1 min-w-0 items-center gap-2 px-4 py-3">
          {showBack ? (
            <>
              <button
                type="button"
                onClick={onBack}
                aria-label={backAriaLabel}
                className={`${COMPACT_HEADER_BUTTON} -ml-1`}
              >
                <Chevron01LeftIcon size={20} />
              </button>
              <span className="truncate text-h3 text-ods-text-primary">{title}</span>
            </>
          ) : (
            <p className="truncate text-h3 text-ods-text-primary">{title}</p>
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
          <ActionsMenuDropdown
            triggerAriaLabel="Chat actions"
            onCloseAutoFocus={(e) => e.preventDefault()}
            groups={[{ items: menuItems }]}
            customTrigger={
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
    </>
  )
}
