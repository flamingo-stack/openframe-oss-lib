'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { type ReactNode, useId, useRef, useState } from 'react';
import { useVisitorOs } from '../../hooks/ui/use-visitor-os';
import { cn } from '../../utils/cn';
import { shortcutLabel, usesCommandKey } from '../../utils/visitor-os';
import { ChatsIcon, Ellipsis01Icon, MessagesIcon, SearchIcon, SearchXmarkIcon } from '../icons-v2-generated';
import { LoadingRegion } from '../loading/loading-region';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade';
import { SquareAvatar } from '../ui/square-avatar';
import { TabSelector } from '../ui/tab-selector';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { chatDialogMenuItems, chatMenuIconClassName } from './chat-dialog-menu-items';
import { ChatHeaderSearchField } from './chat-header-search-field';
import { ChatListEmptyState } from './chat-list-empty-state';
import { groupDialogsByDay } from './mingo-chat-day-groups';
import {
  ChatListLoadError,
  dialogOwnedByOther,
  MINGO_DIALOG_STATUS_GLYPHS,
  type MingoChatListProps,
  type MingoDialogStatus,
  type MingoHistoryScope,
  mingoDialogStatusOf,
  useLoadMoreSentinel,
} from './mingo-chat-list-shared';
import type { DialogItem } from './types/component.types';

/** A row of the section before the backend has named the chat. */
const UNTITLED = 'New Chat';

const ICON_BUTTON_CLASS = 'size-6 p-0 text-ods-text-secondary hover:text-ods-text-primary md:size-6';

/**
 * The chat history block of a host's main navigation sidebar (`MingoChatRail`
 * `variant="section"`): a "Chat history" caption with Search and a ⋯ menu
 * (Chat archive), the search field once opened, the My Chats / All Chats
 * scope, and the chats grouped by day. It fills the height it is given and
 * scrolls on its own; the sidebar around it owns the width, the background and
 * the borders.
 */
export function MingoChatHistorySection({
  dialogs,
  activeDialogId,
  onSelectDialog,
  draftTitle,
  onOpenArchive,
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
  ownedByOther,
  currentUserId,
  className,
}: MingoChatListProps) {
  const captionId = useId();
  const visitor = useVisitorOs();
  const [searchOpen, setSearchOpen] = useControllableState({
    prop: searchOpenProp,
    defaultProp: !!searchQuery?.trim(),
    onChange: onSearchOpenChange,
  });
  const searchFieldRef = useRef<HTMLDivElement>(null);
  const hasSearch = !!searchQuery?.trim();
  const showSearch = searchOpen && !!onSearchChange;

  const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>();
  const sentinelRef = useLoadMoreSentinel({
    hasMore,
    isLoadingMore,
    onLoadMore,
    itemCount: dialogs.length,
    rootRef: scrollRef,
  });

  const shortcut = visitor.known ? shortcutLabel(visitor.os, 'K') : null;
  const openSearch = () => {
    // Already open (a term is kept): the icon takes the reader back into it.
    if (showSearch) searchFieldRef.current?.querySelector('input')?.focus();
    else setSearchOpen(true);
  };

  let list: ReactNode;
  if (loadError) {
    list = (
      <ChatListLoadError onRetry={onRetry} className="min-h-0 flex-1 justify-center p-[var(--spacing-system-l)]" />
    );
  } else if (isLoadingHistory) {
    list = (
      <LoadingRegion label="Loading chats" className="flex flex-col gap-[var(--spacing-system-xxs)]">
        {Array.from({ length: 6 }, (_, i) => (
          <UnifiedSkeleton key={i} className="h-[34px] shrink-0 rounded-md" />
        ))}
      </LoadingRegion>
    );
  } else if (dialogs.length === 0 && !draftTitle) {
    list = hasSearch ? (
      <ChatListEmptyState
        icon={<SearchXmarkIcon size={24} />}
        title="No chats found"
        description="Try another search term"
      />
    ) : (
      <ChatListEmptyState
        icon={<ChatsIcon size={24} />}
        title="No Current Chats"
        description="Previous Mingo sessions will show here"
      />
    );
  } else {
    const groups = groupDialogsByDay(dialogs);
    // The chat being started is today's, on top.
    const draftInToday = !!draftTitle && groups[0]?.key === 'today';
    list = (
      <>
        {draftTitle && !draftInToday && (
          <DayGroup label="Today">
            <SectionRow title={draftTitle} active />
          </DayGroup>
        )}
        {groups.map((group, index) => (
          <DayGroup key={group.key} label={group.label}>
            {index === 0 && draftInToday && <SectionRow title={draftTitle} active />}
            {group.items.map(dialog => (
              <SectionRow
                key={dialog.id}
                dialog={dialog}
                title={dialog.title || UNTITLED}
                active={dialog.id === activeDialogId}
                status={mingoDialogStatusOf(dialog, statusOf)}
                ownerName={
                  dialogOwnedByOther(dialog, ownedByOther, currentUserId) ? dialog.owner?.name || undefined : undefined
                }
                ownerAvatarUrl={dialog.owner?.avatarUrl || undefined}
                onSelect={onSelectDialog}
                menuItems={chatDialogMenuItems({
                  onCopyLink: onRequestCopyLink && (() => onRequestCopyLink(dialog)),
                  onRename: onRequestRename && (() => onRequestRename(dialog)),
                  onCompact: onRequestCompact && (() => onRequestCompact(dialog)),
                  onArchive: onRequestArchive && (() => onRequestArchive(dialog)),
                })}
              />
            ))}
          </DayGroup>
        ))}
        {isLoadingMore && <UnifiedSkeleton className="h-[34px] shrink-0 rounded-md" />}
        {hasMore && <div ref={sentinelRef} className="h-px shrink-0" aria-hidden />}
      </>
    );
  }

  const moreMenu: ActionsMenuItem[] = onOpenArchive
    ? [
        {
          id: 'archive',
          label: 'Chat archive',
          icon: <MessagesIcon className={chatMenuIconClassName} />,
          onClick: onOpenArchive,
        },
      ]
    : [];

  return (
    <TooltipProvider delayDuration={300}>
      <section
        // Mingo's cyan for the selection, the scope and the status glyphs,
        // as in the v2 rail, whatever the tenant accent around it.
        data-accent="mingo"
        aria-labelledby={captionId}
        className={cn('flex min-h-0 w-full min-w-0 flex-1 flex-col gap-[var(--spacing-system-xs)]', className)}
      >
        <div className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)] px-[var(--spacing-system-xs)]">
          <h2 id={captionId} className="min-w-0 flex-1 truncate text-ods-text-secondary text-h5">
            Chat history
          </h2>
          {onSearchChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="transparent"
                  size="icon"
                  aria-label="Search chats"
                  aria-keyshortcuts={shortcut ? (usesCommandKey(visitor.os) ? 'Meta+K' : 'Control+K') : undefined}
                  onClick={openSearch}
                  className={ICON_BUTTON_CLASS}
                >
                  <SearchIcon size={20} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{shortcut ? `Search chats · ${shortcut}` : 'Search chats'}</TooltipContent>
            </Tooltip>
          )}
          {moreMenu.length > 0 && (
            <Tooltip>
              <ActionsMenuDropdown
                triggerAriaLabel="More"
                groups={[{ items: moreMenu }]}
                onCloseAutoFocus={e => e.preventDefault()}
                customTrigger={
                  <TooltipTrigger asChild>
                    <Button variant="transparent" size="icon" aria-label="More" className={ICON_BUTTON_CLASS}>
                      <Ellipsis01Icon size={20} />
                    </Button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent side="bottom">More</TooltipContent>
            </Tooltip>
          )}
        </div>

        {showSearch && (
          <div ref={searchFieldRef} className="shrink-0">
            <ChatHeaderSearchField
              initialValue={searchQuery}
              onSearchChange={onSearchChange}
              onCollapse={() => setSearchOpen(false)}
              className="h-8 rounded-md border border-ods-border bg-ods-bg px-[var(--spacing-system-xs)]"
            />
          </div>
        )}

        {/* Stays in the empty state too — an empty "My Chats" must still offer
            "All Chats" — but not over a failed load, where Try again is the
            only thing to do. */}
        {scope && onScopeChange && !loadError && (
          <TabSelector
            className="shrink-0"
            size="small"
            value={scope}
            onValueChange={value => onScopeChange(value as MingoHistoryScope)}
            items={[
              { id: 'my', label: 'My Chats' },
              { id: 'all', label: 'All Chats' },
            ]}
          />
        )}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            onScroll={updateFade}
            className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xs)] overflow-y-auto overscroll-contain"
          >
            {list}
          </div>
          <ScrollFadeOverlay edge="top" visible={fadeTop} color="var(--color-bg-card)" className="h-8" />
          <ScrollFadeOverlay edge="bottom" visible={fadeBottom} color="var(--color-bg-card)" className="h-8" />
        </div>
      </section>
    </TooltipProvider>
  );
}

function DayGroup({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex shrink-0 flex-col">
      <p
        id={labelId}
        className="px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)] text-ods-text-secondary text-h6"
      >
        {label}
      </p>
      {children}
    </div>
  );
}

interface SectionRowProps {
  /** Absent for the draft row (a chat not saved yet): no actions, no select. */
  dialog?: DialogItem;
  title: string;
  active: boolean;
  status?: MingoDialogStatus;
  /** Set only when the chat is someone else's. */
  ownerName?: string;
  ownerAvatarUrl?: string;
  onSelect?: (id: string) => void;
  menuItems?: ActionsMenuItem[];
}

/**
 * One chat, 34 px: the title, then what the row has to say at its end — the
 * status glyph and, for someone else's chat, the owner's initials. The ⋯ menu
 * takes that place on hover or keyboard focus, so the title never reflows.
 */
function SectionRow({
  dialog,
  title,
  active,
  status,
  ownerName,
  ownerAvatarUrl,
  onSelect,
  menuItems = [],
}: SectionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = menuItems.length > 0;
  const glyph = status ? MINGO_DIALOG_STATUS_GLYPHS[status] : undefined;

  return (
    <div className="group/row relative shrink-0">
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        tabIndex={dialog ? undefined : -1}
        onClick={dialog ? () => onSelect?.(dialog.id) : undefined}
        className={cn(
          'flex h-[34px] w-full items-center gap-[var(--spacing-system-xs)] rounded-md px-[var(--spacing-system-xs)] text-left transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus',
          active ? 'bg-ods-accent-secondary' : 'hover:bg-ods-bg-hover',
          !dialog && 'cursor-default',
        )}
      >
        <span
          title={title}
          className={cn('min-w-0 flex-1 truncate text-h6', active ? 'text-ods-accent' : 'text-ods-text-primary')}
        >
          {title}
        </span>
        {(glyph || ownerName || hasMenu) && (
          <span
            className={cn(
              'flex shrink-0 items-center justify-end gap-[var(--spacing-system-xxs)] [&_svg]:size-4',
              hasMenu &&
                'min-w-6 transition-opacity group-hover/row:opacity-0 group-has-[:focus-visible]/row:opacity-0',
              menuOpen && 'opacity-0',
            )}
          >
            {glyph && (
              <span role="img" aria-label={glyph.label} className="flex">
                {glyph.icon}
              </span>
            )}
            {ownerName && (
              <SquareAvatar
                role="img"
                aria-label={`Owner: ${ownerName}`}
                title={ownerName}
                variant="round"
                sizePx={20}
                src={ownerAvatarUrl}
                alt={ownerName}
                fallback={ownerName}
                initialsClassName="text-ods-text-secondary text-badge"
              />
            )}
          </span>
        )}
      </button>
      {hasMenu && (
        // Revealed on hover or keyboard focus in the row (not a click's focus, which
        // would keep it over the status), and kept while its menu is open.
        <span
          className={cn(
            'absolute inset-y-0 right-[var(--spacing-system-xs)] flex items-center transition-opacity',
            menuOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover/row:opacity-100 group-has-[:focus-visible]/row:opacity-100',
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
                <Ellipsis01Icon size={20} />
              </Button>
            }
          />
        </span>
      )}
    </div>
  );
}
