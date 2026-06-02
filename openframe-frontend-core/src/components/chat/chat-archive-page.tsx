'use client'

import * as React from 'react'
import { Chevron02LeftIcon } from '../icons-v2-generated'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { ChatHeaderIconButton } from './chat-header-icon-button'
import { MingoChatHistory } from './mingo-chat-history'
import type { DialogItem } from './types/component.types'

export interface ChatArchivePageProps {
  /** Archived dialogs, grouped (Today / Yesterday / Older) by the list. */
  dialogs: ReadonlyArray<DialogItem>
  /** Open an archived dialog. */
  onSelectDialog: (id: string) => void
  /** Back chevron — returns to the previous (list) view. */
  onBack: () => void
  /** Close the whole chat panel. */
  onClose: () => void
  /** True while a page is loading (drives the empty/loading copy + spinner). */
  isLoading?: boolean
  /** Whether another page of archived dialogs remains. */
  hasMore?: boolean
  /** Fetch the next page. */
  onLoadMore?: () => void
}

/**
 * Chat Archive page — Figma node `7361:427312`. Back + title + close header
 * over the date-grouped archived-dialog list (reuses `MingoChatHistory`
 * without the row action menus).
 */
export function ChatArchivePage({
  dialogs,
  onSelectDialog,
  onBack,
  onClose,
  isLoading = false,
  hasMore = false,
  onLoadMore,
}: ChatArchivePageProps) {
  return (
    <>
      <div className="flex-shrink-0 flex h-14 w-full overflow-hidden border-b border-ods-border bg-ods-card">
        <div className="flex flex-1 min-w-0 items-center gap-2 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="inline-flex shrink-0 items-center justify-center size-8 -ml-1 rounded-md text-ods-text-secondary transition-colors hover:bg-ods-bg-hover hover:text-ods-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
          >
            <Chevron02LeftIcon size={20} />
          </button>
          <span className="truncate text-h3 text-ods-text-primary">
            Chat Archive
          </span>
        </div>
        <ChatHeaderIconButton onClick={onClose} aria-label="Close">
          <XmarkIcon size={24} />
        </ChatHeaderIconButton>
      </div>
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
          // First-load skeleton — `h-12` rows matching the dialog-list layout
          // so results land without a shift (auth → data → empty → content).
          <div className="flex flex-col" aria-hidden>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="flex h-12 items-center gap-[var(--spacing-system-xsf)] border-b border-ods-border px-[var(--spacing-system-s)] last:border-b-0"
              >
                <div className="h-4 w-full max-w-[60%] animate-pulse rounded bg-ods-bg-secondary" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center">
            <p className="text-h4 text-ods-text-secondary">
              No archived chats yet.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
