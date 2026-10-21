'use client';

import { Chevron02LeftIcon, BoxArchiveIcon } from '../icons-v2-generated';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { useLoadingScope } from '../ui/loading-scope';
import { ChatHeaderIconButton } from './chat-header-icon-button';
import { ChatListEmptyState } from './chat-list-empty-state';
import { ChatPanelHeaderMobile } from './chat-panel-header-mobile';
import { MingoChatHistory } from './mingo-chat-history';
import type { DialogItem } from './types/component.types';

interface ChatArchivePageBaseProps {
  /** Archived dialogs, grouped (Today / Yesterday / Older) by the list. */
  dialogs: ReadonlyArray<DialogItem>;
  /** Open an archived dialog. */
  onSelectDialog: (id: string) => void;
  /** A page is loading (the first: the list draws its loading state; a later one: its next-page rows). */
  isLoading?: boolean;
  /** A first-page load is in flight: the list draws its loading state, so the empty state never flashes. */
  isFetching?: boolean;
  /** Whether another page of archived dialogs remains. */
  hasMore?: boolean;
  /** Fetch the next page. */
  onLoadMore?: () => void;
  /** The archive's page size: how many rows the first-load loading state draws. Default
   *  `CHAT_HISTORY_PAGE_SIZE`. */
  pageSize?: number;
}

/** Standalone (default): renders its own back/close header. `onBack` is
 *  required; without `onClose` the close button is left out. */
export interface ChatArchivePageStandaloneProps extends ChatArchivePageBaseProps {
  embedded?: false;
  /** Back chevron — returns to the previous (list) view. */
  onBack: () => void;
  /** Close the whole chat panel. */
  onClose?: () => void;
}

/** Embedded (wide split layout): the archive lives in the left rail and the
 *  host header already provides the "Chat Archive" back + close controls, so
 *  the built-in header — and its handlers — are dropped. */
export interface ChatArchivePageEmbeddedProps extends ChatArchivePageBaseProps {
  embedded: true;
  onBack?: never;
  onClose?: never;
}

export type ChatArchivePageProps = ChatArchivePageStandaloneProps | ChatArchivePageEmbeddedProps;

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
    pageSize,
  } = props;
  // ONE switch: a first page with nothing to show yet (in flight at all, or the page's loading state) is the list's
  // own loading state, never a blank.
  const firstLoad = useLoadingScope() || ((isLoading || isFetching) && dialogs.length === 0);
  return (
    <>
      {/* Mobile (<md): the shared mobile header — back to the list + a ⋯ menu
          (Close only here, since the archive list has no per-chat actions).
          `!props.embedded` narrows the union so `onBack` / `onClose` are the
          standalone handlers (no no-op fallbacks). */}
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
        <div className="hidden h-14 w-full flex-shrink-0 overflow-hidden border-b border-ods-border bg-ods-card md:flex">
          <ChatHeaderIconButton divider="right" onClick={props.onBack} aria-label="Back">
            <Chevron02LeftIcon size={24} />
          </ChatHeaderIconButton>
          <div className="flex min-w-0 flex-1 items-center px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]">
            <span className="truncate text-ods-text-primary text-h3">Chat Archive</span>
          </div>

          {props.onClose && (
            <ChatHeaderIconButton onClick={props.onClose} aria-label="Close">
              <XmarkIcon size={24} />
            </ChatHeaderIconButton>
          )}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col p-[var(--spacing-system-m)]">
        {firstLoad || dialogs.length > 0 ? (
          // The first load is the list's own loading state — the SAME grouped/
          // bordered rows the active list draws, so the archive loads and lands
          // without a layout shift.
          <MingoChatHistory
            loading={firstLoad}
            pageSize={pageSize}
            dialogs={dialogs}
            onSelectDialog={onSelectDialog}
            hasMore={hasMore}
            isLoadingMore={isLoading && dialogs.length > 0}
            onLoadMore={onLoadMore}
          />
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
  );
}
