'use client'

import * as React from 'react'
import { Chevron02LeftIcon, BoxArchiveIcon } from '../icons-v2-generated'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { ChatPanelHeaderMobile } from './chat-panel-header-mobile'
import { MingoChatHistory, MingoChatHistorySkeleton } from './mingo-chat-history'
import { ChatListEmptyState } from './chat-list-empty-state'
import type { DialogItem } from './types/component.types'

interface ChatArchivePageBaseProps {
  /** Archived dialogs, grouped (Today / Yesterday / Older) by the list. */
  dialogs: ReadonlyArray<DialogItem>
  /** Open an archived dialog. */
  onSelectDialog: (id: string) => void
  /** The delayed skeleton is visible (a slow first page is loading). */
  isLoading?: boolean
  /** A first-page load is in flight but the delayed skeleton hasn't appeared
   *  yet — keeps the empty state suppressed so it never flashes before the
   *  skeleton/data arrives. */
  isFetching?: boolean
  /** Whether another page of archived dialogs remains. */
  hasMore?: boolean
  /** Fetch the next page. */
  onLoadMore?: () => void
}

/** Standalone (default): renders its own back/close header, so BOTH handlers
 *  are required. */
export interface ChatArchivePageStandaloneProps extends ChatArchivePageBaseProps {
  embedded?: false
  /** Back chevron — returns to the previous (list) view. */
  onBack: () => void
  /** Close the whole chat panel. */
  onClose: () => void
}

/** Embedded (wide split layout): the archive lives in the left rail and the
 *  host header already provides the "Chat Archive" back + close controls, so
 *  the built-in header — and its handlers — are dropped. */
export interface ChatArchivePageEmbeddedProps extends ChatArchivePageBaseProps {
  embedded: true
  onBack?: never
  onClose?: never
}

export type ChatArchivePageProps =
  | ChatArchivePageStandaloneProps
  | ChatArchivePageEmbeddedProps

/**
 * Chat Archive page — Figma node `7361:427312`. Back + title + close header
 * over the date-grouped archived-dialog list (reuses `MingoChatHistory`
 * without the row action menus). In `embedded` mode the header is dropped so
 * the list can slot into the split layout's left rail.
 */
export function ChatArchivePage(props: ChatArchivePageProps) {
  const {
    dialogs,
    onSelectDialog,
    isLoading = false,
    isFetching = false,
    hasMore = false,
    onLoadMore,
  } = props
  return (
    <>
      {/* Mobile (<md): the shared mobile header — back to the list + a ⋯ menu
          (Close only here, since the archive list has no per-chat actions).
          `!props.embedded` narrows the union so `onBack` / `onClose` are the
          required standalone handlers (no no-op fallbacks). */}
      {!props.embedded && (
        <ChatPanelHeaderMobile
          className="flex md:hidden"
          showBack
          title="Chat Archive"
          backAriaLabel="Back"
          onBack={props.onBack}
          onClose={props.onClose}
        />
      )}

      {/* Desktop (md+): fixed-height bar with full-height divider action cells —
          the back chevron is a leading `ChatHeaderIconButton` cell matching the
          trailing close cell (not a small inline chevron). */}
      {!props.embedded && (
        <div className="hidden md:flex flex-shrink-0 h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card">
          <ChatHeaderIconButton divider="right" onClick={props.onBack} aria-label="Back">
            <Chevron02LeftIcon size={24} />
          </ChatHeaderIconButton>
          <div className="flex flex-1 min-w-0 items-center px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
            <span className="truncate text-h3 text-ods-text-primary">
              Chat Archive
            </span>
          </div>

          <ChatHeaderIconButton onClick={props.onClose} aria-label="Close">
            <XmarkIcon size={24} />
          </ChatHeaderIconButton>
        </div>
      )}
      <div className="flex flex-1 min-h-0 flex-col p-[var(--spacing-system-m)]">
        {dialogs.length > 0 ? (
          <MingoChatHistory
            dialogs={dialogs}
            onSelectDialog={onSelectDialog}
            hasMore={hasMore}
            isLoadingMore={isLoading && dialogs.length > 0}
            onLoadMore={onLoadMore}
          />
        ) : isLoading ? (
          // First-load skeleton — the SAME grouped/bordered placeholder the
          // active list uses, so the archive loads and lands without a layout
          // shift or a mismatched flat-list skeleton.
          <MingoChatHistorySkeleton />
        ) : isFetching ? (
          // A first, uncached load is in flight but the delayed skeleton hasn't
          // appeared yet (the 120ms window). Render nothing rather than flashing
          // the empty state before the skeleton / data arrives.
          null
        ) : (
          // Empty state — mirrors the "Current Chats" rail empty state
          // (Figma 113:60939): centred 24px muted glyph + h4 title + h6 caption.
          <ChatListEmptyState
            icon={<BoxArchiveIcon size={24} />}
            title="No Archived Chats"
            description="Archived Mingo sessions will show here"
          />
        )}
      </div>
    </>
  )
}
