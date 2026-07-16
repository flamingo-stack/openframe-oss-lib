'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import {
  Chevron02LeftIcon,
  Ellipsis01Icon,
  ClockHistoryIcon,
  Refresh01LeftIcon,
  SearchIcon,
} from '../icons-v2-generated'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { ChatHeaderSearchField } from './chat-header-search-field'
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu'
import { ChatPanelHeaderMobile } from './chat-panel-header-mobile'

export interface ChatPanelHeaderProps {
  /** Show the back-chevron + bold (h3) title. When false, the static list
   *  title (h4) is shown with no back affordance. */
  showBack?: boolean
  /** Title text (next to the back chevron, or the static list title). */
  title: string
  /** Optional sub-line under the title (e.g. the signed-in user's name).
   *  Rendered muted (`h6`) beneath the title in every view that has one. */
  subtitle?: React.ReactNode
  /** Accessible label for the back chevron. */
  backAriaLabel?: string
  /** The open conversation is an archived chat (read-only). */
  isArchivedView?: boolean
  /** Back-chevron handler. Required only when `showBack` — the list view has no
   *  back affordance. */
  onBack?: () => void
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
  /** Toggle the dialog-list search field — renders a magnifier button (list
   *  view only), before the archive clock. */
  onToggleSearch?: () => void
  /** Whether the search field is currently open. When true (and `onSearchChange`
   *  is wired) the title area is REPLACED in place by the inline search field
   *  and the magnifier toggle is hidden. */
  searchActive?: boolean
  /** Seeds the inline search field when it opens (current search term). */
  searchQuery?: string
  /** Emits the debounced search term from the inline field. Enables the
   *  in-header search experience (list view only). */
  onSearchChange?: (query: string) => void
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
  subtitle,
  backAriaLabel = 'Back',
  isArchivedView = false,
  onBack,
  onClose,
  onRestore,
  onRename,
  onArchive,
  onOpenArchive,
  compact = false,
  onToggleSearch,
  searchActive = false,
  searchQuery,
  onSearchChange,
}: ChatPanelHeaderProps) {
  // Search open (with a wired handler) swaps the title for the inline field.
  const searchInline = searchActive && !!onSearchChange
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
          subtitle={subtitle}
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
      <div
        className={cn(
          'flex-shrink-0 h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card',
          compact ? 'flex' : 'hidden md:flex',
        )}
      >
        {/* Back — a full-height leading cell (right divider), the same
            `ChatHeaderIconButton` primitive as the trailing ⋯ / close cells. */}
        {showBack && (
          <ChatHeaderIconButton
            divider="right"
            onClick={onBack}
            aria-label={backAriaLabel}
          >
            <Chevron02LeftIcon size={24} />
          </ChatHeaderIconButton>
        )}
        {searchInline ? (
          // Search open — the inline field takes over the title area in place
          // (Figma 116:51217); the magnifier toggle below is hidden.
          <ChatHeaderSearchField
            initialValue={searchQuery}
            onSearchChange={onSearchChange}
            onCollapse={onToggleSearch}
          />
        ) : (
          <div className="flex flex-1 min-w-0 items-center px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <p className="truncate text-h3 leading-tight text-ods-text-primary">{title}</p>
              {subtitle && (
                <p className="truncate text-h6 leading-tight text-ods-text-secondary">{subtitle}</p>
              )}
            </div>
          </div>
        )}

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

        {/* Dialog search toggle — list view only, before the archive entry.
            Hidden while search is open (the inline field owns the magnifier). */}
        {!showBack && !searchInline && onToggleSearch && (
          <ChatHeaderIconButton
            onClick={onToggleSearch}
            aria-label="Search chats"
            aria-pressed={searchActive}
          >
            <SearchIcon size={24} />
          </ChatHeaderIconButton>
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
