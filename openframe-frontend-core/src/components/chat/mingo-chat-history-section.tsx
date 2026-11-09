'use client';

import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDebounce } from '../../hooks/ui/use-debounce';
import { useVisitorOs } from '../../hooks/ui/use-visitor-os';
import { cn } from '../../utils/cn';
import { shortcutLabel, usesCommandKey } from '../../utils/visitor-os';
import {
  ChatBlankIcon,
  ChatsIcon,
  Ellipsis01Icon,
  Filter01Icon,
  MessagesIcon,
  QuestionCircleIcon,
  SearchIcon,
  SearchXmarkIcon,
} from '../icons-v2-generated';
import { LoadingRegion } from '../loading/loading-region';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { ActionsMenuDropdown, type ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { ModalV2, ModalV2Header, ModalV2Title } from '../ui/modal-v2';
import { SearchInput } from '../ui/search-input';
import { SquareAvatar } from '../ui/square-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { chatDialogMenuItems, chatMenuIconClassName } from './chat-dialog-menu-items';
import { ChatListEmptyState } from './chat-list-empty-state';
import { ChatListItem } from './chat-nav-sidebar';
import { groupDialogsByDay } from './mingo-chat-day-groups';
import {
  ChatListLoadError,
  dialogOwnedByOther,
  MINGO_DIALOG_STATUS_GLYPHS,
  type MingoChatListProps,
  type MingoDialogStatus,
  mingoDialogStatusOf,
  useLoadMoreSentinel,
} from './mingo-chat-list-shared';
import type { DialogItem } from './types/component.types';

/** A row of the section before the backend has named the chat. */
const UNTITLED = 'New Chat';

/** The caption's icon buttons: plain glyphs that turn white on hover, no hover wash. */
const ICON_BUTTON_CLASS =
  'size-6 p-0 text-ods-text-secondary transition-colors hover:bg-transparent hover:text-ods-text-primary active:bg-transparent md:size-6';

/** Title widths for the placeholder rows: a list of titles, not a column of bars. */
const SKELETON_TITLE_WIDTHS = ['w-4/5', 'w-3/5', 'w-11/12', 'w-2/3', 'w-3/4', 'w-1/2'];

/** Placeholder chat rows in the `ChatListItem` geometry: 40px, an 18px title. */
function SkeletonRows({ count, offset = 0 }: { count: number; offset?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex h-10 shrink-0 items-center px-[var(--spacing-system-xs)]" aria-hidden>
          <UnifiedSkeleton
            className={cn('h-4 rounded', SKELETON_TITLE_WIDTHS[(i + offset) % SKELETON_TITLE_WIDTHS.length])}
          />
        </div>
      ))}
    </>
  );
}

/** The first load: two days of chats, each with its label. */
function HistorySkeleton() {
  return (
    <LoadingRegion label="Loading chats" className="flex flex-col gap-[var(--spacing-system-xs)]">
      {[5, 4].map((rows, group) => (
        <div key={rows} className="flex flex-col">
          <div className="flex h-7 items-center px-[var(--spacing-system-xs)]" aria-hidden>
            <UnifiedSkeleton className="h-3.5 w-16 rounded" />
          </div>
          <SkeletonRows count={rows} offset={group * 2} />
        </div>
      ))}
    </LoadingRegion>
  );
}

interface HistoryListProps extends Pick<
  MingoChatListProps,
  | 'dialogs'
  | 'activeDialogId'
  | 'draftTitle'
  | 'statusOf'
  | 'ownedByOther'
  | 'currentUserId'
  | 'hasMore'
  | 'isLoadingMore'
  | 'onLoadMore'
  | 'isLoadingHistory'
  | 'loadError'
  | 'onRetry'
> {
  onSelect?: (id: string) => void;
  /** How the next page loads (`MingoChatListProps.loadMore`). Default `'scroll'`. */
  loadMore?: 'scroll' | 'button';
  /** Each row's ⋯ (Rename, Copy link, Compact, Archive); none in the search results. */
  menuFor?: (dialog: DialogItem) => ActionsMenuItem[];
  hasSearch: boolean;
  density?: 'default' | 'compact';
}

/** The chats grouped by day, or what stands in for them: loading, empty, failed. */
function HistoryList({
  dialogs,
  activeDialogId,
  draftTitle,
  statusOf,
  ownedByOther,
  currentUserId,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  isLoadingHistory = false,
  loadError = false,
  onRetry,
  onSelect,
  loadMore = 'scroll',
  menuFor,
  hasSearch,
  density = 'default',
}: HistoryListProps) {
  // The viewport root: whatever scrolls the list (the sidebar body, the search
  // modal) clips the sentinel, and the viewport sees nothing in a closed drawer
  // or a collapsed rail.
  const onScroll = loadMore === 'scroll';
  const sentinelRef = useLoadMoreSentinel({
    hasMore: hasMore && onScroll,
    isLoadingMore,
    onLoadMore,
    itemCount: dialogs.length,
  });
  // The page's loading state draws the list's own, as the first page loading does.
  const loading = useLoadingScope() || isLoadingHistory;

  if (loadError) {
    return <ChatListLoadError onRetry={onRetry} className="justify-center p-[var(--spacing-system-l)]" />;
  }
  if (loading) return <HistorySkeleton />;
  if (dialogs.length === 0 && !draftTitle) {
    return hasSearch ? (
      <ChatListEmptyState
        icon={<SearchXmarkIcon size={24} />}
        title="No chats found"
        description="Try another search term"
      />
    ) : density === 'compact' ? (
      // The three-column shell (Figma 1409:305752): centred in the room the list leaves.
      <ChatListEmptyState
        density="compact"
        icon={<ChatBlankIcon size={20} />}
        title="No current chats"
        description="Previous Mingo sessions will show here"
      />
    ) : (
      <ChatListEmptyState
        icon={<ChatsIcon size={24} />}
        title="No Current Chats"
        description="Previous Mingo sessions will show here"
      />
    );
  }

  const groups = groupDialogsByDay(dialogs);
  // The chat being started is today's, on top.
  const draftInToday = !!draftTitle && groups[0]?.key === 'today';
  const compact = density === 'compact';
  return (
    <div className={cn('flex flex-col', compact ? 'gap-[var(--spacing-system-mf)]' : 'gap-[var(--spacing-system-xs)]')}>
      {draftTitle && !draftInToday && (
        <DayGroup label="Today" density={density}>
          <SectionRow title={draftTitle} active density={density} />
        </DayGroup>
      )}
      {groups.map((group, index) => (
        <DayGroup
          key={group.key}
          label={group.label}
          density={density}
          // Compact: today's chats sit right under the "Current chats" caption, which names them.
          labelHidden={compact && group.key === 'today'}
        >
          {index === 0 && draftInToday && <SectionRow title={draftTitle} active density={density} />}
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
              onSelect={onSelect}
              menuItems={menuFor?.(dialog)}
              density={density}
            />
          ))}
        </DayGroup>
      ))}
      {isLoadingMore && (
        <LoadingRegion label="Loading more chats" className="flex flex-col">
          <SkeletonRows count={3} />
        </LoadingRegion>
      )}
      {hasMore && onScroll && <div ref={sentinelRef} className="h-px shrink-0" aria-hidden />}
      {hasMore && !onScroll && !isLoadingMore && onLoadMore && (
        <Button
          variant="link"
          size="compact"
          type="button"
          data-tone="neutral"
          onClick={onLoadMore}
          className="self-start px-[var(--spacing-system-xs)]"
        >
          Show more
        </Button>
      )}
    </div>
  );
}

/**
 * The chat history block of a host's main navigation sidebar (`MingoChatRail`
 * `variant="section"`): a "Chat history" caption with three icon buttons —
 * Search (a modal over the page, ⌘K), the My chats / All chats filter (lit while
 * all chats show) and ⋯ (Chat archive, the host's own items) — then the chats grouped by day. It is
 * drawn at its full height and does not scroll: the sidebar body scrolls it with
 * the tree above it. The sidebar owns the width, the background and the borders;
 * the colours are the tenant's accent, as everywhere in the sidebar.
 */
export function MingoChatHistorySection({
  dialogs,
  activeDialogId,
  onSelectDialog,
  draftTitle,
  onOpenArchive,
  onWhatToAsk,
  moreMenuItems = [],
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
  loadMore = 'scroll',
  isLoadingHistory = false,
  loadError = false,
  onRetry,
  ownedByOther,
  currentUserId,
  className,
  density = 'default',
}: MingoChatListProps) {
  const captionId = useId();
  const visitor = useVisitorOs();
  const [searchOpen, setSearchOpen] = useControllableState({
    prop: searchOpenProp,
    defaultProp: false,
    onChange: onSearchOpenChange,
  });
  const hasSearch = !!searchQuery?.trim();
  const showSearch = searchOpen && !!onSearchChange;
  const shortcut = visitor.known ? shortcutLabel(visitor.os, 'K') : null;

  const listProps = {
    dialogs,
    activeDialogId,
    statusOf,
    ownedByOther,
    currentUserId,
    hasMore,
    isLoadingMore,
    onLoadMore,
    isLoadingHistory,
    loadError,
    onRetry,
  };

  const moreMenu: ActionsMenuItem[] = [
    ...(onOpenArchive
      ? [
          {
            id: 'archive',
            label: 'Chat archive',
            icon: <MessagesIcon className={chatMenuIconClassName} />,
            onClick: onOpenArchive,
          },
        ]
      : []),
    ...(onWhatToAsk
      ? [
          {
            id: 'what-to-ask',
            label: 'What to ask Mingo?',
            icon: <QuestionCircleIcon className={chatMenuIconClassName} />,
            onClick: onWhatToAsk,
          },
        ]
      : []),
    ...moreMenuItems,
  ];

  // The scope as a filter, not a control of its own: a choice of two (radio
  // items, the menu closes on a pick), the trigger lit while it is the wider
  // one. Not over a failed load, where Try again is the only thing to do.
  const scopeMenu: ActionsMenuItem[] =
    scope && onScopeChange && !loadError
      ? [
          {
            id: 'my',
            label: 'My chats',
            type: 'radio',
            checked: scope === 'my',
            onClick: () => onScopeChange('my'),
          },
          {
            id: 'all',
            label: 'All chats',
            type: 'radio',
            checked: scope === 'all',
            onClick: () => onScopeChange('all'),
          },
        ]
      : [];

  // Compact (the three-column shell, Figma `nav/section-header`): the caption is
  // "Current chats" over today's chats, its actions 16px search and ⋯, the scope
  // folded into the ⋯ as its first group.
  const compact = density === 'compact';
  const iconSize = compact ? 16 : 20;
  // The icon button kind sizes its glyph itself (24px from md): the compact
  // caption's 16px glyphs (Figma `nav/section-header`) take it back.
  const iconButtonClass = cn(ICON_BUTTON_CLASS, compact && 'size-4 md:size-4 [&_svg]:size-4 md:[&_svg]:size-4');
  const moreGroups: Array<{ items: ActionsMenuItem[] }> = [];
  if (compact && scopeMenu.length > 0) moreGroups.push({ items: scopeMenu });
  if (moreMenu.length > 0) moreGroups.push({ items: moreMenu });

  return (
    <TooltipProvider delayDuration={300}>
      <section
        aria-labelledby={captionId}
        className={cn(
          'flex w-full min-w-0 flex-col',
          // Compact: the section takes the sidebar's spare height, so an empty list centres in it.
          compact ? 'flex-1 gap-[var(--spacing-system-xxs)]' : 'gap-[var(--spacing-system-xs)]',
          className,
        )}
      >
        <div
          className={cn(
            'flex shrink-0 items-center',
            compact
              ? 'gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-xsf)]'
              : 'gap-[var(--spacing-system-xs)] px-[var(--spacing-system-xs)]',
          )}
        >
          <h2
            id={captionId}
            className={cn(
              'min-w-0 flex-1 truncate text-h5',
              compact ? 'text-ods-text-panel-secondary' : 'text-ods-text-secondary',
            )}
          >
            {compact ? 'Current chats' : 'Chat history'}
          </h2>
          {onSearchChange && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="transparent"
                  size="icon"
                  aria-label="Search chats"
                  aria-keyshortcuts={shortcut ? (usesCommandKey(visitor.os) ? 'Meta+K' : 'Control+K') : undefined}
                  onClick={() => setSearchOpen(true)}
                  className={iconButtonClass}
                >
                  <SearchIcon size={iconSize} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{shortcut ? `Search chats · ${shortcut}` : 'Search chats'}</TooltipContent>
            </Tooltip>
          )}
          {!compact && scopeMenu.length > 0 && (
            <Tooltip>
              <ActionsMenuDropdown
                triggerAriaLabel="Filter chats"
                groups={[{ items: scopeMenu }]}
                onCloseAutoFocus={e => e.preventDefault()}
                customTrigger={
                  <TooltipTrigger asChild>
                    <Button
                      variant="transparent"
                      size="icon"
                      aria-label="Filter chats"
                      className={cn(ICON_BUTTON_CLASS, scope === 'all' && 'text-ods-accent')}
                    >
                      <Filter01Icon size={20} />
                    </Button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent side="bottom">
                {scope === 'all' ? 'Showing all chats' : 'Showing my chats'}
              </TooltipContent>
            </Tooltip>
          )}
          {moreGroups.length > 0 && (
            <Tooltip>
              <ActionsMenuDropdown
                triggerAriaLabel="More"
                groups={moreGroups}
                onCloseAutoFocus={e => e.preventDefault()}
                customTrigger={
                  <TooltipTrigger asChild>
                    <Button variant="transparent" size="icon" aria-label="More" className={iconButtonClass}>
                      <Ellipsis01Icon size={iconSize} />
                    </Button>
                  </TooltipTrigger>
                }
              />
              <TooltipContent side="bottom">More</TooltipContent>
            </Tooltip>
          )}
        </div>

        <HistoryList
          {...listProps}
          hasSearch={hasSearch}
          draftTitle={draftTitle}
          onSelect={onSelectDialog}
          loadMore={loadMore}
          density={density}
          menuFor={dialog =>
            chatDialogMenuItems({
              onCopyLink: onRequestCopyLink && (() => onRequestCopyLink(dialog)),
              onRename: onRequestRename && (() => onRequestRename(dialog)),
              onCompact: onRequestCompact && (() => onRequestCompact(dialog)),
              onArchive: onRequestArchive && (() => onRequestArchive(dialog)),
            })
          }
        />
      </section>

      {/* Uncontrolled only. A host that controls `searchOpen` renders
          `MingoChatSearchModal` once itself: a sidebar section is drawn twice
          (the sidebar and the phone drawer), and each would open its own. */}
      {searchOpenProp === undefined && onSearchChange && (
        <MingoChatSearchModal
          {...listProps}
          open={showSearch}
          onOpenChange={setSearchOpen}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSelectDialog={onSelectDialog}
        />
      )}
    </TooltipProvider>
  );
}

export interface MingoChatSearchModalProps extends Pick<
  MingoChatListProps,
  | 'dialogs'
  | 'activeDialogId'
  | 'statusOf'
  | 'ownedByOther'
  | 'currentUserId'
  | 'hasMore'
  | 'isLoadingMore'
  | 'onLoadMore'
  | 'isLoadingHistory'
  | 'loadError'
  | 'onRetry'
  | 'searchQuery'
  | 'onSelectDialog'
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (term: string) => void;
}

/**
 * The chat search of the sidebar's history: the design system's modal with its
 * `SearchInput`, focused on open, and the host's list under it — filtered by the
 * term, which goes to the host 300ms after typing stops (at once on Enter or when
 * emptied). Picking a chat opens it and closes the search; Escape and × close it.
 * Closing clears the term, so the sidebar never stays filtered behind it.
 *
 * Over the window (portalled to `<body>`): the phone drawer slides the sidebar
 * in with a transform, which would hold a fixed modal inside it. Render it once
 * per page — `MingoChatRail variant="section"` renders its own only while it
 * keeps the search state itself.
 */
export function MingoChatSearchModal({
  open,
  onOpenChange,
  searchQuery,
  onSearchChange,
  onSelectDialog,
  ...listProps
}: MingoChatSearchModalProps) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <SearchModalContent initialValue={searchQuery} onSearchChange={onSearchChange} onClose={() => onOpenChange(false)}>
      <HistoryList
        {...listProps}
        hasSearch={!!searchQuery?.trim()}
        onSelect={id => {
          onOpenChange(false);
          if (searchQuery?.trim()) onSearchChange('');
          onSelectDialog?.(id);
        }}
      />
    </SearchModalContent>,
    document.body,
  );
}

interface SearchModalContentProps {
  initialValue?: string;
  onSearchChange: (term: string) => void;
  onClose: () => void;
  children: ReactNode;
}

function SearchModalContent({ initialValue, onSearchChange, onClose, children }: SearchModalContentProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const debounced = useDebounce(value, 300);
  const lastSent = useRef(initialValue ?? '');
  const fieldRef = useRef<HTMLDivElement>(null);

  const send = (term: string) => {
    if (term === lastSent.current) return;
    lastSent.current = term;
    onSearchChange(term);
  };

  useEffect(() => {
    if (debounced === lastSent.current) return;
    lastSent.current = debounced;
    onSearchChange(debounced);
  }, [debounced, onSearchChange]);

  // Opened on an explicit click or ⌘K: the field is what the user asked for. A
  // frame late, after the modal has taken focus into its panel.
  useEffect(() => {
    const frame = requestAnimationFrame(() => fieldRef.current?.querySelector('input')?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = () => {
    send('');
    onClose();
  };

  return (
    <ModalV2 isOpen onClose={close} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Search chats</ModalV2Title>
      </ModalV2Header>
      <div ref={fieldRef} role="search" aria-label="Search chats" className="w-full">
        <SearchInput
          value={value}
          onChange={setValue}
          onSubmit={send}
          placeholder="Search for Chats"
          showDropdown={false}
        />
      </div>
      <div className="max-h-[min(480px,55vh)] w-full overflow-y-auto">{children}</div>
    </ModalV2>
  );
}

function DayGroup({
  label,
  children,
  density = 'default',
  labelHidden = false,
}: {
  label: string;
  children: ReactNode;
  density?: 'default' | 'compact';
  /** The caption above already names the day: the label is for assistive tech only. */
  labelHidden?: boolean;
}) {
  const labelId = useId();
  return (
    // A day that arrives with a page (or replaces the placeholder) fades in rather than popping.
    <div
      role="group"
      aria-labelledby={labelId}
      className={cn(
        'flex shrink-0 flex-col duration-300 animate-in fade-in motion-reduce:animate-none',
        density === 'compact' && 'gap-[var(--spacing-system-xxs)]',
      )}
    >
      <p
        id={labelId}
        className={cn(
          'px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)]',
          labelHidden && 'sr-only',
          density === 'compact'
            ? 'px-[var(--spacing-system-xsf)] py-0 text-ods-text-panel-secondary text-h5'
            : 'text-ods-text-secondary text-h6',
        )}
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
  density?: 'default' | 'compact';
}

/**
 * One chat: the design system's `ChatListItem` (Figma `chat-list-item`, the v2
 * rail's row) — the title, then what the row has to say at its end: the status
 * glyph and, for someone else's chat, the owner's avatar. The ⋯ menu takes that
 * place on hover or keyboard focus, so the title never reflows.
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
  density = 'default',
}: SectionRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasMenu = menuItems.length > 0;
  const glyph = status ? MINGO_DIALOG_STATUS_GLYPHS[status] : undefined;

  return (
    // A row that lands in a day already on screen (the next page) fades in too.
    <div className="group/row relative shrink-0 duration-300 animate-in fade-in motion-reduce:animate-none">
      <ChatListItem
        active={active}
        size={density}
        title={title}
        tabIndex={dialog ? undefined : -1}
        onClick={dialog ? () => onSelect?.(dialog.id) : undefined}
        className={cn(
          'transition-colors duration-150',
          !active && 'hover:bg-ods-bg-hover',
          !dialog && 'cursor-default',
        )}
        // Held for the ⋯ even when empty, so a title never runs under it.
        trailing={
          glyph || ownerName || hasMenu ? (
            <span
              className={cn(
                'flex min-w-6 items-center justify-end gap-[var(--spacing-system-xxs)] transition-opacity',
                hasMenu && 'group-hover/row:opacity-0 group-has-[:focus-visible]/row:opacity-0',
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
                  sizePx={24}
                  src={ownerAvatarUrl}
                  alt={ownerName}
                  fallback={ownerName}
                  initialsClassName="text-ods-text-secondary text-badge"
                />
              )}
            </span>
          ) : undefined
        }
      />
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
