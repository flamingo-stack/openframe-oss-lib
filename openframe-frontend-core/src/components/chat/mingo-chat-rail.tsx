'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import { AgentMark } from '../agent-mark';
import {
  Arrow02LeftIcon,
  ChatPlusIcon,
  ChatQuestionIcon,
  ChatsIcon,
  ClockHistoryIcon,
  Ellipsis01Icon,
  SearchIcon,
  UserIcon,
  UsersIcon,
} from '../icons-v2-generated';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { chatDialogMenuItems } from './chat-dialog-menu-items';
import { ChatHeaderSearchField } from './chat-header-search-field';
import { ChatListEmptyState } from './chat-list-empty-state';
import { ChatListItem, ChatNavSidebar, type ChatNavSidebarItem } from './chat-nav-sidebar';
import { MingoChatHistorySection } from './mingo-chat-history-section';
import {
  ChatListLoadError,
  MINGO_DIALOG_STATUS_GLYPHS,
  type MingoChatListProps,
  type MingoDialogStatus,
  mingoDialogStatusOf,
  useLoadMoreSentinel,
} from './mingo-chat-list-shared';
import type { DialogItem } from './types/component.types';

export interface MingoChatRailProps extends MingoChatListProps {
  /**
   * `'rail'` (default): the v2 chat panel's own column — the Mingo mark, the
   * actions below (start a chat, the archive, "What to ask Mingo?") and the
   * list, at a fixed 296 px.
   * `'section'`: the chat history block of a host's main navigation sidebar
   * (`MingoChatHistorySection`) — caption, Search, ⋯ (Chat archive, What to ask Mingo?), the scope,
   * the chats grouped by day. No outer chrome or width of its own; it fills the
   * height it is given and scrolls inside. The rail-only props below are
   * ignored there.
   */
  variant?: 'rail' | 'section';
  /** Rail only. */
  onNewChat?: () => void;
  /** Rail only: the archive is the view on screen. */
  archiveActive?: boolean;
  /** Rail only — the |← control beside the logo: widen the panel to the list and the chat. */
  onExpand?: () => void;
}

/**
 * The Mingo chat list. The default rail is the v2 panel's column; the section
 * is the same list placed in the main sidebar (see `variant`).
 */
export function MingoChatRail({ variant = 'rail', ...props }: MingoChatRailProps) {
  return variant === 'section' ? <MingoChatHistorySection {...props} /> : <MingoChatRailPanel {...props} />;
}

/**
 * The Mingo chat list of the v2 layout (Figma `chat-sidebar`, type
 * mingo-my-chats): the Mingo mark, the three actions, a "Your Current Chats"
 * list with a ⋯ menu that scopes or searches it, and one row per chat with its
 * status at the end. Row actions (rename, archive, ...) sit behind a ⋯ that
 * replaces the status on hover.
 */
function MingoChatRailPanel({
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
  searchOpen: searchOpenProp,
  onSearchOpenChange,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isLoadingHistory = false,
  loadError = false,
  onRetry,
  onExpand,
  className,
}: Omit<MingoChatRailProps, 'variant'>) {
  const [searchOpen, setSearchOpen] = useControllableState({
    prop: searchOpenProp,
    defaultProp: !!searchQuery?.trim(),
    onChange: onSearchOpenChange,
  });
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
  const sentinelRef = useLoadMoreSentinel({ hasMore, isLoadingMore, onLoadMore, itemCount: dialogs.length });

  let list: ReactNode;
  if (loadError) {
    list = (
      <ChatListLoadError onRetry={onRetry} className="px-[var(--spacing-system-xs)] py-[var(--spacing-system-l)]" />
    );
  } else if (isLoadingHistory) {
    list = Array.from({ length: 6 }, (_, i) => (
      <UnifiedSkeleton key={i} aria-hidden className="h-10 shrink-0 rounded-md" />
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
            status={mingoDialogStatusOf(dialog, statusOf)}
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
        <div className="flex flex-1 items-center justify-between">
          <AgentMark agent="mingo" className="size-6 text-ods-text-primary" />
          {onExpand && (
            <Button
              variant="transparent"
              size="icon"
              aria-label="Expand chat"
              onClick={onExpand}
              className="size-6 p-0 text-ods-text-secondary hover:text-ods-text-primary md:size-6"
            >
              <Arrow02LeftIcon size={24} />
            </Button>
          )}
        </div>
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
  const glyph = status ? MINGO_DIALOG_STATUS_GLYPHS[status] : undefined;
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
