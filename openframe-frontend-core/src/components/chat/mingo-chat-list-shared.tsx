'use client';

import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import { AlertCircleIcon, MessageIndicatorIcon, Refresh01RightIcon, ShieldCheckIcon } from '../icons-v2-generated';
import type { ActionsMenuItem } from '../ui/actions-menu';
import { Button } from '../ui/button';
import type { DialogItem } from './types/component.types';

/** Ownership scope of a Mingo chat list: the current user's chats only, or
 *  every admin's chats in the tenant. */
export type MingoHistoryScope = 'my' | 'all';

/**
 * What a chat is doing, shown at the end of its row:
 * - `working`: Mingo is answering in it
 * - `unread`: a reply the user has not seen
 * - `approval`: Mingo waits for an approval there
 */
export type MingoDialogStatus = 'working' | 'unread' | 'approval';

/**
 * `DotsLoaderIcon` drawn as HTML boxes (`ods-dots-loader` in the ODS styles): same box,
 * dots and motion. A chat row shows it for as long as a reply streams, on every page,
 * and WebKit animates an SVG child on the main thread every frame — one row's icon kept
 * ~12% of a core busy; HTML boxes ~3% (2026-10-21).
 */
function WorkingDots({ className }: { className?: string }) {
  return (
    <span className={cn('ods-dots-loader', className)}>
      <span />
      <span />
      <span />
    </span>
  );
}

/** One glyph per status, for every Mingo chat list (the v2 rail, the sidebar section). */
export const MINGO_DIALOG_STATUS_GLYPHS: Record<MingoDialogStatus, { icon: ReactNode; label: string }> = {
  working: { icon: <WorkingDots className="text-ods-text-secondary" />, label: 'Mingo is working' },
  unread: { icon: <MessageIndicatorIcon className="text-ods-accent" />, label: 'New reply' },
  approval: { icon: <ShieldCheckIcon className="text-ods-accent" />, label: 'Waiting for approval' },
};

/**
 * The list both Mingo chat lists render — the v2 panel's rail and the main
 * sidebar's chat-history section (`MingoChatRail` `variant`). The host owns the
 * data, the scope, the search term and the paging; the list only shows them.
 */
export interface MingoChatListProps {
  /** Dialogs to list, newest first. */
  dialogs: ReadonlyArray<DialogItem>;
  activeDialogId?: string;
  onSelectDialog?: (id: string) => void;
  /** A chat being started and not saved yet: a selected row at the top
   *  (e.g. "New Chat"), so the list says what the chat beside it is. */
  draftTitle?: string;
  /** Open the archive. The rail lists it as an action; the section puts
   *  "Chat archive" in its ⋯ menu. */
  onOpenArchive?: () => void;
  /**
   * "What to ask Mingo?": the suggestions a chat starts from. The rail draws it as an
   * action under the logo, the section as an item of its ⋯ menu.
   */
  onWhatToAsk?: () => void;
  /**
   * The host's own actions at the end of the section's ⋯ menu, after "Chat archive" and
   * "What to ask Mingo?" (e.g. "Reset Onboarding"). The section only: the rail has no ⋯ of its own.
   */
  moreMenuItems?: ActionsMenuItem[];
  /** A row's status glyph. Unread replies are shown without it. */
  statusOf?: (dialog: DialogItem) => MingoDialogStatus | undefined;
  /** Row ⋯ menu actions — each item appears only when its handler is set. */
  onRequestRename?: (dialog: DialogItem) => void;
  onRequestArchive?: (dialog: DialogItem) => void;
  onRequestCopyLink?: (dialog: DialogItem) => void;
  onRequestCompact?: (dialog: DialogItem) => void;
  /** My Chats / All Chats; both or neither. The rail offers it in its ⋯
   *  menu, the section as a `TabSelector`. */
  scope?: MingoHistoryScope;
  onScopeChange?: (scope: MingoHistoryScope) => void;
  /** Server-side search: `searchQuery` is the host's term, `onSearchChange`
   *  receives the debounced input. Without a handler there is no search. */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Whether the search is open. Controlled with `onSearchOpenChange` (e.g. a
   *  host that opens it on ⌘K); without it the list keeps its own state, open
   *  from the start while `searchQuery` holds a term (the rail). The rail's is a
   *  field in its header; the section's is a modal — `MingoChatSearchModal`,
   *  which a host controlling this renders once itself. The section's Search
   *  tooltip names ⌘K / Ctrl K: binding that key is the host's (it may have to
   *  open a collapsed sidebar first), the list listens for none. */
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /**
   * How the section's list loads its next page: as its end scrolls into view
   * (`'scroll'`, the default), or on a "Show more" under it (`'button'`). The
   * search results and the rail always scroll.
   */
  loadMore?: 'scroll' | 'button';
  /** The first page is still loading: the list draws one page of loading rows. */
  isLoadingHistory?: boolean;
  /** The host's page size: how many rows the loading state draws. Default `CHAT_HISTORY_PAGE_SIZE`. */
  pageSize?: number;
  /** The list failed to load with nothing cached. */
  loadError?: boolean;
  onRetry?: () => void;
  /** Section only: the chat belongs to someone other than the viewer, so its
   *  row shows the owner's (`dialog.owner`) initials. The row cannot tell on
   *  its own: hosts set `owner` on the viewer's chats too. Wins over
   *  `currentUserId`. */
  ownedByOther?: (dialog: DialogItem) => boolean;
  /** Section only: the viewer's user id. Without `ownedByOther`, a chat whose
   *  `owner.id` is set and differs from it is someone else's; a chat with no
   *  `owner.id` is taken as the viewer's. */
  currentUserId?: string | null;
  className?: string;
}

/**
 * Whether a row is someone else's chat: the host's answer when it gives one
 * (`ownedByOther`), else `owner.id` against the viewer's id. Unknown = the
 * viewer's own, so no row shows a stranger's initials on a guess.
 */
export function dialogOwnedByOther(
  dialog: DialogItem,
  ownedByOther: ((dialog: DialogItem) => boolean) | undefined,
  currentUserId: string | null | undefined,
): boolean {
  if (ownedByOther) return ownedByOther(dialog);
  const ownerId = dialog.owner?.id;
  return !!currentUserId && !!ownerId && ownerId !== currentUserId;
}

/** The host's status for the row, else an unread reply when the row counts one. */
export function mingoDialogStatusOf(
  dialog: DialogItem,
  statusOf: ((dialog: DialogItem) => MingoDialogStatus | undefined) | undefined,
): MingoDialogStatus | undefined {
  return statusOf?.(dialog) ?? ((dialog.unreadMessagesCount ?? 0) > 0 ? 'unread' : undefined);
}

/**
 * "Couldn't load your chats" + Try again: what a Mingo chat list shows when its
 * first page failed with nothing cached. One block for every list, so the
 * wording cannot drift between them.
 */
export function ChatListLoadError({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-[var(--spacing-system-m)] text-center', className)}>
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
}

export interface LoadMoreSentinelOptions {
  /** Whether more rows remain (cursor pagination). */
  hasMore: boolean;
  /** True while the next page is loading: no second request meanwhile. */
  isLoadingMore: boolean;
  /** Fetch the next page. */
  onLoadMore?: () => void;
  /** Rows rendered so far: a landed page re-arms the observer. */
  itemCount: number;
  /**
   * The scrolling element the sentinel is clipped by. Omitted: the viewport —
   * which still clips by every scroll box between it and the sentinel, so a
   * list works whichever ancestor scrolls it (the sidebar's history section:
   * the sidebar body).
   */
  rootRef?: RefObject<HTMLElement | null>;
}

/**
 * How far ahead of the end of the list the next page starts loading: about a
 * screen of rows, so a reader scrolling at a normal pace never reaches the end
 * and never sees the placeholder. Below only — a list off to the side (the
 * closed phone drawer, translated out of view) must not count as near.
 */
const LOAD_AHEAD = '0px 0px 600px 0px';

/**
 * Infinite scroll for a chat list: put the returned ref on a 1px sentinel after
 * the last row (rendered only while `hasMore`), and `onLoadMore` fires when it
 * comes into view.
 */
export function useLoadMoreSentinel({
  hasMore,
  isLoadingMore,
  onLoadMore,
  itemCount,
  rootRef,
}: LoadMoreSentinelOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Refreshed in an unconditional effect, declared before the observer effect
  // so it wins the same flush. Not in the render body: the only reader is the
  // IntersectionObserver callback, which cannot fire before a commit, and a
  // discarded render attempt must not install a loading flag that never was.
  const onLoadMoreRef = useRef(onLoadMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
    isLoadingMoreRef.current = isLoadingMore;
  });
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef ? rootRef.current : null;
    if (!sentinel || (rootRef && !root) || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    // `rootMargin` grows the root only. `scrollMargin` grows every scroll box
    // between the sentinel and the root as well, so the page also loads ahead
    // inside a nested list; an engine without it ignores the key and loads
    // once the sentinel shows.
    const options: IntersectionObserverInit & { scrollMargin?: string } = {
      root,
      rootMargin: LOAD_AHEAD,
      scrollMargin: LOAD_AHEAD,
      threshold: 0.1,
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !isLoadingMoreRef.current) onLoadMoreRef.current?.();
    }, options);
    observer.observe(sentinel);
    return () => observer.disconnect();
    // `itemCount`/`isLoadingMore` re-arm the observer after every page lands:
    // `observe()` re-reports the CURRENT intersection, so a sentinel that stays
    // in view (a short page, e.g. the "My Chats" scope) keeps chaining loads
    // until the list fills its box or `hasMore` flips. A sentinel that never
    // leaves the view never re-crosses the threshold, so an observer armed once
    // would load a single page per mount.
  }, [hasMore, isLoadingMore, itemCount, rootRef]);
  return sentinelRef;
}
