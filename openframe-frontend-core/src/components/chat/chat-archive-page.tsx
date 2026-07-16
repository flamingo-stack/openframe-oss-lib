'use client'

import * as React from 'react'
import { Chevron02LeftIcon, BoxArchiveIcon } from '../icons-v2-generated'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { ChatPanelHeaderMobile } from './chat-panel-header-mobile'
import { MingoChatHistory, MingoChatHistorySkeleton } from './mingo-chat-history'
import type { DialogItem } from './types/component.types'

export interface ChatArchivePageProps {
  /** Archived dialogs, grouped (Today / Yesterday / Older) by the list. */
  dialogs: ReadonlyArray<DialogItem>
  /** Open an archived dialog. */
  onSelectDialog: (id: string) => void
  /** Back chevron — returns to the previous (list) view. Required unless
   *  `embedded` (then the host supplies the surrounding header). */
  onBack?: () => void
  /** Close the whole chat panel. Required unless `embedded`. */
  onClose?: () => void
  /** True while a page is loading (drives the empty/loading copy + spinner). */
  isLoading?: boolean
  /** Whether another page of archived dialogs remains. */
  hasMore?: boolean
  /** Fetch the next page. */
  onLoadMore?: () => void
  /** Render the LIST only, without the built-in back/close header — for the
   *  wide split layout, where the archive lives in the left rail and the host
   *  header already provides the "Chat Archive" back + close controls. */
  embedded?: boolean
}

/**
 * Chat Archive page — Figma node `7361:427312`. Back + title + close header
 * over the date-grouped archived-dialog list (reuses `MingoChatHistory`
 * without the row action menus). In `embedded` mode the header is dropped so
 * the list can slot into the split layout's left rail.
 */
export function ChatArchivePage({
  dialogs,
  onSelectDialog,
  onBack,
  onClose,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  embedded = false,
}: ChatArchivePageProps) {
  return (
    <>
      {/* Mobile (<md): the shared mobile header — back to the list + a ⋯ menu
          (Close only here, since the archive list has no per-chat actions). */}
      {!embedded && (
        <ChatPanelHeaderMobile
          className="flex md:hidden"
          showBack
          title="Chat Archive"
          backAriaLabel="Back"
          onBack={onBack ?? (() => {})}
          onClose={onClose ?? (() => {})}
        />
      )}

      {/* Desktop (md+): fixed-height bar with full-height divider action cells —
          the back chevron is a leading `ChatHeaderIconButton` cell matching the
          trailing close cell (not a small inline chevron). */}
      {!embedded && (
        <div className="hidden md:flex flex-shrink-0 h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card">
          <ChatHeaderIconButton divider="right" onClick={onBack} aria-label="Back">
            <Chevron02LeftIcon size={24} />
          </ChatHeaderIconButton>
          <div className="flex flex-1 min-w-0 items-center px-4 py-3">
            <span className="truncate text-h3 text-ods-text-primary">
              Chat Archive
            </span>
          </div>

          <ChatHeaderIconButton onClick={onClose} aria-label="Close">
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
        ) : (
          // Empty state — no archived chats. Centred icon + title + hint,
          // mirroring the panel's other empty surfaces (icon in a muted token,
          // h-scale title, secondary body copy). Pure ODS tokens.
          <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-s)] px-[var(--spacing-system-l)] text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-ods-bg-secondary text-ods-text-secondary">
              <BoxArchiveIcon size={28} />
            </div>
            <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
              <p className="text-h3 text-ods-text-primary">No archived chats</p>
              <p className="max-w-xs text-h5 text-ods-text-secondary">
                Chats you archive will appear here. Archive a chat from its
                actions menu to tuck it away without deleting it.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
