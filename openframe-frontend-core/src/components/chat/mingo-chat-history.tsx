'use client';

import { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { Ellipsis01Icon, SearchXmarkIcon } from '../icons-v2-generated';
import { LoadingRegion } from '../loading/loading-region';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { ActionsMenuDropdown } from '../ui/actions-menu';
import { Button } from '../ui/button';
import { LoadingItems, loadingItemProps, useLoadingScope } from '../ui/loading-scope';
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade';
import { SquareAvatar } from '../ui/square-avatar';
import { chatDialogMenuItems } from './chat-dialog-menu-items';
import { ChatListEmptyState } from './chat-list-empty-state';
import { SKELETON_TITLE_WIDTHS } from './chat-nav-sidebar';
import { dialogTimestamp } from './mingo-chat-day-groups';
import { useLoadMoreSentinel } from './mingo-chat-list-shared';
import type { DialogItem } from './types/component.types';

/**
 * The lib's own conversation page: what its dialog readers request (the NATS adapter's `dialogsPageSize` default and
 * the archive's fetch), and so what a history list's loading state draws when its host names no page size. A host
 * that pages its list differently passes its page size (`pageSize`, `EmbeddableChat`'s `historyPageSize`), so the
 * loading state draws exactly one page.
 */
export const CHAT_HISTORY_PAGE_SIZE = 20;

/** The list's layout, read by the loaded groups and by the loading state, so both are one size. */
const HISTORY_GROUP_CLASS = 'flex flex-col gap-[var(--spacing-system-xxs)]';
const HISTORY_GROUP_LABEL_CLASS = 'text-ods-text-secondary text-h5';
const HISTORY_GROUP_BOX_CLASS = 'overflow-hidden rounded-md border border-ods-border';
const HISTORY_ROW_CLASS = 'flex h-12 items-center border-b border-ods-border last:border-b-0';
const HISTORY_ROW_CONTENT_CLASS = 'p-[var(--spacing-system-s)]';

/** Date groups the loading state draws: the typical history, recent chats over older ones. */
const HISTORY_SKELETON_GROUPS = 2;

// =============================================================================
// Types
// =============================================================================

export interface MingoChatHistoryProps {
  /** Dialogs to list, assumed already sorted newest-first by the host. */
  dialogs: ReadonlyArray<DialogItem>;
  /** Currently-open dialog id (highlighted). */
  activeDialogId?: string;
  /** Open a dialog. */
  onSelectDialog?: (id: string) => void;
  /** Request rename — enables the row "Rename Chat" action. The host opens
   *  the Rename modal; the list does no inline editing. */
  onRequestRename?: (dialog: DialogItem) => void;
  /** Request archive — enables the row "Archive Chat" action. The host opens
   *  the Archive confirmation modal. */
  onRequestArchive?: (dialog: DialogItem) => void;
  /** Request a shareable link — enables the row "Copy Chat Link" action. The host
   *  owns the URL shape and the copy itself (the list knows neither the app's
   *  routes nor whether a clipboard is available). */
  onRequestCopyLink?: (dialog: DialogItem) => void;
  /** Request context compaction — enables the row "Compact Chat Memory" action. */
  onRequestCompact?: (dialog: DialogItem) => void;
  /** Current server-side search term. Drives the "No chats found" empty state;
   *  the search INPUT lives in the panel header, not in this list. The host
   *  owns the term and refetches server-side — the list does no filtering. */
  searchQuery?: string;
  /** Whether more dialogs remain (cursor pagination). */
  hasMore?: boolean;
  /** True while the next page is loading. */
  isLoadingMore?: boolean;
  /** Fetch the next page — fired when the bottom sentinel scrolls into view. */
  onLoadMore?: () => void;
  /** The first page is still loading: the list draws its own loading state (one page of rows). Inside a
   *  `LoadingScope` it does so whatever this says. */
  loading?: boolean;
  /** The host's page size: how many rows the loading state draws. Default {@link CHAT_HISTORY_PAGE_SIZE}. */
  pageSize?: number;
  /** Appended to the root element. */
  className?: string;
}

interface DialogGroup {
  key: string;
  label: string;
  items: DialogItem[];
}

// =============================================================================
// Date grouping — Today / Yesterday / Older
// =============================================================================

function groupDialogs(dialogs: ReadonlyArray<DialogItem>): DialogGroup[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const today: DialogItem[] = [];
  const yesterday: DialogItem[] = [];
  const older: DialogItem[] = [];
  for (const d of dialogs) {
    const t = dialogTimestamp(d);
    if (t !== null && t >= startOfToday) today.push(d);
    else if (t !== null && t >= startOfYesterday) yesterday.push(d);
    else older.push(d); // includes timestamp-less dialogs
  }

  return [
    { key: 'today', label: 'Today', items: today },
    { key: 'yesterday', label: 'Yesterday', items: yesterday },
    { key: 'older', label: 'Older', items: older },
  ].filter(g => g.items.length > 0);
}

// =============================================================================
// Row
// =============================================================================

interface RowProps {
  /** Absent while `loading`: the loading row needs no data. */
  dialog?: DialogItem;
  isActive?: boolean;
  /** The dialog is still being read: the SAME row, its title slot a bar (no unread badge, no trailing cell: both are
   *  read data most rows do not have). */
  loading?: boolean;
  /** The loading row's place in the list: picks its title bar's width. */
  skeletonIndex?: number;
  onSelect?: (id: string) => void;
  onRequestRename?: (dialog: DialogItem) => void;
  onRequestCopyLink?: (dialog: DialogItem) => void;
  onRequestCompact?: (dialog: DialogItem) => void;
  onRequestArchive?: (dialog: DialogItem) => void;
}

function MingoChatHistoryRow({
  dialog,
  isActive = false,
  loading: loadingProp = false,
  skeletonIndex = 0,
  onSelect,
  onRequestCopyLink,
  onRequestRename,
  onRequestCompact,
  onRequestArchive,
  ...props
}: RowProps & { [key: `data-${string}`]: unknown }) {
  // ONE switch: a row with no dialog yet is a loading row.
  const loading = useLoadingScope() || loadingProp || !dialog;
  const title = dialog?.title || 'Untitled Chat';
  const unread = dialog?.unreadMessagesCount ?? 0;
  const hasMenu = !loading && (!!onRequestRename || !!onRequestArchive || !!onRequestCopyLink || !!onRequestCompact);
  const owner = dialog?.owner;
  const hasAvatar = !loading && !!(owner?.name || owner?.avatarUrl);
  // Keep the `⋯` visible while its menu is open — once Radix moves focus into
  // the portalled content the row loses hover/focus-within.
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = dialog
    ? chatDialogMenuItems({
        onCopyLink: onRequestCopyLink && (() => onRequestCopyLink(dialog)),
        onRename: onRequestRename && (() => onRequestRename(dialog)),
        onCompact: onRequestCompact && (() => onRequestCompact(dialog)),
        onArchive: onRequestArchive && (() => onRequestArchive(dialog)),
      })
    : [];
  const select = () => dialog && onSelect?.(dialog.id);

  // The item is the full-width row (inside the group's bordered box). Padding
  // lives on the inner content button (badge + title) only — the `⋯` is a
  // SIBLING of that padded content, so it sits at the item's right edge, inside
  // the item but outside its padded content area.
  return (
    <div
      {...loadingItemProps(props)}
      aria-hidden={loading || undefined}
      className={cn(
        HISTORY_ROW_CLASS,
        'group/row relative transition-colors',
        // Active (selected) dialog — Figma 259:91610: an accent-secondary
        // fill, a 4px accent bar down the leading edge, and accent-colored
        // title text. Inactive rows keep the dark surface with a hover tint.
        isActive ? 'bg-ods-accent-secondary' : cn('bg-ods-bg', !loading && 'hover:bg-ods-bg-hover'),
      )}
    >
      {isActive ? (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-ods-accent" />
      ) : null}
      <div
        role={loading ? undefined : 'button'}
        tabIndex={loading ? undefined : 0}
        onClick={loading ? undefined : select}
        onKeyDown={
          loading
            ? undefined
            : e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  select();
                }
              }
        }
        className={cn(
          HISTORY_ROW_CONTENT_CLASS,
          'flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xsf)]',
          !loading &&
            'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent',
        )}
      >
        {loading ? (
          <TextLineSkeleton type="h4" className={SKELETON_TITLE_WIDTHS[skeletonIndex % SKELETON_TITLE_WIDTHS.length]} />
        ) : null}
        {!loading && unread > 0 ? (
          <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)] text-ods-text-on-accent text-h5">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
        {loading ? null : (
          <span
            className={cn('min-w-0 flex-1 truncate text-h4', isActive ? 'text-ods-accent' : 'text-ods-text-primary')}
            title={title}
          >
            {title}
          </span>
        )}
      </div>
      {hasMenu || hasAvatar ? (
        // Trailing 48px cell (Figma 113:63224): the owner avatar sits centred
        // by default; hovering the row (or opening the menu) swaps it for the
        // `⋯` actions button IN PLACE, so the title never reflows. Without an
        // avatar the cell exists only for the hover menu, so it collapses on
        // mobile exactly like the old hover-only gutter (no hover on touch).
        <span className={cn('relative w-12 shrink-0 self-stretch', !hasAvatar && 'max-md:hidden')}>
          {hasMenu ? (
            // Revealed on row hover/its own focus; kept visible while the menu
            // is open. Hidden on mobile — it's a hover affordance. `peer/menu`
            // so the avatar layer (a later sibling) can fade when the trigger
            // holds keyboard focus.
            <span
              onClick={e => e.stopPropagation()}
              className={cn(
                'peer/menu absolute inset-0 transition-opacity max-md:hidden',
                menuOpen ? 'opacity-100' : 'opacity-0 focus-within:opacity-100 group-hover/row:opacity-100',
              )}
            >
              <ActionsMenuDropdown
                triggerAriaLabel="Chat actions"
                groups={[{ items: menuItems }]}
                open={menuOpen}
                onOpenChange={setMenuOpen}
                // Don't return focus (and its ring) to the `⋯` trigger on close.
                onCloseAutoFocus={e => e.preventDefault()}
                customTrigger={
                  <Button
                    variant="transparent"
                    size="icon"
                    aria-label="Chat actions"
                    // Square, grey icon → white on hover. `h-full`/`w-full` fill
                    // the 48px cell exactly (no breakpoint poke from
                    // `size="icon"`'s responsive `md:h-12`); `p-0` drops the
                    // icon-size padding. tailwind-merge so these win over
                    // defaults.
                    className="h-full w-full rounded-none p-0 text-ods-text-secondary hover:text-ods-text-primary md:h-full"
                  >
                    <Ellipsis01Icon />
                  </Button>
                }
              />
            </span>
          ) : null}
          {hasAvatar ? (
            // Avatar layer — clicks fall through to row selection (it covers
            // the cell whenever the menu trigger is faded out). On desktop it
            // fades for the menu swap; on mobile it's always shown.
            <span
              onClick={select}
              title={owner?.name || undefined}
              className={cn(
                'absolute inset-0 flex cursor-pointer items-center justify-center transition-opacity',
                hasMenu &&
                  (menuOpen
                    ? 'pointer-events-none opacity-0'
                    : 'md:group-hover/row:pointer-events-none md:group-hover/row:opacity-0 md:peer-[:focus-within]/menu:pointer-events-none md:peer-[:focus-within]/menu:opacity-0'),
              )}
            >
              <SquareAvatar
                variant="round"
                sizePx={24}
                src={owner?.avatarUrl || undefined}
                alt={owner?.name || undefined}
                fallback={owner?.name || undefined}
                initialsClassName="text-[10px] text-ods-text-secondary"
              />
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

/**
 * The history's loading state, shaped like the loaded list: the typical two date groups, each a group label over a
 * bordered box of rows, one page of rows across them (`rows`, the host's page size), each the row itself in its loading
 * form (`MingoChatHistoryRow loading`). Drawn by `MingoChatHistory` itself (`loading`, or inside a `LoadingScope`).
 */
function MingoChatHistorySkeleton({ rows, className }: { rows: number; className?: string }) {
  const perGroup = Math.ceil(rows / HISTORY_SKELETON_GROUPS);
  const groups = Array.from({ length: HISTORY_SKELETON_GROUPS }, (_, group) =>
    Math.max(0, Math.min(perGroup, rows - group * perGroup)),
  ).filter(count => count > 0);
  return (
    <LoadingRegion
      label="Loading conversations"
      // `overflow-hidden` clips the page of rows to the flex-1 box (the loaded list scrolls; the loading state stays
      // within bounds).
      className={cn('flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)] overflow-hidden', className)}
    >
      {groups.map((count, group) => (
        <div key={group} className={cn(HISTORY_GROUP_CLASS, 'shrink-0')}>
          {/* Group label (Today / Yesterday / Older): read from the dialogs' dates. */}
          <TextLineSkeleton type="h5" className="w-16" />
          <div className={HISTORY_GROUP_BOX_CLASS}>
            <LoadingItems count={count}>
              {i => <MingoChatHistoryRow loading data-loading-item skeletonIndex={group * perGroup + i} />}
            </LoadingItems>
          </div>
        </div>
      ))}
    </LoadingRegion>
  );
}

// =============================================================================
// Component
// =============================================================================

/**
 * MingoChatHistory — Figma node `7532:223950`.
 *
 * The returning-user variation of the Mingo empty state: the dialog history
 * rendered inline in the main panel, grouped into Today / Yesterday / Older
 * sections. Each row shows an optional unread badge, the title, and a `⋯`
 * menu (Rename / Archive — each gated on the matching handler and surfaced as
 * a request the host fulfils via a modal). Owns its own scroll + bottom/top
 * fade and an infinite-scroll
 * sentinel that fires `onLoadMore`. While its first page loads (`loading`, or
 * inside a `LoadingScope`) it draws its own skeleton: one page of rows.
 */
export function MingoChatHistory({
  dialogs,
  activeDialogId,
  onSelectDialog,
  onRequestCopyLink,
  onRequestRename,
  onRequestCompact,
  onRequestArchive,
  searchQuery,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  loading = false,
  pageSize = CHAT_HISTORY_PAGE_SIZE,
  className,
}: MingoChatHistoryProps) {
  // ONE switch: the first page loading (or the page's loading state) draws one page of skeleton rows.
  const isLoading = useLoadingScope() || loading;
  const groups = useMemo(() => groupDialogs(dialogs), [dialogs]);
  const noSearchResults = groups.length === 0 && !!searchQuery?.trim();

  // Scroll-fade affordances — shared ui/scroll-fade (re-measures on resize
  // and content mutations, so no manual `dialogs` dependency is needed).
  const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>();

  // Infinite scroll — load the next page when the sentinel enters the
  // scroll viewport.
  const sentinelRef = useLoadMoreSentinel({
    hasMore,
    isLoadingMore,
    onLoadMore,
    itemCount: dialogs.length,
    rootRef: scrollRef,
  });

  if (isLoading) return <MingoChatHistorySkeleton rows={pageSize} className={className} />;

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)]', className)}>
      {/* Scroll region — the search INPUT now lives in the panel header
          (Figma 116:51217), so the list is just the grouped rows + fades. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={updateFade}
          className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-m)] overflow-y-auto overscroll-contain"
        >
          {noSearchResults ? (
            // No search matches — same centred glyph + title + caption layout as
            // the other chat-list empty states (Figma 113:60939).
            <ChatListEmptyState
              icon={<SearchXmarkIcon size={24} />}
              title="No Chats Found"
              description="Try a different search term"
            />
          ) : (
            groups.map(group => (
              <div key={group.key} className={HISTORY_GROUP_CLASS}>
                <p className={HISTORY_GROUP_LABEL_CLASS}>{group.label}</p>
                <div className={HISTORY_GROUP_BOX_CLASS}>
                  {group.items.map(dialog => (
                    <MingoChatHistoryRow
                      key={dialog.id}
                      data-loading-item
                      dialog={dialog}
                      isActive={dialog.id === activeDialogId}
                      onSelect={onSelectDialog}
                      onRequestCopyLink={onRequestCopyLink}
                      onRequestRename={onRequestRename}
                      onRequestCompact={onRequestCompact}
                      onRequestArchive={onRequestArchive}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
          {hasMore ? <div ref={sentinelRef} className="h-px shrink-0" /> : null}
        </div>

        {/* Scroll-fade — only while content is hidden in that direction. */}
        <ScrollFadeOverlay edge="top" visible={fadeTop} color="var(--color-bg-card)" className="h-12" />
        <ScrollFadeOverlay edge="bottom" visible={fadeBottom} color="var(--color-bg-card)" className="h-12" />
      </div>
    </div>
  );
}
