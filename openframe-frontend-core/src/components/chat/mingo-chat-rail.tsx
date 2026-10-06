'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import {
  AlertCircleIcon,
  ChatPlusIcon,
  ChatQuestionIcon,
  ChatsIcon,
  ClockHistoryIcon,
  DotsLoaderIcon,
  Ellipsis01Icon,
  MessageIndicatorIcon,
  Refresh01RightIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
} from '../icons-v2-generated';
import { MingoIcon } from '../icons/mingo-icon';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { chatDialogMenuItems } from './chat-dialog-menu-items';
import { ChatHeaderSearchField } from './chat-header-search-field';
import { ChatListEmptyState } from './chat-list-empty-state';
import { ChatListItem, ChatNavSidebar, type ChatNavSidebarItem } from './chat-nav-sidebar';
import type { MingoHistoryScope } from './mingo-history-rail';
import type { DialogItem } from './types/component.types';

/**
 * What a chat is doing, shown at the end of its row:
 * - `working`: Mingo is answering in it
 * - `unread`: a reply the user has not seen
 * - `approval`: Mingo waits for an approval there
 */
export type MingoDialogStatus = 'working' | 'unread' | 'approval';

export interface MingoChatRailProps {
  /** Dialogs to list, newest first. */
  dialogs: ReadonlyArray<DialogItem>;
  activeDialogId?: string;
  onSelectDialog?: (id: string) => void;
  /** A chat being started and not saved yet: a selected row at the top
   *  (e.g. "New Chat"), so the list says what the chat beside it is. */
  draftTitle?: string;
  onNewChat?: () => void;
  /** Open the archive. `archiveActive` marks it as the view on screen. */
  onOpenArchive?: () => void;
  archiveActive?: boolean;
  /** "What to ask Mingo?": the suggestions a new chat starts from. */
  onWhatToAsk?: () => void;
  /** A row's status glyph. Unread replies are shown without it. */
  statusOf?: (dialog: DialogItem) => MingoDialogStatus | undefined;
  onRequestRename?: (dialog: DialogItem) => void;
  onRequestArchive?: (dialog: DialogItem) => void;
  onRequestCopyLink?: (dialog: DialogItem) => void;
  onRequestCompact?: (dialog: DialogItem) => void;
  /** "Show My Chats" / "Show All Chats" in the list's ⋯ menu; both or neither. */
  scope?: MingoHistoryScope;
  onScopeChange?: (scope: MingoHistoryScope) => void;
  /** Server-side search. With a handler the ⋯ menu offers "Search for Chat". */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** The first page is still loading. */
  isLoadingHistory?: boolean;
  /** The list failed to load with nothing cached. */
  loadError?: boolean;
  onRetry?: () => void;
  className?: string;
}

const STATUS_GLYPHS: Record<MingoDialogStatus, { icon: ReactNode; label: string }> = {
  working: { icon: <DotsLoaderIcon className="text-ods-text-secondary" />, label: 'Mingo is working' },
  unread: { icon: <MessageIndicatorIcon className="text-ods-accent" />, label: 'New reply' },
  approval: { icon: <ShieldCheckIcon className="text-ods-accent" />, label: 'Waiting for approval' },
};

function statusFor(dialog: DialogItem, statusOf: MingoChatRailProps['statusOf']): MingoDialogStatus | undefined {
  return statusOf?.(dialog) ?? ((dialog.unreadMessagesCount ?? 0) > 0 ? 'unread' : undefined);
}

/**
 * The Mingo chat list of the v2 layout (Figma `chat-sidebar`, type
 * mingo-my-chats): the Mingo mark, the three actions, a "Your Current Chats"
 * list with a ⋯ menu that scopes or searches it, and one row per chat with its
 * status at the end. Row actions (rename, archive, ...) sit behind a ⋯ that
 * replaces the status on hover.
 */
export function MingoChatRail({
  dialogs,
  activeDialogId,
  onSelectDialog,
  draftTitle,
  onNewChat,
  onOpenArchive,
  archiveActive = false,
  onWhatToAsk,
  statusOf,
  onRequestRename,
  onRequestArchive,
  onRequestCopyLink,
  onRequestCompact,
  scope,
  onScopeChange,
  searchQuery,
  onSearchChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isLoadingHistory = false,
  loadError = false,
  onRetry,
  className,
}: MingoChatRailProps) {
  const [searchOpen, setSearchOpen] = useState(!!searchQuery?.trim());
  const hasSearch = !!searchQuery?.trim();

  const items: ChatNavSidebarItem[] = [];
  if (onNewChat) items.push({ id: 'new', label: 'Start New Chat', icon: <ChatPlusIcon />, onClick: onNewChat });
  if (onOpenArchive) {
    items.push({
      id: 'archive',
      label: 'Chat Archive',
      icon: <ClockHistoryIcon />,
      active: archiveActive,
      onClick: onOpenArchive,
    });
  }
  if (onWhatToAsk)
    items.push({ id: 'ask', label: 'What to ask Mingo?', icon: <ChatQuestionIcon />, onClick: onWhatToAsk });

  const listMenu: ActionsMenuItem[] = [];
  if (scope && onScopeChange) {
    listMenu.push(
      {
        id: 'my',
        label: 'Show My Chats',
        icon: <UserIcon className="h-full w-full text-ods-text-secondary" />,
        type: 'checkbox',
        checked: scope === 'my',
        onClick: () => onScopeChange('my'),
      },
      {
        id: 'all',
        label: 'Show All Chats',
        icon: <UsersIcon className="h-full w-full text-ods-text-secondary" />,
        type: 'checkbox',
        checked: scope === 'all',
        onClick: () => onScopeChange('all'),
      },
    );
  }
  if (onSearchChange) {
    if (listMenu.length > 0) listMenu.push({ id: 'divider', label: '', type: 'separator' });
    listMenu.push({
      id: 'search',
      label: 'Search for Chat',
      icon: <SearchIcon className="h-full w-full text-ods-text-secondary" />,
      onClick: () => setSearchOpen(true),
    });
  }

  // Infinite scroll: the next page when the sentinel at the list's end shows.
  // The observer clips against the scrolling list, so the viewport root works.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
    isLoadingMoreRef.current = isLoadingMore;
  });
  const dialogCount = dialogs.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isLoadingMoreRef.current) onLoadMoreRef.current?.();
      },
      { rootMargin: '120px', threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // Re-armed per page: a sentinel still in view after a short page keeps loading.
  }, [hasMore, dialogCount, isLoadingMore]);

  let list: ReactNode;
  if (loadError) {
    list = (
      <div className="flex flex-col items-center gap-[var(--spacing-system-m)] px-[var(--spacing-system-xs)] py-[var(--spacing-system-l)] text-center">
        <AlertCircleIcon className="size-8 shrink-0 text-ods-text-secondary" />
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h4">Couldn’t load your chats</p>
          <p className="text-ods-text-secondary text-h6">Something went wrong reaching the server. Try again.</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="small" leftIcon={<Refresh01RightIcon />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  } else if (isLoadingHistory) {
    list = Array.from({ length: 6 }, (_, i) => (
      <div key={i} className="h-10 shrink-0 animate-pulse rounded-md bg-ods-skeleton" aria-hidden />
    ));
  } else if (dialogs.length === 0 && !draftTitle) {
    list = hasSearch ? (
      <p className="px-[var(--spacing-system-xs)] py-[var(--spacing-system-s)] text-ods-text-secondary text-h6">
        No chats found
      </p>
    ) : (
      <ChatListEmptyState
        icon={<ChatsIcon size={24} />}
        title="No Current Chats"
        description="Previous Mingo sessions will show here"
      />
    );
  } else {
    list = (
      <>
        {draftTitle && <ChatListItem active title={draftTitle} tabIndex={-1} className="cursor-default" />}
        {dialogs.map(dialog => (
          <MingoChatRailRow
            key={dialog.id}
            dialog={dialog}
            active={dialog.id === activeDialogId}
            status={statusFor(dialog, statusOf)}
            onSelect={onSelectDialog}
            menuItems={chatDialogMenuItems({
              onCopyLink: onRequestCopyLink && (() => onRequestCopyLink(dialog)),
              onRename: onRequestRename && (() => onRequestRename(dialog)),
              onCompact: onRequestCompact && (() => onRequestCompact(dialog)),
              onArchive: onRequestArchive && (() => onRequestArchive(dialog)),
            })}
          />
        ))}
        {hasMore && <div ref={sentinelRef} className="h-px shrink-0" aria-hidden />}
      </>
    );
  }

  return (
    <ChatNavSidebar
      className={className}
      // Mingo's cyan for the selection and the status glyphs, whatever the
      // tenant accent the rest of the panel carries.
      data-accent="mingo"
      aria-label="Mingo chats"
      logo={
        <MingoIcon
          color="currentColor"
          eyesColor="var(--ods-flamingo-cyan-base)"
          cornerColor="var(--ods-flamingo-cyan-base)"
          className="size-6 text-ods-text-primary"
          aria-hidden
        />
      }
      items={items}
      sectionLabel="Your Current Chats"
      sectionActions={
        listMenu.length > 0 ? (
          <ActionsMenuDropdown
            triggerAriaLabel="Chat list options"
            groups={[{ items: listMenu }]}
            onCloseAutoFocus={e => e.preventDefault()}
            customTrigger={
              <Button
                variant="transparent"
                size="icon"
                aria-label="Chat list options"
                className="size-6 p-0 text-ods-text-secondary hover:text-ods-text-primary md:size-6"
              >
                <Ellipsis01Icon size={24} />
              </Button>
            }
          />
        ) : undefined
      }
      listHeader={
        searchOpen && onSearchChange ? (
          <ChatHeaderSearchField
            initialValue={searchQuery}
            onSearchChange={onSearchChange}
            onCollapse={() => setSearchOpen(false)}
            className="h-10 rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-xs)]"
          />
        ) : undefined
      }
    >
      {list}
    </ChatNavSidebar>
  );
}

interface MingoChatRailRowProps {
  dialog: DialogItem;
  active: boolean;
  status?: MingoDialogStatus;
  onSelect?: (id: string) => void;
  menuItems: ActionsMenuItem[];
}

function MingoChatRailRow({ dialog, active, status, onSelect, menuItems }: MingoChatRailRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = menuItems.length > 0;
  const glyph = status ? STATUS_GLYPHS[status] : undefined;
  const title = dialog.title || 'Untitled Chat';

  return (
    <div className="group/row relative shrink-0">
      <ChatListItem
        active={active}
        title={title}
        onClick={() => onSelect?.(dialog.id)}
        className={cn(hasMenu && 'pr-10')}
        trailing={
          glyph ? (
            <span
              role="img"
              aria-label={glyph.label}
              className={cn('flex transition-opacity', hasMenu && 'group-hover/row:opacity-0', menuOpen && 'opacity-0')}
            >
              {glyph.icon}
            </span>
          ) : undefined
        }
      />
      {hasMenu && (
        // Revealed on hover or its own focus, and kept while its menu is open.
        <span
          className={cn(
            'absolute inset-y-0 right-[var(--spacing-system-xs)] flex items-center transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover/row:opacity-100',
          )}
        >
          <ActionsMenuDropdown
            triggerAriaLabel={`Actions for ${title}`}
            groups={[{ items: menuItems }]}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onCloseAutoFocus={e => e.preventDefault()}
            customTrigger={
              <Button
                variant="transparent"
                size="icon"
                aria-label={`Actions for ${title}`}
                className="size-6 p-0 text-ods-text-secondary hover:text-ods-text-primary md:size-6"
              >
                <Ellipsis01Icon size={24} />
              </Button>
            }
          />
        </span>
      )}
    </div>
  );
}
